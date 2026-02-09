/**
 * SafeChannel v1.0.0
 * Cross-tab messaging with automatic fallback for MSFS panels.
 *
 * Uses BroadcastChannel where available, falls back to
 * localStorage + storage events for environments like MSFS
 * in-game panels (Coherent GT) that lack BroadcastChannel.
 *
 * Usage:
 *   <script src="/ui/shared/safe-channel.js"></script>
 *
 *   const ch = new SafeChannel('SimGlass-sync');
 *   ch.onmessage = (event) => console.log(event.data);
 *   ch.postMessage({ type: 'flightplan-update', plan: {...} });
 *   ch.close();
 */

// eslint-disable-next-line no-unused-vars
class SafeChannel {
    /**
     * @param {string} name - Channel name (same as BroadcastChannel name)
     */
    constructor(name) {
        this.name = name;
        this.onmessage = null;
        this._closed = false;
        this._bc = null;
        this._storageKey = '__sc_' + name;

        if (typeof BroadcastChannel !== 'undefined') {
            try {
                this._bc = new BroadcastChannel(name);
                this._bc.onmessage = (e) => {
                    if (!this._closed && this.onmessage) this.onmessage(e);
                };
                return;
            } catch (e) {
                // Fall through to localStorage fallback
            }
        }

        // localStorage fallback — uses storage events for cross-tab
        this._onStorage = (e) => {
            if (this._closed || e.key !== this._storageKey || !e.newValue) return;
            try {
                const data = JSON.parse(e.newValue);
                if (this.onmessage) this.onmessage({ data });
            } catch (err) {
                // Malformed message, ignore
            }
        };
        window.addEventListener('storage', this._onStorage);
    }

    /**
     * Send a message on this channel
     * @param {*} data - JSON-serializable data
     */
    postMessage(data) {
        if (this._closed) return;

        if (this._bc) {
            this._bc.postMessage(data);
            return;
        }

        // localStorage fallback — write triggers storage event in other tabs
        try {
            localStorage.setItem(this._storageKey, JSON.stringify(data));
            // Remove immediately so the same message can be sent again
            localStorage.removeItem(this._storageKey);
        } catch (e) {
            // localStorage unavailable
        }
    }

    /**
     * Close the channel and clean up listeners
     */
    close() {
        if (this._closed) return;
        this._closed = true;

        if (this._bc) {
            this._bc.onmessage = null;
            this._bc.close();
            this._bc = null;
        }

        if (this._onStorage) {
            window.removeEventListener('storage', this._onStorage);
            this._onStorage = null;
        }

        this.onmessage = null;
    }
}
