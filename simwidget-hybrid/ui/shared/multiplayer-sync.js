/**
 * SimGlass Multiplayer Sync Client
 * Enables shared cockpit - sync widget state between pilots
 *
 * Usage:
 *   const sync = new MultiplayerSync('checklist');
 *   sync.onStateUpdate((state) => { ... });
 *   sync.onAction((action, data) => { ... });
 *   sync.createRoom('Captain Bob');
 *   // or
 *   sync.joinRoom('ABC123', 'First Officer Jane');
 */

class MultiplayerSync {
    constructor(widgetId) {
        this.widgetId = widgetId;
        this.ws = null;
        this.roomCode = null;
        this.pilotName = null;
        this.role = null;
        this.pilots = [];
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        this.callbacks = {
            onConnect: [],
            onDisconnect: [],
            onRoomCreated: [],
            onRoomJoined: [],
            onPilotJoined: [],
            onPilotLeft: [],
            onStateUpdate: [],
            onAction: [],
            onChat: [],
            onError: []
        };

        this.syncUrl = this.getSyncUrl();
    }

    getSyncUrl() {
        const host = window.location.hostname || 'localhost';
        return 'ws://' + host + ':8085';
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.syncUrl);

                this.ws.onopen = () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this.emit('onConnect');
                    resolve();
                };

                this.ws.onclose = () => {
                    this.connected = false;
                    this.emit('onDisconnect');
                    this.attemptReconnect();
                };

                this.ws.onerror = (err) => {
                    this.emit('onError', { error: 'Connection failed' });
                    reject(err);
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(JSON.parse(event.data));
                };

            } catch (e) {
                reject(e);
            }
        });
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.emit('onError', { error: 'Max reconnection attempts reached' });
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        setTimeout(() => {
            if (!this.connected && this.roomCode) {
                this.connect().then(() => {
                    // Rejoin room after reconnect
                    this.joinRoom(this.roomCode, this.pilotName);
                }).catch(() => {});
            }
        }, delay);
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'room-created':
                this.roomCode = msg.roomCode;
                this.pilotName = msg.pilotName;
                this.role = msg.role;
                this.emit('onRoomCreated', msg);
                break;

            case 'room-joined':
                this.roomCode = msg.roomCode;
                this.pilotName = msg.pilotName;
                this.role = msg.role;
                this.pilots = msg.pilots;
                this.emit('onRoomJoined', msg);
                // Apply received state
                if (msg.state && msg.state[this.widgetId]) {
                    this.emit('onStateUpdate', msg.state[this.widgetId]);
                }
                break;

            case 'pilot-joined':
                this.pilots = msg.pilots;
                this.emit('onPilotJoined', msg);
                break;

            case 'pilot-left':
                this.pilots = msg.pilots;
                this.emit('onPilotLeft', msg);
                break;

            case 'state-update':
                if (msg.widget === this.widgetId) {
                    this.emit('onStateUpdate', msg.state, msg.from);
                }
                break;

            case 'action':
                if (msg.widget === this.widgetId) {
                    this.emit('onAction', msg.action, msg.data, msg.from);
                }
                break;

            case 'chat':
                this.emit('onChat', msg);
                break;

            case 'error':
                this.emit('onError', msg);
                break;
        }
    }

    async createRoom(pilotName) {
        if (!this.connected) {
            await this.connect();
        }

        this.send({
            type: 'create-room',
            pilotName: pilotName || 'Captain'
        });
    }

    async joinRoom(roomCode, pilotName) {
        if (!this.connected) {
            await this.connect();
        }

        this.send({
            type: 'join-room',
            roomCode: roomCode.toUpperCase(),
            pilotName: pilotName || 'First Officer'
        });
    }

    leaveRoom() {
        this.send({ type: 'leave-room' });
        this.roomCode = null;
        this.pilots = [];
    }

    syncState(state) {
        if (!this.roomCode) return;

        this.send({
            type: 'sync-state',
            widget: this.widgetId,
            state
        });
    }

    syncAction(action, data) {
        if (!this.roomCode) return;

        this.send({
            type: 'sync-action',
            widget: this.widgetId,
            action,
            data
        });
    }

    sendChat(message) {
        if (!this.roomCode) return;

        this.send({
            type: 'chat',
            message
        });
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    // Event handlers
    onConnect(fn) { this.callbacks.onConnect.push(fn); return this; }
    onDisconnect(fn) { this.callbacks.onDisconnect.push(fn); return this; }
    onRoomCreated(fn) { this.callbacks.onRoomCreated.push(fn); return this; }
    onRoomJoined(fn) { this.callbacks.onRoomJoined.push(fn); return this; }
    onPilotJoined(fn) { this.callbacks.onPilotJoined.push(fn); return this; }
    onPilotLeft(fn) { this.callbacks.onPilotLeft.push(fn); return this; }
    onStateUpdate(fn) { this.callbacks.onStateUpdate.push(fn); return this; }
    onAction(fn) { this.callbacks.onAction.push(fn); return this; }
    onChat(fn) { this.callbacks.onChat.push(fn); return this; }
    onError(fn) { this.callbacks.onError.push(fn); return this; }

    emit(event, ...args) {
        this.callbacks[event]?.forEach(fn => {
            try {
                fn(...args);
            } catch (e) {
                console.error('[Sync] Callback error:', e);
            }
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.roomCode = null;
    }

    isConnected() {
        return this.connected && this.roomCode !== null;
    }

    getRoomCode() {
        return this.roomCode;
    }

    getPilots() {
        return this.pilots;
    }
}

// Export for use in widgets
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiplayerSync;
}
