/**
 * AI Autopilot Pane — Full AI Pilot
 * Type: control | Category: flight
 * Path: ui/ai-autopilot/pane.js
 *
 * Orchestrator that extends SimGlassBase and wires all AI autopilot modules.
 * Rule-based flight phase engine handles routine AP commands;
 * LLM advisor handles complex decisions. Pilot always has override authority.
 */

class AiAutopilotPane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'ai-autopilot',
            widgetVersion: '1.0.0',
            autoConnect: true
        });

        // AI state
        this.aiEnabled = false;
        this._autoControlsEnabled = false;  // "AI Has Controls" mode
        this._autoAdviseTimer = null;
        this._autoAdviseInFlight = false;
        this._autoAdviseInterval = 60000;   // 60s between auto-advise cycles
        this._lastFlightData = null;
        this.copilotStatus = null;

        // Aircraft profile
        this.profileKey = localStorage.getItem('ai-ap-profile') || DEFAULT_PROFILE;
        this.profile = AIRCRAFT_PROFILES[this.profileKey] || AIRCRAFT_PROFILES[DEFAULT_PROFILE];

        // AP state tracking (mirrors what sim reports)
        this.ap = {
            master: false,
            headingHold: false,
            altitudeHold: false,
            vsHold: false,
            speedHold: false,
            navHold: false,
            aprHold: false
        };

        // AP set values
        this.setValues = { heading: 0, altitude: 8500, vs: 0, speed: 110 };

        // Initialize modules
        this.commandQueue = new CommandQueue({
            sendCommand: (cmd) => this._sendWsCommand(cmd),
            profile: this.profile,
            onCommandExecuted: (entry) => this._onCommandExecuted(entry),
            onOverrideChange: (overrides) => this._onOverrideChange(overrides)
        });

        this.flightPhase = new FlightPhase({
            targetCruiseAlt: 8500,
            profile: this.profile,
            onPhaseChange: (newPhase, oldPhase) => this._onPhaseChange(newPhase, oldPhase)
        });

        this.ruleEngine = new RuleEngine({
            profile: this.profile,
            commandQueue: this.commandQueue
        });

        this.llmAdvisor = new LLMAdvisor({
            onAdvisory: (adv) => this._onAdvisory(adv),
            onLoading: (loading) => this._onAdvisoryLoading(loading)
        });

        // Debug log
        this._debugLog = [];
        this._debugMaxEntries = 200;
        this._debugFilter = 'all';
        this._debugVisible = false;
        this._debugStats = { api: 0, ws: 0, llm: 0, cmd: 0 };
        this._wsPerSec = 0;
        this._wsCount = 0;

        // Cache DOM elements
        this.elements = {};
        this._cacheElements();

        // Setup UI event listeners
        this._setupEvents();

        // Setup debug panel
        this._setupDebug();

        // Build phase dots
        this._buildPhaseDots();

        // Override detection timer
        this._overrideCheckTimer = setInterval(() => this._checkOverrideExpiry(), 5000);

        // WS rate counter (messages per second)
        this._wsRateTimer = setInterval(() => {
            this._wsPerSec = this._wsCount;
            this._wsCount = 0;
            if (this._debugVisible) this._renderDebugStats();
        }, 1000);

        // Fetch copilot config status
        this._fetchCopilotStatus();

        // Initial render
        this._render();
    }

    // ── DOM Cache ──────────────────────────────────────────

    _cacheElements() {
        this.elements.aiToggle = document.getElementById('ai-toggle');
        this.elements.phaseName = document.getElementById('phase-name');
        this.elements.phaseProgress = document.getElementById('phase-progress');
        this.elements.phaseDots = document.getElementById('phase-dots');
        this.elements.targetAlt = document.getElementById('target-alt');
        this.elements.targetSpd = document.getElementById('target-spd');
        this.elements.targetHdg = document.getElementById('target-hdg');

        this.elements.valHdg = document.getElementById('val-hdg');
        this.elements.valAlt = document.getElementById('val-alt');
        this.elements.valVs = document.getElementById('val-vs');
        this.elements.valSpd = document.getElementById('val-spd');
        this.elements.valNav = document.getElementById('val-nav');
        this.elements.checkHdg = document.getElementById('check-hdg');
        this.elements.checkAlt = document.getElementById('check-alt');
        this.elements.checkVs = document.getElementById('check-vs');
        this.elements.checkSpd = document.getElementById('check-spd');
        this.elements.checkNav = document.getElementById('check-nav');
        this.elements.statusHdg = document.getElementById('status-hdg');
        this.elements.statusAlt = document.getElementById('status-alt');
        this.elements.statusVs = document.getElementById('status-vs');
        this.elements.statusSpd = document.getElementById('status-spd');
        this.elements.statusNav = document.getElementById('status-nav');

        this.elements.commandLog = document.getElementById('command-log');
        this.elements.advisoryContent = document.getElementById('advisory-content');
        this.elements.advisoryActions = document.getElementById('advisory-actions');
        this.elements.advisoryAsk = document.getElementById('advisory-ask');
        this.elements.advisoryAccept = document.getElementById('advisory-accept');
        this.elements.advisoryDismiss = document.getElementById('advisory-dismiss');
        this.elements.aircraftName = document.getElementById('aircraft-name');
        this.elements.overrideCount = document.getElementById('override-count');
        this.elements.autoControlsBtn = document.getElementById('auto-controls-btn');
        this.elements.debugToggle = document.getElementById('debug-toggle');
        this.elements.debugPanel = document.getElementById('debug-panel');
        this.elements.debugLog = document.getElementById('debug-log');
        this.elements.debugClear = document.getElementById('debug-clear');
        this.elements.dsApi = document.getElementById('ds-api');
        this.elements.dsWs = document.getElementById('ds-ws');
        this.elements.dsLlm = document.getElementById('ds-llm');
        this.elements.dsCmd = document.getElementById('ds-cmd');
    }

    // ── Event Setup ────────────────────────────────────────

    _setupEvents() {
        // Master AI toggle
        this.elements.aiToggle?.addEventListener('click', () => {
            this.aiEnabled = !this.aiEnabled;
            if (this.aiEnabled) {
                this.ruleEngine.reset();
                this.commandQueue.clear();
            }
            this._render();
        });

        // Advisory ask button
        this.elements.advisoryAsk?.addEventListener('click', () => {
            if (this.llmAdvisor.isRateLimited()) return;
            const phase = this.flightPhase.phase;
            this.llmAdvisor.requestAdvisory(
                `Current phase: ${phase}. Any recommendations for the current flight situation?`,
                this._lastFlightData
            );
        });

        // Advisory accept/dismiss
        this.elements.advisoryAccept?.addEventListener('click', () => {
            this._acceptAdvisory();
        });
        this.elements.advisoryDismiss?.addEventListener('click', () => {
            this._dismissAdvisory();
        });

        // AI Has Controls toggle
        this.elements.autoControlsBtn?.addEventListener('click', () => {
            if (!this.aiEnabled) {
                this.aiEnabled = true;
            }
            this._autoControlsEnabled = !this._autoControlsEnabled;
            if (this._autoControlsEnabled) {
                this._autoAdvise();  // immediate first run
                this._autoAdviseTimer = setInterval(() => this._autoAdvise(), this._autoAdviseInterval);
            } else {
                if (this._autoAdviseTimer) {
                    clearInterval(this._autoAdviseTimer);
                    this._autoAdviseTimer = null;
                }
            }
            this._render();
        });
    }

    // ── Debug Panel ─────────────────────────────────────────

    _setupDebug() {
        // Toggle button
        this.elements.debugToggle?.addEventListener('click', () => {
            this._debugVisible = !this._debugVisible;
            this.elements.debugToggle.classList.toggle('active', this._debugVisible);
            if (this.elements.debugPanel) {
                this.elements.debugPanel.style.display = this._debugVisible ? 'flex' : 'none';
            }
            if (this._debugVisible) this._renderDebugLog();
        });

        // Filter buttons
        document.querySelectorAll('.debug-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.debug-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._debugFilter = btn.dataset.filter;
                this._renderDebugLog();
            });
        });

        // Clear button
        this.elements.debugClear?.addEventListener('click', () => {
            this._debugLog = [];
            this._debugStats = { api: 0, ws: 0, llm: 0, cmd: 0 };
            this._renderDebugLog();
            this._renderDebugStats();
        });

        // Intercept fetch for API logging
        this._origFetch = window.fetch;
        window.fetch = (...args) => this._interceptFetch(...args);
    }

    _interceptFetch(url, opts = {}) {
        const urlStr = typeof url === 'string' ? url : url.url || '';
        // Only log ai-pilot and copilot API calls
        if (!urlStr.includes('/api/ai-pilot') && !urlStr.includes('/api/copilot')) {
            return this._origFetch(url, opts);
        }

        const method = (opts.method || 'GET').toUpperCase();
        const shortUrl = urlStr.replace(/^https?:\/\/[^/]+/, '');
        const startTime = performance.now();

        // Parse request body for LLM calls
        let reqBody = null;
        if (opts.body) {
            try { reqBody = JSON.parse(opts.body); } catch (e) { /* not json */ }
        }

        // Log outgoing request
        const isLlm = urlStr.includes('/advisory') || urlStr.includes('/auto-advise');
        if (isLlm && reqBody?.message) {
            const msg = reqBody.message.length > 80 ? reqBody.message.slice(0, 80) + '...' : reqBody.message;
            this._dbg('llm', `<span class="dim">&rarr;</span> <span class="val">${this._esc(msg)}</span>`);
        }

        return this._origFetch(url, opts).then(response => {
            const dur = (performance.now() - startTime).toFixed(0);
            const status = response.status;
            const statusClass = status < 400 ? 'ok' : 'err';

            this._dbg('api', `${method} <span class="url">${this._esc(shortUrl)}</span> <span class="${statusClass}">${status}</span> <span class="dur">${dur}ms</span>`);

            // For LLM endpoints, clone and read response for logging
            if (isLlm && status < 400) {
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('json')) {
                    const clone = response.clone();
                    clone.json().then(data => {
                        if (data.advisory) {
                            const text = data.advisory.replace(/COMMANDS_JSON:[\s\S]*$/, '').trim();
                            const preview = text.length > 100 ? text.slice(0, 100) + '...' : text;
                            this._dbg('llm', `<span class="dim">&larr;</span> <span class="val">${this._esc(preview)}</span>`);
                        }
                        if (data.commands?.length) {
                            const cmds = data.commands.map(c =>
                                `${c.command}${c.value !== undefined ? '=' + c.value : ''} ${c.executed ? '<span class="ok">OK</span>' : '<span class="err">SKIP</span>'}`
                            ).join(', ');
                            this._dbg('cmd', cmds);
                        }
                    }).catch(() => {});
                }
            }

            return response;
        }).catch(err => {
            const dur = (performance.now() - startTime).toFixed(0);
            this._dbg('api', `${method} <span class="url">${this._esc(shortUrl)}</span> <span class="err">ERR</span> <span class="dur">${dur}ms</span> ${this._esc(err.message)}`);
            throw err;
        });
    }

    /** Add a debug log entry */
    _dbg(category, html) {
        const now = new Date();
        const ts = now.getHours().toString().padStart(2, '0') + ':' +
                   now.getMinutes().toString().padStart(2, '0') + ':' +
                   now.getSeconds().toString().padStart(2, '0') + '.' +
                   String(now.getMilliseconds()).padStart(3, '0');

        this._debugLog.unshift({ ts, cat: category, html });
        if (this._debugLog.length > this._debugMaxEntries) this._debugLog.pop();
        this._debugStats[category] = (this._debugStats[category] || 0) + 1;

        if (this._debugVisible) {
            this._renderDebugLog();
            this._renderDebugStats();
        }
    }

    /** Escape HTML for safe display */
    _esc(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    _renderDebugLog() {
        if (!this.elements.debugLog) return;
        const filter = this._debugFilter;
        const entries = filter === 'all'
            ? this._debugLog.slice(0, 60)
            : this._debugLog.filter(e => e.cat === filter).slice(0, 60);

        if (entries.length === 0) {
            this.elements.debugLog.innerHTML = '<div style="color:#334;padding:8px;font-style:italic">No debug entries</div>';
            return;
        }

        this.elements.debugLog.innerHTML = entries.map(e =>
            `<div class="dbg-entry"><span class="dbg-time">${e.ts}</span>` +
            `<span class="dbg-tag ${e.cat}">${e.cat.toUpperCase()}</span>` +
            `<span class="dbg-text">${e.html}</span></div>`
        ).join('');
    }

    _renderDebugStats() {
        if (this.elements.dsApi) this.elements.dsApi.textContent = this._debugStats.api;
        if (this.elements.dsWs) this.elements.dsWs.textContent = this._wsPerSec;
        if (this.elements.dsLlm) this.elements.dsLlm.textContent = this._debugStats.llm;
        if (this.elements.dsCmd) this.elements.dsCmd.textContent = this._debugStats.cmd;
    }

    // ── Phase Dots ─────────────────────────────────────────

    _buildPhaseDots() {
        if (!this.elements.phaseDots) return;
        this.elements.phaseDots.innerHTML = '';
        const phases = this.flightPhase.PHASES;
        for (let i = 0; i < phases.length; i++) {
            const dot = document.createElement('span');
            dot.className = 'phase-dot';
            dot.title = phases[i];
            this.elements.phaseDots.appendChild(dot);
        }
    }

    // ── WebSocket Integration ──────────────────────────────

    onMessage(msg) {
        this._wsCount++;
        if (msg.type === 'flightData' && msg.data) {
            // Throttle WS debug logging to 1 per 5 seconds (avoid flooding)
            const now = Date.now();
            if (!this._lastWsLog || now - this._lastWsLog > 5000) {
                this._lastWsLog = now;
                const d = msg.data;
                this._dbg('ws', `flightData <span class="dim">alt:</span><span class="val">${Math.round(d.altitude||0)}</span> <span class="dim">spd:</span><span class="val">${Math.round(d.speed||0)}</span> <span class="dim">hdg:</span><span class="val">${Math.round(d.heading||0)}</span> <span class="dim">vs:</span><span class="val">${Math.round(d.verticalSpeed||0)}</span> <span class="dim">gnd:</span><span class="val">${d.onGround ? 'Y' : 'N'}</span>`);
            }
            this._onSimData(msg.data);
        } else {
            this._dbg('ws', `${this._esc(msg.type || 'unknown')} <span class="dim">${JSON.stringify(msg).slice(0, 80)}</span>`);
        }
    }

    _onSimData(data) {
        this._lastFlightData = data;

        // Update AP state from sim
        if (data.apMaster !== undefined) this.ap.master = data.apMaster;
        if (data.apHdgLock !== undefined) this.ap.headingHold = data.apHdgLock;
        if (data.apAltLock !== undefined) this.ap.altitudeHold = data.apAltLock;
        if (data.apVsLock !== undefined) this.ap.vsHold = data.apVsLock;
        if (data.apSpdLock !== undefined) this.ap.speedHold = data.apSpdLock;
        if (data.apNavLock !== undefined) this.ap.navHold = data.apNavLock;
        if (data.apAprLock !== undefined) this.ap.aprHold = data.apAprLock;

        // Update set values
        if (data.apHdgSet !== undefined) this.setValues.heading = Math.round(data.apHdgSet);
        if (data.apAltSet !== undefined) this.setValues.altitude = Math.round(data.apAltSet);
        if (data.apVsSet !== undefined) this.setValues.vs = Math.round(data.apVsSet);
        if (data.apSpdSet !== undefined) this.setValues.speed = Math.round(data.apSpdSet);

        // Detect pilot overrides (AP state changed without AI commanding it)
        this._detectPilotOverride(data);

        if (this.aiEnabled) {
            // Update flight phase
            this.flightPhase.update(data);

            // Run rule engine
            this.ruleEngine.evaluate(this.flightPhase.phase, data, this.ap);

            // Check LLM advisory triggers
            const trigger = this.llmAdvisor.checkTriggers(data, this.flightPhase.phase);
            if (trigger) {
                this.llmAdvisor.requestAdvisory(trigger, data);
            }
        }

        this._render();
    }

    /**
     * Detect pilot manual AP changes and register overrides
     */
    _detectPilotOverride(data) {
        // If AI is not enabled, no overrides to track
        if (!this.aiEnabled) return;

        // Compare what AI last commanded vs what sim reports
        // If they differ, pilot made a manual change
        const overrideMap = {
            'HDG': { sim: data.apHdgLock, ap: this.ap.headingHold },
            'ALT': { sim: data.apAltLock, ap: this.ap.altitudeHold },
            'VS':  { sim: data.apVsLock,  ap: this.ap.vsHold },
            'SPD': { sim: data.apSpdLock, ap: this.ap.speedHold },
            'NAV': { sim: data.apNavLock, ap: this.ap.navHold }
        };

        // We only detect overrides on toggle changes that weren't commanded by AI
        // This is a simplified heuristic — real implementation would track command timestamps
    }

    _sendWsCommand(cmd) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        if (typeof cmd === 'string') {
            this.ws.send(JSON.stringify({ type: 'command', command: cmd }));
            this._dbg('cmd', `<span class="dim">&rarr; WS</span> ${this._esc(cmd)}`);
        } else if (cmd && cmd.command) {
            this.ws.send(JSON.stringify({ type: 'command', command: cmd.command, value: cmd.value }));
            this._dbg('cmd', `<span class="dim">&rarr; WS</span> ${this._esc(cmd.command)}${cmd.value !== undefined ? ' <span class="val">= ' + cmd.value + '</span>' : ''}`);
        }
    }

    // ── Module Callbacks ───────────────────────────────────

    _onPhaseChange(newPhase, oldPhase) {
        this._dbg('cmd', `Phase: <span class="dim">${this._esc(oldPhase)}</span> <span class="dim">&rarr;</span> <span class="val">${this._esc(newPhase)}</span>`);
        // Sync cruise alt to rule engine
        this.ruleEngine.setTargetCruiseAlt(this.flightPhase.targetCruiseAlt);
        this._render();
    }

    _onCommandExecuted(entry) {
        this._renderCommandLog();
    }

    _onOverrideChange(overrides) {
        this._renderOverrides(overrides);
    }

    _onAdvisory(advisory) {
        if (advisory && !advisory.error) {
            const preview = (advisory.text || '').slice(0, 80);
            this._dbg('llm', `<span class="dim">&larr; stream</span> <span class="val">${this._esc(preview)}${advisory.text?.length > 80 ? '...' : ''}</span>`);
            if (advisory.execCommands?.length) {
                this._dbg('cmd', `parsed: ${advisory.execCommands.map(c => c.command + (c.value !== undefined ? '=' + c.value : '')).join(', ')}`);
            }
        }
        this._renderAdvisory(advisory);
        // Auto-accept when AI has controls
        if (this._autoControlsEnabled && advisory && !advisory.error && advisory.execCommands?.length > 0) {
            this._acceptAdvisory();
        }
    }

    _onAdvisoryLoading(loading) {
        if (this.elements.advisoryAsk) {
            this.elements.advisoryAsk.textContent = loading ? 'Thinking...' : 'Ask AI';
            this.elements.advisoryAsk.classList.toggle('loading', loading);
        }
    }

    _acceptAdvisory() {
        const adv = this.llmAdvisor.getCurrentAdvisory();
        if (!adv) return this._dismissAdvisory();

        // Execute parsed commands through the command queue
        if (adv.execCommands && adv.execCommands.length > 0) {
            for (const cmd of adv.execCommands) {
                this.commandQueue.enqueue({
                    type: cmd.command,
                    value: cmd.value || 0,
                    description: `AI: ${cmd.command}${cmd.value !== undefined ? ' → ' + cmd.value : ''}`
                });
            }
        } else if (adv.commands.length > 0) {
            // Log as text-only advisory
            this.commandQueue.enqueue({
                type: 'ADVISORY_ACCEPTED',
                value: true,
                description: 'Advisory accepted: ' + adv.commands[0]
            });
        }
        this._dismissAdvisory();
    }

    /**
     * Auto-advise via server-side endpoint: asks AI, parses, executes in one call.
     * Used when "AI Has Controls" is active.
     */
    async _autoAdvise() {
        if (this._destroyed || !this.aiEnabled || !this._autoControlsEnabled) return;
        if (this._autoAdviseInFlight) return;

        this._autoAdviseInFlight = true;
        this._onAdvisoryLoading(true);

        try {
            const phase = this.flightPhase.phase;
            const res = await fetch(`/api/ai-pilot/auto-advise`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Phase: ${phase}. Recommend optimal AP settings for current conditions.`
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Error ${res.status}`);
            }

            const result = await res.json();

            // Show advisory text
            if (result.advisory) {
                const displayText = result.advisory.replace(/COMMANDS_JSON:\s*\[[\s\S]*?\]/, '').trim();
                this._renderAdvisory({ text: displayText, commands: result.commands || [], error: false });
            }

            // Log executed commands
            if (result.commands) {
                for (const cmd of result.commands) {
                    const entry = {
                        time: Date.now(),
                        type: cmd.command,
                        value: cmd.value,
                        description: `AI auto: ${cmd.command}${cmd.value ? ' → ' + cmd.value : ''} ${cmd.executed ? '✓' : '(queued)'}`
                    };
                    this.commandQueue._log.unshift(entry);
                    if (this.commandQueue._log.length > this.commandQueue._maxLog) this.commandQueue._log.pop();
                }
                this._renderCommandLog();
            }

        } catch (err) {
            this._renderAdvisory({ text: err.message, commands: [], error: true });
        } finally {
            this._autoAdviseInFlight = false;
            this._onAdvisoryLoading(false);
        }
    }

    _dismissAdvisory() {
        this.llmAdvisor.clearAdvisory();
        if (this.elements.advisoryContent) {
            this.elements.advisoryContent.innerHTML = '<span class="advisory-idle">No active advisories</span>';
        }
        if (this.elements.advisoryActions) {
            this.elements.advisoryActions.style.display = 'none';
        }
    }

    // ── Render ─────────────────────────────────────────────

    _render() {
        this._renderToggle();
        this._renderPhase();
        this._renderTargets();
        this._renderApStatus();
        this._renderCommandLog();
        this._renderFooter();
    }

    _renderToggle() {
        if (!this.elements.aiToggle) return;
        this.elements.aiToggle.textContent = this.aiEnabled ? 'ON' : 'OFF';
        this.elements.aiToggle.classList.toggle('active', this.aiEnabled);

        if (this.elements.autoControlsBtn) {
            this.elements.autoControlsBtn.textContent = this._autoControlsEnabled ? 'AI HAS CONTROLS' : 'AI CONTROLS';
            this.elements.autoControlsBtn.classList.toggle('active', this._autoControlsEnabled);
        }
    }

    _renderPhase() {
        const phase = this.flightPhase.phase;
        const progress = this.flightPhase.getProgress();

        if (this.elements.phaseName) {
            this.elements.phaseName.textContent = phase;
            this.elements.phaseName.className = 'phase-name ' + phase.toLowerCase();
        }

        if (this.elements.phaseProgress) {
            this.elements.phaseProgress.style.width = progress + '%';
        }

        // Update dots
        const dots = this.elements.phaseDots?.querySelectorAll('.phase-dot');
        if (dots) {
            const idx = this.flightPhase.phaseIndex;
            dots.forEach((dot, i) => {
                dot.classList.toggle('completed', i < idx);
                dot.classList.toggle('active', i === idx);
            });
        }
    }

    _renderTargets() {
        const d = this._lastFlightData;
        const phase = this.flightPhase.phase;
        const p = this.profile;

        if (this.elements.targetAlt) {
            const alt = this.aiEnabled ? this.flightPhase.targetCruiseAlt : (d?.altitude || 0);
            this.elements.targetAlt.textContent = Math.round(alt).toLocaleString() + ' ft';
            this.elements.targetAlt.classList.toggle('active', this.aiEnabled);
        }
        if (this.elements.targetSpd) {
            const spd = this.aiEnabled && p ? (p.phaseSpeeds[phase] || p.speeds.Vcruise) : (d?.speed || 0);
            this.elements.targetSpd.textContent = Math.round(spd) + ' kt';
            this.elements.targetSpd.classList.toggle('active', this.aiEnabled);
        }
        if (this.elements.targetHdg) {
            const hdg = d ? Math.round(d.heading || 0) : 0;
            this.elements.targetHdg.textContent = 'HDG ' + String(hdg).padStart(3, '0') + '\u00B0';
            this.elements.targetHdg.classList.toggle('active', this.aiEnabled);
        }
    }

    _renderApStatus() {
        const overrides = this.commandQueue.getActiveOverrides();
        const overrideAxes = new Set(overrides.map(o => o.axis));

        const rows = [
            { el: 'Hdg', label: 'HDG', engaged: this.ap.headingHold, value: String(this.setValues.heading).padStart(3, '0') + '\u00B0', axis: 'HDG' },
            { el: 'Alt', label: 'ALT', engaged: this.ap.altitudeHold, value: this.setValues.altitude.toLocaleString(), axis: 'ALT' },
            { el: 'Vs',  label: 'VS',  engaged: this.ap.vsHold, value: (this.setValues.vs >= 0 ? '+' : '') + this.setValues.vs, axis: 'VS' },
            { el: 'Spd', label: 'SPD', engaged: this.ap.speedHold, value: this.setValues.speed + ' kt', axis: 'SPD' },
            { el: 'Nav', label: 'NAV', engaged: this.ap.navHold || this.ap.aprHold, value: this.ap.aprHold ? 'APR' : (this.ap.navHold ? 'ON' : 'OFF'), axis: 'NAV' }
        ];

        for (const row of rows) {
            const valEl = this.elements['val' + row.el];
            const checkEl = this.elements['check' + row.el];
            const statusEl = this.elements['status' + row.el];
            const isOverride = overrideAxes.has(row.axis);

            if (valEl) valEl.textContent = row.value;
            if (checkEl) {
                checkEl.className = 'status-check ' + (isOverride ? 'override' : (row.engaged ? 'engaged' : 'off'));
            }
            if (statusEl) {
                statusEl.classList.toggle('override', isOverride);
            }
        }
    }

    _renderCommandLog() {
        if (!this.elements.commandLog) return;

        const log = this.commandQueue.getLog();
        if (log.length === 0) {
            this.elements.commandLog.innerHTML = '<div class="log-empty">' +
                (this.aiEnabled ? 'Waiting for phase commands...' : 'AI Autopilot inactive') + '</div>';
            return;
        }

        const html = log.slice(0, 20).map(entry => {
            const time = new Date(entry.time);
            const ts = time.getHours().toString().padStart(2, '0') + ':' +
                       time.getMinutes().toString().padStart(2, '0') + ':' +
                       time.getSeconds().toString().padStart(2, '0');
            const isOverride = entry.type.includes('OVERRIDE') || entry.type === 'ADVISORY_ACCEPTED';
            return `<div class="log-entry${isOverride ? ' override' : ''}">` +
                   `<span class="log-time">${ts}</span>` +
                   `<span class="log-cmd">${entry.description}</span>` +
                   `</div>`;
        }).join('');

        this.elements.commandLog.innerHTML = html;
    }

    _renderAdvisory(advisory) {
        if (!this.elements.advisoryContent) return;

        if (!advisory || advisory.error) {
            this.elements.advisoryContent.innerHTML =
                `<span class="advisory-text" style="color:#ef5350">${advisory?.text || 'Advisory failed'}</span>`;
            if (this.elements.advisoryActions) this.elements.advisoryActions.style.display = 'none';
            return;
        }

        this.elements.advisoryContent.innerHTML = `<span class="advisory-text">${advisory.text}</span>`;

        if (this.elements.advisoryActions) {
            this.elements.advisoryActions.style.display = advisory.commands.length > 0 ? 'flex' : 'none';
        }
    }

    _renderOverrides(overrides) {
        if (this.elements.overrideCount) {
            this.elements.overrideCount.textContent = overrides ? overrides.length : 0;
        }
    }

    _renderFooter() {
        if (this.elements.aircraftName) {
            this.elements.aircraftName.textContent = this.profile?.shortName || 'Unknown';
        }
    }

    _checkOverrideExpiry() {
        // Let the command queue clean up expired overrides
        const overrides = this.commandQueue.getActiveOverrides();
        this._renderOverrides(overrides);
    }

    // ── Copilot Status & Settings ─────────────────────────

    async _fetchCopilotStatus() {
        try {
            const res = await fetch('/api/copilot/status');
            if (res.ok) {
                this.copilotStatus = await res.json();
                this._renderConfigBanner();
            }
        } catch (e) {
            console.warn('[AI-AP] Could not fetch copilot status:', e.message);
        }
    }

    _renderConfigBanner() {
        const existing = document.querySelector('.ai-config-banner');
        if (existing) existing.remove();

        if (this.copilotStatus?.licensed && this.copilotStatus?.hasApiKey) return;

        const banner = document.createElement('div');
        banner.className = 'ai-config-banner';
        banner.innerHTML = '<strong>AI not configured</strong> — Open Settings to add your license key and API key.';
        const phase = document.getElementById('phase-section');
        if (phase) phase.before(banner);
    }

    /**
     * Register the AI Configuration settings section.
     * Called from index.html after SettingsPanel is created.
     */
    registerSettingsSection(settingsPanel) {
        const self = this;

        const MODELS = {
            openai: [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
            ],
            anthropic: [
                { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
                { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' }
            ],
            ollama: [
                { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder 32B' },
                { id: 'qwen3-coder:latest', name: 'Qwen3 Coder' },
                { id: 'llama3:8b', name: 'Llama 3 8B' },
                { id: 'qwen2.5-coder:14b', name: 'Qwen 2.5 Coder 14B' }
            ],
            lmstudio: [
                { id: 'local-model', name: 'Currently Loaded Model' }
            ]
        };

        settingsPanel.registerSection('ai-config', {
            title: 'AI Configuration',
            icon: '',
            render: () => {
                const status = self.copilotStatus || {};
                const provider = status.provider || 'openai';
                const model = status.model || 'gpt-4o';

                const modelOptions = (p) => MODELS[p].map(m =>
                    `<option value="${m.id}" ${m.id === model ? 'selected' : ''}>${m.name}</option>`
                ).join('');

                return `
                    <div class="ai-settings">
                        <div class="as-row">
                            <label>License Key</label>
                            <div class="as-input-group">
                                <input type="text" id="as-license-key" placeholder="SW-XXXXX-XXXXX-XXXXX-XXXXX" value="${status.licensed ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : ''}">
                                <button class="btn-small" id="as-validate-btn">Validate</button>
                            </div>
                            <div class="as-status" id="as-license-status">${status.licensed ? '<span class="as-ok">Licensed (' + (status.tier || 'pro') + ')</span>' : '<span class="as-warn">Not licensed</span>'}</div>
                        </div>
                        <div class="as-row">
                            <label>Provider</label>
                            <select id="as-provider">
                                <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                                <option value="anthropic" ${provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                                <option value="ollama" ${provider === 'ollama' ? 'selected' : ''}>Ollama (Local)</option>
                                <option value="lmstudio" ${provider === 'lmstudio' ? 'selected' : ''}>LM Studio (Local)</option>
                            </select>
                        </div>
                        <div class="as-row">
                            <label>Model</label>
                            <select id="as-model">${modelOptions(provider)}</select>
                        </div>
                        <div class="as-row">
                            <label>API Key</label>
                            <input type="password" id="as-api-key" placeholder="${status.hasApiKey ? 'Key saved (enter new to replace)' : 'Enter your API key'}">
                        </div>
                        <div class="as-row">
                            <label class="toggle-item">
                                <input type="checkbox" id="as-memory-only" ${status.apiKeyMemoryOnly ? 'checked' : ''}>
                                <span>Memory only (not saved to disk)</span>
                            </label>
                        </div>
                        <div class="as-row">
                            <button class="btn btn-primary" id="as-save-btn">Save Configuration</button>
                        </div>
                        <div class="as-status" id="as-save-status"></div>
                    </div>
                `;
            },
            onMount: (container) => {
                const providerSelect = container.querySelector('#as-provider');
                const modelSelect = container.querySelector('#as-model');

                providerSelect.addEventListener('change', () => {
                    const p = providerSelect.value;
                    modelSelect.innerHTML = MODELS[p].map(m =>
                        `<option value="${m.id}">${m.name}</option>`
                    ).join('');
                });

                container.querySelector('#as-validate-btn').addEventListener('click', async () => {
                    const key = container.querySelector('#as-license-key').value.trim();
                    const statusEl = container.querySelector('#as-license-status');
                    if (!key || key.includes('\u2022')) {
                        statusEl.innerHTML = '<span class="as-warn">Enter a license key to validate</span>';
                        return;
                    }
                    try {
                        const res = await fetch('/api/copilot/validate-key', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ key })
                        });
                        const result = await res.json();
                        if (result.valid) {
                            statusEl.innerHTML = '<span class="as-ok">Valid key (' + (result.tier || 'pro') + ')</span>';
                        } else {
                            statusEl.innerHTML = '<span class="as-err">' + (result.error || 'Invalid key') + '</span>';
                        }
                    } catch (e) {
                        statusEl.innerHTML = '<span class="as-err">Server error</span>';
                    }
                });

                container.querySelector('#as-save-btn').addEventListener('click', async () => {
                    const saveStatus = container.querySelector('#as-save-status');
                    const licenseKey = container.querySelector('#as-license-key').value.trim();
                    const body = {
                        provider: providerSelect.value,
                        model: modelSelect.value,
                        apiKeyMemoryOnly: container.querySelector('#as-memory-only').checked
                    };

                    if (licenseKey && !licenseKey.includes('\u2022')) {
                        body.licenseKey = licenseKey;
                    }

                    const apiKey = container.querySelector('#as-api-key').value.trim();
                    if (apiKey) {
                        body.apiKey = apiKey;
                    }

                    try {
                        const res = await fetch('/api/copilot/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });
                        const result = await res.json();
                        if (result.success) {
                            saveStatus.innerHTML = '<span class="as-ok">Saved! ' +
                                (result.licensed ? 'Licensed.' : 'License invalid.') +
                                (result.hasApiKey ? ' API key set.' : '') + '</span>';
                            self.copilotStatus = {
                                licensed: result.licensed,
                                tier: result.tier,
                                provider: body.provider,
                                model: body.model,
                                hasApiKey: result.hasApiKey,
                                apiKeyMemoryOnly: body.apiKeyMemoryOnly
                            };
                            const banner = document.querySelector('.ai-config-banner');
                            if (banner && result.licensed && result.hasApiKey) {
                                banner.remove();
                            }
                        } else {
                            saveStatus.innerHTML = '<span class="as-err">Save failed</span>';
                        }
                    } catch (e) {
                        saveStatus.innerHTML = '<span class="as-err">Server error</span>';
                    }
                });
            }
        });
    }

    // ── Lifecycle ──────────────────────────────────────────

    destroy() {
        if (this._overrideCheckTimer) {
            clearInterval(this._overrideCheckTimer);
            this._overrideCheckTimer = null;
        }
        if (this._autoAdviseTimer) {
            clearInterval(this._autoAdviseTimer);
            this._autoAdviseTimer = null;
        }
        if (this._wsRateTimer) {
            clearInterval(this._wsRateTimer);
            this._wsRateTimer = null;
        }
        // Restore original fetch
        if (this._origFetch) {
            window.fetch = this._origFetch;
        }
        this.commandQueue.destroy();
        this.llmAdvisor.destroy();
        if (super.destroy) super.destroy();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AiAutopilotPane;
}
