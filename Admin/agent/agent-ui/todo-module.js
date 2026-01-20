/**
 * TODO Module v2.1.0
 * Free-floating, draggable TODO panel with multiple lists
 *
 * Path: C:\LLM-DevOSWE\Admin\agent\agent-ui\todo-module.js
 * Last Updated: 2026-01-11
 *
 * Changelog:
 * v2.1.0 - Added context menu (right-click) using MenuUtils
 *        - Added "Needs Testing" flag with 🧪 badge
 *        - Added notification toast for actions
 *        - Added "Add Thought" and "Copy Text" to context menu
 *
 * Usage: Include this script and call TodoModule.init(apiBase)
 */

const TodoModule = (function() {
    let apiBase = '';
    let allLists = {};
    let currentListName = 'General';
    let todos = [];
    let draggedItem = null;
    let isMinimized = false;
    let isPinned = true; // true = pinned (stays open), false = hover mode (auto-hide)
    let config = {
        assistantName: 'Kit',
        inputSelector: '#message-input'
    };
    
    const DEFAULT_LISTS = ['General', 'SimWidget', 'Agent', 'Admin', 'MSFS'];
    const ALL_LISTS_KEY = '📋 All';
    
    const PRIORITIES = [
        { id: 'mustdo', label: '⚡ MUSTDO', color: '#ff4444' },
        { id: 'high', label: '🔴 High', color: '#ff8844' },
        { id: 'medium', label: '🟡 Medium', color: '#ffcc00' },
        { id: 'low', label: '🟢 Low', color: '#44cc44' },
        { id: 'thought', label: '💭 Thought', color: '#888888' }
    ];

    function createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .todo-panel {
                position: relative;
                width: 100%;
                max-height: 300px;
                background: #1a1a2e;
                border-top: 1px solid #333;
                display: flex;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow: hidden;
            }
            .todo-panel.minimized {
                max-height: 44px;
                width: auto;
                min-width: 120px;
            }
            .todo-panel.minimized .todo-body,
            .todo-panel.minimized .todo-input-area {
                display: none;
            }
            .todo-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                background: #2a2a3e;
                user-select: none;
                border-bottom: 1px solid #333;
            }
            .todo-header h3 {
                margin: 0;
                font-size: 14px;
                color: #fff;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .todo-count {
                background: #4a9eff;
                color: #fff;
                font-size: 11px;
                padding: 2px 6px;
                border-radius: 10px;
            }
            .todo-header-btns {
                display: flex;
                gap: 4px;
            }
            .todo-header-btn {
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                font-size: 16px;
                padding: 4px;
                border-radius: 4px;
            }
            .todo-header-btn:hover {
                background: #3a3a4e;
                color: #fff;
            }
            .todo-header-btn#todo-refresh {
                transition: transform 0.3s ease;
            }
            .todo-header-btn.reconcile-icon {
                font-size: 12px;
                opacity: 0.7;
            }
            .todo-header-btn.reconcile-icon:hover {
                opacity: 1;
            }
            .todo-list-selector {
                background: #1a1a2e;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 4px 8px;
                color: #4a9eff;
                font-size: 12px;
                cursor: pointer;
                margin-left: 8px;
            }
            .todo-list-selector:hover {
                border-color: #4a9eff;
            }
            .todo-list-selector:focus {
                outline: none;
                border-color: #4a9eff;
            }
            .todo-new-list-btn {
                background: none;
                border: 1px solid #333;
                color: #888;
                cursor: pointer;
                font-size: 14px;
                padding: 2px 6px;
                border-radius: 4px;
                margin-left: 4px;
            }
            .todo-new-list-btn:hover {
                background: #3a3a4e;
                color: #4a9eff;
                border-color: #4a9eff;
            }
            .todo-body {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
                max-height: 350px;
            }
            .todo-section {
                margin-bottom: 12px;
            }
            .todo-section-header {
                font-size: 11px;
                font-weight: 600;
                color: #888;
                padding: 4px 8px;
                text-transform: uppercase;
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                user-select: none;
                border-radius: 4px;
            }
            .todo-section-header:hover {
                background: rgba(255,255,255,0.05);
            }
            .todo-section-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
            }
            .todo-section-toggle {
                margin-left: auto;
                font-size: 10px;
                color: #666;
                transition: transform 0.2s;
            }
            .todo-section.collapsed .todo-section-toggle {
                transform: rotate(-90deg);
            }
            .todo-section.collapsed .todo-item {
                display: none;
            }
            .todo-section.collapsed .todo-section-header {
                opacity: 0.7;
            }
            .todo-item {
                background: #2a2a3e;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 10px 12px;
                margin-bottom: 6px;
                cursor: grab;
                display: flex;
                align-items: flex-start;
                gap: 10px;
                transition: all 0.3s ease;
            }
            .todo-item:hover {
                border-color: #4a9eff;
            }
            .todo-item.dragging {
                opacity: 0.5;
                transform: scale(1.02);
            }
            .todo-item.drag-over {
                border-color: #4a9eff;
                background: #3a3a4e;
            }
            .todo-checkbox {
                width: 18px;
                height: 18px;
                border: 2px solid #555;
                border-radius: 4px;
                cursor: pointer;
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-top: 2px;
            }
            .todo-checkbox:hover {
                border-color: #4a9eff;
            }
            .todo-checkbox.checked {
                background: #22c55e;
                border-color: #22c55e;
            }
            .todo-checkbox.checked::after {
                content: '✓';
                color: #fff;
                font-size: 12px;
            }
            .todo-content {
                flex: 1;
                min-width: 0;
                cursor: pointer;
            }
            .todo-content:hover {
                background: rgba(74, 158, 255, 0.1);
                border-radius: 4px;
                margin: -4px;
                padding: 4px;
            }
            .todo-text {
                color: #e0e0e0;
                font-size: 13px;
                word-wrap: break-word;
                cursor: pointer;
            }
            .todo-text:hover {
                background: rgba(74, 158, 255, 0.1);
                border-radius: 4px;
            }
            .todo-edit-input {
                width: 100%;
                background: #1a1a2e;
                border: 1px solid #4a9eff;
                border-radius: 4px;
                padding: 4px 8px;
                color: #e0e0e0;
                font-size: 13px;
                outline: none;
                resize: none;
                overflow: hidden;
                font-family: inherit;
                line-height: 1.4;
            }
            .todo-thought {
                font-size: 11px;
                color: #888;
                font-style: italic;
                margin-top: 4px;
                padding: 4px 8px;
                background: rgba(74, 158, 255, 0.1);
                border-radius: 4px;
                border-left: 2px solid #4a9eff;
                cursor: pointer;
            }
            .todo-thought:hover {
                background: rgba(74, 158, 255, 0.2);
            }
            .todo-item.completed .todo-text {
                text-decoration: line-through;
                color: #666;
            }
            .todo-item.completed {
                opacity: 0.5;
                transition: opacity 0.5s ease, transform 0.5s ease;
            }
            .todo-item.needs-testing {
                border-left: 3px solid #f59e0b;
                background: rgba(245, 158, 11, 0.1);
            }
            .todo-testing-badge {
                margin-left: 6px;
                font-size: 12px;
                animation: pulse-testing 2s ease-in-out infinite;
            }
            @keyframes pulse-testing {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
                15% { opacity: 1; transform: translateX(-50%) translateY(0); }
                85% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            }
            .todo-meta {
                font-size: 10px;
                color: #666;
                margin-top: 4px;
            }
            .todo-source-badge {
                background: #3a3a4e;
                color: #4a9eff;
                padding: 1px 4px;
                border-radius: 3px;
                font-size: 9px;
                margin-right: 4px;
            }
            .todo-actions {
                display: flex;
                gap: 2px;
                opacity: 0;
                transition: opacity 0.15s;
            }
            .todo-item:hover .todo-actions {
                opacity: 1;
            }
            .todo-action-btn {
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                font-size: 14px;
                padding: 2px 4px;
                border-radius: 4px;
            }
            .todo-action-btn:hover {
                background: #3a3a4e;
                color: #fff;
            }
            .todo-action-btn.delete:hover {
                color: #ff4444;
            }
            .todo-action-btn[data-action="send"]:hover {
                color: #4a9eff;
            }
            .todo-input-area {
                padding: 10px;
                border-top: 1px solid #333;
                background: #2a2a3e;
            }
            .todo-input-row {
                display: flex;
                gap: 6px;
                align-items: center;
            }
            .todo-input {
                flex: 1;
                min-width: 0;
                background: #1a1a2e;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 8px 12px;
                color: #e0e0e0;
                font-size: 13px;
                outline: none;
            }
            .todo-input:focus {
                border-color: #4a9eff;
                box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
            }
            .todo-priority-select {
                width: 90px;
                flex-shrink: 0;
            }
            .todo-add-btn {
                flex-shrink: 0;
            }
            .todo-thought-input {
                width: 100%;
                background: #1a1a2e;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 6px 12px;
                color: #888;
                font-size: 12px;
                font-style: italic;
                outline: none;
                margin-top: 6px;
            }
            .todo-thought-input:focus {
                border-color: #4a9eff;
                color: #e0e0e0;
            }
            .todo-priority-select {
                background: #1a1a2e;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 8px;
                color: #ccc;
                font-size: 12px;
                cursor: pointer;
            }
            .todo-add-btn {
                background: #4a9eff;
                border: none;
                border-radius: 6px;
                padding: 8px 14px;
                color: #fff;
                font-size: 13px;
                cursor: pointer;
                font-weight: 500;
            }
            .todo-add-btn:hover {
                background: #3a8eef;
            }
            .todo-empty {
                text-align: center;
                padding: 30px;
                color: #666;
                font-size: 13px;
            }
            .priority-menu {
                position: absolute;
                background: #2a2a3e;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 4px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .priority-menu-item {
                padding: 8px 12px;
                cursor: pointer;
                border-radius: 4px;
                font-size: 12px;
                color: #ccc;
            }
            .priority-menu-item:hover {
                background: #3a3a4e;
            }
            .priority-menu-item.cancel { color: #888; }
            .priority-menu-item.cancel:hover { color: #ff6b6b; }
            .priority-menu-divider {
                height: 1px;
                background: #444;
                margin: 4px 8px;
            }

            /* Enhanced input area */
            .todo-input-expanded {
                display: none;
                flex-direction: column;
                gap: 8px;
                padding: 10px;
                background: #2a2a3e;
                border-top: 1px solid #4a9eff;
                animation: slideDown 0.2s ease;
            }
            .todo-input-expanded.visible { display: flex; }
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .todo-input-tools {
                display: flex;
                gap: 6px;
                align-items: center;
            }
            .todo-tool-btn {
                background: #1a1a2e;
                border: 1px solid #444;
                border-radius: 6px;
                padding: 6px 10px;
                color: #888;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .todo-tool-btn:hover {
                border-color: #4a9eff;
                color: #4a9eff;
            }
            .todo-tool-btn.active {
                background: #4a9eff;
                border-color: #4a9eff;
                color: #fff;
            }
            .todo-tool-btn.recording {
                background: #ef4444;
                border-color: #ef4444;
                color: #fff;
                animation: pulse-red 1s infinite;
            }
            @keyframes pulse-red {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-4px); }
                75% { transform: translateX(4px); }
            }
            .todo-notes-area {
                background: #1a1a2e;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 8px;
                color: #e0e0e0;
                font-size: 12px;
                min-height: 60px;
                resize: vertical;
                outline: none;
            }
            .todo-notes-area:focus { border-color: #4a9eff; }
            .todo-image-preview {
                max-width: 100%;
                max-height: 100px;
                border-radius: 4px;
                border: 1px solid #444;
            }
            .todo-voice-status {
                font-size: 11px;
                color: #888;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .todo-voice-status.listening { color: #ef4444; }
            .todo-input-actions {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            .todo-cancel-btn {
                background: none;
                border: 1px solid #444;
                border-radius: 6px;
                padding: 6px 12px;
                color: #888;
                cursor: pointer;
                font-size: 12px;
            }
            .todo-cancel-btn:hover { border-color: #666; color: #ccc; }

            /* Todo item image */
            .todo-item-image {
                max-width: 100%;
                max-height: 60px;
                border-radius: 4px;
                margin-top: 6px;
                cursor: pointer;
                border: 1px solid #444;
                opacity: 0.8;
                transition: opacity 0.2s;
            }
            .todo-item-image:hover { opacity: 1; }

            /* Image viewer modal */
            .todo-image-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 20000;
                cursor: zoom-out;
            }
            .todo-image-modal img {
                max-width: 90%;
                max-height: 90%;
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            }

            /* Reconcile dialog */
            .todo-reconcile-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 20000;
            }
            .todo-reconcile-dialog {
                background: #1a1a2e;
                border: 1px solid #333;
                border-radius: 12px;
                width: 450px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            }
            .reconcile-header {
                padding: 14px 16px;
                border-bottom: 1px solid #333;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .reconcile-header h4 { margin: 0; color: #e0e0e0; font-size: 14px; }
            .reconcile-header-actions { display: flex; gap: 8px; align-items: center; }
            .reconcile-btn {
                background: #2a2a3e;
                border: 1px solid #444;
                color: #ccc;
                cursor: pointer;
                font-size: 14px;
                padding: 4px 8px;
                border-radius: 4px;
            }
            .reconcile-btn:hover { background: #3a3a4e; color: #fff; }
            .reconcile-close {
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                font-size: 18px;
            }
            .reconcile-close:hover { color: #fff; }
            .reconcile-body {
                padding: 16px;
                overflow-y: auto;
                flex: 1;
            }
            .reconcile-section {
                margin-bottom: 16px;
            }
            .reconcile-section-title {
                font-size: 11px;
                color: #888;
                text-transform: uppercase;
                margin-bottom: 8px;
            }
            .reconcile-status {
                padding: 10px;
                background: #2a2a3e;
                border-radius: 6px;
                font-size: 12px;
                color: #ccc;
            }
            .reconcile-status.synced { border-left: 3px solid #22c55e; }
            .reconcile-status.conflict { border-left: 3px solid #f59e0b; }
            .reconcile-status.error { border-left: 3px solid #ef4444; }
            .reconcile-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-top: 12px;
            }
            .reconcile-btn {
                background: #2a2a3e;
                border: 1px solid #444;
                border-radius: 6px;
                padding: 8px 12px;
                color: #ccc;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .reconcile-btn:hover { border-color: #4a9eff; color: #fff; }
            .reconcile-btn.primary { background: #4a9eff; border-color: #4a9eff; }
            .reconcile-btn.danger { border-color: #ef4444; }
            .reconcile-btn.danger:hover { background: #ef4444; }
            .reconcile-log {
                background: #111;
                border-radius: 4px;
                padding: 8px;
                font-family: monospace;
                font-size: 11px;
                color: #888;
                max-height: 120px;
                overflow-y: auto;
                margin-top: 8px;
            }
            .reconcile-log-entry { margin: 2px 0; }
            .reconcile-log-entry.success { color: #22c55e; }
            .reconcile-log-entry.error { color: #ef4444; }
            .reconcile-log-entry.info { color: #4a9eff; }

            /* Submenu styles */
            .reconcile-btn.has-submenu { position: relative; }
            .reconcile-btn.has-submenu::after {
                content: '▾';
                margin-left: 4px;
                font-size: 10px;
            }
            .reconcile-submenu {
                position: absolute;
                bottom: 100%;
                left: 0;
                background: #2a2a3e;
                border: 1px solid #444;
                border-radius: 6px;
                padding: 4px;
                padding-bottom: 8px;
                min-width: 160px;
                box-shadow: 0 -4px 12px rgba(0,0,0,0.3);
                display: none;
                z-index: 10001;
            }
            .reconcile-submenu::after {
                content: '';
                position: absolute;
                bottom: -8px;
                left: 0;
                right: 0;
                height: 8px;
            }
            .reconcile-btn.has-submenu:hover .reconcile-submenu,
            .reconcile-submenu:hover {
                display: block;
            }
            .reconcile-submenu-item {
                padding: 8px 12px;
                color: #ccc;
                cursor: pointer;
                border-radius: 4px;
                font-size: 11px;
                white-space: nowrap;
            }
            .reconcile-submenu-item:hover {
                background: #3a3a4e;
                color: #fff;
            }
            .reconcile-submenu-item.danger:hover {
                background: #ef4444;
            }
            .reconcile-submenu-divider {
                height: 1px;
                background: #444;
                margin: 4px 8px;
            }

            /* Pin/Hover mode */
            .todo-header-btn.pin-btn {
                font-size: 14px;
            }
            .todo-header-btn.pin-btn.active {
                color: #4a9eff;
            }
            .todo-panel.hover-mode {
                opacity: 0.95;
                transition: opacity 0.2s ease;
            }
            .todo-panel.hover-mode:not(:hover) {
                opacity: 0.3;
                pointer-events: auto;
            }
            .todo-panel.hover-mode:hover {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.className = 'todo-panel';
        panel.id = 'todo-panel';
        panel.innerHTML = `
            <div class="todo-header" id="todo-drag-handle">
                <h3>📋 <select class="todo-list-selector" id="todo-list-selector"></select><button class="todo-new-list-btn" id="todo-new-list" title="New List">+</button> <span class="todo-count" id="todo-count">0</span></h3>
                <div class="todo-header-btns">
                    <button class="todo-header-btn" id="todo-refresh" title="Refresh">🔄</button>
                    <button class="todo-header-btn reconcile-icon" id="todo-reconcile" title="Reconcile/Sync">⚙️</button>
                    <button class="todo-header-btn pin-btn active" id="todo-pin" title="Pinned (click for hover mode)">📌</button>
                    <button class="todo-header-btn" id="todo-minimize" title="Minimize">−</button>
                    <button class="todo-header-btn" id="todo-close" title="Close">×</button>
                </div>
            </div>
            <div class="todo-body" id="todo-body"></div>
            <div class="todo-input-area">
                <div class="todo-input-row">
                    <input type="text" class="todo-input" id="todo-new-input" placeholder="Add new task...">
                    <select class="todo-priority-select" id="todo-new-priority">
                        <option value="">Priority...</option>
                        ${PRIORITIES.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
                    </select>
                    <button class="todo-add-btn" id="todo-add-btn">Add</button>
                </div>
                <div class="todo-input-expanded" id="todo-input-expanded">
                    <div class="todo-input-tools">
                        <button class="todo-tool-btn" id="todo-tool-screenshot" title="Capture screenshot">📷</button>
                        <button class="todo-tool-btn" id="todo-tool-voice" title="Voice notes">🎤</button>
                        <span class="todo-voice-status" id="todo-voice-status"></span>
                        <div style="flex:1"></div>
                        <button class="todo-cancel-btn" id="todo-cancel-expanded">Cancel</button>
                    </div>
                    <div id="todo-image-container"></div>
                    <textarea class="todo-notes-area" id="todo-notes-input" placeholder="Add notes, details, or context..."></textarea>
                </div>
            </div>
        `;
        // Append to container if exists, otherwise body
        const container = document.getElementById('todo-panel-container');
        if (container) {
            container.appendChild(panel);
        } else {
            document.body.appendChild(panel);
        }

        // Only enable drag if floating (not in container)
        if (!container) {
            setupDragPanel(panel);
        }
        setupEvents();
    }

    function setupDragPanel(panel) {
        const handle = document.getElementById('todo-drag-handle');
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            panel.style.transition = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panel.style.left = (startLeft + dx) + 'px';
            panel.style.top = (startTop + dy) + 'px';
            panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                saveState();
            }
            isDragging = false;
            panel.style.transition = '';
        });
    }

    let voiceRecognition = null;
    let isRecording = false;
    let capturedImage = null;
    let collapsedSections = {};

    function setupEvents() {
        document.getElementById('todo-minimize').addEventListener('click', toggleMinimize);
        document.getElementById('todo-close').addEventListener('click', hide);
        document.getElementById('todo-refresh').addEventListener('click', () => {
            loadTodos();
            const btn = document.getElementById('todo-refresh');
            btn.style.transform = 'rotate(360deg)';
            setTimeout(() => btn.style.transform = '', 300);
        });
        document.getElementById('todo-reconcile').addEventListener('click', showReconcileDialog);
        document.getElementById('todo-pin').addEventListener('click', togglePin);
        document.getElementById('todo-add-btn').addEventListener('click', addTodo);
        document.getElementById('todo-new-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTodo();
        });

        // When priority is selected, show expanded input
        document.getElementById('todo-new-priority').addEventListener('change', (e) => {
            const expanded = document.getElementById('todo-input-expanded');
            if (e.target.value) {
                expanded.classList.add('visible');
            }
        });

        // Cancel expanded input
        document.getElementById('todo-cancel-expanded').addEventListener('click', () => {
            collapseInput();
        });

        // Screenshot tool
        document.getElementById('todo-tool-screenshot').addEventListener('click', captureScreenshot);

        // Voice tool
        document.getElementById('todo-tool-voice').addEventListener('click', toggleVoiceInput);

        // List selector
        document.getElementById('todo-list-selector').addEventListener('change', (e) => {
            switchList(e.target.value);
        });

        // New list button
        document.getElementById('todo-new-list').addEventListener('click', createNewList);
    }

    function collapseInput() {
        const expanded = document.getElementById('todo-input-expanded');
        const priority = document.getElementById('todo-new-priority');
        const notes = document.getElementById('todo-notes-input');
        const imageContainer = document.getElementById('todo-image-container');

        expanded.classList.remove('visible');
        priority.value = '';
        notes.value = '';
        imageContainer.innerHTML = '';
        capturedImage = null;

        if (isRecording) {
            stopVoiceInput();
        }
    }

    async function captureScreenshot() {
        try {
            const btn = document.getElementById('todo-tool-screenshot');
            btn.classList.add('active');

            // Use screen capture API
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' }
            });

            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());

            // Convert to data URL
            capturedImage = canvas.toDataURL('image/png');

            // Show preview
            const container = document.getElementById('todo-image-container');
            container.innerHTML = `
                <div style="position:relative;display:inline-block;">
                    <img src="${capturedImage}" class="todo-image-preview" alt="Screenshot">
                    <button onclick="this.parentElement.remove(); capturedImage=null;"
                            style="position:absolute;top:-8px;right:-8px;background:#ef4444;border:none;color:#fff;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;">×</button>
                </div>
            `;

            btn.classList.remove('active');
        } catch (err) {
            console.log('Screenshot cancelled or failed:', err);
            document.getElementById('todo-tool-screenshot').classList.remove('active');
        }
    }

    function toggleVoiceInput() {
        if (isRecording) {
            stopVoiceInput();
        } else {
            startVoiceInput();
        }
    }

    function startVoiceInput() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('Voice input not supported in this browser');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        voiceRecognition = new SpeechRecognition();
        voiceRecognition.continuous = true;
        voiceRecognition.interimResults = true;

        const btn = document.getElementById('todo-tool-voice');
        const status = document.getElementById('todo-voice-status');
        const notes = document.getElementById('todo-notes-input');

        let finalTranscript = notes.value ? notes.value + ' ' : '';

        voiceRecognition.onstart = () => {
            isRecording = true;
            btn.classList.add('recording');
            btn.innerHTML = '⏹';
            status.textContent = 'Listening... (click to stop)';
            status.classList.add('listening');
        };

        voiceRecognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript = transcript;
                }
            }
            notes.value = finalTranscript + interimTranscript;
        };

        voiceRecognition.onerror = (event) => {
            console.log('Voice error:', event.error);
            stopVoiceInput();
        };

        voiceRecognition.onend = () => {
            stopVoiceInput();
        };

        voiceRecognition.start();
    }

    function stopVoiceInput() {
        if (voiceRecognition) {
            voiceRecognition.stop();
            voiceRecognition = null;
        }

        isRecording = false;
        const btn = document.getElementById('todo-tool-voice');
        const status = document.getElementById('todo-voice-status');

        btn.classList.remove('recording');
        btn.innerHTML = '🎤';
        status.textContent = '';
        status.classList.remove('listening');
    }

    // Reconcile functionality
    let reconcileDialog = null;
    let serverTodos = null;

    async function showReconcileDialog() {
        // Remove existing dialog
        if (reconcileDialog) reconcileDialog.remove();

        reconcileDialog = document.createElement('div');
        reconcileDialog.className = 'todo-reconcile-overlay';
        reconcileDialog.innerHTML = `
            <div class="todo-reconcile-dialog">
                <div class="reconcile-header">
                    <h4>🔄 Reconcile Todos</h4>
                    <div class="reconcile-header-actions">
                        <button class="reconcile-btn" id="reconcile-clear" title="Clear Log">🧹</button>
                        <button class="reconcile-close" id="reconcile-close">×</button>
                    </div>
                </div>
                <div class="reconcile-body">
                    <div class="reconcile-section">
                        <div class="reconcile-section-title">Sync Status</div>
                        <div class="reconcile-status" id="reconcile-status">Checking...</div>
                    </div>
                    <div class="reconcile-actions" id="reconcile-actions"></div>
                    <div class="reconcile-log" id="reconcile-log"></div>
                </div>
            </div>
        `;
        document.body.appendChild(reconcileDialog);

        document.getElementById('reconcile-close').onclick = closeReconcileDialog;
        document.getElementById('reconcile-clear').onclick = () => {
            const log = document.getElementById('reconcile-log');
            if (log) log.innerHTML = '';
        };
        reconcileDialog.onclick = (e) => {
            if (e.target === reconcileDialog) closeReconcileDialog();
        };

        // Check sync status
        await checkSyncStatus();
    }

    function closeReconcileDialog() {
        if (reconcileDialog) {
            reconcileDialog.remove();
            reconcileDialog = null;
        }
    }

    function logReconcile(msg, type = 'info') {
        const log = document.getElementById('reconcile-log');
        if (log) {
            const entry = document.createElement('div');
            entry.className = `reconcile-log-entry ${type}`;
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        }
    }

    async function checkSyncStatus() {
        const statusEl = document.getElementById('reconcile-status');
        const actionsEl = document.getElementById('reconcile-actions');

        logReconcile('Fetching server todos...');

        try {
            const response = await fetch(`${apiBase}/api/todos`);
            serverTodos = await response.json();

            const localCount = Object.values(allLists).flat().length;
            const serverCount = serverTodos.lists
                ? Object.values(serverTodos.lists).flat().length
                : (serverTodos.todos?.length || 0);

            // Compare
            const localHash = hashTodos(allLists);
            const serverHash = hashTodos(serverTodos.lists || { General: serverTodos.todos || [] });

            if (localHash === serverHash) {
                statusEl.className = 'reconcile-status synced';
                statusEl.innerHTML = `✓ In sync<br><small>Local: ${localCount} items | Server: ${serverCount} items</small>`;
                logReconcile('Todos are in sync', 'success');
                actionsEl.innerHTML = `
                    <button class="reconcile-btn" onclick="TodoModule._forceRefresh()">🔄 Refresh</button>
                    <button class="reconcile-btn has-submenu">📥 Export
                        <div class="reconcile-submenu">
                            <div class="reconcile-submenu-item" onclick="TodoModule._exportBackup()">Export All Lists</div>
                            <div class="reconcile-submenu-item" onclick="TodoModule._exportCurrentList()">Export Current List</div>
                            <div class="reconcile-submenu-item" onclick="TodoModule._exportCompleted()">Export Completed Only</div>
                        </div>
                    </button>
                    <button class="reconcile-btn has-submenu">📤 Import
                        <div class="reconcile-submenu">
                            <div class="reconcile-submenu-item" onclick="TodoModule._importBackup()">Merge with Existing</div>
                            <div class="reconcile-submenu-item" onclick="TodoModule._importToNewList()">Import to New List</div>
                            <div class="reconcile-submenu-divider"></div>
                            <div class="reconcile-submenu-item danger" onclick="TodoModule._importReplace()">Replace All</div>
                        </div>
                    </button>
                `;
            } else {
                statusEl.className = 'reconcile-status conflict';
                statusEl.innerHTML = `⚠ Out of sync<br><small>Local: ${localCount} items | Server: ${serverCount} items</small>`;
                logReconcile('Detected sync difference', 'error');
                actionsEl.innerHTML = `
                    <button class="reconcile-btn primary has-submenu">⬇ Merge
                        <div class="reconcile-submenu">
                            <div class="reconcile-submenu-item" onclick="TodoModule._mergeFromServer()">Merge All from Server</div>
                            <div class="reconcile-submenu-item" onclick="TodoModule._mergeUncompleted()">Merge Uncompleted Only</div>
                        </div>
                    </button>
                    <button class="reconcile-btn" onclick="TodoModule._pushToServer()">⬆ Push to Server</button>
                    <button class="reconcile-btn has-submenu">🔀 Smart Merge
                        <div class="reconcile-submenu">
                            <div class="reconcile-submenu-item" onclick="TodoModule._smartMerge()">Auto (Newest Wins)</div>
                            <div class="reconcile-submenu-item" onclick="TodoModule._smartMergeLocal()">Favor Local</div>
                            <div class="reconcile-submenu-item" onclick="TodoModule._smartMergeServer()">Favor Server</div>
                        </div>
                    </button>
                    <button class="reconcile-btn has-submenu">📤 Import
                        <div class="reconcile-submenu">
                            <div class="reconcile-submenu-item" onclick="TodoModule._importBackup()">Merge with Existing</div>
                            <div class="reconcile-submenu-item" onclick="TodoModule._importToNewList()">Import to New List</div>
                        </div>
                    </button>
                    <button class="reconcile-btn danger" onclick="TodoModule._resetToServer()">🗑 Reset</button>
                `;
            }
        } catch (err) {
            statusEl.className = 'reconcile-status error';
            statusEl.innerHTML = `✗ Error: ${err.message}`;
            logReconcile(`Error: ${err.message}`, 'error');
            actionsEl.innerHTML = `
                <button class="reconcile-btn" onclick="TodoModule._forceRefresh()">🔄 Retry</button>
            `;
        }
    }

    function hashTodos(lists) {
        // Simple hash based on todo IDs and completion status
        const items = Object.values(lists).flat();
        return items.map(t => `${t.id}:${t.completed}:${t.priority}`).sort().join('|');
    }

    async function forceRefresh() {
        logReconcile('Force refreshing from server...');
        await loadTodos();
        logReconcile('Refresh complete', 'success');
        await checkSyncStatus();
    }

    async function mergeFromServer() {
        logReconcile('Merging from server...');

        if (!serverTodos) {
            logReconcile('No server data available', 'error');
            return;
        }

        const serverLists = serverTodos.lists || { General: serverTodos.todos || [] };

        // Merge: add missing items from server
        let added = 0;
        for (const [listName, serverItems] of Object.entries(serverLists)) {
            if (!allLists[listName]) allLists[listName] = [];

            for (const serverItem of serverItems) {
                const exists = allLists[listName].some(t => t.id === serverItem.id);
                if (!exists) {
                    allLists[listName].push(serverItem);
                    added++;
                    logReconcile(`Added: ${serverItem.text.substring(0, 30)}...`);
                }
            }
        }

        todos = allLists[currentListName] || [];
        await saveTodos();
        render();
        populateListSelector();

        logReconcile(`Merged ${added} items from server`, 'success');
        await checkSyncStatus();
    }

    async function pushToServer() {
        logReconcile('Pushing local data to server...');
        await saveTodos();
        logReconcile('Push complete', 'success');
        await checkSyncStatus();
    }

    async function smartMerge() {
        logReconcile('Starting smart merge...');

        if (!serverTodos) {
            logReconcile('No server data available', 'error');
            return;
        }

        const serverLists = serverTodos.lists || { General: serverTodos.todos || [] };
        let merged = 0, updated = 0;

        for (const [listName, serverItems] of Object.entries(serverLists)) {
            if (!allLists[listName]) allLists[listName] = [];

            for (const serverItem of serverItems) {
                const localItem = allLists[listName].find(t => t.id === serverItem.id);

                if (!localItem) {
                    // Add missing item
                    allLists[listName].push(serverItem);
                    merged++;
                    logReconcile(`Added: ${serverItem.text.substring(0, 25)}...`);
                } else {
                    // Compare and take newer based on completion or priority changes
                    const serverDate = new Date(serverItem.createdAt || 0);
                    const localDate = new Date(localItem.createdAt || 0);

                    // If server item is completed and local isn't, use server
                    if (serverItem.completed && !localItem.completed) {
                        localItem.completed = true;
                        updated++;
                        logReconcile(`Updated completed: ${localItem.text.substring(0, 25)}...`);
                    }

                    // If server has higher priority, upgrade local
                    const priorityOrder = ['thought', 'low', 'medium', 'high', 'mustdo'];
                    if (priorityOrder.indexOf(serverItem.priority) > priorityOrder.indexOf(localItem.priority)) {
                        localItem.priority = serverItem.priority;
                        updated++;
                        logReconcile(`Upgraded priority: ${localItem.text.substring(0, 25)}...`);
                    }
                }
            }
        }

        // Also check local items not on server
        for (const [listName, localItems] of Object.entries(allLists)) {
            const serverItems = serverLists[listName] || [];
            for (const localItem of localItems) {
                const onServer = serverItems.some(t => t.id === localItem.id);
                if (!onServer) {
                    logReconcile(`Local only: ${localItem.text.substring(0, 25)}...`, 'info');
                }
            }
        }

        todos = allLists[currentListName] || [];
        await saveTodos();
        render();
        populateListSelector();

        logReconcile(`Smart merge complete: ${merged} added, ${updated} updated`, 'success');
        await checkSyncStatus();
    }

    async function resetToServer() {
        if (!confirm('This will replace all local todos with server data. Continue?')) {
            logReconcile('Reset cancelled');
            return;
        }

        logReconcile('Resetting to server data...');

        if (!serverTodos) {
            await loadTodos();
        } else {
            allLists = serverTodos.lists || { General: serverTodos.todos || [] };
            currentListName = serverTodos.currentList || 'General';
            todos = allLists[currentListName] || [];
            render();
            populateListSelector();
        }

        logReconcile('Reset complete', 'success');
        await checkSyncStatus();
    }

    function exportBackup() {
        const backup = {
            lists: allLists,
            currentList: currentListName,
            exportedAt: new Date().toISOString()
        };
        downloadBackup(backup, 'todos-backup');
        logReconcile('All lists exported', 'success');
    }

    function exportCurrentList() {
        const backup = {
            lists: { [currentListName]: allLists[currentListName] || [] },
            currentList: currentListName,
            exportedAt: new Date().toISOString()
        };
        downloadBackup(backup, `todos-${currentListName}`);
        logReconcile(`Exported list: ${currentListName}`, 'success');
    }

    function exportCompleted() {
        const completedLists = {};
        for (const [listName, items] of Object.entries(allLists)) {
            const completed = items.filter(t => t.completed);
            if (completed.length > 0) {
                completedLists[listName] = completed;
            }
        }
        const backup = {
            lists: completedLists,
            currentList: currentListName,
            exportedAt: new Date().toISOString()
        };
        downloadBackup(backup, 'todos-completed');
        logReconcile('Completed items exported', 'success');
    }

    function downloadBackup(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function importBackup() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            logReconcile(`Reading file: ${file.name}...`);

            try {
                const text = await file.text();
                const imported = JSON.parse(text);

                // Validate structure
                if (!imported.lists && !imported.todos) {
                    logReconcile('Invalid backup file format', 'error');
                    return;
                }

                const importedLists = imported.lists || { General: imported.todos || [] };
                let added = 0, skipped = 0;

                // Merge imported items
                for (const [listName, items] of Object.entries(importedLists)) {
                    if (!allLists[listName]) {
                        allLists[listName] = [];
                        logReconcile(`Created list: ${listName}`);
                    }

                    for (const item of items) {
                        // Check if item already exists (by ID or matching text)
                        const existsById = allLists[listName].some(t => t.id === item.id);
                        const existsByText = allLists[listName].some(t =>
                            t.text.toLowerCase() === item.text.toLowerCase()
                        );

                        if (!existsById && !existsByText) {
                            // Generate new ID to avoid conflicts
                            item.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                            allLists[listName].push(item);
                            added++;
                            logReconcile(`Added: ${item.text.substring(0, 30)}...`);
                        } else {
                            skipped++;
                        }
                    }
                }

                todos = allLists[currentListName] || [];
                await saveTodos();
                render();
                populateListSelector();

                logReconcile(`Import complete: ${added} added, ${skipped} duplicates skipped`, 'success');
                await checkSyncStatus();

            } catch (err) {
                logReconcile(`Import failed: ${err.message}`, 'error');
            }
        };

        input.click();
    }

    function importToNewList() {
        const listName = prompt('Import to new list named:', 'Imported');
        if (!listName || !listName.trim()) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const imported = JSON.parse(text);
                const importedLists = imported.lists || { General: imported.todos || [] };

                // Flatten all imported items into the new list
                const allItems = Object.values(importedLists).flat();
                allItems.forEach(item => {
                    item.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                });

                allLists[listName.trim()] = allItems;
                todos = allLists[currentListName] || [];

                await saveTodos();
                render();
                populateListSelector();

                logReconcile(`Imported ${allItems.length} items to "${listName.trim()}"`, 'success');
                await checkSyncStatus();
            } catch (err) {
                logReconcile(`Import failed: ${err.message}`, 'error');
            }
        };
        input.click();
    }

    async function importReplace() {
        if (!confirm('This will REPLACE all existing todos. Are you sure?')) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const imported = JSON.parse(text);

                allLists = imported.lists || { General: imported.todos || [] };
                currentListName = imported.currentList || 'General';
                todos = allLists[currentListName] || [];

                await saveTodos();
                render();
                populateListSelector();

                const count = Object.values(allLists).flat().length;
                logReconcile(`Replaced with ${count} items from backup`, 'success');
                await checkSyncStatus();
            } catch (err) {
                logReconcile(`Import failed: ${err.message}`, 'error');
            }
        };
        input.click();
    }

    async function mergeUncompleted() {
        logReconcile('Merging uncompleted items from server...');

        if (!serverTodos) {
            logReconcile('No server data available', 'error');
            return;
        }

        const serverLists = serverTodos.lists || { General: serverTodos.todos || [] };
        let added = 0;

        for (const [listName, serverItems] of Object.entries(serverLists)) {
            if (!allLists[listName]) allLists[listName] = [];

            for (const serverItem of serverItems) {
                if (serverItem.completed) continue; // Skip completed
                const exists = allLists[listName].some(t => t.id === serverItem.id);
                if (!exists) {
                    allLists[listName].push(serverItem);
                    added++;
                    logReconcile(`Added: ${serverItem.text.substring(0, 30)}...`);
                }
            }
        }

        todos = allLists[currentListName] || [];
        await saveTodos();
        render();
        populateListSelector();

        logReconcile(`Merged ${added} uncompleted items`, 'success');
        await checkSyncStatus();
    }

    async function smartMergeLocal() {
        logReconcile('Smart merge (favoring local)...');
        await doSmartMerge('local');
    }

    async function smartMergeServer() {
        logReconcile('Smart merge (favoring server)...');
        await doSmartMerge('server');
    }

    async function doSmartMerge(favor = 'auto') {
        if (!serverTodos) {
            logReconcile('No server data available', 'error');
            return;
        }

        const serverLists = serverTodos.lists || { General: serverTodos.todos || [] };
        let merged = 0, updated = 0;

        for (const [listName, serverItems] of Object.entries(serverLists)) {
            if (!allLists[listName]) allLists[listName] = [];

            for (const serverItem of serverItems) {
                const localItem = allLists[listName].find(t => t.id === serverItem.id);

                if (!localItem) {
                    allLists[listName].push(serverItem);
                    merged++;
                } else {
                    // Conflict resolution based on favor mode
                    if (favor === 'server') {
                        // Server wins - update local with server values
                        Object.assign(localItem, serverItem);
                        updated++;
                    } else if (favor === 'local') {
                        // Local wins - keep local values (no change)
                    } else {
                        // Auto - use existing smart merge logic (newest wins)
                        if (serverItem.completed && !localItem.completed) {
                            localItem.completed = true;
                            updated++;
                        }
                    }
                }
            }
        }

        todos = allLists[currentListName] || [];
        await saveTodos();
        render();
        populateListSelector();

        logReconcile(`Smart merge: ${merged} added, ${updated} updated (favor: ${favor})`, 'success');
        await checkSyncStatus();
    }

    function populateListSelector() {
        const selector = document.getElementById('todo-list-selector');
        // Get all list names, excluding ALL_LISTS_KEY (it's added separately at top)
        const lists = (Object.keys(allLists).length > 0 ? Object.keys(allLists) : DEFAULT_LISTS)
            .filter(name => name !== ALL_LISTS_KEY);
        // Add "All" option at the top (always first, never duplicated)
        const allOption = `<option value="${ALL_LISTS_KEY}" ${currentListName === ALL_LISTS_KEY ? 'selected' : ''}>${ALL_LISTS_KEY}</option>`;
        const listOptions = lists.map(name =>
            `<option value="${name}" ${name === currentListName ? 'selected' : ''}>${name}</option>`
        ).join('');
        selector.innerHTML = allOption + listOptions;
    }
    
    function switchList(listName) {
        // Save current list first (but not if currently viewing "All")
        if (currentListName !== ALL_LISTS_KEY) {
            allLists[currentListName] = todos;
        }

        currentListName = listName;

        // Handle "All" view - combine all lists
        if (listName === ALL_LISTS_KEY) {
            todos = getAllTodosCombined();
        } else {
            todos = allLists[listName] || [];
        }
        render();
        saveState();
        // Don't save when viewing "All" - it's a virtual view
        if (listName !== ALL_LISTS_KEY) {
            saveTodos();
        }
    }

    // Combine all todos from all lists with source list info
    function getAllTodosCombined() {
        const combined = [];
        for (const [listName, items] of Object.entries(allLists)) {
            items.forEach(todo => {
                combined.push({
                    ...todo,
                    _sourceList: listName  // Track which list this came from
                });
            });
        }
        // Sort by priority then by date
        const priorityOrder = { mustdo: 0, high: 1, medium: 2, low: 3, thought: 4 };
        combined.sort((a, b) => {
            // Incomplete first
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            // Then by priority
            const pa = priorityOrder[a.priority] ?? 2;
            const pb = priorityOrder[b.priority] ?? 2;
            if (pa !== pb) return pa - pb;
            // Then by date (newest first)
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        return combined;
    }
    
    function createNewList() {
        const name = prompt('New list name:');
        if (!name || name.trim() === '') return;
        
        const trimmedName = name.trim();
        if (allLists[trimmedName]) {
            alert('List already exists');
            return;
        }
        
        // Save current list
        allLists[currentListName] = todos;
        
        // Create new list
        allLists[trimmedName] = [];
        currentListName = trimmedName;
        todos = [];
        
        populateListSelector();
        render();
        saveState();
        saveTodos();
    }

    function toggleMinimize() {
        const panel = document.getElementById('todo-panel');
        isMinimized = !isMinimized;
        panel.classList.toggle('minimized', isMinimized);
        document.getElementById('todo-minimize').textContent = isMinimized ? '+' : '−';
        saveState();
    }

    function togglePin() {
        isPinned = !isPinned;
        localStorage.setItem('todo-panel-pinned', isPinned);
        updatePinButton();
    }

    function updatePinButton() {
        const btn = document.getElementById('todo-pin');
        const panel = document.getElementById('todo-panel');
        if (btn) {
            btn.textContent = isPinned ? '📌' : '👆';
            btn.title = isPinned ? 'Pinned (click for hover mode)' : 'Hover mode (click to pin)';
            btn.classList.toggle('active', isPinned);
        }
        if (panel) {
            panel.classList.toggle('hover-mode', !isPinned);
        }
    }

    function hide() {
        document.getElementById('todo-panel').style.display = 'none';
        saveState();
    }

    function toggle() {
        console.log("toggle called");
        let panel = document.getElementById('todo-panel');

        // Auto-initialize if panel doesn't exist
        if (!panel) {
            createStyles();
            createPanel();
            panel = document.getElementById('todo-panel');
            if (!panel) return;
        }

        // Use computed style for reliable check
        const computedDisplay = getComputedStyle(panel).display;
        const isHidden = computedDisplay === 'none';
        console.log("toggle: display=", computedDisplay, "isHidden=", isHidden);

        if (isHidden) {
            // Reset position to ensure visibility
            panel.style.top = '80px';
            panel.style.right = '20px';
            panel.style.left = 'auto';
            panel.classList.remove('minimized');
            isMinimized = false;
            show();
        } else {
            hide();
        }
    }

    function show() {
        const panel = document.getElementById('todo-panel');
        panel.style.display = 'flex';
        loadTodos();
        saveState();
    }
    
    function saveState() {
        const panel = document.getElementById('todo-panel');
        const state = {
            visible: panel.style.display !== 'none',
            minimized: isMinimized,
            currentList: currentListName,
            top: panel.style.top,
            left: panel.style.left,
            right: panel.style.right
        };
        localStorage.setItem('todo-panel-state', JSON.stringify(state));
    }
    
    function loadState() {
        try {
            const saved = localStorage.getItem('todo-panel-state');
            if (saved) {
                const state = JSON.parse(saved);
                const panel = document.getElementById('todo-panel');

                // Note: currentListName always defaults to "All" on page load
                // (set in init before loadState is called)

                if (state.visible) {
                    panel.style.display = 'flex';
                    loadTodos();
                }

                if (state.minimized) {
                    isMinimized = true;
                    panel.classList.add('minimized');
                    document.getElementById('todo-minimize').textContent = '+';
                }

                if (state.top) panel.style.top = state.top;
                if (state.left) panel.style.left = state.left;
                if (state.right) panel.style.right = state.right;
            }

            // Restore pin state
            const pinnedState = localStorage.getItem('todo-panel-pinned');
            if (pinnedState !== null) {
                isPinned = pinnedState === 'true';
            }
            updatePinButton();
        } catch (err) {
            console.error('Failed to load todo panel state:', err);
        }
    }

    async function loadTodos() {
        console.log("loadTodos called, apiBase:", apiBase);
        try {
            const response = await fetch(`${apiBase}/api/todos`);
            const data = await response.json();
            console.log("loadTodos received:", data.lists ? Object.keys(data.lists) : "no lists", "current:", currentListName);
            
            // Always ensure default lists exist
            DEFAULT_LISTS.forEach(name => {
                if (!allLists[name]) {
                    allLists[name] = [];
                }
            });
            
            // Handle new multi-list format or migrate from old format
            if (data.lists && Object.keys(data.lists).length > 0) {
                // Merge with defaults
                Object.keys(data.lists).forEach(name => {
                    allLists[name] = data.lists[name];
                });
                currentListName = data.currentList || currentListName;
            } else if (data.todos && data.todos.length > 0) {
                // Migrate old format - put old todos in General
                allLists['General'] = data.todos;
                currentListName = 'General';
            }
            
            // Handle "All" view or ensure current list exists
            if (currentListName === ALL_LISTS_KEY) {
                // "All" is a virtual view - combine all lists
                todos = getAllTodosCombined();
            } else if (!allLists[currentListName]) {
                currentListName = 'General';
                todos = allLists[currentListName] || [];
            } else {
                todos = allLists[currentListName] || [];
            }

            populateListSelector();
            render();

            // Save to ensure defaults are persisted (but not when viewing "All")
            if (currentListName !== ALL_LISTS_KEY) {
                saveTodos();
            }
        } catch (err) {
            console.error('Failed to load todos:', err);
            DEFAULT_LISTS.forEach(name => {
                allLists[name] = [];
            });
            todos = [];
            populateListSelector();
            render();
        }
    }

    async function saveTodos() {
        try {
            // Don't save when viewing "All" - it's a virtual view
            if (currentListName === ALL_LISTS_KEY) {
                console.log('[TodoModule] Skipping save - viewing All (use saveTodosAllLists instead)');
                return;
            }

            // Update current list in allLists
            allLists[currentListName] = todos;

            await fetch(`${apiBase}/api/todos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lists: allLists,
                    currentList: currentListName
                })
            });
        } catch (err) {
            console.error('Failed to save todos:', err);
        }
    }

    function render() {
        console.log('[TodoModule] render() called, todos.length:', todos.length);
        const body = document.getElementById('todo-body');
        const count = document.getElementById('todo-count');

        const activeTodos = todos.filter(t => !t.completed);
        count.textContent = activeTodos.length;

        if (todos.length === 0) {
            console.log('[TodoModule] render() - no todos, showing empty state');
            body.innerHTML = '<div class="todo-empty">No tasks yet.<br>Add one below!</div>';
            return;
        }

        // Group by priority
        const grouped = {};
        PRIORITIES.forEach(p => grouped[p.id] = []);
        todos.forEach(t => {
            console.log('[TodoModule] Grouping todo:', t.id, 'priority:', t.priority, 'grouped[priority]:', !!grouped[t.priority]);
            if (grouped[t.priority]) grouped[t.priority].push(t);
            else grouped['medium'].push(t);
        });

        // Sort each group: incomplete first, completed at bottom
        PRIORITIES.forEach(p => {
            grouped[p.id].sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));
        });

        let html = '';
        PRIORITIES.forEach(p => {
            const items = grouped[p.id];
            if (items.length === 0) return;
            
            const isCollapsed = collapsedSections[p.id] ? 'collapsed' : '';
            html += `
                <div class="todo-section ${isCollapsed}" data-priority="${p.id}">
                    <div class="todo-section-header" data-priority="${p.id}">
                        <span class="todo-section-dot" style="background:${p.color}"></span>
                        ${p.label} (${items.length})
                        <span class="todo-section-toggle">▼</span>
                    </div>
                    ${items.map(t => renderItem(t)).join('')}
                </div>
            `;
        });

        body.innerHTML = html;
        setupItemEvents();
        setupSectionToggles();
    }

    function setupSectionToggles() {
        document.querySelectorAll('.todo-section-header').forEach(header => {
            header.addEventListener('click', (e) => {
                // Don't toggle if clicking on items inside
                if (e.target.closest('.todo-item')) return;

                const priority = header.dataset.priority;
                const section = header.closest('.todo-section');

                collapsedSections[priority] = !collapsedSections[priority];
                section.classList.toggle('collapsed', collapsedSections[priority]);

                // Save state
                localStorage.setItem('todo-collapsed-sections', JSON.stringify(collapsedSections));
            });
        });
    }

    function loadCollapsedState() {
        try {
            const saved = localStorage.getItem('todo-collapsed-sections');
            if (saved) {
                collapsedSections = JSON.parse(saved);
            }
        } catch (err) {
            collapsedSections = {};
        }
    }

    function renderItem(todo) {
        const time = new Date(todo.createdAt).toLocaleDateString();
        const imageHtml = todo.image
            ? `<img src="${todo.image}" class="todo-item-image" data-action="view-image" title="Click to view">`
            : '';
        const testingBadge = todo.needsTesting
            ? '<span class="todo-testing-badge" title="Needs Testing">🧪</span>'
            : '';
        // Show source list badge when in "All" view
        const sourceListBadge = (currentListName === ALL_LISTS_KEY && todo._sourceList)
            ? `<span class="todo-source-badge" title="From: ${todo._sourceList}">[${todo._sourceList}]</span>`
            : '';
        const itemClasses = [
            'todo-item',
            todo.completed ? 'completed' : '',
            todo.needsTesting ? 'needs-testing' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${itemClasses}"
                 data-id="${todo.id}"
                 data-source-list="${todo._sourceList || ''}"
                 draggable="true">
                <div class="todo-checkbox ${todo.completed ? 'checked' : ''}" data-action="toggle"></div>
                <div class="todo-content">
                    <div class="todo-text" data-action="edit-text" title="Click to edit">${escapeHtml(todo.text)}${testingBadge}</div>
                    ${todo.thought ? `<div class="todo-thought" data-action="edit-thought" title="Click to edit">💭 ${escapeHtml(todo.thought)}</div>` : ''}
                    ${imageHtml}
                    <div class="todo-meta">${sourceListBadge} ${time}</div>
                </div>
                <div class="todo-actions">
                    <button class="todo-action-btn" data-action="add-image" title="Add screenshot">📷</button>
                    <button class="todo-action-btn" data-action="send" title="Send to ${config.assistantName}">➤</button>
                    <button class="todo-action-btn" data-action="priority" title="Change priority">◐</button>
                    <button class="todo-action-btn delete" data-action="delete" title="Delete">×</button>
                </div>
            </div>
        `;
    }

    function setupItemEvents() {
        document.querySelectorAll('.todo-item').forEach(item => {
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
            item.addEventListener('dragleave', handleDragLeave);

            // Context menu (right-click)
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showTodoContextMenu(e, item.dataset.id);
            });

            item.querySelector('[data-action="toggle"]').addEventListener('click', () => {
                toggleComplete(item.dataset.id);
            });

            item.querySelector('[data-action="delete"]').addEventListener('click', () => {
                deleteTodo(item.dataset.id);
            });

            item.querySelector('[data-action="priority"]').addEventListener('click', (e) => {
                showPriorityMenu(e, item.dataset.id);
            });

            // Send to input button
            item.querySelector('[data-action="send"]').addEventListener('click', () => {
                copyToInput(item.dataset.id);
            });
            
            // Click to edit text
            const textEl = item.querySelector('[data-action="edit-text"]');
            if (textEl) {
                textEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    startEditText(item.dataset.id, textEl);
                });
            }
            
            // Click to edit thought
            const thoughtEl = item.querySelector('[data-action="edit-thought"]');
            if (thoughtEl) {
                thoughtEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    startEditThought(item.dataset.id, thoughtEl);
                });
            }

            // View image
            const imageEl = item.querySelector('[data-action="view-image"]');
            if (imageEl) {
                imageEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    viewImage(imageEl.src);
                });
            }

            // Add image to existing todo
            const addImageBtn = item.querySelector('[data-action="add-image"]');
            if (addImageBtn) {
                addImageBtn.addEventListener('click', () => {
                    addImageToTodo(item.dataset.id);
                });
            }
        });
    }

    async function addImageToTodo(id) {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' }
            });

            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            stream.getTracks().forEach(track => track.stop());

            const imageData = canvas.toDataURL('image/png');

            const todo = todos.find(t => t.id === id);
            if (todo) {
                todo.image = imageData;
                saveTodos();
                render();
            }
        } catch (err) {
            console.log('Screenshot cancelled:', err);
        }
    }

    function viewImage(src) {
        const modal = document.createElement('div');
        modal.className = 'todo-image-modal';
        modal.innerHTML = `<img src="${src}" alt="Todo image">`;
        modal.onclick = () => modal.remove();
        document.body.appendChild(modal);

        // Close on Escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    function handleDragStart(e) {
        draggedItem = e.target.closest('.todo-item');
        draggedItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd(e) {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        }
        document.querySelectorAll('.todo-item').forEach(i => i.classList.remove('drag-over'));
    }

    function handleDragOver(e) {
        e.preventDefault();
        const item = e.target.closest('.todo-item');
        if (item && item !== draggedItem) {
            item.classList.add('drag-over');
        }
        
        // Auto-scroll when near edges
        const todoBody = document.querySelector('.todo-body');
        if (todoBody) {
            const rect = todoBody.getBoundingClientRect();
            const scrollZone = 40; // pixels from edge to trigger scroll
            const scrollSpeed = 8;
            
            if (e.clientY < rect.top + scrollZone) {
                // Near top - scroll up
                todoBody.scrollTop -= scrollSpeed;
            } else if (e.clientY > rect.bottom - scrollZone) {
                // Near bottom - scroll down
                todoBody.scrollTop += scrollSpeed;
            }
        }
    }

    function handleDragLeave(e) {
        const item = e.target.closest('.todo-item');
        if (item) item.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        const targetItem = e.target.closest('.todo-item');
        if (!targetItem || !draggedItem || targetItem === draggedItem) return;

        const draggedId = draggedItem.dataset.id;
        const targetId = targetItem.dataset.id;
        
        // Get target's priority section
        const targetSection = targetItem.closest('.todo-section');
        const newPriority = targetSection ? targetSection.dataset.priority : 'medium';

        // Find indices
        const draggedIdx = todos.findIndex(t => t.id === draggedId);
        const targetIdx = todos.findIndex(t => t.id === targetId);

        if (draggedIdx > -1 && targetIdx > -1) {
            // Update priority
            todos[draggedIdx].priority = newPriority;
            
            // Reorder
            const [removed] = todos.splice(draggedIdx, 1);
            const newTargetIdx = todos.findIndex(t => t.id === targetId);
            todos.splice(newTargetIdx, 0, removed);
            
            saveTodos();
            render();
        }
    }

    function showPriorityMenu(e, todoId) {
        // Remove existing menu
        const existing = document.querySelector('.priority-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.className = 'priority-menu';

        menu.innerHTML = PRIORITIES.map(p => `
            <div class="priority-menu-item" data-priority="${p.id}">
                <span style="color:${p.color}">●</span> ${p.label}
            </div>
        `).join('') + `
            <div class="priority-menu-divider"></div>
            <div class="priority-menu-item cancel" data-action="cancel">
                <span style="color:#666">✕</span> Cancel
            </div>
        `;

        document.body.appendChild(menu);

        // Position menu within viewport bounds
        const menuRect = menu.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const gap = 8;

        let left = e.clientX;
        let top = e.clientY;

        // Shift left if overflows right edge
        if (left + menuRect.width > vw - gap) {
            left = vw - menuRect.width - gap;
        }
        // Shift right if overflows left edge
        if (left < gap) {
            left = gap;
        }
        // Flip up if overflows bottom
        if (top + menuRect.height > vh - gap) {
            top = e.clientY - menuRect.height;
        }
        // Clamp top
        if (top < gap) {
            top = gap;
        }

        menu.style.left = left + 'px';
        menu.style.top = top + 'px';

        menu.querySelectorAll('.priority-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.action === 'cancel') {
                    menu.remove();
                    return;
                }
                changePriority(todoId, item.dataset.priority);
                menu.remove();
            });
        });

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 0);

        // Close on Escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                menu.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    function changePriority(id, priority) {
        const todo = todos.find(t => t.id === id);
        if (todo) {
            todo.priority = priority;
            saveTodos();
            render();
        }
    }

    // Context menu for todo items using MenuUtils
    function showTodoContextMenu(e, todoId) {
        const todo = todos.find(t => t.id === todoId);
        if (!todo) return;

        // Use MenuUtils if available, fallback to simple menu
        if (typeof MenuUtils !== 'undefined') {
            const items = [
                { header: 'Actions' },
                {
                    icon: todo.completed ? '↩' : '✓',
                    label: todo.completed ? 'Mark Incomplete' : 'Mark Complete',
                    action: () => toggleComplete(todoId)
                },
                {
                    icon: '🧪',
                    label: todo.needsTesting ? 'Clear Testing Flag' : 'Mark Needs Testing',
                    action: () => toggleNeedsTesting(todoId)
                },
                {
                    icon: '➤',
                    label: `Send to ${config.assistantName}`,
                    action: () => copyToInput(todoId)
                },
                { divider: true },
                { header: 'Priority' },
                ...PRIORITIES.map(p => ({
                    icon: '●',
                    label: p.label.replace(/^[^ ]+ /, ''),  // Remove emoji prefix
                    action: () => changePriority(todoId, p.id)
                })),
                { divider: true },
                {
                    icon: '📝',
                    label: 'Edit Text',
                    action: () => {
                        const textEl = document.querySelector(`.todo-item[data-id="${todoId}"] .todo-text`);
                        if (textEl) startEditText(todoId, textEl);
                    }
                },
                {
                    icon: '💭',
                    label: todo.thought ? 'Edit Thought' : 'Add Thought',
                    action: () => {
                        const thoughtEl = document.querySelector(`.todo-item[data-id="${todoId}"] .todo-thought`);
                        if (thoughtEl) {
                            startEditThought(todoId, thoughtEl);
                        } else {
                            addThought(todoId);
                        }
                    }
                },
                {
                    icon: '📷',
                    label: 'Add Screenshot',
                    action: () => addImageToTodo(todoId)
                },
                {
                    icon: '📋',
                    label: 'Copy Text',
                    action: () => {
                        navigator.clipboard.writeText(todo.text);
                        showNotification('Copied to clipboard');
                    }
                },
                { divider: true },
                {
                    icon: '🗑',
                    label: 'Delete',
                    danger: true,
                    action: () => deleteTodo(todoId)
                }
            ];

            MenuUtils.createContextMenu(items, { x: e.pageX, y: e.pageY });
        } else {
            // Fallback to old priority menu
            showPriorityMenu(e, todoId);
        }
    }

    // Toggle needs testing flag
    function toggleNeedsTesting(id) {
        const todo = todos.find(t => t.id === id);
        if (todo) {
            todo.needsTesting = !todo.needsTesting;
            saveTodos();
            render();
            showNotification(todo.needsTesting ? 'Marked for testing' : 'Testing flag cleared');
        }
    }

    // Add thought to a todo
    function addThought(id) {
        const todo = todos.find(t => t.id === id);
        if (todo) {
            const thought = prompt('Add a thought or note:');
            if (thought && thought.trim()) {
                todo.thought = thought.trim();
                saveTodos();
                render();
            }
        }
    }

    // Simple notification
    function showNotification(message) {
        const existing = document.querySelector('.todo-notification');
        if (existing) existing.remove();

        const notif = document.createElement('div');
        notif.className = 'todo-notification';
        notif.textContent = message;
        notif.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #2a2a3e;
            color: #fff;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 99999;
            animation: fadeInOut 2s ease forwards;
        `;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 2000);
    }

    function toggleComplete(id) {
        const todo = todos.find(t => t.id === id);
        if (!todo) return;

        // Get the item element for animation
        const item = document.querySelector(`.todo-item[data-id="${id}"]`);

        const doToggle = () => {
            todo.completed = !todo.completed;
            // If in "All" view, update the source list
            if (currentListName === ALL_LISTS_KEY && todo._sourceList) {
                const srcTodo = allLists[todo._sourceList]?.find(t => t.id === id);
                if (srcTodo) srcTodo.completed = todo.completed;
                saveTodosAllLists();
            } else {
                saveTodos();
            }
            render();
        };

        if (!todo.completed && item) {
            // Animate fade when completing
            item.style.opacity = '0.5';
            item.style.transform = 'translateX(10px)';
            setTimeout(doToggle, 300);
        } else {
            doToggle();
        }
    }

    function deleteTodo(id) {
        const todo = todos.find(t => t.id === id);

        // If in "All" view, delete from the source list
        if (currentListName === ALL_LISTS_KEY && todo?._sourceList) {
            allLists[todo._sourceList] = allLists[todo._sourceList].filter(t => t.id !== id);
            todos = getAllTodosCombined();
            saveTodosAllLists();
        } else {
            todos = todos.filter(t => t.id !== id);
            saveTodos();
        }
        render();
    }

    // Save all lists (used when modifying from "All" view)
    async function saveTodosAllLists() {
        try {
            await fetch(`${apiBase}/api/todos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lists: allLists,
                    currentList: currentListName === ALL_LISTS_KEY ? 'General' : currentListName
                })
            });
        } catch (err) {
            console.error('Failed to save todos:', err);
        }
    }
    
    function startEditText(id, element) {
        const todo = todos.find(t => t.id === id);
        if (!todo) return;
        
        const currentText = todo.text;
        const rect = element.getBoundingClientRect();
        
        const textarea = document.createElement('textarea');
        textarea.className = 'todo-edit-input';
        textarea.value = currentText;
        textarea.style.minHeight = Math.max(rect.height, 24) + 'px';
        
        element.innerHTML = '';
        element.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        // Auto-resize to content
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
        
        const saveEdit = () => {
            const newText = textarea.value.trim();
            if (newText && newText !== currentText) {
                todo.text = newText;
                // If in "All" view, update the source list
                if (currentListName === ALL_LISTS_KEY && todo._sourceList) {
                    const srcTodo = allLists[todo._sourceList]?.find(t => t.id === id);
                    if (srcTodo) srcTodo.text = newText;
                    saveTodosAllLists();
                } else {
                    saveTodos();
                }
            }
            render();
        };
        
        textarea.addEventListener('blur', saveEdit);
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textarea.blur();
            } else if (e.key === 'Escape') {
                render();
            }
        });
    }
    
    function startEditThought(id, element) {
        const todo = todos.find(t => t.id === id);
        if (!todo) return;
        
        const currentThought = todo.thought || '';
        const rect = element.getBoundingClientRect();
        
        const textarea = document.createElement('textarea');
        textarea.className = 'todo-edit-input';
        textarea.value = currentThought;
        textarea.placeholder = 'Add thought...';
        textarea.style.minHeight = Math.max(rect.height, 20) + 'px';
        textarea.style.fontSize = '11px';
        textarea.style.fontStyle = 'italic';
        
        element.innerHTML = '';
        element.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        // Auto-resize to content
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
        
        const saveEdit = () => {
            const newThought = textarea.value.trim();
            if (newThought !== currentThought) {
                todo.thought = newThought;
                saveTodos();
            }
            render();
        };
        
        textarea.addEventListener('blur', saveEdit);
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textarea.blur();
            } else if (e.key === 'Escape') {
                render();
            }
        });
    }

    function copyToInput(id) {
        const todo = todos.find(t => t.id === id);
        if (!todo) return;

        // Send to Kitt via TaskProcessor (relay queue)
        if (typeof TaskProcessor !== 'undefined' && TaskProcessor.submit) {
            // Build task content with todo text and any notes/thought
            let taskContent = todo.text;
            if (todo.thought) {
                taskContent += `\n\n💭 Notes: ${todo.thought}`;
            }

            TaskProcessor.submit(taskContent, {
                priority: todo.priority || 'normal',
                source: 'todo-module'
            });

            // Visual feedback - green flash for sent
            const item = document.querySelector(`.todo-item[data-id="${id}"]`);
            if (item) {
                item.style.background = '#2a5a2a';
                item.style.transition = 'background 0.3s';
                setTimeout(() => {
                    item.style.background = '';
                }, 500);
            }

            // Show notification
            if (typeof showNotification === 'function') {
                showNotification(`Task sent to ${config.assistantName}`, 'success');
            }

            console.log(`[TodoModule] Sent to ${config.assistantName}:`, taskContent.substring(0, 50));
        } else {
            // Fallback: copy to input field
            const input = document.querySelector(config.inputSelector);
            if (input) {
                input.value = todo.text;
                input.focus();

                const item = document.querySelector(`.todo-item[data-id="${id}"]`);
                if (item) {
                    item.style.background = '#3a5a3a';
                    setTimeout(() => {
                        item.style.background = '';
                    }, 300);
                }
            }
        }
    }

    function addTodo() {
        console.log('[TodoModule] addTodo() called');
        const input = document.getElementById('todo-new-input');
        const prioritySelect = document.getElementById('todo-new-priority');
        const notesInput = document.getElementById('todo-notes-input');

        if (!input) {
            console.error('[TodoModule] Input element not found!');
            return;
        }

        const text = input.value.trim();
        const priority = prioritySelect?.value;
        const notes = notesInput ? notesInput.value.trim() : '';

        console.log('[TodoModule] Input text:', text, 'Priority:', priority, 'CurrentList:', currentListName);

        if (!text) {
            console.log('[TodoModule] Empty text, returning');
            return;
        }

        // Require priority selection
        if (!priority) {
            console.log('[TodoModule] No priority selected');
            prioritySelect.style.borderColor = '#ef4444';
            prioritySelect.style.animation = 'shake 0.3s';
            setTimeout(() => {
                prioritySelect.style.borderColor = '';
                prioritySelect.style.animation = '';
            }, 1000);
            prioritySelect.focus();
            return;
        }

        const todo = {
            id: Date.now().toString(),
            text,
            thought: notes,
            priority,
            completed: false,
            createdAt: new Date().toISOString()
        };

        // Add image if captured
        if (capturedImage) {
            todo.image = capturedImage;
        }

        // When viewing "All", add to "General" list instead of virtual "All"
        if (currentListName === ALL_LISTS_KEY) {
            console.log('[TodoModule] Adding to General list (viewing All)');
            // Add to General list
            if (!allLists['General']) allLists['General'] = [];
            allLists['General'].unshift(todo);
            // Refresh the combined view
            todos = getAllTodosCombined();
            saveTodosAllLists();
        } else {
            console.log('[TodoModule] Adding to', currentListName);
            todos.unshift(todo);
            saveTodos();
        }

        console.log('[TodoModule] Todo added, rendering. Todos count:', todos.length);
        console.log('[TodoModule] Todo object:', JSON.stringify(todo));
        console.log('[TodoModule] Current todos array:', todos.map(t => ({id: t.id, text: t.text, priority: t.priority})));

        // Auto-expand the priority section so new task is visible
        if (collapsedSections[priority]) {
            console.log('[TodoModule] Auto-expanding collapsed section:', priority);
            collapsedSections[priority] = false;
            localStorage.setItem('todo-collapsed-sections', JSON.stringify(collapsedSections));
        }

        render();

        // Scroll to show the new task
        setTimeout(() => {
            const newTaskEl = document.querySelector(`[data-id="${todo.id}"]`);
            if (newTaskEl) {
                newTaskEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Briefly highlight the new task
                newTaskEl.style.outline = '2px solid #00d9ff';
                setTimeout(() => newTaskEl.style.outline = '', 1500);
            } else {
                console.warn('[TodoModule] Could not find new task element in DOM:', todo.id);
            }
        }, 100);

        // Reset inputs
        input.value = '';
        collapseInput();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function init(baseUrl, options = {}) {
        apiBase = baseUrl || `http://${location.hostname}:8585`;
        config = { ...config, ...options };

        // Always default to "All" list on page load
        currentListName = ALL_LISTS_KEY;

        loadCollapsedState();
        createStyles();
        createPanel();
        loadState();

        // Always load todos on init (fixes dropdown not populated issue)
        loadTodos();

        // Merge with TaskProcessor (Claude Tasks)
        if (typeof TaskProcessor !== 'undefined') {
            TaskProcessor.on('taskStateChange', ({ task, newState }) => {
                syncTaskToTodo(task, newState);
            });
            // Initial sync of existing tasks
            setTimeout(() => {
                const tasks = TaskProcessor.getAllTasks?.() || [];
                tasks.forEach(t => syncTaskToTodo(t, t.state));
            }, 1000);
        }
    }

    function syncTaskToTodo(task, state) {
        if (!allLists['Claude']) allLists['Claude'] = [];
        const list = allLists['Claude'];
        const existing = list.find(t => t.id === task.id);

        if (existing) {
            existing.completed = (state === 'complete');
            existing.text = task.content;
        } else if (state !== 'complete' && state !== 'cancelled') {
            list.push({
                id: task.id,
                text: task.content,
                priority: task.priority === 'high' ? 'high' : 'medium',
                completed: false,
                createdAt: task.createdAt
            });
        }

        if (currentListName === 'Claude' || currentListName === ALL_LISTS_KEY) {
            todos = currentListName === ALL_LISTS_KEY
                ? Object.values(allLists).flat()
                : allLists[currentListName] || [];
            render();
        }
        populateListSelector();
    }

    return {
        init,
        show,
        hide,
        toggle,
        loadTodos,
        // Reconcile functions (prefixed with _ for internal use via onclick)
        _forceRefresh: forceRefresh,
        _mergeFromServer: mergeFromServer,
        _mergeUncompleted: mergeUncompleted,
        _pushToServer: pushToServer,
        _smartMerge: smartMerge,
        _smartMergeLocal: smartMergeLocal,
        _smartMergeServer: smartMergeServer,
        _resetToServer: resetToServer,
        _exportBackup: exportBackup,
        _exportCurrentList: exportCurrentList,
        _exportCompleted: exportCompleted,
        _importBackup: importBackup,
        _importToNewList: importToNewList,
        _importReplace: importReplace
    };
})();
