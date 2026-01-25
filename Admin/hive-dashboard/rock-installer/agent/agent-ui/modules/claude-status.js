/**
 * Claude Status Module v1.0.0
 *
 * Displays Claude's processing status in the header bar.
 * Listens to TaskProcessor events and updates the visual indicator.
 *
 * Path: C:\LLM-DevOSWE\Admin\agent\agent-ui\modules\claude-status.js
 * Last Updated: 2026-01-11
 *
 * Features:
 *   - Real-time status indicator (Ready/Working/Error)
 *   - Pulse animation when Claude is processing
 *   - Click to show task details modal
 *   - Integration with TaskProcessor events
 */

const ClaudeStatus = (function() {
    'use strict';

    // ==================== STATE ====================
    const state = {
        status: 'ready',  // 'ready', 'busy', 'error'
        currentTask: null,
        queueLength: 0,
        lastUpdate: null
    };

    // ==================== DOM ELEMENTS ====================
    let elements = {
        container: null,
        dot: null,
        label: null,
        headerStatus: null  // Header bar status text
    };

    // ==================== STATUS UPDATE ====================
    function updateStatus(newStatus, details = {}) {
        state.status = newStatus;
        state.currentTask = details.task || null;
        state.queueLength = details.queueLength || 0;
        state.lastUpdate = new Date().toISOString();

        if (!elements.container) return;

        // Update dot classes
        elements.dot.classList.remove('busy', 'error');
        elements.container.classList.remove('busy', 'error');

        // Update label and styling
        switch (newStatus) {
            case 'busy':
                elements.dot.classList.add('busy');
                elements.container.classList.add('busy');
                elements.label.textContent = 'Working';
                elements.container.title = `Claude: Processing task${state.queueLength > 0 ? ` (${state.queueLength} queued)` : ''}`;
                break;
            case 'error':
                elements.dot.classList.add('error');
                elements.container.classList.add('error');
                elements.label.textContent = 'Error';
                elements.container.title = 'Claude: Error occurred';
                break;
            default:
                elements.label.textContent = 'Ready';
                elements.container.title = state.queueLength > 0
                    ? `Claude: Ready (${state.queueLength} tasks queued)`
                    : 'Claude: Ready';
        }

        // Update header status text
        if (elements.headerStatus) {
            elements.headerStatus.className = 'claude-status-text';
            switch (newStatus) {
                case 'busy':
                    elements.headerStatus.textContent = 'Working...';
                    elements.headerStatus.classList.add('busy');
                    break;
                case 'error':
                    elements.headerStatus.textContent = 'Error';
                    elements.headerStatus.classList.add('offline');
                    break;
                default:
                    elements.headerStatus.textContent = 'Ready';
            }
        }

        console.log(`[ClaudeStatus] Status: ${newStatus}`, details);
    }

    // ==================== EVENT HANDLERS ====================
    function handleClaudeStatusChange(claudeStatus) {
        if (claudeStatus.busy) {
            updateStatus('busy', {
                source: claudeStatus.source,
                task: claudeStatus.kittStatus?.task
            });
        } else {
            updateStatus('ready');
        }
    }

    function handleTaskStarted(data) {
        updateStatus('busy', {
            task: data.task,
            queueLength: TaskProcessor.getQueue().length
        });
    }

    function handleTaskComplete(data) {
        const queue = TaskProcessor.getQueue();
        if (queue.length > 0) {
            updateStatus('busy', { queueLength: queue.length });
        } else {
            updateStatus('ready');
        }
    }

    function handleTaskError(data) {
        updateStatus('error', { task: data.task });
        // Auto-recover to ready after 5 seconds
        setTimeout(() => {
            if (state.status === 'error') {
                updateStatus('ready');
            }
        }, 5000);
    }

    function handleTaskQueued(data) {
        const currentStatus = TaskProcessor.getClaudeStatus();
        if (currentStatus.busy) {
            updateStatus('busy', { queueLength: data.queueLength });
        }
    }

    // ==================== MODAL DRAG ====================
    function setupClaudeModalDrag(modal) {
        const content = modal.querySelector('.claude-details-content');
        const handle = modal.querySelector('.claude-details-header');
        if (!content || !handle) return;

        let isDragging = false;
        let startX, startY, initialX, initialY;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            isDragging = true;
            const rect = content.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialX = rect.left;
            initialY = rect.top;
            content.style.position = 'fixed';
            content.style.margin = '0';
            content.style.left = initialX + 'px';
            content.style.top = initialY + 'px';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newX = initialX + (e.clientX - startX);
            let newY = initialY + (e.clientY - startY);
            newX = Math.max(0, Math.min(window.innerWidth - 100, newX));
            newY = Math.max(0, Math.min(window.innerHeight - 50, newY));
            content.style.left = newX + 'px';
            content.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => { isDragging = false; });
    }

    // ==================== DETAILS MODAL ====================
    function showDetails() {
        const status = TaskProcessor.getStatus();

        const modal = document.createElement('div');
        modal.className = 'claude-details-modal';
        modal.innerHTML = `
            <div class="claude-details-content">
                <div class="claude-details-header">
                    <h3>Claude Status</h3>
                    <button class="btn-close" onclick="this.closest('.claude-details-modal').remove()">x</button>
                </div>
                <div class="claude-details-body">
                    <div class="status-row">
                        <span class="status-label">Status:</span>
                        <span class="status-value ${state.status}">${state.status === 'busy' ? 'Working' : state.status === 'error' ? 'Error' : 'Ready'}</span>
                    </div>
                    ${status.currentTask ? `
                        <div class="status-row">
                            <span class="status-label">Current Task:</span>
                            <span class="status-value">${status.currentTask.content}</span>
                        </div>
                        <div class="status-row">
                            <span class="status-label">Progress:</span>
                            <span class="status-value">${status.currentTask.progress}% - ${status.currentTask.statusMessage}</span>
                        </div>
                    ` : ''}
                    <div class="status-row">
                        <span class="status-label">Queue:</span>
                        <span class="status-value">${status.queueLength} task(s)</span>
                    </div>
                    ${status.queue.length > 0 ? `
                        <div class="queue-list">
                            <span class="status-label">Queued Tasks:</span>
                            ${status.queue.map((t, i) => `
                                <div class="queue-item">
                                    <span class="queue-pos">${i + 1}.</span>
                                    <span class="queue-content">${t.content}</span>
                                    <span class="queue-priority priority-${t.priority}">${t.priority}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="status-row">
                        <span class="status-label">Last Update:</span>
                        <span class="status-value">${state.lastUpdate ? new Date(state.lastUpdate).toLocaleTimeString() : 'Never'}</span>
                    </div>
                </div>
            </div>
        `;

        // Add modal styles if not present
        if (!document.getElementById('claude-details-styles')) {
            const styles = document.createElement('style');
            styles.id = 'claude-details-styles';
            styles.textContent = `
                .claude-details-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                .claude-details-content {
                    background: #1a1a2e;
                    border-radius: 12px;
                    border: 1px solid #333;
                    min-width: 350px;
                    max-width: 500px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                }
                .claude-details-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    border-bottom: 1px solid #333;
                    cursor: move;
                    user-select: none;
                }
                .claude-details-header h3 {
                    margin: 0;
                    color: #4a9eff;
                    font-size: 16px;
                }
                .claude-details-header .btn-close {
                    background: none;
                    border: none;
                    color: #888;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 4px 8px;
                }
                .claude-details-header .btn-close:hover {
                    color: #fff;
                }
                .claude-details-body {
                    padding: 16px;
                }
                .status-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    border-bottom: 1px solid #2a2a3e;
                }
                .status-row:last-child {
                    border-bottom: none;
                }
                .status-label {
                    color: #888;
                    font-size: 13px;
                }
                .status-value {
                    color: #e0e0e0;
                    font-size: 13px;
                    text-align: right;
                    max-width: 250px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .status-value.ready { color: #22c55e; }
                .status-value.busy { color: #f59e0b; }
                .status-value.error { color: #ef4444; }
                .queue-list {
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid #2a2a3e;
                }
                .queue-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 0;
                    font-size: 12px;
                }
                .queue-pos {
                    color: #666;
                    min-width: 20px;
                }
                .queue-content {
                    flex: 1;
                    color: #aaa;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .queue-priority {
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                    text-transform: uppercase;
                }
                .priority-high { background: #ef4444; color: white; }
                .priority-normal { background: #3b82f6; color: white; }
                .priority-low { background: #666; color: #ccc; }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(modal);
        setupClaudeModalDrag(modal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // ==================== INITIALIZATION ====================
    function init() {
        console.log('[ClaudeStatus] Initializing...');

        // Get DOM elements
        elements.container = document.getElementById('claude-status');
        elements.dot = document.getElementById('claude-dot');
        elements.label = document.getElementById('claude-label');
        elements.headerStatus = document.getElementById('header-claude-status');

        if (!elements.container) {
            console.warn('[ClaudeStatus] Container element not found');
            return;
        }

        // Add click handler for details
        elements.container.addEventListener('click', (e) => {
            e.stopPropagation();
            showDetails();
        });

        // Subscribe to TaskProcessor events
        if (typeof TaskProcessor !== 'undefined') {
            TaskProcessor.on('claudeStatusChange', handleClaudeStatusChange);
            TaskProcessor.on('taskStarted', handleTaskStarted);
            TaskProcessor.on('taskComplete', handleTaskComplete);
            TaskProcessor.on('taskError', handleTaskError);
            TaskProcessor.on('taskQueued', handleTaskQueued);

            // Get initial status
            const initialStatus = TaskProcessor.getClaudeStatus();
            if (initialStatus.busy) {
                updateStatus('busy');
            }
        } else {
            console.warn('[ClaudeStatus] TaskProcessor not available');
        }

        console.log('[ClaudeStatus] Ready');
    }

    // ==================== PUBLIC API ====================
    return {
        init,
        updateStatus,
        showDetails,
        getState: () => ({ ...state })
    };
})();

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', ClaudeStatus.init);

// Export for other modules
window.ClaudeStatus = ClaudeStatus;
