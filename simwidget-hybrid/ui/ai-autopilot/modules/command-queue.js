/**
 * Command Queue — Rate-Limited AP Command Execution
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/command-queue.js
 *
 * Queued AP commands with rate limiting, dedup, safety limits, and pilot override.
 * Max 2 commands/second to prevent AP thrashing.
 */

class CommandQueue {
    constructor(options = {}) {
        this.sendCommand = options.sendCommand || null;   // fn(command) — sends via WebSocket
        this.profile = options.profile || null;
        this.onCommandExecuted = options.onCommandExecuted || null;
        this.onOverrideChange = options.onOverrideChange || null;

        // Queue state
        this._queue = [];
        this._log = [];           // last 50 executed commands
        this._maxLog = 50;
        this._rateLimit = 500;    // ms between commands (2/sec)
        this._lastExecTime = 0;
        this._drainTimer = null;
        this._destroyed = false;

        // Pilot override tracking
        // When pilot manually changes an AP axis, AI pauses that axis for OVERRIDE_COOLDOWN
        this._overrides = {};     // { axis: expireTimestamp }
        this.OVERRIDE_COOLDOWN = 30000;  // 30 seconds

        // AP state tracking for dedup
        this._currentApState = {};
    }

    /**
     * Add a command to the queue
     * @param {Object} cmd - { type, value, description }
     */
    enqueue(cmd) {
        if (this._destroyed) return;

        // Safety checks
        if (!this._validateCommand(cmd)) return;

        // Check pilot override
        const axis = this._commandToAxis(cmd.type);
        if (axis && this._isOverridden(axis)) return;

        // Dedup against current AP state
        if (this._isDuplicate(cmd)) return;

        this._queue.push(cmd);
        this._scheduleDrain();
    }

    /**
     * Process queued commands respecting rate limit
     */
    _drain() {
        if (this._destroyed || this._queue.length === 0) {
            this._drainTimer = null;
            return;
        }

        const now = Date.now();
        const elapsed = now - this._lastExecTime;

        if (elapsed >= this._rateLimit) {
            const cmd = this._queue.shift();
            this._execute(cmd);
            this._lastExecTime = now;
        }

        if (this._queue.length > 0) {
            this._scheduleDrain();
        } else {
            this._drainTimer = null;
        }
    }

    _scheduleDrain() {
        if (this._drainTimer) return;
        const delay = Math.max(0, this._rateLimit - (Date.now() - this._lastExecTime));
        this._drainTimer = setTimeout(() => this._drain(), delay);
    }

    /**
     * Execute a single command
     */
    _execute(cmd) {
        if (!cmd) return;

        // Build the WS command
        const wsCmd = this._buildWsCommand(cmd);
        if (wsCmd && this.sendCommand) {
            this.sendCommand(wsCmd);
        }

        // Log it
        const entry = {
            time: Date.now(),
            type: cmd.type,
            value: cmd.value,
            description: cmd.description
        };
        this._log.unshift(entry);
        if (this._log.length > this._maxLog) {
            this._log.pop();
        }

        // Update tracked state
        this._currentApState[cmd.type] = cmd.value;

        if (this.onCommandExecuted) {
            this.onCommandExecuted(entry);
        }
    }

    /**
     * Convert our command format to the WebSocket command string
     * matching the autopilot pane's command vocabulary
     */
    _buildWsCommand(cmd) {
        // Toggle commands: send the command name directly
        const toggleCmds = [
            'AP_MASTER', 'TOGGLE_FLIGHT_DIRECTOR', 'YAW_DAMPER_TOGGLE',
            'AP_HDG_HOLD', 'AP_ALT_HOLD', 'AP_VS_HOLD', 'AP_AIRSPEED_HOLD',
            'AP_NAV1_HOLD', 'AP_APR_HOLD', 'AP_BC_HOLD', 'AP_VNAV',
            'HEADING_BUG_SET'
        ];

        if (toggleCmds.includes(cmd.type)) {
            return cmd.type;
        }

        // Value-set commands: send as command with value
        const valueCmds = [
            'AP_ALT_VAR_SET', 'AP_VS_VAR_SET', 'AP_SPD_VAR_SET', 'HEADING_BUG_SET'
        ];

        if (valueCmds.includes(cmd.type)) {
            return { command: cmd.type, value: cmd.value };
        }

        // Inc/Dec commands for gradual adjustment
        if (cmd.type.includes('_INC') || cmd.type.includes('_DEC')) {
            return cmd.type;
        }

        return cmd.type;
    }

    /**
     * Validate command against aircraft profile safety limits
     */
    _validateCommand(cmd) {
        if (!cmd || !cmd.type) return false;
        if (!this.profile) return true;  // no profile = no safety checks

        const limits = this.profile.limits;

        // VS limits
        if (cmd.type === 'AP_VS_VAR_SET') {
            const clamped = Math.max(limits.minVs, Math.min(limits.maxVs, cmd.value));
            if (clamped !== cmd.value) {
                cmd.value = clamped;
                cmd.description += ' (clamped)';
            }
        }

        // Altitude ceiling
        if (cmd.type === 'AP_ALT_VAR_SET') {
            const max = limits.maxAlt || limits.ceiling || 45000;
            if (cmd.value > max) {
                cmd.value = max;
                cmd.description += ' (ceiling)';
            }
        }

        // Speed limits
        if (cmd.type === 'AP_SPD_VAR_SET') {
            const maxSpd = this.profile.speeds.Vno || 250;
            const minSpd = this.profile.speeds.Vs1 || 50;
            cmd.value = Math.max(minSpd, Math.min(maxSpd, cmd.value));
        }

        return true;
    }

    /**
     * Map command type to axis for override tracking
     */
    _commandToAxis(type) {
        if (type.includes('HDG') || type.includes('HEADING')) return 'HDG';
        if (type.includes('ALT') && !type.includes('VS')) return 'ALT';
        if (type.includes('VS')) return 'VS';
        if (type.includes('SPD') || type.includes('AIRSPEED')) return 'SPD';
        if (type.includes('NAV')) return 'NAV';
        if (type.includes('APR')) return 'APR';
        if (type === 'AP_MASTER') return 'MASTER';
        return null;
    }

    /**
     * Check if an axis is currently overridden by pilot
     */
    _isOverridden(axis) {
        const expires = this._overrides[axis];
        if (!expires) return false;
        if (Date.now() > expires) {
            delete this._overrides[axis];
            this._notifyOverrideChange();
            return false;
        }
        return true;
    }

    /**
     * Register a pilot override — pauses AI for this axis
     * Called when pilot manually changes an AP setting
     */
    registerOverride(axis) {
        this._overrides[axis] = Date.now() + this.OVERRIDE_COOLDOWN;
        // Remove queued commands for this axis
        this._queue = this._queue.filter(cmd => this._commandToAxis(cmd.type) !== axis);
        this._notifyOverrideChange();
    }

    /**
     * Clear all overrides
     */
    clearOverrides() {
        this._overrides = {};
        this._notifyOverrideChange();
    }

    _notifyOverrideChange() {
        if (this.onOverrideChange) {
            this.onOverrideChange(this.getActiveOverrides());
        }
    }

    /**
     * Get list of currently active overrides
     */
    getActiveOverrides() {
        const now = Date.now();
        const active = [];
        for (const [axis, expires] of Object.entries(this._overrides)) {
            if (now < expires) {
                active.push({ axis, remaining: Math.ceil((expires - now) / 1000) });
            }
        }
        return active;
    }

    /**
     * Check if command is duplicate of current state
     */
    _isDuplicate(cmd) {
        const current = this._currentApState[cmd.type];
        if (current === undefined) return false;
        if (typeof cmd.value === 'boolean') return current === cmd.value;
        if (typeof cmd.value === 'number') return Math.abs(current - cmd.value) < 1;
        return current === cmd.value;
    }

    /**
     * Update known AP state from sim data (for dedup)
     */
    updateApState(state) {
        this._currentApState = { ...this._currentApState, ...state };
    }

    /** Get command log (most recent first) */
    getLog() {
        return this._log;
    }

    /** Clear queue and log */
    clear() {
        this._queue = [];
        this._log = [];
        this._currentApState = {};
    }

    /** Set aircraft profile for safety limits */
    setProfile(profile) {
        this.profile = profile;
    }

    destroy() {
        this._destroyed = true;
        if (this._drainTimer) {
            clearTimeout(this._drainTimer);
            this._drainTimer = null;
        }
        this._queue = [];
    }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommandQueue;
}
