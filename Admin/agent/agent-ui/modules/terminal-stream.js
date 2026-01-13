/**
 * Terminal Stream Module v1.0.0
 *
 * Connects to Terminal Bridge and displays Claude Code output
 * in the Command Center UI.
 */

const TerminalStream = (function() {
    'use strict';

    let ws = null;
    let isConnected = false;
    let outputBuffer = [];
    let containerEl = null;
    let outputEl = null;

    const config = {
        wsUrl: `ws://${location.hostname}:8701`,
        maxLines: 200,
        autoScroll: true,
        reconnectDelay: 3000
    };

    // ==================== WEBSOCKET ====================

    function connect() {
        if (ws && ws.readyState === WebSocket.OPEN) return;

        console.log('[TerminalStream] Connecting to', config.wsUrl);

        try {
            ws = new WebSocket(config.wsUrl);
        } catch (err) {
            console.error('[TerminalStream] Failed to create WebSocket:', err);
            setTimeout(connect, config.reconnectDelay);
            return;
        }

        ws.onopen = () => {
            console.log('[TerminalStream] Connected');
            isConnected = true;
            updateStatus('connected');
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleMessage(msg);
            } catch (err) {
                console.error('[TerminalStream] Parse error:', err);
            }
        };

        ws.onclose = () => {
            console.log('[TerminalStream] Disconnected');
            isConnected = false;
            updateStatus('disconnected');
            setTimeout(connect, config.reconnectDelay);
        };

        ws.onerror = (err) => {
            console.error('[TerminalStream] WebSocket error:', err);
            updateStatus('error');
        };
    }

    function handleMessage(msg) {
        switch (msg.type) {
            case 'init':
                // Received initial buffer
                outputBuffer = msg.buffer || [];
                renderBuffer();
                break;

            case 'output':
                // New output entry
                appendEntry(msg.entry);
                break;

            case 'buffer':
                outputBuffer = msg.buffer || [];
                renderBuffer();
                break;

            case 'clear':
                outputBuffer = [];
                if (outputEl) outputEl.innerHTML = '';
                break;
        }
    }

    // ==================== RENDERING ====================

    function createUI() {
        // Check if container exists in the dashboard
        containerEl = document.getElementById('terminal-stream-container');

        if (!containerEl) {
            // Create floating panel if no container
            containerEl = document.createElement('div');
            containerEl.id = 'terminal-stream-panel';
            containerEl.className = 'terminal-stream-panel';
            containerEl.innerHTML = `
                <div class="ts-header">
                    <div class="ts-title">
                        <span class="ts-icon">💻</span>
                        <span>Claude Terminal</span>
                        <span class="ts-status" id="ts-status">●</span>
                    </div>
                    <div class="ts-controls">
                        <button class="ts-btn" onclick="TerminalStream.clear()" title="Clear">🗑</button>
                        <button class="ts-btn" onclick="TerminalStream.toggleMinimize()" title="Minimize">─</button>
                        <button class="ts-btn" onclick="TerminalStream.hide()" title="Close">✕</button>
                    </div>
                </div>
                <div class="ts-body">
                    <div class="ts-output" id="ts-output"></div>
                </div>
            `;
            document.body.appendChild(containerEl);
            addStyles();
        }

        outputEl = document.getElementById('ts-output') || containerEl.querySelector('.ts-output');
    }

    function addStyles() {
        if (document.getElementById('terminal-stream-styles')) return;

        const style = document.createElement('style');
        style.id = 'terminal-stream-styles';
        style.textContent = `
            .terminal-stream-panel {
                position: fixed;
                bottom: 20px;
                left: 240px;
                width: 500px;
                height: 300px;
                background: #0d0d14;
                border: 1px solid #4a9eff;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                z-index: 10000;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                font-family: 'JetBrains Mono', 'Consolas', monospace;
                resize: both;
                overflow: hidden;
            }
            .terminal-stream-panel.hidden {
                display: none;
            }
            .terminal-stream-panel.minimized {
                height: 40px;
                resize: none;
            }
            .terminal-stream-panel.minimized .ts-body {
                display: none;
            }
            .ts-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: #1a1a2e;
                border-bottom: 1px solid #333;
                cursor: move;
            }
            .ts-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                font-weight: 600;
                color: #e0e0e0;
            }
            .ts-icon { font-size: 16px; }
            .ts-status {
                font-size: 10px;
                color: #666;
            }
            .ts-status.connected { color: #22c55e; }
            .ts-status.disconnected { color: #ef4444; }
            .ts-controls {
                display: flex;
                gap: 4px;
            }
            .ts-btn {
                background: rgba(255,255,255,0.1);
                border: none;
                color: #aaa;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            .ts-btn:hover {
                background: rgba(255,255,255,0.2);
                color: #fff;
            }
            .ts-body {
                flex: 1;
                overflow: hidden;
            }
            .ts-output {
                height: 100%;
                padding: 8px 12px;
                overflow-y: auto;
                font-size: 11px;
                line-height: 1.4;
                color: #e0e0e0;
            }
            .ts-entry {
                margin-bottom: 4px;
                padding: 4px 8px;
                border-radius: 4px;
                background: rgba(255,255,255,0.03);
            }
            .ts-entry-time {
                color: #666;
                font-size: 10px;
                margin-right: 8px;
            }
            .ts-entry-tool {
                color: #4a9eff;
                font-weight: 500;
            }
            .ts-entry-content {
                color: #e0e0e0;
                white-space: pre-wrap;
                word-break: break-word;
            }
            .ts-entry.type-error .ts-entry-content {
                color: #ef4444;
            }
            .ts-entry.type-system .ts-entry-content {
                color: #4a9eff;
                font-style: italic;
            }

            /* Inline version for dashboard card */
            .card-terminal-stream .ts-output {
                max-height: 180px;
            }
        `;
        document.head.appendChild(style);
    }

    function renderBuffer() {
        if (!outputEl) return;

        outputEl.innerHTML = outputBuffer.map(entry => formatEntry(entry)).join('');
        scrollToBottom();
    }

    function appendEntry(entry) {
        if (!entry) return;

        outputBuffer.push(entry);

        // Trim buffer
        while (outputBuffer.length > config.maxLines) {
            outputBuffer.shift();
        }

        if (outputEl) {
            outputEl.insertAdjacentHTML('beforeend', formatEntry(entry));
            scrollToBottom();
        }
    }

    function formatEntry(entry) {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const typeClass = entry.type ? `type-${entry.type}` : '';
        const toolBadge = entry.tool ? `<span class="ts-entry-tool">[${entry.tool}]</span> ` : '';

        return `
            <div class="ts-entry ${typeClass}">
                <span class="ts-entry-time">${time}</span>
                ${toolBadge}
                <span class="ts-entry-content">${escapeHtml(entry.content || '')}</span>
            </div>
        `;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function scrollToBottom() {
        if (config.autoScroll && outputEl) {
            outputEl.scrollTop = outputEl.scrollHeight;
        }
    }

    function updateStatus(status) {
        const el = document.getElementById('ts-status');
        if (el) {
            el.className = 'ts-status ' + status;
        }
    }

    // ==================== CONTROLS ====================

    function show() {
        createUI();
        containerEl?.classList.remove('hidden');
        connect();
    }

    function hide() {
        containerEl?.classList.add('hidden');
    }

    function toggle() {
        if (!containerEl || containerEl.classList.contains('hidden')) {
            show();
        } else {
            hide();
        }
    }

    function toggleMinimize() {
        containerEl?.classList.toggle('minimized');
    }

    function clear() {
        outputBuffer = [];
        if (outputEl) outputEl.innerHTML = '';
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'clear' }));
        }
    }

    // ==================== INIT ====================

    function init() {
        console.log('[TerminalStream] Initialized');
        // Auto-connect if container exists
        if (document.getElementById('terminal-stream-container')) {
            createUI();
            connect();
        }
    }

    // ==================== PUBLIC API ====================

    return {
        init,
        show,
        hide,
        toggle,
        toggleMinimize,
        clear,
        connect,
        get isConnected() { return isConnected; }
    };
})();

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    TerminalStream.init();
});

window.TerminalStream = TerminalStream;
