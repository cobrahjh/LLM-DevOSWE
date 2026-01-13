/**
 * Relay WebSocket Client v1.0.0
 *
 * Connects to Relay Service WebSocket for real-time task events.
 * Provides event-based API for task state changes.
 *
 * Path: C:\LLM-DevOSWE\Admin\agent\agent-ui\modules\relay-ws.js
 * Last Updated: 2026-01-12
 *
 * Events:
 *   connected     - WebSocket connected
 *   disconnected  - WebSocket disconnected
 *   task:created  - New task created
 *   task:processing - Task picked up by consumer
 *   task:completed - Task completed with response
 *   task:failed   - Task failed
 *   task:retrying - Task being retried
 *   consumer:online - Consumer connected
 *   consumer:offline - Consumer disconnected
 */

const RelayWS = (function() {
    'use strict';

    let ws = null;
    let reconnectTimer = null;
    let clientId = null;
    const listeners = new Map();

    const config = {
        url: `ws://${location.hostname}:8600`,
        reconnectDelay: 3000,
        maxReconnectDelay: 30000,
        autoReconnect: true
    };

    let reconnectAttempts = 0;

    // Event emitter
    function on(event, callback) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(callback);
    }

    function off(event, callback) {
        if (!listeners.has(event)) return;
        const cbs = listeners.get(event);
        const idx = cbs.indexOf(callback);
        if (idx > -1) cbs.splice(idx, 1);
    }

    function emit(event, data) {
        if (!listeners.has(event)) return;
        listeners.get(event).forEach(cb => {
            try { cb(data); } catch (e) { console.error(`[RelayWS] Event handler error:`, e); }
        });
    }

    function connect() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log('[RelayWS] Already connected');
            return;
        }

        try {
            console.log(`[RelayWS] Connecting to ${config.url}...`);
            ws = new WebSocket(config.url);

            ws.onopen = () => {
                console.log('[RelayWS] Connected');
                reconnectAttempts = 0;
                emit('connected', { clientId });
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    console.log('[RelayWS] Received:', msg.type, msg.data);

                    // Handle connection acknowledgment
                    if (msg.type === 'connected') {
                        clientId = msg.clientId;
                        console.log(`[RelayWS] Client ID: ${clientId}`);
                    }

                    // Emit the event for listeners
                    emit(msg.type, msg.data);
                } catch (e) {
                    console.error('[RelayWS] Message parse error:', e);
                }
            };

            ws.onclose = () => {
                console.log('[RelayWS] Disconnected');
                emit('disconnected', {});

                if (config.autoReconnect) {
                    scheduleReconnect();
                }
            };

            ws.onerror = (err) => {
                console.error('[RelayWS] Error:', err);
            };
        } catch (e) {
            console.error('[RelayWS] Connection failed:', e);
            if (config.autoReconnect) {
                scheduleReconnect();
            }
        }
    }

    function disconnect() {
        config.autoReconnect = false;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (ws) {
            ws.close();
            ws = null;
        }
    }

    function scheduleReconnect() {
        if (reconnectTimer) return;

        reconnectAttempts++;
        const delay = Math.min(
            config.reconnectDelay * Math.pow(1.5, reconnectAttempts - 1),
            config.maxReconnectDelay
        );

        console.log(`[RelayWS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, delay);
    }

    function isConnected() {
        return ws && ws.readyState === WebSocket.OPEN;
    }

    function getClientId() {
        return clientId;
    }

    // Auto-connect on load
    function init() {
        connect();
    }

    return {
        init,
        connect,
        disconnect,
        on,
        off,
        isConnected,
        getClientId
    };
})();

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RelayWS.init());
} else {
    RelayWS.init();
}

// Export for module systems
if (typeof module !== 'undefined') module.exports = { RelayWS };
