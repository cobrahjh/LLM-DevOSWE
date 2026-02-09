/**
 * Claude Bridge Client v1.0.0
 *
 * Connects Kitt UI to Claude Bridge Service (port 8700)
 * Replaces the old relay/consumer system
 *
 * Usage:
 *   ClaudeBridge.connect();
 *   ClaudeBridge.send('fix the bug');
 *   ClaudeBridge.onOutput((text) => console.log(text));
 */

const ClaudeBridge = (function() {
    let ws = null;
    let clientId = null;
    let isConnected = false;
    let reconnectAttempts = 0;
    let maxReconnectAttempts = 10;
    let reconnectTimeout = null;

    // Callbacks
    let onConnectCallback = null;
    let onDisconnectCallback = null;
    let onOutputCallback = null;
    let onCompleteCallback = null;
    let onErrorCallback = null;
    let onStatusCallback = null;

    const BRIDGE_URL = `ws://${location.hostname}:8700`;

    function connect() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log('[ClaudeBridge] Already connected');
            return;
        }

        console.log(`[ClaudeBridge] Connecting to ${BRIDGE_URL}...`);

        try {
            ws = new WebSocket(BRIDGE_URL);

            ws.onopen = () => {
                console.log('[ClaudeBridge] Connected');
                isConnected = true;
                reconnectAttempts = 0;
                if (onConnectCallback) onConnectCallback();
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleMessage(data);
                } catch (err) {
                    console.error('[ClaudeBridge] Parse error:', err);
                }
            };

            ws.onclose = () => {
                console.log('[ClaudeBridge] Disconnected');
                isConnected = false;
                clientId = null;
                if (onDisconnectCallback) onDisconnectCallback();
                scheduleReconnect();
            };

            ws.onerror = (err) => {
                console.error('[ClaudeBridge] WebSocket error:', err);
            };

        } catch (err) {
            console.error('[ClaudeBridge] Connection error:', err);
            scheduleReconnect();
        }
    }

    function scheduleReconnect() {
        if (reconnectAttempts >= maxReconnectAttempts) {
            console.log('[ClaudeBridge] Max reconnect attempts reached');
            return;
        }

        reconnectAttempts++;
        const delay = Math.min(1000 * reconnectAttempts, 10000);
        console.log(`[ClaudeBridge] Reconnecting in ${delay / 1000}s... (attempt ${reconnectAttempts})`);

        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, delay);
    }

    function handleMessage(data) {
        switch (data.type) {
            case 'connected':
                clientId = data.clientId;
                console.log(`[ClaudeBridge] Client ID: ${clientId}`);
                if (onStatusCallback) onStatusCallback(data.workers);
                break;

            case 'task_started':
                console.log(`[ClaudeBridge] Task ${data.taskId} started on ${data.worker}`);
                if (onOutputCallback) onOutputCallback(`[${data.worker}] Processing...\n`);
                break;

            case 'output':
                if (onOutputCallback) onOutputCallback(data.text);
                break;

            case 'task_complete':
                console.log(`[ClaudeBridge] Task ${data.taskId} complete (exit: ${data.exitCode})`);
                if (onCompleteCallback) onCompleteCallback(data.output, data.exitCode);
                break;

            case 'task_error':
                console.error(`[ClaudeBridge] Task ${data.taskId} error:`, data.error);
                if (onErrorCallback) onErrorCallback(data.error);
                break;

            case 'status':
                if (onStatusCallback) onStatusCallback(data.workers);
                break;

            case 'pong':
                // Heartbeat response
                break;

            default:
                console.log('[ClaudeBridge] Unknown message:', data);
        }
    }

    function send(content, options = {}) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.error('[ClaudeBridge] Not connected');
            if (onErrorCallback) onErrorCallback('Not connected to Claude Bridge');
            return false;
        }

        const message = {
            type: 'task',
            content: content,
            worker: options.worker || null  // null = auto-route
        };

        ws.send(JSON.stringify(message));
        return true;
    }

    function getStatus() {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: 'status' }));
    }

    function disconnect() {
        clearTimeout(reconnectTimeout);
        if (ws) {
            ws.close();
            ws = null;
        }
        isConnected = false;
        clientId = null;
    }

    // Public API
    return {
        connect,
        disconnect,
        send,
        getStatus,

        get isConnected() { return isConnected; },
        get clientId() { return clientId; },

        onConnect(cb) { onConnectCallback = cb; },
        onDisconnect(cb) { onDisconnectCallback = cb; },
        onOutput(cb) { onOutputCallback = cb; },
        onComplete(cb) { onCompleteCallback = cb; },
        onError(cb) { onErrorCallback = cb; },
        onStatus(cb) { onStatusCallback = cb; },

        // Force specific worker
        sendQuick(content) { return send(content, { worker: 'quick' }); },
        sendCode(content) { return send(content, { worker: 'code' }); }
    };
})();

// Auto-connect on load
if (typeof window !== 'undefined') {
    window.ClaudeBridge = ClaudeBridge;
}
