/**
 * Output Bubble - Movable Claude/Kitt Activity Monitor v1.0.0
 *
 * Floating draggable panel showing all Claude/Kitt processing:
 * - Real-time task status
 * - Voice persona activity
 * - Relay queue updates
 * - Error/success notifications
 *
 * Path: C:\LLM-DevOSWE\Admin\agent\agent-ui\modules\output-bubble.js
 * Last Updated: 2026-01-12
 */

const OutputBubble = (function() {
    'use strict';

    const MAX_ENTRIES = 100;
    const entries = [];
    let bubble = null;
    let isMinimized = false;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    // ==================== UI CREATION ====================

    function createBubble() {
        if (bubble) return bubble;

        bubble = document.createElement('div');
        bubble.id = 'output-bubble';
        bubble.className = 'output-bubble';
        bubble.innerHTML = `
            <div class="output-bubble-header" id="output-bubble-header">
                <span class="output-bubble-title">🤖 Claude Activity</span>
                <div class="output-bubble-controls">
                    <button class="output-bubble-btn" onclick="OutputBubble.clear()" title="Clear">🗑️</button>
                    <button class="output-bubble-btn" onclick="OutputBubble.toggleMinimize()" title="Minimize">─</button>
                    <button class="output-bubble-btn" onclick="OutputBubble.hide()" title="Close">✕</button>
                </div>
            </div>
            <div class="output-bubble-body" id="output-bubble-body">
                <div class="output-bubble-empty">No activity yet...</div>
            </div>
            <div class="output-bubble-footer">
                <span class="output-bubble-count">0 entries</span>
                <span class="output-bubble-status">● Connected</span>
            </div>
        `;

        document.body.appendChild(bubble);

        // Make draggable
        setupDragging();

        // Load position from localStorage
        loadPosition();

        return bubble;
    }

    function setupDragging() {
        const header = document.getElementById('output-bubble-header');
        if (!header) return;

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('output-bubble-btn')) return;
            isDragging = true;
            dragOffset.x = e.clientX - bubble.offsetLeft;
            dragOffset.y = e.clientY - bubble.offsetTop;
            bubble.classList.add('dragging');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const x = e.clientX - dragOffset.x;
            const y = e.clientY - dragOffset.y;
            bubble.style.left = `${Math.max(0, x)}px`;
            bubble.style.top = `${Math.max(0, y)}px`;
            bubble.style.right = 'auto';
            bubble.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                bubble.classList.remove('dragging');
                savePosition();
            }
        });
    }

    function savePosition() {
        if (!bubble) return;
        localStorage.setItem('outputBubblePosition', JSON.stringify({
            left: bubble.style.left,
            top: bubble.style.top
        }));
    }

    function loadPosition() {
        const saved = localStorage.getItem('outputBubblePosition');
        if (saved && bubble) {
            const pos = JSON.parse(saved);
            bubble.style.left = pos.left;
            bubble.style.top = pos.top;
            bubble.style.right = 'auto';
            bubble.style.bottom = 'auto';
        }
    }

    // ==================== ENTRY MANAGEMENT ====================

    function addEntry(type, message, details = {}) {
        const entry = {
            id: Date.now(),
            type,
            message,
            details,
            timestamp: new Date().toISOString()
        };

        entries.unshift(entry);

        // Trim old entries
        while (entries.length > MAX_ENTRIES) {
            entries.pop();
        }

        renderEntries();
        return entry;
    }

    function renderEntries() {
        const body = document.getElementById('output-bubble-body');
        const countEl = bubble?.querySelector('.output-bubble-count');

        if (!body) return;

        if (entries.length === 0) {
            body.innerHTML = '<div class="output-bubble-empty">No activity yet...</div>';
        } else {
            body.innerHTML = entries.slice(0, 50).map(entry => `
                <div class="output-entry output-entry-${entry.type}">
                    <span class="output-entry-icon">${getIcon(entry.type)}</span>
                    <span class="output-entry-message">${escapeHtml(entry.message)}</span>
                    <span class="output-entry-time">${formatTime(entry.timestamp)}</span>
                </div>
            `).join('');
        }

        if (countEl) {
            countEl.textContent = `${entries.length} entries`;
        }
    }

    function getIcon(type) {
        const icons = {
            task: '📋',
            voice: '🎤',
            relay: '📡',
            error: '❌',
            success: '✅',
            info: 'ℹ️',
            warning: '⚠️',
            claude: '🤖',
            heather: '👩‍💼',
            shiZhenXiang: '👩‍💻'
        };
        return icons[type] || '●';
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { hour12: false });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== PUBLIC METHODS ====================

    function show() {
        createBubble();
        bubble.classList.add('visible');
    }

    function hide() {
        if (bubble) {
            bubble.classList.remove('visible');
        }
    }

    function toggle() {
        if (bubble?.classList.contains('visible')) {
            hide();
        } else {
            show();
        }
    }

    function toggleMinimize() {
        if (!bubble) return;
        isMinimized = !isMinimized;
        bubble.classList.toggle('minimized', isMinimized);
    }

    function clear() {
        entries.length = 0;
        renderEntries();
    }

    // Convenience methods for logging different types
    function logTask(message, details) { return addEntry('task', message, details); }
    function logVoice(message, details) { return addEntry('voice', message, details); }
    function logRelay(message, details) { return addEntry('relay', message, details); }
    function logError(message, details) { return addEntry('error', message, details); }
    function logSuccess(message, details) { return addEntry('success', message, details); }
    function logInfo(message, details) { return addEntry('info', message, details); }
    function logClaude(message, details) { return addEntry('claude', message, details); }
    function logHeather(message, details) { return addEntry('heather', message, details); }
    function logShiZhenXiang(message, details) { return addEntry('shiZhenXiang', message, details); }

    // ==================== EVENT SUBSCRIPTIONS ====================

    function subscribeToEvents() {
        // Subscribe to relay WebSocket events
        if (typeof RelayWS !== 'undefined') {
            RelayWS.on('task:created', (data) => logTask(`Task created: ${data.id}`));
            RelayWS.on('task:processing', (data) => logTask(`Task processing: ${data.id}`));
            RelayWS.on('task:completed', (data) => logSuccess(`Task completed: ${data.id}`));
            RelayWS.on('task:failed', (data) => logError(`Task failed: ${data.id}`));
        }

        // Subscribe to TeamTasks events
        document.addEventListener('teamTaskUpdate', (e) => {
            const { task, event } = e.detail;
            if (event === 'assigned') {
                logTask(`Task assigned to ${task.assigneeName}: ${task.summary}`);
            } else if (event === 'completed') {
                logSuccess(`${task.assigneeName} completed: ${task.summary}`);
            }
        });

        // Subscribe to voice events
        if (typeof VoiceEngine !== 'undefined') {
            // Hook into VoiceEngine speak
            const originalSpeak = VoiceEngine.speak;
            VoiceEngine.speak = function(text, options) {
                const persona = options?.voiceName?.includes('粵語') ? 'shiZhenXiang' : 'heather';
                addEntry(persona, text.substring(0, 100) + (text.length > 100 ? '...' : ''));
                return originalSpeak.call(this, text, options);
            };
        }
    }

    // ==================== INITIALIZATION ====================

    function init() {
        console.log('[OutputBubble] Initializing activity monitor');
        createBubble();
        subscribeToEvents();
        console.log('[OutputBubble] Ready');
    }

    return {
        init,
        show,
        hide,
        toggle,
        toggleMinimize,
        clear,
        addEntry,
        logTask,
        logVoice,
        logRelay,
        logError,
        logSuccess,
        logInfo,
        logClaude,
        logHeather,
        logShiZhenXiang,
        getEntries: () => [...entries]
    };
})();

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => OutputBubble.init());
} else {
    OutputBubble.init();
}

// Export
if (typeof module !== 'undefined') module.exports = { OutputBubble };
