/**
 * Activity Log Module v1.2.0
 *
 * Real-time log of Kitt activities and task status
 * Now with TodoModule integration for task completion actions
 * Updated to use standard CSS variables from STANDARDS.md
 */

const ActivityLog = (function() {
    'use strict';

    let logPanel = null;
    let logContent = null;
    let isVisible = false;
    let maxEntries = 100;
    let entries = [];
    let sortNewest = true; // Sort by newest first
    let isPinned = true; // true = pinned (stays open), false = hover mode (auto-hide)

    // Log types with colors from STANDARDS.md color scheme
    const LOG_TYPES = {
        info: { icon: 'ℹ️', color: 'var(--accent-info, #4a9eff)' },
        success: { icon: '✓', color: 'var(--accent-success, #22c55e)' },
        error: { icon: '✗', color: 'var(--accent-error, #ef4444)' },
        warning: { icon: '⚠', color: 'var(--accent-warning, #f59e0b)' },
        send: { icon: '➤', color: 'var(--accent-info, #4a9eff)' },
        receive: { icon: '◄', color: 'var(--accent-success, #22c55e)' },
        relay: { icon: '🔄', color: 'var(--accent-purple, #a855f7)' },
        voice: { icon: '🎤', color: '#ec4899' },
        system: { icon: '⚙', color: 'var(--text-muted, #666)' },
        task: { icon: '📌', color: 'var(--accent-warning, #f59e0b)' },
        queue: { icon: '📋', color: 'var(--accent-warning, #f59e0b)' }
    };

    function init() {
        createPanel();
        createToggleButton();
        hookIntoSystems();
        log('system', 'Activity Log initialized');
        console.log('[ActivityLog] Initialized');
    }

    function createPanel() {
        logPanel = document.createElement('div');
        logPanel.id = 'activity-log-panel';
        logPanel.innerHTML = `
            <div class="log-header">
                <span class="log-title">📋 Activity Log</span>
                <div class="log-controls">
                    <button class="log-btn pin-btn" id="log-pin" title="Pin/Hover mode">📌</button>
                    <button class="log-btn" id="log-sort" title="Sort by newest/oldest">↓</button>
                    <button class="log-btn" id="log-clear" title="Clear">🗑</button>
                    <button class="log-btn" id="log-export" title="Export">📥</button>
                    <button class="log-btn" id="log-close" title="Close">✕</button>
                </div>
            </div>
            <div class="log-filters">
                <label><input type="checkbox" data-type="info" checked> Info</label>
                <label><input type="checkbox" data-type="send" checked> Send</label>
                <label><input type="checkbox" data-type="receive" checked> Receive</label>
                <label><input type="checkbox" data-type="relay" checked> Relay</label>
                <label><input type="checkbox" data-type="task" checked> Task</label>
                <label><input type="checkbox" data-type="error" checked> Error</label>
            </div>
            <div class="log-content" id="log-content"></div>
            <div class="log-footer">
                <span id="log-count">0 entries</span>
                <label class="log-autoscroll">
                    <input type="checkbox" id="log-autoscroll-check" checked> Auto-scroll
                </label>
            </div>
        `;
        document.body.appendChild(logPanel);
        logContent = document.getElementById('log-content');

        // Event handlers
        document.getElementById('log-close').onclick = hide;
        document.getElementById('log-clear').onclick = clear;
        document.getElementById('log-export').onclick = exportLog;
        document.getElementById('log-sort').onclick = toggleSort;
        document.getElementById('log-pin').onclick = togglePin;

        // Filter handlers
        logPanel.querySelectorAll('.log-filters input').forEach(cb => {
            cb.onchange = applyFilters;
        });

        // Hover mode - auto-hide when mouse leaves
        logPanel.onmouseleave = () => {
            if (!isPinned && isVisible) {
                hide();
            }
        };

        // Load pin state
        isPinned = localStorage.getItem('activity-log-pinned') !== 'false';
        updatePinButton();

        addStyles();
        setupDragPanel();
        loadPosition();
    }

    function setupDragPanel() {
        const header = logPanel.querySelector('.log-header');
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            // Don't drag when clicking buttons
            if (e.target.tagName === 'BUTTON' || e.target.closest('.log-controls')) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = logPanel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            logPanel.style.transition = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            logPanel.style.left = (startLeft + dx) + 'px';
            logPanel.style.top = (startTop + dy) + 'px';
            logPanel.style.right = 'auto';
            logPanel.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                savePosition();
            }
            isDragging = false;
            logPanel.style.transition = '';
        });
    }

    function savePosition() {
        const rect = logPanel.getBoundingClientRect();
        localStorage.setItem('activity-log-position', JSON.stringify({
            left: logPanel.style.left,
            top: logPanel.style.top
        }));
    }

    function loadPosition() {
        try {
            const saved = localStorage.getItem('activity-log-position');
            if (saved) {
                const pos = JSON.parse(saved);
                if (pos.left) logPanel.style.left = pos.left;
                if (pos.top) logPanel.style.top = pos.top;
                if (pos.left || pos.top) {
                    logPanel.style.right = 'auto';
                    logPanel.style.bottom = 'auto';
                }
            }
        } catch (err) {
            console.error('Failed to load activity log position:', err);
        }
    }

    function togglePin() {
        isPinned = !isPinned;
        localStorage.setItem('activity-log-pinned', isPinned);
        updatePinButton();
    }

    function updatePinButton() {
        const btn = document.getElementById('log-pin');
        if (btn) {
            btn.textContent = isPinned ? '📌' : '👆';
            btn.title = isPinned ? 'Pinned (click for hover mode)' : 'Hover mode (click to pin)';
            btn.classList.toggle('active', isPinned);
        }
        if (logPanel) {
            logPanel.classList.toggle('hover-mode', !isPinned);
        }
    }

    function createToggleButton() {
        // Add to header if exists
        const header = document.querySelector('.header-controls, .header-right');
        if (header) {
            const btn = document.createElement('button');
            btn.className = 'header-btn';
            btn.id = 'btn-activity-log';
            btn.title = 'Activity Log';
            btn.textContent = '📋';
            btn.onclick = toggle;
            header.insertBefore(btn, header.firstChild);
        }
    }

    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* CSS Variables from STANDARDS.md */
            :root {
                --bg-dark: #1a1a2e;
                --bg-darker: #0f0f1a;
                --bg-card: #2a2a3e;
                --accent-success: #22c55e;
                --accent-info: #4a9eff;
                --accent-warning: #f59e0b;
                --accent-error: #ef4444;
                --accent-purple: #a855f7;
                --text-primary: #e0e0e0;
                --text-muted: #94a3b8;
                --border-color: #333;
            }

            #activity-log-panel {
                position: fixed;
                bottom: 60px;
                right: 20px;
                width: 400px;
                height: 350px;
                background: var(--bg-dark);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                display: none;
                flex-direction: column;
                z-index: 9999;
                font-family: 'Consolas', monospace;
                font-size: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            #activity-log-panel.visible { display: flex; }

            .log-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                border-bottom: 1px solid var(--border-color);
                background: #222;
                border-radius: 8px 8px 0 0;
                cursor: move;
                user-select: none;
            }
            .log-title { font-weight: 600; color: var(--text-primary); }
            .log-controls { display: flex; gap: 4px; }
            .log-btn {
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                padding: 4px 6px;
                border-radius: 4px;
                font-size: 12px;
                transition: all 0.15s ease;
            }
            .log-btn:hover { background: var(--bg-card); color: #fff; }

            .log-filters {
                display: flex;
                gap: 10px;
                padding: 6px 12px;
                border-bottom: 1px solid var(--border-color);
                font-size: 11px;
                color: var(--text-muted);
                flex-wrap: wrap;
            }
            .log-filters label {
                display: flex;
                align-items: center;
                gap: 4px;
                cursor: pointer;
            }
            .log-filters input { width: 12px; height: 12px; }

            .log-content {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
            }

            .log-entry {
                display: flex;
                gap: 8px;
                padding: 4px 6px;
                border-radius: 4px;
                margin-bottom: 2px;
                align-items: flex-start;
                transition: background 0.15s ease;
            }
            .log-entry:hover { background: rgba(255,255,255,0.05); }
            .log-entry.hidden { display: none; }

            .log-time { color: #666; white-space: nowrap; }
            .log-icon { width: 16px; text-align: center; }
            .log-message { flex: 1; color: #ccc; word-break: break-word; }
            .log-message-wrap { flex: 1; display: flex; flex-direction: column; }

            .log-footer {
                display: flex;
                justify-content: space-between;
                padding: 6px 12px;
                border-top: 1px solid var(--border-color);
                color: #666;
                font-size: 11px;
            }
            .log-autoscroll {
                display: flex;
                align-items: center;
                gap: 4px;
                cursor: pointer;
            }

            #btn-activity-log {
                background: none;
                border: none;
                color: var(--text-muted);
                cursor: pointer;
                padding: 4px 8px;
                font-size: 16px;
                transition: color 0.15s ease;
            }
            #btn-activity-log:hover { color: var(--accent-info); }
            #btn-activity-log.has-new { color: var(--accent-success); animation: pulse 1s infinite; }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            /* Pin button */
            .pin-btn.active { color: var(--accent-info) !important; }
            .pin-btn:not(.active) { color: var(--text-muted); }

            /* Hover mode */
            #activity-log-panel.hover-mode {
                opacity: 0.95;
                transition: opacity 0.2s ease;
            }
            #activity-log-panel.hover-mode:not(:hover) {
                opacity: 0.7;
            }
            #activity-log-panel.hover-mode::after {
                content: 'Hover mode - will auto-hide';
                position: absolute;
                bottom: -20px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 10px;
                color: #666;
                white-space: nowrap;
            }

            /* Task action buttons */
            .log-entry-actions {
                display: flex;
                gap: 4px;
                margin-top: 4px;
                opacity: 0;
                transition: opacity 0.15s ease;
            }
            .log-entry:hover .log-entry-actions { opacity: 1; }
            .log-entry.has-actions .log-entry-actions { opacity: 1; }

            .log-action-btn {
                background: var(--bg-card);
                border: 1px solid #444;
                border-radius: 4px;
                padding: 2px 6px;
                font-size: 10px;
                color: #aaa;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 3px;
                transition: all 0.15s ease;
            }
            .log-action-btn:hover {
                background: #3a3a4e;
                border-color: var(--accent-info);
                color: #fff;
            }
            .log-action-btn.complete:hover { border-color: var(--accent-success); color: var(--accent-success); }
            .log-action-btn.test:hover { border-color: var(--accent-warning); color: var(--accent-warning); }
            .log-action-btn.edit:hover { border-color: var(--accent-info); color: var(--accent-info); }

            .log-entry.task-match {
                background: rgba(245, 158, 11, 0.1);
                border-left: 2px solid var(--accent-warning);
            }

            .log-todo-link {
                font-size: 10px;
                color: var(--accent-warning);
                margin-left: 8px;
                cursor: pointer;
            }
            .log-todo-link:hover { text-decoration: underline; }
        `;
        document.head.appendChild(style);
    }

    function log(type, message, data = null) {
        const entry = {
            id: Date.now(),
            time: new Date().toLocaleTimeString('en-US', { hour12: false }),
            type: type,
            message: message,
            data: data,
            matchedTodo: null
        };

        // Check if this entry matches any todo item
        if (type === 'success' || type === 'task' || type === 'receive') {
            entry.matchedTodo = findMatchingTodo(message);
        }

        entries.push(entry);
        if (entries.length > maxEntries) {
            entries.shift();
        }

        renderEntry(entry);
        updateCount();

        // Highlight button if panel is hidden
        if (!isVisible) {
            const btn = document.getElementById('btn-activity-log');
            if (btn) btn.classList.add('has-new');
        }
    }

    // Find matching todo in TodoModule
    function findMatchingTodo(message) {
        if (typeof TodoModule === 'undefined') return null;

        // Get all todos from TodoModule (access internal state)
        const todoPanel = document.getElementById('todo-panel');
        if (!todoPanel) return null;

        const todoItems = todoPanel.querySelectorAll('.todo-item:not(.completed)');
        const msgLower = message.toLowerCase();

        for (const item of todoItems) {
            const textEl = item.querySelector('.todo-text');
            if (!textEl) continue;

            const todoText = textEl.textContent.toLowerCase();
            // Match if message contains significant words from todo
            const words = todoText.split(/\s+/).filter(w => w.length > 3);
            const matchCount = words.filter(w => msgLower.includes(w)).length;

            if (matchCount >= 2 || (words.length <= 2 && matchCount >= 1)) {
                return {
                    id: item.dataset.id,
                    text: textEl.textContent
                };
            }
        }
        return null;
    }

    function renderEntry(entry) {
        if (!logContent) return;

        const typeInfo = LOG_TYPES[entry.type] || LOG_TYPES.info;
        const div = document.createElement('div');
        div.className = `log-entry log-type-${entry.type}`;
        div.dataset.type = entry.type;
        div.dataset.id = entry.id;

        if (entry.matchedTodo) {
            div.classList.add('task-match', 'has-actions');
        }

        let actionsHtml = '';
        if (entry.matchedTodo) {
            actionsHtml = `
                <div class="log-entry-actions">
                    <button class="log-action-btn complete" data-action="complete" data-todo-id="${entry.matchedTodo.id}" title="Mark todo as complete">✓ Complete</button>
                    <button class="log-action-btn test" data-action="test" data-todo-id="${entry.matchedTodo.id}" title="Test this feature">🧪 Test</button>
                    <button class="log-action-btn edit" data-action="edit" data-todo-id="${entry.matchedTodo.id}" title="Edit todo">📝 Edit</button>
                </div>
            `;
        }

        const todoLink = entry.matchedTodo
            ? `<span class="log-todo-link" data-todo-id="${entry.matchedTodo.id}">📌 ${escapeHtml(entry.matchedTodo.text.substring(0, 30))}...</span>`
            : '';

        div.innerHTML = `
            <span class="log-time">${entry.time}</span>
            <span class="log-icon" style="color:${typeInfo.color}">${typeInfo.icon}</span>
            <div class="log-message-wrap">
                <span class="log-message">${escapeHtml(entry.message)}${todoLink}</span>
                ${actionsHtml}
            </div>
        `;

        // Add to correct position based on sort order
        if (sortNewest) {
            logContent.insertBefore(div, logContent.firstChild);
        } else {
            logContent.appendChild(div);
        }

        // Attach action handlers
        if (entry.matchedTodo) {
            attachActionHandlers(div, entry.matchedTodo);
        }

        // Auto-scroll
        const autoScroll = document.getElementById('log-autoscroll-check');
        if (autoScroll && autoScroll.checked) {
            if (sortNewest) {
                logContent.scrollTop = 0;
            } else {
                logContent.scrollTop = logContent.scrollHeight;
            }
        }

        applyFilters();
    }

    function attachActionHandlers(div, matchedTodo) {
        // Complete action
        const completeBtn = div.querySelector('[data-action="complete"]');
        if (completeBtn) {
            completeBtn.onclick = () => markTodoComplete(matchedTodo.id);
        }

        // Test action - send test command to Kitt
        const testBtn = div.querySelector('[data-action="test"]');
        if (testBtn) {
            testBtn.onclick = () => sendTestCommand(matchedTodo.text);
        }

        // Edit action - open todo for editing
        const editBtn = div.querySelector('[data-action="edit"]');
        if (editBtn) {
            editBtn.onclick = () => editTodo(matchedTodo.id);
        }

        // Todo link - show todo panel
        const todoLink = div.querySelector('.log-todo-link');
        if (todoLink) {
            todoLink.onclick = () => showTodo(matchedTodo.id);
        }
    }

    function markTodoComplete(todoId) {
        const todoItem = document.querySelector(`.todo-item[data-id="${todoId}"]`);
        if (todoItem) {
            const checkbox = todoItem.querySelector('.todo-checkbox');
            if (checkbox) checkbox.click();
            log('success', `Marked todo as complete`);
        }
    }

    function sendTestCommand(todoText) {
        const input = document.querySelector('#message-input');
        if (input) {
            input.value = `Test: ${todoText}`;
            input.focus();
            log('info', `Prepared test command for: ${todoText.substring(0, 30)}...`);
        }
    }

    function editTodo(todoId) {
        // Show todo panel and trigger edit on the item
        if (typeof TodoModule !== 'undefined') {
            TodoModule.show();
            setTimeout(() => {
                const todoItem = document.querySelector(`.todo-item[data-id="${todoId}"]`);
                if (todoItem) {
                    const textEl = todoItem.querySelector('.todo-text');
                    if (textEl) textEl.click();
                }
            }, 100);
        }
    }

    function showTodo(todoId) {
        if (typeof TodoModule !== 'undefined') {
            TodoModule.show();
            setTimeout(() => {
                const todoItem = document.querySelector(`.todo-item[data-id="${todoId}"]`);
                if (todoItem) {
                    todoItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    todoItem.style.background = '#3a4a5e';
                    setTimeout(() => todoItem.style.background = '', 1000);
                }
            }, 100);
        }
    }

    function toggleSort() {
        sortNewest = !sortNewest;
        const sortBtn = document.getElementById('log-sort');
        if (sortBtn) {
            sortBtn.textContent = sortNewest ? '↓' : '↑';
            sortBtn.title = sortNewest ? 'Newest first' : 'Oldest first';
        }
        rerenderAll();
    }

    function rerenderAll() {
        if (!logContent) return;
        logContent.innerHTML = '';
        const sorted = sortNewest ? [...entries].reverse() : [...entries];
        sorted.forEach(entry => {
            const typeInfo = LOG_TYPES[entry.type] || LOG_TYPES.info;
            const div = document.createElement('div');
            div.className = `log-entry log-type-${entry.type}`;
            div.dataset.type = entry.type;
            div.dataset.id = entry.id;

            if (entry.matchedTodo) {
                div.classList.add('task-match', 'has-actions');
            }

            let actionsHtml = '';
            if (entry.matchedTodo) {
                actionsHtml = `
                    <div class="log-entry-actions">
                        <button class="log-action-btn complete" data-action="complete" data-todo-id="${entry.matchedTodo.id}" title="Mark todo as complete">✓ Complete</button>
                        <button class="log-action-btn test" data-action="test" data-todo-id="${entry.matchedTodo.id}" title="Test this feature">🧪 Test</button>
                        <button class="log-action-btn edit" data-action="edit" data-todo-id="${entry.matchedTodo.id}" title="Edit todo">📝 Edit</button>
                    </div>
                `;
            }

            const todoLink = entry.matchedTodo
                ? `<span class="log-todo-link" data-todo-id="${entry.matchedTodo.id}">📌 ${escapeHtml(entry.matchedTodo.text.substring(0, 30))}...</span>`
                : '';

            div.innerHTML = `
                <span class="log-time">${entry.time}</span>
                <span class="log-icon" style="color:${typeInfo.color}">${typeInfo.icon}</span>
                <div class="log-message-wrap">
                    <span class="log-message">${escapeHtml(entry.message)}${todoLink}</span>
                    ${actionsHtml}
                </div>
            `;
            logContent.appendChild(div);

            if (entry.matchedTodo) {
                attachActionHandlers(div, entry.matchedTodo);
            }
        });
        applyFilters();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function applyFilters() {
        if (!logContent) return;

        const checked = {};
        logPanel.querySelectorAll('.log-filters input').forEach(cb => {
            checked[cb.dataset.type] = cb.checked;
        });

        logContent.querySelectorAll('.log-entry').forEach(entry => {
            const type = entry.dataset.type;
            const show = checked[type] !== false; // Show if not explicitly unchecked
            entry.classList.toggle('hidden', !show);
        });
    }

    function updateCount() {
        const countEl = document.getElementById('log-count');
        if (countEl) {
            countEl.textContent = `${entries.length} entries`;
        }
    }

    function clear() {
        entries = [];
        if (logContent) logContent.innerHTML = '';
        updateCount();
        log('system', 'Log cleared');
    }

    function exportLog() {
        const text = entries.map(e => `[${e.time}] [${e.type.toUpperCase()}] ${e.message}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kitt-activity-${new Date().toISOString().slice(0,10)}.log`;
        a.click();
        URL.revokeObjectURL(url);
        log('system', 'Log exported');
    }

    function show() {
        if (logPanel) {
            logPanel.classList.add('visible');
            isVisible = true;
            const btn = document.getElementById('btn-activity-log');
            if (btn) btn.classList.remove('has-new');
        }
    }

    function hide() {
        if (logPanel) {
            logPanel.classList.remove('visible');
            isVisible = false;
        }
    }

    function toggle() {
        isVisible ? hide() : show();
    }

    // Hook into existing systems to capture events
    function hookIntoSystems() {
        // Intercept WebSocket messages
        const originalWsHandler = window.AdminKitt?.state?.ws?.onmessage;

        // Hook into AdminKitt if available
        if (typeof AdminKitt !== 'undefined') {
            // Patch sendQuick
            const originalSendQuick = AdminKitt.sendQuick;
            AdminKitt.sendQuick = function(text) {
                log('send', `Message: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
                return originalSendQuick.apply(this, arguments);
            };
        }

        // Listen for custom events
        document.addEventListener('kitt:send', (e) => log('send', e.detail));
        document.addEventListener('kitt:receive', (e) => log('receive', e.detail));
        document.addEventListener('kitt:status', (e) => log('relay', e.detail));
        document.addEventListener('kitt:error', (e) => log('error', e.detail));
    }

    // Public logging methods for other modules to use
    function info(msg) { log('info', msg); }
    function success(msg) { log('success', msg); }
    function error(msg) { log('error', msg); }
    function warning(msg) { log('warning', msg); }
    function send(msg) { log('send', msg); }
    function receive(msg) { log('receive', msg); }
    function relay(msg) { log('relay', msg); }
    function voice(msg) { log('voice', msg); }
    function task(msg) { log('task', msg); }
    function queue(msg) { log('queue', msg); }

    return {
        init,
        log,
        info,
        success,
        error,
        warning,
        send,
        receive,
        relay,
        voice,
        task,
        queue,
        show,
        hide,
        toggle,
        clear
    };
})();

// Auto-init
document.addEventListener('DOMContentLoaded', ActivityLog.init);
