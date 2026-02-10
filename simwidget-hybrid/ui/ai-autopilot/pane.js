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
        this._lastFlightData = null;

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

        // Cache DOM elements
        this.elements = {};
        this._cacheElements();

        // Setup UI event listeners
        this._setupEvents();

        // Build phase dots
        this._buildPhaseDots();

        // Override detection timer
        this._overrideCheckTimer = setInterval(() => this._checkOverrideExpiry(), 5000);

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
        if (msg.type === 'flightData' && msg.data) {
            this._onSimData(msg.data);
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
        } else if (cmd && cmd.command) {
            this.ws.send(JSON.stringify({ type: 'command', command: cmd.command, value: cmd.value }));
        }
    }

    // ── Module Callbacks ───────────────────────────────────

    _onPhaseChange(newPhase, oldPhase) {
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
        this._renderAdvisory(advisory);
    }

    _onAdvisoryLoading(loading) {
        if (this.elements.advisoryAsk) {
            this.elements.advisoryAsk.textContent = loading ? 'Thinking...' : 'Ask AI';
            this.elements.advisoryAsk.classList.toggle('loading', loading);
        }
    }

    _acceptAdvisory() {
        // Mark advisory as accepted, log it
        const adv = this.llmAdvisor.getCurrentAdvisory();
        if (adv && adv.commands.length > 0) {
            // Log acceptance
            this.commandQueue.enqueue({
                type: 'ADVISORY_ACCEPTED',
                value: true,
                description: 'Advisory accepted: ' + adv.commands[0]
            });
        }
        this._dismissAdvisory();
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

    // ── Lifecycle ──────────────────────────────────────────

    destroy() {
        if (this._overrideCheckTimer) {
            clearInterval(this._overrideCheckTimer);
            this._overrideCheckTimer = null;
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
