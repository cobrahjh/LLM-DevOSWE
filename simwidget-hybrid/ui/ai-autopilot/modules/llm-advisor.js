/**
 * LLM Advisor — Intelligent Flight Advisory
 * Type: module | Category: ai-autopilot
 * Path: ui/ai-autopilot/modules/llm-advisor.js
 *
 * Queries the copilot API for complex flight decisions.
 * Rate limited: max 1 query every 30 seconds.
 * Triggered by specific events or pilot request.
 */

class LLMAdvisor {
    constructor(options = {}) {
        this.serverPort = options.serverPort || window.location.port || 8080;
        this.onAdvisory = options.onAdvisory || null;   // fn(advisory)
        this.onLoading = options.onLoading || null;      // fn(loading)

        this._lastQueryTime = 0;
        this._rateLimitMs = 30000;  // 30 seconds between queries
        this._currentAdvisory = null;
        this._pendingAbort = null;
        this._destroyed = false;

        // Track conditions for automatic triggers
        this._prevWind = null;
        this._prevFuel = null;
    }

    /**
     * Request an advisory from the LLM
     * @param {string} prompt - specific question or trigger context
     * @param {Object} flightData - current flight state
     * @returns {Promise<Object|null>} advisory response
     */
    async requestAdvisory(prompt, flightData) {
        if (this._destroyed) return null;

        // Rate limit
        const now = Date.now();
        if (now - this._lastQueryTime < this._rateLimitMs) {
            const wait = Math.ceil((this._rateLimitMs - (now - this._lastQueryTime)) / 1000);
            return { error: `Rate limited. Try again in ${wait}s.` };
        }

        this._lastQueryTime = now;
        if (this.onLoading) this.onLoading(true);

        // Abort any in-flight request
        if (this._pendingAbort) {
            this._pendingAbort.abort();
        }
        this._pendingAbort = new AbortController();

        try {
            const systemContext = this._buildContext(flightData);
            const fullPrompt = `${systemContext}\n\nPILOT REQUEST: ${prompt}\n\nRespond concisely (2-3 sentences max). If you recommend an AP change, state it clearly as: "RECOMMEND: [action]"`;

            const response = await fetch(`http://localhost:${this.serverPort}/api/ai-pilot/advisory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: fullPrompt }),
                signal: this._pendingAbort.signal
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Server error ${response.status}`);
            }

            // Read SSE stream
            const text = await this._readStream(response);
            const advisory = this._parseAdvisory(text, prompt);
            this._currentAdvisory = advisory;

            if (this.onAdvisory) this.onAdvisory(advisory);
            return advisory;

        } catch (err) {
            if (err.name === 'AbortError') return null;
            const errorAdvisory = { text: err.message, error: true, commands: [] };
            if (this.onAdvisory) this.onAdvisory(errorAdvisory);
            return errorAdvisory;
        } finally {
            this._pendingAbort = null;
            if (this.onLoading) this.onLoading(false);
        }
    }

    /**
     * Read SSE stream and accumulate text
     */
    async _readStream(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.chunk) text += parsed.chunk;
                    if (parsed.done) break;
                } catch (e) { /* skip malformed */ }
            }
        }

        return text;
    }

    /**
     * Build context summary for LLM query
     */
    _buildContext(d) {
        if (!d) return '';
        return `CURRENT STATE: Alt ${Math.round(d.altitude || 0)}ft, Speed ${Math.round(d.speed || 0)}kt, ` +
               `HDG ${Math.round(d.heading || 0)}°, VS ${Math.round(d.verticalSpeed || 0)}fpm, ` +
               `Wind ${Math.round(d.windDirection || 0)}°/${Math.round(d.windSpeed || 0)}kt, ` +
               `Fuel ${Math.round(d.fuelTotal || 0)}gal`;
    }

    /**
     * Parse advisory text for actionable commands
     */
    _parseAdvisory(text, trigger) {
        const advisory = {
            text: text,
            trigger: trigger,
            timestamp: Date.now(),
            commands: [],       // human-readable strings
            execCommands: [],   // { command, value } objects for execution
            error: false
        };

        // Try JSON format: COMMANDS_JSON: [...]
        const jsonMatch = text.match(/COMMANDS_JSON:\s*(\[[\s\S]*?\])/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (Array.isArray(parsed)) {
                    advisory.execCommands = parsed;
                    advisory.commands = parsed.map(c => `${c.command}${c.value !== undefined ? ' ' + c.value : ''}`);
                    // Clean JSON block from display text
                    advisory.text = text.replace(/COMMANDS_JSON:\s*\[[\s\S]*?\]/, '').trim();
                    return advisory;
                }
            } catch (e) { /* fall through */ }
        }

        // Fallback: parse COMMAND VALUE lines and RECOMMEND: lines
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.replace(/^[-*\s]+/, '').trim();

            // Structured: HEADING_BUG_SET 300
            const cmdMatch = trimmed.match(/^((?:AP_|HEADING_|TOGGLE_|YAW_)\w+)[\s:]+(\d+|ON|OFF)?$/i);
            if (cmdMatch) {
                const cmd = { command: cmdMatch[1].toUpperCase() };
                if (cmdMatch[2] && cmdMatch[2] !== 'ON' && cmdMatch[2] !== 'OFF') {
                    cmd.value = parseInt(cmdMatch[2]);
                }
                advisory.execCommands.push(cmd);
                advisory.commands.push(trimmed);
                continue;
            }

            // Legacy: RECOMMEND: free text
            const recMatch = line.match(/RECOMMEND:\s*(.+)/i);
            if (recMatch) {
                advisory.commands.push(recMatch[1].trim());
            }
        }

        return advisory;
    }

    /**
     * Check for automatic advisory triggers based on flight data changes
     * Call this on each sim data update
     * @returns {string|null} trigger description if advisory should fire
     */
    checkTriggers(d, phase) {
        if (!d || this._destroyed) return null;

        // Wind shift > 20kt change
        if (d.windSpeed !== undefined) {
            if (this._prevWind !== null && Math.abs(d.windSpeed - this._prevWind) > 20) {
                this._prevWind = d.windSpeed;
                return `Wind changed significantly to ${Math.round(d.windDirection)}°/${Math.round(d.windSpeed)}kt`;
            }
            this._prevWind = d.windSpeed;
        }

        // Low fuel warning (< 30 min reserve at current burn)
        if (d.fuelTotal !== undefined && d.fuelFlow > 0) {
            const minutesRemaining = (d.fuelTotal / d.fuelFlow) * 60;
            if (minutesRemaining < 30 && this._prevFuel !== 'low') {
                this._prevFuel = 'low';
                return `Low fuel: ${Math.round(minutesRemaining)} minutes remaining at current flow`;
            }
            if (minutesRemaining >= 45) this._prevFuel = null;
        }

        return null;
    }

    /** Get current advisory */
    getCurrentAdvisory() {
        return this._currentAdvisory;
    }

    /** Clear current advisory */
    clearAdvisory() {
        this._currentAdvisory = null;
    }

    /** Check if rate limited */
    isRateLimited() {
        return Date.now() - this._lastQueryTime < this._rateLimitMs;
    }

    /** Seconds until next query allowed */
    cooldownRemaining() {
        const remaining = this._rateLimitMs - (Date.now() - this._lastQueryTime);
        return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    }

    destroy() {
        this._destroyed = true;
        if (this._pendingAbort) {
            this._pendingAbort.abort();
            this._pendingAbort = null;
        }
    }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LLMAdvisor;
}
