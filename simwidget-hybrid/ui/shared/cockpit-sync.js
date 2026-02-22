/**
 * Shared Cockpit Sync - Multi-device synchronization
 * Allows multiple devices to share widget state
 *
 * Usage:
 *   const sync = new CockpitSync({ deviceName: 'iPad' });
 *   sync.on('stateUpdate', (data) => { ... });
 *   sync.updateState({ key: 'value' });
 */

class CockpitSync {
    constructor(options = {}) {
        this.deviceId = options.deviceId || this.generateDeviceId();
        this.deviceName = options.deviceName || this.detectDeviceName();
        this.sessionId = null;
        this.role = null; // 'host' or 'guest'
        this.pollInterval = options.pollInterval || 1000;
        this.apiBase = options.apiBase || '';

        this.state = {};
        this.lastUpdate = 0;
        this.connected = false;
        this.polling = false;

        this.listeners = {
            stateUpdate: [],
            deviceJoin: [],
            deviceLeave: [],
            sessionStart: [],
            sessionEnd: [],
            error: []
        };

        // BroadcastChannel for same-device tabs
        this.localChannel = new SafeChannel('cockpit-sync-local');
        this.localChannel.onmessage = (e) => this.handleLocalMessage(e.data);

        // Load saved session
        this.loadSession();
    }

    generateDeviceId() {
        let id = localStorage.getItem('cockpit-sync-device-id');
        if (!id) {
            id = 'device-' + Array.from(crypto.getRandomValues(new Uint8Array(5))).map(b => b.toString(36)).join('').slice(0, 9);
            localStorage.setItem('cockpit-sync-device-id', id);
        }
        return id;
    }

    detectDeviceName() {
        const ua = navigator.userAgent;
        if (/iPad/.test(ua)) return 'iPad';
        if (/iPhone/.test(ua)) return 'iPhone';
        if (/Android/.test(ua)) return 'Android';
        if (/Windows/.test(ua)) return 'Windows PC';
        if (/Mac/.test(ua)) return 'Mac';
        return 'Device';
    }

    loadSession() {
        const saved = localStorage.getItem('cockpit-sync-session');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.sessionId = data.sessionId;
                this.role = data.role;
            } catch (e) {
                // Ignore parse errors
            }
        }
    }

    saveSession() {
        localStorage.setItem('cockpit-sync-session', JSON.stringify({
            sessionId: this.sessionId,
            role: this.role
        }));
    }

    clearSession() {
        localStorage.removeItem('cockpit-sync-session');
        this.sessionId = null;
        this.role = null;
    }

    // Event handling
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
        return this;
    }

    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
        return this;
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    // Create new session (become host)
    async createSession() {
        try {
            const response = await fetch(`${this.apiBase}/api/cockpit/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: this.deviceId,
                    deviceName: this.deviceName
                })
            });

            const data = await response.json();
            if (data.sessionId) {
                this.sessionId = data.sessionId;
                this.role = 'host';
                this.connected = true;
                this.saveSession();
                this.startPolling();
                this.emit('sessionStart', { sessionId: this.sessionId, role: this.role });
                return { success: true, sessionId: this.sessionId };
            }
            return { success: false, error: data.error };
        } catch (e) {
            this.emit('error', { message: 'Failed to create session', error: e });
            return { success: false, error: e.message };
        }
    }

    // Join existing session
    async joinSession(sessionId) {
        try {
            const response = await fetch(`${this.apiBase}/api/cockpit/join/${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: this.deviceId,
                    deviceName: this.deviceName
                })
            });

            const data = await response.json();
            if (data.success) {
                this.sessionId = sessionId;
                this.role = 'guest';
                this.connected = true;
                this.state = data.state || {};
                this.saveSession();
                this.startPolling();
                this.emit('sessionStart', { sessionId: this.sessionId, role: this.role });
                this.emit('stateUpdate', this.state);
                return { success: true };
            }
            return { success: false, error: data.error };
        } catch (e) {
            this.emit('error', { message: 'Failed to join session', error: e });
            return { success: false, error: e.message };
        }
    }

    // Leave session
    async leaveSession() {
        if (!this.sessionId) return;

        this.stopPolling();

        try {
            await fetch(`${this.apiBase}/api/cockpit/leave/${this.sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: this.deviceId })
            });
        } catch (e) {
            // Ignore errors when leaving
        }

        const oldSessionId = this.sessionId;
        this.clearSession();
        this.connected = false;
        this.state = {};
        this.emit('sessionEnd', { sessionId: oldSessionId });
    }

    // Update shared state
    async updateState(updates) {
        if (!this.sessionId) return { success: false, error: 'No session' };

        // Merge locally first
        Object.assign(this.state, updates);

        // Broadcast to local tabs
        this.localChannel.postMessage({
            type: 'stateUpdate',
            state: this.state,
            source: this.deviceId
        });

        // Send to server
        try {
            const response = await fetch(`${this.apiBase}/api/cockpit/sync/${this.sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: this.deviceId,
                    updates
                })
            });

            const data = await response.json();
            return { success: data.success };
        } catch (e) {
            this.emit('error', { message: 'Failed to sync state', error: e });
            return { success: false, error: e.message };
        }
    }

    // Get current state from server
    async fetchState() {
        if (!this.sessionId) return null;

        try {
            const response = await fetch(
                `${this.apiBase}/api/cockpit/state/${this.sessionId}?since=${this.lastUpdate}`
            );
            const data = await response.json();

            if (data.state && data.lastUpdate > this.lastUpdate) {
                this.state = data.state;
                this.lastUpdate = data.lastUpdate;
                this.emit('stateUpdate', this.state);
            }

            return data;
        } catch (e) {
            return null;
        }
    }

    // Polling for remote updates
    startPolling() {
        if (this.polling) return;
        this.polling = true;

        this.pollTimer = setInterval(() => {
            if (this.connected && this.sessionId) {
                this.fetchState();
            }
        }, this.pollInterval);
    }

    stopPolling() {
        this.polling = false;
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    // Handle messages from other tabs on same device
    handleLocalMessage(msg) {
        if (msg.source === this.deviceId) return;

        switch (msg.type) {
            case 'stateUpdate':
                this.state = msg.state;
                this.emit('stateUpdate', this.state);
                break;
        }
    }

    // Get session QR code URL for easy joining
    getJoinUrl() {
        if (!this.sessionId) return null;
        const base = window.location.origin;
        return `${base}/ui/cockpit-join/?session=${this.sessionId}`;
    }

    // Get session code for manual entry
    getSessionCode() {
        if (!this.sessionId) return null;
        // Return last 6 characters for easier sharing
        return this.sessionId.slice(-6).toUpperCase();
    }

    destroy() {
        this.stopPolling();
        if (this.localChannel) {
            this.localChannel.close();
            this.localChannel = null;
        }
        this.connected = false;
    }

    // Static method to find sessions
    static async findSessions(apiBase = '') {
        try {
            const response = await fetch(`${apiBase}/api/cockpit/sessions`);
            return await response.json();
        } catch (e) {
            return { sessions: [] };
        }
    }
}

// Auto-initialize
if (typeof window !== 'undefined') {
    window.CockpitSync = CockpitSync;
}
