/**
 * Consumer Status Module v1.0.0
 *
 * Displays active Claude Code consumer sessions in the header.
 * Listens to RelayWS events and polls /api/consumers endpoint.
 *
 * Path: C:\LLM-DevOSWE\Admin\agent\agent-ui\modules\consumer-status.js
 * Last Updated: 2026-01-12
 *
 * Features:
 *   - Real-time consumer count in header
 *   - Click to show consumer details panel
 *   - Green dot when consumers active, red when none
 *   - Auto-updates via WebSocket events
 */

const ConsumerStatus = (function() {
    'use strict';

    // ==================== STATE ====================
    const state = {
        consumers: [],
        activeCount: 0,
        lastUpdate: null,
        pollInterval: null
    };

    const config = {
        baseHost: location.hostname,
        pollIntervalMs: 10000 // 10 seconds fallback poll
    };

    // ==================== DOM ELEMENTS ====================
    let elements = {
        container: null,
        dot: null,
        count: null
    };

    // ==================== STATUS UPDATE ====================
    function updateUI() {
        if (!elements.container) return;

        const active = state.activeCount;

        // Update dot color
        if (elements.dot) {
            elements.dot.classList.remove('online', 'offline');
            elements.dot.classList.add(active > 0 ? 'online' : 'offline');
        }

        // Update count
        if (elements.count) {
            elements.count.textContent = active > 0 ? active : '0';
        }

        // Update tooltip
        elements.container.title = active > 0
            ? `${active} consumer${active > 1 ? 's' : ''} online`
            : 'No consumers connected';

        console.log(`[ConsumerStatus] ${active} consumer(s) online`);
    }

    // ==================== FETCH CONSUMERS ====================
    async function fetchConsumers() {
        try {
            const res = await fetch(`http://${config.baseHost}:8600/api/consumers`);
            const data = await res.json();

            state.consumers = data.consumers || [];
            state.activeCount = state.consumers.filter(c => c.isOnline).length;
            state.lastUpdate = new Date().toISOString();

            updateUI();
            return state.consumers;
        } catch (err) {
            console.warn('[ConsumerStatus] Failed to fetch consumers:', err.message);
            return [];
        }
    }

    // ==================== DETAILS PANEL ====================
    function showDetails() {
        // Remove existing panel
        const existing = document.querySelector('.consumer-details-panel');
        if (existing) {
            existing.remove();
            return;
        }

        const panel = document.createElement('div');
        panel.className = 'consumer-details-panel';
        panel.innerHTML = `
            <div class="consumer-details-header">
                <h3>Consumer Sessions</h3>
                <button class="btn-close" onclick="this.closest('.consumer-details-panel').remove()">x</button>
            </div>
            <div class="consumer-details-body">
                ${state.consumers.length === 0 ? '<p class="no-consumers">No consumers registered</p>' : ''}
                ${state.consumers.map(c => `
                    <div class="consumer-row ${c.isOnline ? 'online' : 'offline'}">
                        <div class="consumer-dot ${c.isOnline ? 'online' : 'offline'}"></div>
                        <div class="consumer-info">
                            <div class="consumer-name">${c.name || c.id}</div>
                            <div class="consumer-meta">
                                ${c.isOnline ? 'Online' : 'Offline'} |
                                Last seen: ${c.lastSeenAgo} |
                                Tasks: ${c.tasks_completed}
                            </div>
                        </div>
                        ${c.current_task_id ? `<div class="consumer-task">Working on task...</div>` : ''}
                    </div>
                `).join('')}
            </div>
            <div class="consumer-details-footer">
                <button class="admin-btn" onclick="ConsumerStatus.refresh()">Refresh</button>
                <span class="consumer-updated">Last update: ${state.lastUpdate ? new Date(state.lastUpdate).toLocaleTimeString() : 'Never'}</span>
            </div>
        `;

        // Add styles if not present
        if (!document.getElementById('consumer-status-styles')) {
            const styles = document.createElement('style');
            styles.id = 'consumer-status-styles';
            styles.textContent = `
                .consumer-status-indicator {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 10px;
                    background: #1a1a2e;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid #333;
                }
                .consumer-status-indicator:hover {
                    background: #2a2a3e;
                    border-color: #4a9eff;
                }
                .consumer-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #666;
                    transition: background 0.3s;
                }
                .consumer-dot.online {
                    background: #22c55e;
                    box-shadow: 0 0 6px #22c55e;
                }
                .consumer-dot.offline {
                    background: #ef4444;
                }
                .consumer-count {
                    font-size: 12px;
                    font-weight: 600;
                    color: #888;
                    font-family: 'JetBrains Mono', monospace;
                }
                .consumer-status-indicator:hover .consumer-count {
                    color: #fff;
                }
                .consumer-label {
                    font-size: 11px;
                    color: #666;
                }

                .consumer-details-panel {
                    position: fixed;
                    top: 60px;
                    right: 20px;
                    background: #1a1a2e;
                    border: 1px solid #333;
                    border-radius: 12px;
                    width: 350px;
                    max-height: 400px;
                    z-index: 10000;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    animation: slideIn 0.2s ease-out;
                }
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .consumer-details-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    border-bottom: 1px solid #333;
                }
                .consumer-details-header h3 {
                    margin: 0;
                    color: #4a9eff;
                    font-size: 14px;
                }
                .consumer-details-header .btn-close {
                    background: none;
                    border: none;
                    color: #888;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 4px 8px;
                }
                .consumer-details-header .btn-close:hover {
                    color: #fff;
                }
                .consumer-details-body {
                    padding: 12px;
                    max-height: 280px;
                    overflow-y: auto;
                }
                .no-consumers {
                    color: #666;
                    text-align: center;
                    padding: 20px;
                    font-size: 13px;
                }
                .consumer-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    background: #2a2a3e;
                    border-radius: 8px;
                    margin-bottom: 8px;
                    border-left: 3px solid #666;
                }
                .consumer-row.online {
                    border-left-color: #22c55e;
                }
                .consumer-row.offline {
                    border-left-color: #ef4444;
                    opacity: 0.6;
                }
                .consumer-info {
                    flex: 1;
                }
                .consumer-name {
                    font-weight: 600;
                    color: #e0e0e0;
                    font-size: 13px;
                    font-family: 'JetBrains Mono', monospace;
                }
                .consumer-meta {
                    font-size: 11px;
                    color: #888;
                    margin-top: 4px;
                }
                .consumer-task {
                    font-size: 10px;
                    color: #4a9eff;
                    background: #0f3460;
                    padding: 4px 8px;
                    border-radius: 4px;
                }
                .consumer-details-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    border-top: 1px solid #333;
                }
                .consumer-updated {
                    font-size: 10px;
                    color: #666;
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(panel);

        // Close when clicking outside
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!panel.contains(e.target) && !elements.container?.contains(e.target)) {
                    panel.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    }

    // ==================== WEBSOCKET HANDLERS ====================
    function setupWebSocketListeners() {
        if (typeof RelayWS === 'undefined') {
            console.warn('[ConsumerStatus] RelayWS not available');
            return;
        }

        // Consumer came online
        RelayWS.on('consumer:online', (data) => {
            console.log('[ConsumerStatus] Consumer online:', data.consumerId);
            fetchConsumers();
        });

        // Consumer went offline
        RelayWS.on('consumer:offline', (data) => {
            console.log('[ConsumerStatus] Consumer offline:', data.consumerId);
            fetchConsumers();
        });

        // WebSocket connected - refresh
        RelayWS.on('connected', () => {
            fetchConsumers();
        });

        console.log('[ConsumerStatus] WebSocket listeners setup');
    }

    // ==================== CREATE UI ====================
    function createUI() {
        // Find header actions area
        const headerActions = document.querySelector('.header-actions');
        if (!headerActions) {
            console.warn('[ConsumerStatus] Header actions not found');
            return;
        }

        // Check if already exists
        if (document.getElementById('consumer-status')) return;

        // Create indicator
        const container = document.createElement('div');
        container.id = 'consumer-status';
        container.className = 'consumer-status-indicator';
        container.innerHTML = `
            <div class="consumer-dot offline" id="consumer-dot"></div>
            <span class="consumer-count" id="consumer-count">0</span>
            <span class="consumer-label">CC</span>
        `;

        // Insert before first button in header actions
        const firstBtn = headerActions.querySelector('.header-btn');
        if (firstBtn) {
            headerActions.insertBefore(container, firstBtn);
        } else {
            headerActions.appendChild(container);
        }

        // Store element references
        elements.container = container;
        elements.dot = document.getElementById('consumer-dot');
        elements.count = document.getElementById('consumer-count');

        // Add click handler
        container.addEventListener('click', (e) => {
            e.stopPropagation();
            showDetails();
        });

        console.log('[ConsumerStatus] UI created');
    }

    // ==================== INITIALIZATION ====================
    function init() {
        console.log('[ConsumerStatus] Initializing...');

        // Create UI elements
        createUI();

        // Setup WebSocket listeners
        setupWebSocketListeners();

        // Initial fetch
        fetchConsumers();

        // Periodic refresh as fallback
        state.pollInterval = setInterval(fetchConsumers, config.pollIntervalMs);

        console.log('[ConsumerStatus] Ready');
    }

    // ==================== PUBLIC API ====================
    return {
        init,
        refresh: fetchConsumers,
        showDetails,
        getState: () => ({ ...state }),
        getActiveCount: () => state.activeCount
    };
})();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ConsumerStatus.init);
} else {
    // DOM already ready, but wait for other modules
    setTimeout(ConsumerStatus.init, 500);
}

// Export for other modules
window.ConsumerStatus = ConsumerStatus;
