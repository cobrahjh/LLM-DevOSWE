/**
 * Console Capture - Copy console output to textarea and send to Hive
 * Hotkey: Ctrl+Shift+L (Log Viewer)
 */

const ConsoleCapture = (function() {
    'use strict';

    let panel = null;
    let visible = false;
    let logs = [];
    const MAX_LOGS = 1000;

    // Intercept console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    function captureLog(level, args) {
        const timestamp = new Date().toLocaleTimeString();
        const message = Array.from(args).map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch(e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        logs.push({ timestamp, level, message });
        if (logs.length > MAX_LOGS) logs.shift();

        if (visible && panel) {
            updateLogDisplay();
        }
    }

    // Override console methods
    console.log = function(...args) {
        originalLog.apply(console, args);
        captureLog('log', args);
    };

    console.error = function(...args) {
        originalError.apply(console, args);
        captureLog('error', args);
    };

    console.warn = function(...args) {
        originalWarn.apply(console, args);
        captureLog('warn', args);
    };

    console.info = function(...args) {
        originalInfo.apply(console, args);
        captureLog('info', args);
    };

    async function loadActiveSessions() {
        try {
            // Try proxy endpoint first (same-origin, no CORS), fallback to direct relay
            let response, data;
            try {
                response = await fetch('/api/relay/consumers');
                data = await response.json();
            } catch (proxyErr) {
                console.warn('[ConsoleCapture] Proxy failed, trying direct relay:', proxyErr);
                response = await fetch('http://192.168.1.192:8600/api/consumers');
                data = await response.json();
            }

            // Get only online consumers
            const onlineConsumers = data.consumers.filter(c => c.isOnline);

            return onlineConsumers.map(c => ({
                id: c.id,
                name: c.name,
                lastSeen: c.lastSeenAgo
            }));
        } catch (err) {
            console.warn('[ConsoleCapture] Could not load active sessions:', err);
            return [];
        }
    }

    async function populateSessionDropdown() {
        const select = document.getElementById('cc-session-select');
        if (!select) return;

        const sessions = await loadActiveSessions();

        // Clear existing options except the static ones
        select.innerHTML = `
            <option value="default">Default (any available)</option>
            <option value="this">This Session (Current Claude)</option>
        `;

        // Add active Claude sessions
        if (sessions.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = '🟢 Active Claude Sessions';

            sessions.forEach(session => {
                const option = document.createElement('option');
                option.value = session.id;
                option.textContent = `${session.name} (${session.lastSeen})`;
                optgroup.appendChild(option);
            });

            select.appendChild(optgroup);
        }

        // Add custom option at the end
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'Custom Session ID...';
        select.appendChild(customOption);
    }

    function createPanel() {
        panel = document.createElement('div');
        panel.id = 'console-capture-panel';

        // Setup session selector change handler and load sessions
        setTimeout(async () => {
            const select = document.getElementById('cc-session-select');
            const customInput = document.getElementById('cc-custom-session');
            if (select && customInput) {
                select.addEventListener('change', (e) => {
                    customInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
                });

                // Load active sessions into dropdown
                await populateSessionDropdown();
            }
        }, 100);

        panel.innerHTML = `
            <div class="cc-header">
                <span>📋 Console Logs</span>
                <div class="cc-controls">
                    <button onclick="ConsoleCapture.clear()" title="Clear logs">🗑️</button>
                    <button onclick="ConsoleCapture.copyAll()" title="Copy all">📋</button>
                    <button onclick="ConsoleCapture.sendToHive()" title="Send to Hive">🚀</button>
                    <button onclick="ConsoleCapture.toggle()">×</button>
                </div>
            </div>
            <div class="cc-content">
                <div class="cc-logs" id="cc-logs"></div>
                <div class="cc-textarea-section">
                    <div class="cc-label">
                        <span>📝 Edit & Send to Hive:</span>
                        <button onclick="ConsoleCapture.copyFromLogs()" class="cc-small-btn">Copy from logs above</button>
                    </div>
                    <textarea id="cc-textarea" placeholder="Paste console output or debug results here..."></textarea>
                    <div class="cc-session-selector">
                        <label for="cc-session-select">🎯 Target Session:</label>
                        <select id="cc-session-select">
                            <option value="default">Default (any available)</option>
                            <option value="this">This Session (Current Claude)</option>
                            <option value="custom">Custom Session ID...</option>
                        </select>
                        <button onclick="ConsoleCapture.refreshSessions()" class="cc-small-btn" style="margin-left:8px;">🔄</button>
                        <input type="text" id="cc-custom-session" placeholder="Enter session ID" style="display:none;">
                    </div>
                    <div class="cc-actions">
                        <button onclick="ConsoleCapture.sendTextareaToHive()" class="cc-send-btn">🚀 Send to Hive</button>
                        <button onclick="ConsoleCapture.copyTextarea()" class="cc-copy-btn">📋 Copy</button>
                        <button onclick="document.getElementById('cc-textarea').value=''" class="cc-clear-btn">Clear</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        addStyles();
        updateLogDisplay();
    }

    function addStyles() {
        if (document.getElementById('console-capture-styles')) return;

        const style = document.createElement('style');
        style.id = 'console-capture-styles';
        style.textContent = `
            #console-capture-panel {
                position: fixed;
                top: 50%;
                right: 20px;
                transform: translateY(-50%);
                width: 450px;
                max-height: 80vh;
                background: #1a1a2e;
                border: 1px solid #4a9eff;
                border-radius: 12px;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 12px;
                color: #e0e0e0;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            }

            .cc-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 14px;
                background: #2a2a3e;
                border-radius: 12px 12px 0 0;
                border-bottom: 1px solid #333;
                font-weight: bold;
                color: #4a9eff;
            }

            .cc-controls {
                display: flex;
                gap: 6px;
            }

            .cc-controls button {
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                font-size: 14px;
                padding: 4px 8px;
                border-radius: 4px;
                transition: all 0.2s;
            }

            .cc-controls button:hover {
                background: #3a3a4e;
                color: #fff;
            }

            .cc-content {
                display: flex;
                flex-direction: column;
                flex: 1;
                overflow: hidden;
            }

            .cc-logs {
                flex: 1;
                overflow-y: auto;
                padding: 10px;
                max-height: 250px;
                background: #0f0f1a;
                border-bottom: 1px solid #333;
            }

            .cc-log-entry {
                padding: 6px 8px;
                margin: 2px 0;
                border-radius: 4px;
                border-left: 3px solid;
                font-family: 'Consolas', monospace;
                font-size: 11px;
                word-break: break-word;
            }

            .cc-log-entry.log { border-left-color: #4a9eff; background: rgba(74, 158, 255, 0.05); }
            .cc-log-entry.error { border-left-color: #ef4444; background: rgba(239, 68, 68, 0.05); color: #ff6b6b; }
            .cc-log-entry.warn { border-left-color: #f59e0b; background: rgba(245, 158, 11, 0.05); color: #fbbf24; }
            .cc-log-entry.info { border-left-color: #22c55e; background: rgba(34, 197, 94, 0.05); color: #86efac; }

            .cc-timestamp {
                color: #666;
                font-size: 10px;
                margin-right: 8px;
            }

            .cc-textarea-section {
                padding: 12px;
                background: #1a1a2e;
            }

            .cc-label {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                color: #4a9eff;
                font-size: 12px;
                font-weight: bold;
            }

            .cc-small-btn {
                background: #2a2a3e;
                border: 1px solid #444;
                color: #ccc;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 10px;
            }

            .cc-small-btn:hover {
                background: #3a3a4e;
                color: #fff;
            }

            #cc-textarea {
                width: 100%;
                min-height: 120px;
                background: #0f0f1a;
                border: 1px solid #444;
                border-radius: 6px;
                color: #e0e0e0;
                padding: 10px;
                font-family: 'Consolas', monospace;
                font-size: 11px;
                resize: vertical;
                box-sizing: border-box;
            }

            #cc-textarea:focus {
                outline: none;
                border-color: #4a9eff;
            }

            .cc-session-selector {
                margin: 10px 0;
                padding: 10px;
                background: #0f0f1a;
                border-radius: 6px;
                border: 1px solid #333;
            }

            .cc-session-selector label {
                display: block;
                color: #888;
                font-size: 11px;
                margin-bottom: 6px;
            }

            #cc-session-select {
                width: 100%;
                padding: 8px;
                background: #1a1a2e;
                border: 1px solid #444;
                border-radius: 4px;
                color: #e0e0e0;
                font-family: 'Consolas', monospace;
                font-size: 11px;
            }

            #cc-custom-session {
                width: 100%;
                margin-top: 6px;
                padding: 8px;
                background: #1a1a2e;
                border: 1px solid #444;
                border-radius: 4px;
                color: #e0e0e0;
                font-family: 'Consolas', monospace;
                font-size: 11px;
            }

            .cc-actions {
                display: flex;
                gap: 8px;
                margin-top: 10px;
            }

            .cc-send-btn {
                flex: 1;
                padding: 10px;
                background: #4a9eff;
                border: none;
                border-radius: 6px;
                color: #fff;
                cursor: pointer;
                font-weight: bold;
                font-size: 12px;
            }

            .cc-send-btn:hover {
                background: #3a8eef;
            }

            .cc-copy-btn, .cc-clear-btn {
                padding: 10px 16px;
                background: #2a2a3e;
                border: 1px solid #444;
                border-radius: 6px;
                color: #ccc;
                cursor: pointer;
                font-size: 12px;
            }

            .cc-copy-btn:hover, .cc-clear-btn:hover {
                background: #3a3a4e;
                color: #fff;
            }
        `;

        document.head.appendChild(style);
    }

    function updateLogDisplay() {
        const logsDiv = document.getElementById('cc-logs');
        if (!logsDiv) return;

        logsDiv.innerHTML = logs.slice(-100).map(log => `
            <div class="cc-log-entry ${log.level}">
                <span class="cc-timestamp">${log.timestamp}</span>
                <span class="cc-message">${escapeHtml(log.message)}</span>
            </div>
        `).join('');

        logsDiv.scrollTop = logsDiv.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function getCurrentSessionId() {
        try {
            // Try to get session info from KittBox/Agent server
            const response = await fetch('http://localhost:8585/api/session-info');
            const data = await response.json();
            if (data.sessionId) {
                return data.sessionId;
            }
        } catch (err) {
            console.warn('[ConsoleCapture] Could not get session info:', err);
        }

        // Fallback: generate ID with timestamp
        return `claude-code-${Date.now()}`;
    }

    function toggle() {
        if (!panel) createPanel();
        visible = !visible;
        panel.style.display = visible ? 'flex' : 'none';
        if (visible) updateLogDisplay();
    }

    function clear() {
        logs = [];
        updateLogDisplay();
        showToast('✓ Logs cleared');
    }

    function copyAll() {
        const text = logs.map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`).join('\n');
        navigator.clipboard.writeText(text);
        showToast('✓ Copied all logs to clipboard');
    }

    function copyFromLogs() {
        const text = logs.map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`).join('\n');
        document.getElementById('cc-textarea').value = text;
        showToast('✓ Copied to textarea');
    }

    function copyTextarea() {
        const textarea = document.getElementById('cc-textarea');
        navigator.clipboard.writeText(textarea.value);
        showToast('✓ Copied to clipboard');
    }

    async function sendToHive() {
        const text = logs.map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`).join('\n');
        await sendMessage(text);
    }

    async function sendTextareaToHive() {
        const textarea = document.getElementById('cc-textarea');
        const text = textarea.value.trim();
        if (!text) {
            showToast('⚠ Textarea is empty');
            return;
        }
        await sendMessage(text);
    }

    async function sendMessage(text) {
        // Get selected session
        const sessionSelect = document.getElementById('cc-session-select');
        const customInput = document.getElementById('cc-custom-session');
        let sessionId = 'default';

        if (sessionSelect) {
            const selectedValue = sessionSelect.value;
            if (selectedValue === 'this') {
                // Try to get PID from server endpoint
                sessionId = await getCurrentSessionId();
            } else if (selectedValue === 'custom' && customInput && customInput.value.trim()) {
                sessionId = customInput.value.trim();
            } else {
                sessionId = 'default';
            }
        }

        try {
            const relayUrl = 'http://192.168.1.192:8600/api/queue';
            const response = await fetch(relayUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    sessionId: sessionId
                })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                showToast('🚀 Sent to Hive!');
                // Clear textarea after successful send
                const textarea = document.getElementById('cc-textarea');
                if (textarea) textarea.value = '';
            } else {
                showToast('❌ Failed: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('[ConsoleCapture] Send failed:', err);
            showToast('❌ Relay offline');
        }
    }

    function showToast(msg) {
        let toast = document.getElementById('cc-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'cc-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: #22c55e;
                color: #fff;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 13px;
                z-index: 100003;
                transition: opacity 0.3s;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.style.display = 'none', 300);
        }, 2000);
    }

    function init() {
        // Hotkey: Ctrl+Shift+L
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                toggle();
            }
        });

        console.log('[ConsoleCapture] Ready - Press Ctrl+Shift+L to open');
    }

    function refreshSessions() {
        populateSessionDropdown();
        showToast('🔄 Sessions refreshed');
    }

    return {
        init,
        toggle,
        clear,
        copyAll,
        copyFromLogs,
        copyTextarea,
        sendToHive,
        sendTextareaToHive,
        refreshSessions
    };
})();

document.addEventListener('DOMContentLoaded', ConsoleCapture.init);
