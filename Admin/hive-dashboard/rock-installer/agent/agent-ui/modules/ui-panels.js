/**
 * Admin Kitt - UI Panels Module
 * Version: v2.0.0
 * Last updated: 2026-01-10
 * 
 * Handles: Admin menu, Services panel, Log viewer, Modals
 */

const UIPanels = (function() {
    'use strict';
    
    const config = {
        baseHost: location.hostname
    };
    
    let currentLogService = null;
    
    // ==================== PANEL MANAGEMENT ====================
    function togglePanel(panel) {
        const adminMenu = document.getElementById('admin-menu');
        const adminOverlay = document.getElementById('admin-overlay');

        // All panels now use admin menu (services merged into SERVERS section)
        adminMenu.classList.toggle('active');
        adminOverlay.classList.toggle('active');
    }

    function closeAll() {
        document.getElementById('admin-menu')?.classList.remove('active');
        document.getElementById('admin-overlay')?.classList.remove('active');
    }
    
    // ==================== LOG VIEWER ====================
    function toggleLog(service) {
        const logModal = document.getElementById('log-modal');
        if (logModal.classList.contains('active')) {
            logModal.classList.remove('active');
        } else {
            showLog(service);
        }
    }
    
    async function showLog(service) {
        currentLogService = service;
        document.getElementById('log-selector').value = service;
        document.getElementById('log-modal').classList.add('active');
        await refreshLog();
    }
    
    async function refreshLog() {
        const logContent = document.getElementById('log-content');
        const service = document.getElementById('log-selector').value;
        currentLogService = service;
        logContent.textContent = 'Loading...';
        
        if (service === 'kitt') {
            try {
                const response = await fetch(`http://${config.baseHost}:8585/api/logs/kitt`);
                const data = await response.json();
                logContent.innerHTML = formatKittLog(data.entries || []);
            } catch (err) {
                logContent.textContent = `Error: ${err.message}`;
            }
            return;
        }
        
        let endpoint;
        if (['agent', 'errors', 'chat', 'usage'].includes(service)) {
            endpoint = `http://${location.hostname}:8585/api/logs/${service}`;
        } else {
            endpoint = `http://${config.baseHost}:8080/api/logs/${service}`;
        }
        
        try {
            const response = await fetch(endpoint, { timeout: 3000 });
            if (response.ok) {
                const data = await response.json();
                logContent.innerHTML = formatLog(data.log || 'No log data', service);
            } else {
                logContent.textContent = 'Failed to fetch log';
            }
        } catch (err) {
            logContent.textContent = `Error: ${err.message}\n\nService may not be running.`;
        }
    }
    
    function formatKittLog(entries) {
        if (!entries || entries.length === 0) {
            return '<div style="color:#888;text-align:center;padding:20px;">No Kitt communications yet</div>';
        }
        
        let html = '<div style="display:flex;flex-direction:column;gap:6px;">';
        let lastDate = '';
        
        const icons = { 'user': '📱', 'user-relay': '📱→', 'kitt': '🤖', 'claude-relay': '🖥️→' };
        const colors = {
            'user': { bg: '#1a3a5a', border: '#4a9eff' },
            'user-relay': { bg: '#1a3a5a', border: '#4a9eff' },
            'kitt': { bg: '#2a3a2e', border: '#10b981' },
            'claude-relay': { bg: '#3a1a5a', border: '#a855f7' }
        };
        
        entries.forEach(e => {
            if (e.date !== lastDate) {
                html += `<div style="text-align:center;color:#666;font-size:10px;padding:6px 0;border-bottom:1px solid #333;">${e.date}</div>`;
                lastDate = e.date;
            }
            
            const c = colors[e.from] || { bg: '#2a2a3e', border: '#666' };
            const icon = icons[e.from] || '💬';
            const borderColor = e.isError ? '#ef4444' : c.border;
            const label = e.from.replace('-relay', ' (relay)');
            
            html += `
                <div style="background:${c.bg};border-left:3px solid ${borderColor};padding:8px 10px;border-radius:4px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                        <span style="font-size:11px;color:#aaa;">${icon} ${label}</span>
                        <span style="color:#555;font-size:10px;">${e.time}</span>
                    </div>
                    <div style="color:${e.isError ? '#ff8888' : '#ddd'};font-size:12px;line-height:1.4;word-break:break-word;">${e.message}</div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }
    
    function formatLog(log, service) {
        if (service === 'chat' || (typeof service === 'undefined' && log.includes('User:') && log.includes('Assistant:'))) {
            return formatChatHistory(log);
        }
        
        return log
            .replace(/error/gi, '<span class="error">error</span>')
            .replace(/warn/gi, '<span class="warn">warn</span>')
            .replace(/info/gi, '<span class="info">info</span>')
            .replace(/debug/gi, '<span class="debug">debug</span>');
    }
    
    function formatChatHistory(log) {
        const lines = log.split('\n');
        let formatted = '';
        let currentMessage = '';
        let messageType = '';
        
        for (let line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('User:') || trimmedLine.startsWith('Human:')) {
                if (currentMessage && messageType) {
                    formatted += formatChatMessage(currentMessage, messageType);
                }
                messageType = 'user';
                currentMessage = trimmedLine.substring(trimmedLine.indexOf(':') + 1).trim();
            } else if (trimmedLine.startsWith('Assistant:') || trimmedLine.startsWith('Kitt:')) {
                if (currentMessage && messageType) {
                    formatted += formatChatMessage(currentMessage, messageType);
                }
                messageType = 'assistant';
                currentMessage = trimmedLine.substring(trimmedLine.indexOf(':') + 1).trim();
            } else if (trimmedLine.startsWith('[') && trimmedLine.includes(']')) {
                if (currentMessage && messageType) {
                    formatted += formatChatMessage(currentMessage, messageType);
                    currentMessage = '';
                }
                formatted += '<div class="chat-timestamp">' + escapeHtml(trimmedLine) + '</div>\n';
                messageType = '';
            } else if (trimmedLine && messageType) {
                currentMessage += '\n' + trimmedLine;
            } else if (trimmedLine && !messageType) {
                const lowerLine = trimmedLine.toLowerCase();
                if (lowerLine.includes('error')) {
                    formatted += '<div class="chat-error">' + escapeHtml(trimmedLine) + '</div>\n';
                } else if (lowerLine.includes('warn')) {
                    formatted += '<div class="chat-warning">' + escapeHtml(trimmedLine) + '</div>\n';
                } else {
                    formatted += '<div class="chat-system">' + escapeHtml(trimmedLine) + '</div>\n';
                }
            }
        }
        
        if (currentMessage && messageType) {
            formatted += formatChatMessage(currentMessage, messageType);
        }
        
        return formatted || '<div class="chat-empty">No chat history available</div>';
    }
    
    function formatChatMessage(content, type) {
        const escapedContent = escapeHtml(content.trim());
        const className = type === 'user' ? 'chat-user' : 'chat-assistant';
        const icon = type === 'user' ? '👤' : '🤖';
        
        return `<div class="${className}">
            <div class="chat-icon">${icon}</div>
            <div class="chat-content">${escapedContent.replace(/\n/g, '<br>')}</div>
        </div>\n`;
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async function clearLog() {
        if (!currentLogService) return;
        if (!confirm(`Clear ${currentLogService} log permanently?`)) return;
        
        let endpoint;
        if (['agent', 'errors', 'chat', 'usage'].includes(currentLogService)) {
            endpoint = `http://${location.hostname}:8585/api/logs/${currentLogService}`;
        } else {
            endpoint = `http://${location.hostname}:8080/api/logs/${currentLogService}`;
        }
        
        try {
            const res = await fetch(endpoint, { method: 'DELETE' });
            const data = await res.json();
            document.getElementById('log-content').textContent = data.success ? 'Log cleared' : 'Error: ' + (data.error || 'Unknown error');
        } catch (err) {
            document.getElementById('log-content').textContent = 'Error: ' + err.message;
        }
    }
    
    async function copyLog() {
        const logContent = document.getElementById('log-content');
        const btn = document.getElementById('btn-copy-log');
        const text = logContent.innerText;
        
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            btn.classList.add('copied');
            btn.textContent = '✓ Copied';
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.textContent = '📋 Copy';
            }, 2000);
        } catch (err) {
            console.error('Copy failed:', err);
            btn.textContent = '❌ Failed';
            setTimeout(() => btn.textContent = '📋 Copy', 2000);
        }
    }
    
    // ==================== LOG MODAL DRAG ====================
    function setupLogDrag() {
        const modal = document.getElementById('log-modal');
        const handle = document.getElementById('log-drag-handle');
        if (!modal || !handle) return;
        
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        const saved = localStorage.getItem('log-modal-state');
        if (saved) {
            const state = JSON.parse(saved);
            if (state.left) modal.style.left = state.left;
            if (state.top) modal.style.top = state.top;
            if (state.width) modal.style.width = state.width;
            if (state.height) modal.style.height = state.height;
            if (state.left || state.top) modal.style.transform = 'none';
        }
        
        function saveState() {
            localStorage.setItem('log-modal-state', JSON.stringify({
                left: modal.style.left,
                top: modal.style.top,
                width: modal.style.width,
                height: modal.style.height
            }));
        }
        
        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = modal.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            modal.style.transform = 'none';
            modal.style.left = startLeft + 'px';
            modal.style.top = startTop + 'px';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            modal.style.left = (startLeft + e.clientX - startX) + 'px';
            modal.style.top = (startTop + e.clientY - startY) + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) saveState();
            isDragging = false;
        });
        
        new ResizeObserver(() => saveState()).observe(modal);
    }
    
    // ==================== DRAGGABLE UTILITY ====================
    function setupDraggable(modal, contentSelector, handleSelector) {
        const panel = modal.querySelector(contentSelector);
        const handle = modal.querySelector(handleSelector);
        if (!panel || !handle) return;

        let isDragging = false;
        let startX, startY, initialX, initialY;

        handle.style.cursor = 'move';
        handle.style.userSelect = 'none';

        handle.addEventListener('mousedown', (e) => {
            if (e.target.closest('button, input, select')) return;
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialX = rect.left;
            initialY = rect.top;
            panel.style.position = 'fixed';
            panel.style.margin = '0';
            panel.style.left = initialX + 'px';
            panel.style.top = initialY + 'px';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newX = initialX + (e.clientX - startX);
            let newY = initialY + (e.clientY - startY);
            newX = Math.max(0, Math.min(window.innerWidth - 100, newX));
            newY = Math.max(0, Math.min(window.innerHeight - 50, newY));
            panel.style.left = newX + 'px';
            panel.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => { isDragging = false; });
    }

    // ==================== GENERIC MODAL ====================
    function showModal(title, content) {
        const existing = document.getElementById('trouble-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'trouble-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
        modal.innerHTML = `
            <div class="modal-content" style="background:#1a1a2e;border:1px solid #333;border-radius:12px;max-width:500px;width:100%;max-height:80vh;overflow-y:auto;">
                <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #333;cursor:move;">
                    <h2 style="margin:0;color:#fff;font-size:16px;">${title}</h2>
                    <button onclick="document.getElementById('trouble-modal').remove()" style="background:none;border:none;color:#888;font-size:24px;cursor:pointer;">&times;</button>
                </div>
                <div style="padding:20px;">${content}</div>
            </div>
        `;
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
        setupDraggable(modal, '.modal-content', '.modal-header');
    }
    
    // ==================== NOTES ====================
    async function loadNotes() {
        const notesEl = document.getElementById('admin-notes');
        if (!notesEl) return; // Element doesn't exist in v3.0 layout
        try {
            const response = await fetch(`http://${config.baseHost}:8585/api/notes`);
            const data = await response.json();
            notesEl.value = data.notes || '';
        } catch (err) {
            console.error('Failed to load notes:', err);
        }
    }

    async function saveNotes() {
        const notesEl = document.getElementById('admin-notes');
        if (!notesEl) return;
        const notes = notesEl.value;
        try {
            await fetch(`http://${config.baseHost}:8585/api/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes })
            });
            const btn = document.querySelector('.notes-save');
            btn.textContent = '✓ Saved';
            btn.style.background = '#22c55e';
            btn.style.color = '#000';
            setTimeout(() => {
                btn.textContent = '💾 Save Notes';
                btn.style.background = '';
                btn.style.color = '';
            }, 1500);
        } catch (err) {
            console.error('Failed to save notes:', err);
        }
    }
    
    // ==================== QUICK REFERENCE ====================
    async function loadQuickReference() {
        const container = document.getElementById('quick-ref-section');
        if (!container) return;
        
        try {
            const res = await fetch(`http://${location.hostname}:8585/api/quick-reference`);
            const data = await res.json();
            
            if (data.categories) {
                let html = '';
                for (const [catId, cat] of Object.entries(data.categories)) {
                    html += `<div style="margin-bottom: 8px;"><strong style="color:#4a9eff;font-size:10px;">${cat.label}</strong></div>`;
                    for (const [abbrev, meaning] of Object.entries(cat.items)) {
                        html += `<div><b>${abbrev}</b> = ${meaning}</div>`;
                    }
                }
                container.innerHTML = html;
            }
        } catch (err) {
            container.innerHTML = '<div style="color:#ff6666;">Failed to load</div>';
        }
    }
    
    // ==================== Z-INDEX MANAGER ====================
    let topZIndex = 100;

    function bringToFront(element) {
        topZIndex++;
        element.style.zIndex = topZIndex;
    }

    // ==================== DASHBOARD CARD DRAG ====================
    function setupCardDrag(cardSelector, storageKey, headerSelector = '.card-header') {
        const card = document.querySelector(cardSelector);
        if (!card) return;

        const header = card.querySelector(headerSelector);
        if (!header) return;

        let isDragging = false;
        let startX, startY, startLeft, startTop;

        // Bring to front on click anywhere on card
        card.addEventListener('mousedown', () => {
            if (card.classList.contains('floating')) {
                bringToFront(card);
            }
        });

        // Bring to front on hover when minimized
        card.addEventListener('mouseenter', () => {
            if (card.classList.contains('minimized') && card.classList.contains('floating')) {
                bringToFront(card);
            }
        });

        // Click header to expand when minimized
        header.addEventListener('click', (e) => {
            if (card.classList.contains('minimized') && !e.target.closest('button, input, select')) {
                // Find and click the minimize button to toggle
                const minBtn = header.querySelector('.minimize-btn');
                if (minBtn) minBtn.click();
            }
        });

        // Load saved position
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const state = JSON.parse(saved);
                if (state.left && state.top) {
                    card.style.position = 'fixed';
                    card.style.left = state.left;
                    card.style.top = state.top;
                    if (state.width) card.style.width = state.width;
                    // Don't restore height for todo card - let content determine height
                    if (state.height && !card.classList.contains('card-todo')) {
                        card.style.height = state.height;
                    }
                    card.style.zIndex = '100';
                    card.classList.add('floating');
                }
            } catch (e) {}
        }

        function saveState() {
            if (card.classList.contains('floating')) {
                localStorage.setItem(storageKey, JSON.stringify({
                    left: card.style.left,
                    top: card.style.top,
                    width: card.style.width,
                    height: card.style.height
                }));
            }
        }

        header.style.cursor = 'move';

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button, input, select, .service-dot')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = card.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            // Convert to fixed positioning on first drag
            if (!card.classList.contains('floating')) {
                card.style.position = 'fixed';
                card.style.left = startLeft + 'px';
                card.style.top = startTop + 'px';
                card.style.width = rect.width + 'px';
                card.style.zIndex = '100';
                card.classList.add('floating');
            }
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newX = startLeft + (e.clientX - startX);
            let newY = startTop + (e.clientY - startY);
            newX = Math.max(0, Math.min(window.innerWidth - 100, newX));
            newY = Math.max(0, Math.min(window.innerHeight - 50, newY));
            card.style.left = newX + 'px';
            card.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) saveState();
            isDragging = false;
        });

        // Double-click header to reset position
        header.addEventListener('dblclick', (e) => {
            if (e.target.closest('button')) return;
            card.style.position = '';
            card.style.left = '';
            card.style.top = '';
            card.style.width = '';
            card.style.zIndex = '';
            card.classList.remove('floating');
            localStorage.removeItem(storageKey);
        });
    }

    // ==================== INITIALIZATION ====================
    function init() {
        // Panel toggles (services merged into admin menu) - with null checks for v3.0
        document.getElementById('btn-menu')?.addEventListener('click', () => togglePanel('admin'));
        document.getElementById('btn-close-admin')?.addEventListener('click', () => togglePanel('admin'));
        document.getElementById('admin-overlay')?.addEventListener('click', () => togglePanel('admin'));

        // Services button and compact status now open admin menu (servers section)
        document.getElementById('btn-services')?.addEventListener('click', () => togglePanel('admin'));
        document.getElementById('compact-status')?.addEventListener('click', () => togglePanel('admin'));

        // Log viewer
        document.getElementById('btn-close-log')?.addEventListener('click', () => document.getElementById('log-modal')?.classList.remove('active'));
        document.getElementById('log-selector')?.addEventListener('change', () => refreshLog());

        // Cost modal
        document.getElementById('btn-close-cost')?.addEventListener('click', () => document.getElementById('cost-modal')?.classList.remove('active'));

        // Setup log drag
        setupLogDrag();

        // Setup dashboard card drag
        setupCardDrag('.card-health', 'card-health-position');
        setupCardDrag('.card-msfs', 'card-msfs-position');
        // Todo panel created dynamically - delay setup
        setTimeout(() => setupCardDrag('.card-todo', 'card-todo-position', '.todo-header'), 500);

        // Load data
        loadNotes();
        loadQuickReference();
    }
    
    // ==================== PUBLIC API ====================
    return {
        init,
        togglePanel,
        closeAll,
        toggleLog,
        showLog,
        refreshLog,
        clearLog,
        copyLog,
        showModal,
        setupDraggable,
        loadNotes,
        saveNotes,
        loadQuickReference
    };
})();

// Make functions available globally for onclick handlers
window.toggleLog = UIPanels.toggleLog;
window.showLog = UIPanels.showLog;
window.refreshLog = UIPanels.refreshLog;
window.clearLog = UIPanels.clearLog;
window.copyLog = UIPanels.copyLog;
window.saveNotes = UIPanels.saveNotes;

document.addEventListener('DOMContentLoaded', UIPanels.init);
