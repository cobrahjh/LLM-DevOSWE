/**
 * Universal Throttling Utilities v1.0.0
 * SimGlass Engine - Shared throttling system for all widgets
 */

class ThrottleManager {
    constructor(interval = 60000) {
        this.interval = interval; // Default: 1 minute
        this.lastUpdate = 0;
        this.pendingUpdate = false;
        this.pendingCallback = null;
        this.timeoutId = null;
    }

    /**
     * Throttle a function call
     * @param {Function} callback - Function to throttle
     * @param {boolean} immediate - If true, execute immediately on first call
     */
    throttle(callback, immediate = false) {
        const now = Date.now();

        // If enough time has passed, execute immediately
        if (now - this.lastUpdate >= this.interval) {
            this.lastUpdate = now;
            callback();
            this.pendingUpdate = false;
            return;
        }

        // If immediate mode and this is the first call, execute now
        if (immediate && this.lastUpdate === 0) {
            this.lastUpdate = now;
            callback();
            return;
        }

        // Otherwise, schedule an update if one isn't already pending
        if (!this.pendingUpdate) {
            this.pendingUpdate = true;
            this.pendingCallback = callback;
            const timeToWait = this.interval - (now - this.lastUpdate);

            // Clear any existing timeout
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
            }

            this.timeoutId = setTimeout(() => {
                this.lastUpdate = Date.now();
                if (this.pendingCallback) {
                    this.pendingCallback();
                }
                this.pendingUpdate = false;
                this.pendingCallback = null;
                this.timeoutId = null;
            }, timeToWait);
        } else {
            // Update the pending callback to the latest one
            this.pendingCallback = callback;
        }
    }

    /**
     * Force an immediate update, bypassing the throttle
     */
    forceUpdate(callback) {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.lastUpdate = Date.now();
        this.pendingUpdate = false;
        this.pendingCallback = null;
        callback();
    }

    /**
     * Reset the throttle timer
     */
    reset() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.lastUpdate = 0;
        this.pendingUpdate = false;
        this.pendingCallback = null;
    }

    /**
     * Change the throttle interval
     */
    setInterval(newInterval) {
        this.interval = newInterval;
    }

    /**
     * Get time until next allowed update
     */
    getTimeUntilNext() {
        const elapsed = Date.now() - this.lastUpdate;
        return Math.max(0, this.interval - elapsed);
    }

    /**
     * Check if an update would execute immediately
     */
    canUpdateNow() {
        return Date.now() - this.lastUpdate >= this.interval;
    }

    /**
     * Destroy the throttle manager and clear any pending updates
     */
    destroy() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.pendingCallback = null;
        this.pendingUpdate = false;
    }
}

/**
 * Simple throttle function (stateless)
 * @param {Function} func - Function to throttle
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Throttled function
 */
function throttle(func, wait) {
    let timeout = null;
    let lastRan = 0;

    return function(...args) {
        const now = Date.now();

        if (now - lastRan >= wait) {
            func.apply(this, args);
            lastRan = now;
        } else {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(this, args);
                lastRan = Date.now();
            }, wait - (now - lastRan));
        }
    };
}

/**
 * Debounce function (waits for inactivity)
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout = null;

    return function(...args) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, wait);
    };
}

// Export for use in widgets
if (typeof window !== 'undefined') {
    window.ThrottleManager = ThrottleManager;
    window.throttle = throttle;
    window.debounce = debounce;
}
