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

        // ATC Ground Controller
        this.atcController = typeof ATCController !== 'undefined' ? new ATCController({
            serverPort: this._serverPort,
            onInstruction: (text, type) => {
                this._dbg('cmd', `ATC: <span class="val">${this._esc(text)}</span> <span class="dim">[${type}]</span>`);
                if (this._voice && this._ttsEnabled) this._voice.speak(text);
            },
            onPhaseChange: (from, to) => {
                this._dbg('cmd', `ATC phase: <span class="dim">${this._esc(from)}</span> → <span class="val">${this._esc(to)}</span>`);
                this._renderATCPanel();
            }
        }) : null;

        // Nav state from GTN750 (via SafeChannel)
        this._navState = null;
        this._navStateTimestamp = 0;

        // Airport/runway awareness
        this._nearestAirport = null;
        this._activeRunway = null;
        this._airportPollTimer = null;
        this._lastAirportPoll = 0;

        // SafeChannel for cross-pane sync
        this.syncChannel = typeof SafeChannel !== 'undefined' ? new SafeChannel('SimGlass-sync') : null;
        this._syncBroadcastTimer = null;

        // Debug log
        this._debugLog = [];
        this._debugMaxEntries = 200;
        this._debugFilters = new Set(['api', 'ws', 'llm', 'cmd']);  // all active = show all
        this._debugVisible = false;
        this._debugStats = { api: 0, ws: 0, llm: 0, cmd: 0 };
        this._wsPerSec = 0;
        this._wsCount = 0;
        this._llmLastRt = null;  // last LLM response time in ms

        // Voice announcer for AI advisory TTS
        const savedVoice = localStorage.getItem('ai-ap-voice') || null;
        const savedRate = parseFloat(localStorage.getItem('ai-ap-voice-rate')) || 0.95;
        this._voice = typeof VoiceAnnouncer !== 'undefined' ? new VoiceAnnouncer({ rate: savedRate, pitch: 1.0, voice: savedVoice }) : null;
        this._ttsEnabled = localStorage.getItem('ai-ap-tts') !== 'false';

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

        // SafeChannel sync — subscribe to GTN750 nav-state and broadcast autopilot-state
        this._initSyncListener();
        this._startSyncBroadcast();

        // Check for stored flight plan (late-join scenario)
        this._fetchStoredPlan();

        // Airport polling — fetch nearest airport every 15s when near ground
        this._airportPollTimer = setInterval(() => this._pollNearestAirport(), 15000);

        // Wire ATC controller into rule engine and flight phase
        if (this.atcController) {
            this.ruleEngine.setATCController(this.atcController);
            this.flightPhase.setATCController(this.atcController);
        }

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
        this.elements.advisoryMic = document.getElementById('advisory-mic');
        this.elements.advisoryInputRow = document.getElementById('advisory-input-row');
        this.elements.advisoryTextInput = document.getElementById('advisory-text-input');
        this.elements.advisorySend = document.getElementById('advisory-send');
        this.elements.advisoryAccept = document.getElementById('advisory-accept');
        this.elements.advisoryDismiss = document.getElementById('advisory-dismiss');
        this.elements.aircraftName = document.getElementById('aircraft-name');
        this.elements.overrideCount = document.getElementById('override-count');
        this.elements.autoControlsBtn = document.getElementById('auto-controls-btn');
        this.elements.debugToggle = document.getElementById('debug-toggle');
        this.elements.debugPanel = document.getElementById('debug-panel');
        this.elements.debugLog = document.getElementById('debug-log');
        this.elements.debugClear = document.getElementById('debug-clear');
        this.elements.debugResize = document.getElementById('debug-resize-handle');
        this.elements.debugPopout = document.getElementById('debug-popout');
        this.elements.dsApi = document.getElementById('ds-api');
        this.elements.dsWs = document.getElementById('ds-ws');
        this.elements.dsLlm = document.getElementById('ds-llm');
        this.elements.dsCmd = document.getElementById('ds-cmd');
        this.elements.dsLlmRt = document.getElementById('ds-llm-rt');
        this.elements.simbriefImport = document.getElementById('simbrief-import');

        // Airport bar
        this.elements.airportBar = document.getElementById('airport-bar');
        this.elements.airportIcao = document.getElementById('airport-icao');
        this.elements.airportName = document.getElementById('airport-name');
        this.elements.airportRwy = document.getElementById('airport-rwy');
        this.elements.airportElev = document.getElementById('airport-elev');
        this.elements.airportDist = document.getElementById('airport-dist');

        // ATC panel
        this.elements.atcPanel = document.getElementById('atc-panel');
        this.elements.atcPhase = document.getElementById('atc-phase');
        this.elements.atcInstruction = document.getElementById('atc-instruction');
        this.elements.atcRoute = document.getElementById('atc-route');

        // Flight plan report
        this.elements.fplReport = document.getElementById('fpl-report');
        this.elements.fplReportToggle = document.getElementById('fpl-report-toggle');
        this.elements.fplReportBody = document.getElementById('fpl-report-body');
        this.elements.fplReportRoute = document.getElementById('fpl-report-route');
        this.elements.fplReportChevron = document.getElementById('fpl-report-chevron');
        this.elements.fplRptAlt = document.getElementById('fpl-rpt-alt');
        this.elements.fplRptDist = document.getElementById('fpl-rpt-dist');
        this.elements.fplRptWps = document.getElementById('fpl-rpt-wps');
        this.elements.fplRptSource = document.getElementById('fpl-rpt-source');
        this.elements.fplRptRouteStr = document.getElementById('fpl-rpt-route-str');
        this.elements.fplRptWpsList = document.getElementById('fpl-rpt-wps-list');
        this.elements.fplCmdInput = document.getElementById('fpl-cmd-input');
        this.elements.fplCmdSend = document.getElementById('fpl-cmd-send');
        this.elements.fplCmdHistory = document.getElementById('fpl-cmd-history');
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

        // SimBrief import
        this.elements.simbriefImport?.addEventListener('click', () => {
            this._importSimBrief();
        });

        // Flight plan report collapse toggle
        this.elements.fplReportToggle?.addEventListener('click', () => {
            this.elements.fplReport?.classList.toggle('collapsed');
        });

        // Flight plan command input
        this.elements.fplCmdSend?.addEventListener('click', () => {
            this._sendFplCommand();
        });
        this.elements.fplCmdInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this._sendFplCommand(); }
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

        // Mic button — toggle voice input
        this.elements.advisoryMic?.addEventListener('click', () => {
            this._toggleVoiceInput();
        });

        // Text input — send on Enter
        this.elements.advisoryTextInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._sendTextQuery();
            }
        });

        // Send button
        this.elements.advisorySend?.addEventListener('click', () => {
            this._sendTextQuery();
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

    // ── Voice Input ─────────────────────────────────────────

    _toggleVoiceInput() {
        // If already listening, stop
        if (this._recognition) {
            this._recognition.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this._renderAdvisory({ text: 'Speech recognition not supported in this browser.', commands: [], error: true });
            return;
        }

        // Show input row
        if (this.elements.advisoryInputRow) {
            this.elements.advisoryInputRow.style.display = 'flex';
        }

        this._recognition = new SpeechRecognition();
        this._recognition.continuous = false;
        this._recognition.interimResults = true;
        this._recognition.lang = 'en-US';

        this.elements.advisoryMic?.classList.add('listening');
        this.elements.advisoryTextInput?.classList.add('voice-active');
        if (this.elements.advisoryTextInput) {
            this.elements.advisoryTextInput.placeholder = 'Listening...';
            this.elements.advisoryTextInput.value = '';
        }
        this._dbg('llm', '<span class="dim">&#127908; Listening...</span>');

        this._recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            if (this.elements.advisoryTextInput) {
                this.elements.advisoryTextInput.value = transcript;
            }
        };

        this._recognition.onend = () => {
            this.elements.advisoryMic?.classList.remove('listening');
            this.elements.advisoryTextInput?.classList.remove('voice-active');

            const text = this.elements.advisoryTextInput?.value?.trim();
            this._recognition = null;

            if (text) {
                if (this.elements.advisoryTextInput) {
                    this.elements.advisoryTextInput.placeholder = 'Ask the AI anything...';
                }
                this._dbg('llm', `<span class="dim">&#127908;</span> <span class="val">${this._esc(text)}</span>`);
                this._askAI(text);
            } else {
                if (this.elements.advisoryTextInput) {
                    this.elements.advisoryTextInput.placeholder = 'Ask the AI anything...';
                }
            }
        };

        this._recognition.onerror = (event) => {
            this.elements.advisoryMic?.classList.remove('listening');
            this.elements.advisoryTextInput?.classList.remove('voice-active');
            if (this.elements.advisoryTextInput) {
                this.elements.advisoryTextInput.placeholder = 'Ask the AI anything...';
            }
            this._recognition = null;

            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                this._dbg('llm', `<span class="err">&#127908; ${this._esc(event.error)}</span>`);
            }
        };

        this._recognition.start();
    }

    _sendTextQuery() {
        const text = this.elements.advisoryTextInput?.value?.trim();
        if (!text) return;

        this._dbg('llm', `<span class="dim">&rarr;</span> <span class="val">${this._esc(text)}</span>`);
        this._askAI(text);
        if (this.elements.advisoryTextInput) {
            this.elements.advisoryTextInput.value = '';
        }
    }

    async _askAI(question) {
        this._onAdvisoryLoading(true);

        try {
            const res = await fetch('/api/ai-pilot/auto-advise', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: question })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Error ${res.status}`);
            }

            const result = await res.json();

            if (result.advisory) {
                const displayText = result.advisory.replace(/COMMANDS_JSON:\s*\[[\s\S]*?\]/, '').trim();
                this._renderAdvisory({ text: displayText, commands: result.commands || [], error: false });

                // Speak response (humanized for natural TTS)
                const speakText = this._humanizeSpeech(displayText.replace(/RECOMMEND:\s*/g, '').trim());
                if (this._ttsEnabled && this._voice && speakText) {
                    this._voice.speak(speakText);
                }
            }

            // Log executed commands
            if (result.commands) {
                for (const cmd of result.commands) {
                    const entry = {
                        time: Date.now(),
                        type: cmd.command,
                        value: cmd.value,
                        description: `AI: ${cmd.command}${cmd.value ? ' \u2192 ' + cmd.value : ''} ${cmd.executed ? '\u2713' : '(queued)'}`
                    };
                    this.commandQueue._log.unshift(entry);
                    if (this.commandQueue._log.length > this.commandQueue._maxLog) this.commandQueue._log.pop();
                }
                this._renderCommandLog();
            }

        } catch (err) {
            this._renderAdvisory({ text: err.message, commands: [], error: true });
        } finally {
            this._onAdvisoryLoading(false);
        }
    }

    // ── Debug Panel ─────────────────────────────────────────

    _setupDebug() {
        // Toggle button
        this.elements.debugToggle?.addEventListener('click', () => {
            this._toggleDebug();
        });

        // Auto-open via URL hash: #debug
        if (window.location.hash === '#debug') {
            this._toggleDebug();
        }

        // Filter buttons — multi-select; ALL toggles everything
        const allCats = ['api', 'ws', 'llm', 'cmd'];
        const syncFilterButtons = () => {
            const allActive = allCats.every(c => this._debugFilters.has(c));
            document.querySelectorAll('.debug-filter').forEach(b => {
                const f = b.dataset.filter;
                if (f === 'all') {
                    b.classList.toggle('active', allActive);
                } else {
                    b.classList.toggle('active', this._debugFilters.has(f));
                }
            });
        };

        document.querySelectorAll('.debug-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                const f = btn.dataset.filter;
                if (f === 'all') {
                    // Toggle: if all active → clear all; otherwise → select all
                    const allActive = allCats.every(c => this._debugFilters.has(c));
                    if (allActive) {
                        this._debugFilters.clear();
                    } else {
                        allCats.forEach(c => this._debugFilters.add(c));
                    }
                } else {
                    if (this._debugFilters.has(f)) {
                        this._debugFilters.delete(f);
                    } else {
                        this._debugFilters.add(f);
                    }
                }
                syncFilterButtons();
                this._renderDebugLog();
            });
        });
        syncFilterButtons();

        // Clear button
        this.elements.debugClear?.addEventListener('click', () => {
            this._debugLog = [];
            this._debugStats = { api: 0, ws: 0, llm: 0, cmd: 0 };
            this._renderDebugLog();
            this._renderDebugStats();
        });

        // Resize handle — drag to resize debug panel height
        if (this.elements.debugResize && this.elements.debugPanel) {
            this._debugResizeHandler = (e) => {
                e.preventDefault();
                const panel = this.elements.debugPanel;
                const startY = e.clientY;
                const startH = panel.offsetHeight;
                const handle = this.elements.debugResize;
                handle.classList.add('dragging');

                const onMove = (ev) => {
                    const delta = startY - ev.clientY;
                    const newH = Math.max(80, Math.min(window.innerHeight * 0.7, startH + delta));
                    panel.style.height = newH + 'px';
                };
                const onUp = () => {
                    handle.classList.remove('dragging');
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            };
            this.elements.debugResize.addEventListener('mousedown', this._debugResizeHandler);
        }

        // Popout button — open debug in new window
        this.elements.debugPopout?.addEventListener('click', () => {
            this._popoutDebug();
        });

        // Intercept fetch for API logging
        this._origFetch = window.fetch.bind(window);
        window.fetch = (...args) => this._interceptFetch(...args);
    }

    _toggleDebug() {
        this._debugVisible = !this._debugVisible;
        this.elements.debugToggle?.classList.toggle('active', this._debugVisible);
        if (this.elements.debugPanel) {
            this.elements.debugPanel.style.display = this._debugVisible ? 'flex' : 'none';
        }
        if (this._debugVisible) this._renderDebugLog();
    }

    _popoutDebug() {
        if (this._debugWindow && !this._debugWindow.closed) {
            this._debugWindow.focus();
            return;
        }

        const w = window.open('', 'ai-autopilot-debug', 'width=700,height=500,resizable=yes,scrollbars=yes');
        if (!w) return;
        this._debugWindow = w;

        w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>AI Autopilot Debug</title>
<style>
body { margin:0; background:#060a10; color:#8899aa; font-family:'Consolas',monospace; font-size:11px; }
.dbg-toolbar { display:flex; gap:6px; padding:6px 10px; background:#0a1018; border-bottom:1px solid #1a2030; align-items:center; position:sticky; top:0; z-index:1; }
.dbg-toolbar .title { font-size:11px; font-weight:700; color:#4fc3f7; letter-spacing:1.5px; margin-right:8px; }
.dbg-toolbar button { padding:2px 8px; border:1px solid #222; border-radius:2px; background:transparent; color:#556; font-size:10px; font-weight:700; font-family:'Consolas',monospace; cursor:pointer; }
.dbg-toolbar button:hover { color:#889; border-color:#445; }
.dbg-toolbar button.active { color:#4fc3f7; border-color:#4fc3f7; background:rgba(79,195,247,0.08); }
.dbg-toolbar .clear { margin-left:auto; }
.dbg-toolbar .clear:hover { color:#ef5350; border-color:#ef5350; }
.dbg-stats { display:flex; gap:14px; padding:4px 10px; font-size:10px; color:#445; background:#0a1018; border-bottom:1px solid #1a2030; }
.dbg-stats span span { color:#667; }
.dbg-log { padding:6px 10px; overflow-y:auto; flex:1; }
.dbg-entry { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:1px 0; line-height:1.7; }
.dbg-time { color:#334; margin-right:4px; }
.dbg-tag { display:inline-block; width:28px; text-align:center; font-weight:700; font-size:9px; margin-right:4px; border-radius:2px; padding:0 2px; }
.dbg-tag.api { color:#66bb6a; background:rgba(102,187,106,0.1); }
.dbg-tag.ws { color:#78909c; background:rgba(120,144,156,0.1); }
.dbg-tag.llm { color:#ba68c8; background:rgba(186,104,200,0.1); }
.dbg-tag.cmd { color:#ffb74d; background:rgba(255,183,77,0.1); }
.dbg-text { color:#8899aa; }
.dbg-text .ok { color:#66bb6a; } .dbg-text .err { color:#ef5350; } .dbg-text .dim { color:#445; }
.dbg-text .url { color:#4fc3f7; } .dbg-text .val { color:#e0e0e0; } .dbg-text .dur { color:#ffa726; }
::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:#223; border-radius:2px; }
</style></head><body>
<div class="dbg-toolbar">
  <span class="title">DEBUG</span>
  <button class="active" data-filter="all">ALL</button>
  <button class="active" data-filter="api">API</button>
  <button class="active" data-filter="ws">WS</button>
  <button class="active" data-filter="llm">LLM</button>
  <button class="active" data-filter="cmd">CMD</button>
  <button class="clear" id="pw-clear">CLEAR</button>
</div>
<div class="dbg-stats" id="pw-stats">
  <span>API: <span id="pw-api">0</span></span>
  <span>WS: <span id="pw-ws">0</span>/s</span>
  <span>LLM: <span id="pw-llm">0</span></span>
  <span>RT: <span id="pw-rt">--</span>ms</span>
  <span>CMD: <span id="pw-cmd">0</span></span>
</div>
<div class="dbg-log" id="pw-log"></div>
</body></html>`);
        w.document.close();

        // Wire filter buttons — multi-select, same as inline panel
        const popFilters = new Set(['api', 'ws', 'llm', 'cmd']);
        const popCats = ['api', 'ws', 'llm', 'cmd'];
        const syncPopButtons = () => {
            const allActive = popCats.every(c => popFilters.has(c));
            w.document.querySelectorAll('[data-filter]').forEach(b => {
                const f = b.dataset.filter;
                if (f === 'all') {
                    b.classList.toggle('active', allActive);
                } else {
                    b.classList.toggle('active', popFilters.has(f));
                }
            });
        };
        w.document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                const f = btn.dataset.filter;
                if (f === 'all') {
                    const allActive = popCats.every(c => popFilters.has(c));
                    if (allActive) { popFilters.clear(); } else { popCats.forEach(c => popFilters.add(c)); }
                } else {
                    if (popFilters.has(f)) { popFilters.delete(f); } else { popFilters.add(f); }
                }
                syncPopButtons();
                renderPopout();
            });
        });
        syncPopButtons();

        w.document.getElementById('pw-clear')?.addEventListener('click', () => {
            this._debugLog = [];
            this._debugStats = { api: 0, ws: 0, llm: 0, cmd: 0 };
            renderPopout();
            if (this._debugVisible) {
                this._renderDebugLog();
                this._renderDebugStats();
            }
        });

        const self = this;
        function renderPopout() {
            const logEl = w.document.getElementById('pw-log');
            if (!logEl) return;

            const entries = popFilters.size === 0
                ? []
                : self._debugLog.filter(e => popFilters.has(e.cat)).slice(0, 100);

            if (entries.length === 0) {
                logEl.innerHTML = '<div style="color:#334;padding:8px;font-style:italic">No debug entries</div>';
            } else {
                logEl.innerHTML = entries.map(e =>
                    `<div class="dbg-entry"><span class="dbg-time">${e.ts}</span>` +
                    `<span class="dbg-tag ${e.cat}">${e.cat.toUpperCase()}</span>` +
                    `<span class="dbg-text">${e.html}</span></div>`
                ).join('');
            }

            const s = self._debugStats;
            const api = w.document.getElementById('pw-api');
            const ws = w.document.getElementById('pw-ws');
            const llm = w.document.getElementById('pw-llm');
            const rt = w.document.getElementById('pw-rt');
            const cmd = w.document.getElementById('pw-cmd');
            if (api) api.textContent = s.api;
            if (ws) ws.textContent = self._wsPerSec;
            if (llm) llm.textContent = s.llm;
            if (rt) rt.textContent = self._llmLastRt !== null ? self._llmLastRt : '--';
            if (cmd) cmd.textContent = s.cmd;
        }

        // Refresh popout every 500ms
        this._debugPopoutTimer = setInterval(() => {
            if (w.closed) {
                clearInterval(this._debugPopoutTimer);
                this._debugPopoutTimer = null;
                this._debugWindow = null;
                return;
            }
            renderPopout();
        }, 500);

        renderPopout();
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

            // Track LLM response time
            if (isLlm && status < 400) {
                this._llmLastRt = parseInt(dur);
                if (this._debugVisible) this._renderDebugStats();
            }

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
        const filters = this._debugFilters;
        const entries = filters.size === 0
            ? []
            : this._debugLog.filter(e => filters.has(e.cat)).slice(0, 60);

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
        if (this.elements.dsLlmRt) this.elements.dsLlmRt.textContent = this._llmLastRt !== null ? this._llmLastRt : '--';
        if (this.elements.dsCmd) this.elements.dsCmd.textContent = this._debugStats.cmd;
    }

    // ── SafeChannel Sync ────────────────────────────────────

    _initSyncListener() {
        if (!this.syncChannel) return;
        this.syncChannel.onmessage = (event) => {
            const msg = event.data;
            if (!msg || !msg.type) return;

            switch (msg.type) {
                case 'nav-state':
                    this._onNavStateReceived(msg.data);
                    break;
                case 'taws-alert':
                    this._onTawsAlert(msg.data);
                    break;
                case 'simbrief-plan':
                    this._onSimbriefPlan(msg.data);
                    break;
            }
        };
    }

    _onNavStateReceived(nav) {
        if (!nav) return;
        this._navState = nav;
        this._navStateTimestamp = Date.now();

        // Feed nav data to rule engine
        this.ruleEngine.setNavState(nav);

        // Feed destination distance for TOD calculation
        if (nav.destDistNm != null) {
            this.flightPhase.setDestinationDist(nav.destDistNm);
        }

        // Update cruise altitude from flight plan if available
        if (nav.flightPlan?.cruiseAltitude && nav.flightPlan.cruiseAltitude > 0) {
            this.flightPhase.targetCruiseAlt = nav.flightPlan.cruiseAltitude;
            this.ruleEngine.setTargetCruiseAlt(nav.flightPlan.cruiseAltitude);
        }

        // Log nav-state receipt (throttled)
        if (!this._lastNavLog || Date.now() - this._lastNavLog > 10000) {
            this._lastNavLog = Date.now();
            const wp = nav.activeWaypoint;
            this._dbg('ws', `nav-state <span class="dim">wp:</span><span class="val">${wp?.ident || '---'}</span> <span class="dim">dis:</span><span class="val">${wp?.distNm?.toFixed(1) || '--'}</span> <span class="dim">cdi:</span><span class="val">${nav.cdi?.source || '?'}</span> <span class="dim">dest:</span><span class="val">${nav.destDistNm?.toFixed(0) || '--'}nm</span>`);
        }
    }

    _onTawsAlert(alert) {
        if (!alert) return;
        if (alert.level === 'WARNING' || alert.level === 'CAUTION') {
            this.ruleEngine.setExternalTerrainAlert(alert.level);
            this._dbg('cmd', `TAWS <span class="${alert.level === 'WARNING' ? 'err' : 'val'}">${alert.level}</span>: ${this._esc(alert.message || 'TERRAIN')}`);
        } else {
            this.ruleEngine.setExternalTerrainAlert(null);
        }
    }

    _onSimbriefPlan(plan) {
        if (!plan) return;
        this._currentPlan = plan;
        if (plan.cruiseAltitude && plan.cruiseAltitude > 0) {
            this.flightPhase.targetCruiseAlt = plan.cruiseAltitude;
            this.ruleEngine.setTargetCruiseAlt(plan.cruiseAltitude);
            this._dbg('cmd', `SimBrief plan: cruise <span class="val">${plan.cruiseAltitude}ft</span>`);
        }
        this._renderFplReport();
    }

    async _importSimBrief() {
        const btn = this.elements.simbriefImport;
        if (!btn || btn.classList.contains('loading')) return;

        let pilotId = localStorage.getItem('simbrief-pilot-id');
        if (!pilotId) {
            pilotId = prompt('Enter SimBrief Pilot ID or Username:');
            if (!pilotId) return;
            localStorage.setItem('simbrief-pilot-id', pilotId.trim());
        }

        btn.classList.add('loading');
        btn.textContent = '... LOADING';

        try {
            const isNumeric = /^\d+$/.test(pilotId);
            const param = isNumeric ? 'userid' : 'username';
            const res = await fetch(`/api/simbrief/ofp?${param}=${encodeURIComponent(pilotId)}`);
            if (!res.ok) throw new Error('Failed to fetch OFP');
            const ofp = await res.json();
            if (ofp.fetch?.status === 'Error') throw new Error(ofp.fetch.error || 'No plan found');

            const navlog = ofp.navlog?.fix || [];
            const waypoints = navlog.map(fix => ({
                ident: fix.ident, name: fix.name, type: fix.type,
                lat: parseFloat(fix.pos_lat), lng: parseFloat(fix.pos_long),
                altitude: parseInt(fix.altitude_feet) || 0,
                distanceFromPrev: parseInt(fix.distance) || 0,
                ete: parseInt(fix.time_leg) || 0
            }));

            const planData = {
                departure: ofp.origin?.icao_code,
                arrival: ofp.destination?.icao_code,
                waypoints,
                totalDistance: parseInt(ofp.general?.route_distance) || 0,
                cruiseAltitude: parseInt(ofp.general?.initial_altitude) || 0,
                route: ofp.general?.route || '',
                source: 'simbrief'
            };

            // Feed into local AI autopilot
            this._onSimbriefPlan(planData);

            // Store on server for other panes
            fetch('/api/ai-pilot/shared-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'nav', data: { simbriefPlan: planData } })
            }).catch(() => {});

            // Broadcast to other panes
            if (this.syncChannel) {
                this.syncChannel.postMessage({ type: 'simbrief-plan', data: planData });
            }

            this._dbg('api', `SimBrief loaded: ${planData.departure}→${planData.arrival}, ${waypoints.length} wps`);
            btn.textContent = '\u2714 LOADED';
            setTimeout(() => { btn.textContent = '\u2708 FPL'; }, 2000);
        } catch (e) {
            console.error('[AI-AP] SimBrief import failed:', e);
            this._dbg('api', `SimBrief import failed: ${e.message}`);
            btn.textContent = '\u2718 FAILED';
            localStorage.removeItem('simbrief-pilot-id');
            setTimeout(() => { btn.textContent = '\u2708 FPL'; }, 2000);
        }
        btn.classList.remove('loading');
    }

    // ── Airport/Runway Awareness ────────────────────────────

    async _pollNearestAirport() {
        const d = this._lastFlightData;
        if (!d || !d.latitude || !d.longitude) return;

        // Only poll when below 10000 AGL (relevant for takeoff/approach/landing)
        const agl = d.altitudeAGL || 0;
        if (agl > 10000) {
            if (this._nearestAirport) {
                this._nearestAirport = null;
                this._activeRunway = null;
                this.ruleEngine.setAirportData(null);
                this.ruleEngine.setActiveRunway(null);
                this._renderAirportInfo();
            }
            return;
        }

        try {
            const res = await fetch(`/api/nearby/airports?lat=${d.latitude}&lon=${d.longitude}&radius=15`);
            if (!res.ok) return;
            const airports = await res.json();
            if (!airports?.length) return;

            // Pick closest airport
            const apt = airports[0];
            const changed = !this._nearestAirport || this._nearestAirport.icao !== apt.icao;
            this._nearestAirport = apt;

            // Set field elevation for AGL calculations
            if (apt.elevation != null) {
                this.flightPhase.setFieldElevation(apt.elevation);
            }

            // Determine active runway
            this._activeRunway = this._detectActiveRunway(apt, d);

            // Feed to rule engine
            this.ruleEngine.setAirportData(apt);
            this.ruleEngine.setActiveRunway(this._activeRunway);

            // Store on server for LLM context
            fetch('/api/ai-pilot/shared-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'airport', data: { airport: apt, activeRunway: this._activeRunway } })
            }).catch(() => {});

            if (changed) {
                this._dbg('api', `Airport: <span class="val">${apt.icao}</span> ${this._esc(apt.name || '')} <span class="dim">${apt.distance?.toFixed(1) || '?'}nm elev:${apt.elevation || '?'}ft</span>`);
            }
            if (this._activeRunway) {
                this._dbg('api', `Runway: <span class="val">${this._activeRunway.id}</span> hdg ${this._activeRunway.heading}° len ${this._activeRunway.length || '?'}ft`);
            }

            // Auto-activate ATC and request taxi clearance when parked
            if (this.atcController && this.aiEnabled && this._activeRunway && (d.altitudeAGL || 0) < 50) {
                const atcPhase = this.atcController.getPhase();
                if (atcPhase === 'INACTIVE') {
                    this.atcController.activate();
                }
                if (atcPhase === 'PARKED' && apt.icao) {
                    this.atcController.requestTaxiClearance(apt.icao, this._activeRunway.id);
                }
            }

            this._renderAirportInfo();
        } catch (e) {
            // API not available — continue without airport data
        }
    }

    _detectActiveRunway(airport, d) {
        if (!airport?.runways?.length) return null;

        const hdg = d.heading || 0;
        const windDir = d.windDirection || 0;
        const windSpd = d.windSpeed || 0;

        // Parse runway IDs into heading values
        const parsed = airport.runways.map(rwy => {
            const match = rwy.id?.match(/^(\d{1,2})([LRC]?)$/);
            if (!match) return null;
            const rwyHdg = parseInt(match[1]) * 10;
            const suffix = match[2] || '';
            return { id: rwy.id, heading: rwyHdg, length: rwy.length || 0, suffix };
        }).filter(Boolean);

        if (!parsed.length) return null;

        // Score each runway: prefer into wind + closest to aircraft heading
        let best = null;
        let bestScore = -Infinity;

        for (const rwy of parsed) {
            // Headwind component (positive = headwind, negative = tailwind)
            const windAngle = ((windDir - rwy.heading + 540) % 360) - 180;
            const headwind = windSpd * Math.cos(windAngle * Math.PI / 180);

            // Alignment with aircraft heading (0 = perfect alignment)
            const hdgDiff = Math.abs(((hdg - rwy.heading + 540) % 360) - 180);

            // Score: headwind bonus + heading alignment bonus + length bonus
            const score = headwind * 2 + (180 - hdgDiff) + (rwy.length / 1000);

            if (score > bestScore) {
                bestScore = score;
                best = rwy;
            }
        }

        return best;
    }

    async _fetchStoredPlan() {
        try {
            const res = await fetch('/api/ai-pilot/shared-state/nav');
            if (!res.ok) return;
            const json = await res.json();
            const plan = json.nav?.simbriefPlan;
            if (plan && plan.waypoints?.length && !this._currentPlan) {
                this._onSimbriefPlan(plan);
            }
        } catch (e) { /* server may not be ready */ }
    }

    // ── Flight Plan Report ─────────────────────────────────

    _renderAirportInfo() {
        const apt = this._nearestAirport;
        const rwy = this._activeRunway;

        if (!apt || !this.elements.airportBar) {
            if (this.elements.airportBar) this.elements.airportBar.style.display = 'none';
            return;
        }

        this.elements.airportBar.style.display = '';
        if (this.elements.airportIcao) this.elements.airportIcao.textContent = apt.icao || '----';
        if (this.elements.airportName) this.elements.airportName.textContent = apt.name || '';
        if (this.elements.airportElev) this.elements.airportElev.textContent = `${apt.elevation || '---'} ft`;
        if (this.elements.airportDist) this.elements.airportDist.textContent = `${apt.distance?.toFixed(1) || '--.-'} nm`;

        if (this.elements.airportRwy) {
            if (rwy) {
                this.elements.airportRwy.textContent = `RWY ${rwy.id} (${rwy.heading}\u00B0)`;
                this.elements.airportRwy.classList.remove('no-runway');
            } else {
                this.elements.airportRwy.textContent = 'RWY --';
                this.elements.airportRwy.classList.add('no-runway');
            }
        }
    }

    _renderFplReport() {
        const plan = this._currentPlan;
        if (!plan || !this.elements.fplReport) return;

        this.elements.fplReport.style.display = '';
        this.elements.fplReport.classList.remove('collapsed');

        // Route header
        const dep = plan.departure || '----';
        const arr = plan.arrival || '----';
        if (this.elements.fplReportRoute) {
            this.elements.fplReportRoute.textContent = `${dep} \u2192 ${arr}`;
        }

        // Summary fields
        if (this.elements.fplRptAlt) {
            const alt = plan.cruiseAltitude || 0;
            this.elements.fplRptAlt.textContent = alt >= 18000 ? `FL${Math.round(alt / 100)}` : `${alt.toLocaleString()} ft`;
        }
        if (this.elements.fplRptDist) {
            this.elements.fplRptDist.textContent = plan.totalDistance ? `${plan.totalDistance} nm` : '---';
        }
        if (this.elements.fplRptWps) {
            this.elements.fplRptWps.textContent = plan.waypoints?.length || 0;
        }
        if (this.elements.fplRptSource) {
            this.elements.fplRptSource.textContent = (plan.source || 'unknown').toUpperCase();
        }

        // Route string
        if (this.elements.fplRptRouteStr) {
            this.elements.fplRptRouteStr.textContent = plan.route || '';
        }

        // Waypoint tags
        if (this.elements.fplRptWpsList && plan.waypoints?.length) {
            this.elements.fplRptWpsList.textContent = '';
            const activeIdx = this._navState?.activeWaypoint?.index ?? -1;
            plan.waypoints.forEach((wp, i) => {
                const tag = document.createElement('span');
                tag.className = 'fpl-wp-tag';
                if (i === 0 || i === plan.waypoints.length - 1) tag.classList.add('airport');
                if (i === activeIdx) tag.classList.add('active');
                if (wp.passed) tag.classList.add('passed');
                tag.textContent = wp.ident || `WP${i + 1}`;
                tag.title = wp.altitude ? `${wp.altitude.toLocaleString()} ft` : '';
                this.elements.fplRptWpsList.appendChild(tag);
            });
        }
    }

    _sendFplCommand() {
        const input = this.elements.fplCmdInput;
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;
        input.value = '';

        // Add to command history
        if (this.elements.fplCmdHistory) {
            const entry = document.createElement('div');
            entry.className = 'fpl-cmd-entry';
            const time = new Date();
            const ts = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
            entry.innerHTML = `<span class="cmd-time">${ts}</span><span class="cmd-text">${this._esc(text)}</span><span class="cmd-status sent">SENT</span>`;
            this.elements.fplCmdHistory.prepend(entry);
        }

        // Store as AI instruction
        if (!this._fplInstructions) this._fplInstructions = [];
        this._fplInstructions.push(text);

        // Send to LLM advisor as context
        if (this.llmAdvisor && !this.llmAdvisor.isRateLimited()) {
            const plan = this._currentPlan;
            const planCtx = plan ? `Current plan: ${plan.departure}->${plan.arrival}, cruise ${plan.cruiseAltitude}ft, ${plan.waypoints?.length || 0} wps.` : '';
            this.llmAdvisor.requestAdvisory(
                `Pilot instruction: "${text}". ${planCtx} Phase: ${this.flightPhase.phase}. Interpret and advise on execution.`,
                this._lastFlightData
            );
        }

        this._dbg('cmd', `Pilot instruction: <span class="val">${this._esc(text)}</span>`);

        // Store on server for cross-machine access
        fetch('/api/ai-pilot/shared-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'instructions', data: { commands: this._fplInstructions } })
        }).catch(() => {});
    }

    _startSyncBroadcast() {
        if (!this.syncChannel) return;
        this._syncBroadcastTimer = setInterval(() => this._broadcastAutopilotState(), 1000);
    }

    _broadcastAutopilotState() {
        if (!this.syncChannel || !this.aiEnabled) return;
        const lastCmd = this.commandQueue.getLog()[0] || null;
        this.syncChannel.postMessage({
            type: 'autopilot-state',
            data: {
                enabled: this.aiEnabled,
                autoControls: this._autoControlsEnabled,
                phase: this.flightPhase.phase,
                takeoffSubPhase: this.ruleEngine.getTakeoffSubPhase(),
                targets: {
                    altitude: this.flightPhase.targetCruiseAlt,
                    speed: this.setValues.speed,
                    heading: this.setValues.heading,
                    vs: this.setValues.vs
                },
                ap: {
                    master: this.ap.master,
                    hdg: this.ap.headingHold,
                    alt: this.ap.altitudeHold,
                    vs: this.ap.vsHold,
                    spd: this.ap.speedHold,
                    nav: this.ap.navHold,
                    apr: this.ap.aprHold
                },
                terrainAlert: this.ruleEngine.getTerrainAlert(),
                envelopeAlert: this.ruleEngine.getEnvelopeAlert(),
                envelope: this.ruleEngine.getEnvelope(),
                airport: this._nearestAirport ? {
                    icao: this._nearestAirport.icao,
                    name: this._nearestAirport.name,
                    elevation: this._nearestAirport.elevation,
                    distance: this._nearestAirport.distance
                } : null,
                activeRunway: this._activeRunway ? {
                    id: this._activeRunway.id,
                    heading: this._activeRunway.heading,
                    length: this._activeRunway.length
                } : null,
                navGuidance: this.ruleEngine.getNavGuidance(),
                atcPhase: this.atcController ? this.atcController.getPhase() : 'INACTIVE',
                atcInstruction: this.atcController ? this.atcController.getATCInstruction() : '',
                atcRoute: this.atcController ? this.atcController.getRoute() : null,
                lastCommand: lastCmd ? {
                    type: lastCmd.type,
                    value: lastCmd.value,
                    description: lastCmd.description,
                    time: lastCmd.time
                } : null,
                timestamp: Date.now()
            }
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

            // Update ATC ground controller (only when near ground)
            if (this.atcController && (data.altitudeAGL || 0) < 100) {
                this.atcController.updatePosition(
                    data.latitude, data.longitude,
                    data.groundSpeed || 0, data.altitudeAGL || 0
                );
            }

            // Run rule engine
            this.ruleEngine.evaluate(this.flightPhase.phase, data, this.ap);

            // Log takeoff sub-phase changes
            const subPhase = this.ruleEngine.getTakeoffSubPhase();
            if (subPhase && subPhase !== this._lastTakeoffSubPhase) {
                this._lastTakeoffSubPhase = subPhase;
                this._dbg('cmd', `Takeoff: <span class="val">${this._esc(subPhase)}</span>`);
            }

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
        this._lastTakeoffSubPhase = null;
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
            // Speak advisory via TTS (humanized for natural speech)
            if (this._ttsEnabled && this._voice && advisory.text) {
                const speakText = this._humanizeSpeech(advisory.text.replace(/COMMANDS_JSON:\s*\[[\s\S]*?\]/, '').replace(/RECOMMEND:\s*/g, '').trim());
                if (speakText) this._voice.speak(speakText);
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
        const _adviseStart = performance.now();

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
                // Speak via TTS (humanized for natural speech)
                const speakText = this._humanizeSpeech(displayText.replace(/RECOMMEND:\s*/g, '').trim());
                if (this._ttsEnabled && this._voice && speakText) {
                    this._voice.speak(speakText);
                }
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
        this._renderATCPanel();
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
        const subPhase = this.ruleEngine.getTakeoffSubPhase();

        if (this.elements.phaseName) {
            const display = (phase === 'TAKEOFF' && subPhase) ? `TAKEOFF \u203A ${subPhase}` : phase;
            this.elements.phaseName.textContent = display;
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
            const navG = this.aiEnabled ? this.ruleEngine.getNavGuidance() : null;
            if (navG && navG.wpIdent) {
                // Show active waypoint + distance instead of raw heading
                const distStr = navG.wpDist != null ? ` ${navG.wpDist}nm` : '';
                this.elements.targetHdg.textContent = navG.wpIdent + distStr;
                this.elements.targetHdg.title = navG.interceptDesc || '';
            } else {
                const hdg = d ? Math.round(d.heading || 0) : 0;
                this.elements.targetHdg.textContent = 'HDG ' + String(hdg).padStart(3, '0') + '\u00B0';
                this.elements.targetHdg.title = '';
            }
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
            { el: 'Nav', label: 'NAV', engaged: this.ap.navHold || this.ap.aprHold, value: this.ap.aprHold ? 'APR' : (this.ap.navHold ? (this.ruleEngine.getNavGuidance()?.cdiSource || 'ON') : 'OFF'), axis: 'NAV' }
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
                // Re-render AI config section if settings panel is showing it
                if (this._settingsPanel) {
                    this._settingsPanel.rerenderSection('ai-config');
                }
            }
        } catch (e) {
            console.warn('[AI-AP] Could not fetch copilot status:', e.message);
        }
    }

    _renderConfigBanner() {
        const existing = document.querySelector('.ai-config-banner');
        if (existing) existing.remove();

        const status = this.copilotStatus;
        if (!status) return;

        const provider = status.provider || '';
        const isLocal = provider.startsWith('ollama') || provider.startsWith('lmstudio');

        // No banner needed if licensed and has key (or is local)
        if (status.licensed && (status.hasApiKey || isLocal)) return;

        const banner = document.createElement('div');
        banner.className = 'ai-config-banner';

        if (!status.licensed) {
            banner.innerHTML = '<strong>AI not configured</strong> \u2014 Open Settings to add your license key.';
        } else if (!isLocal && !status.hasApiKey) {
            banner.innerHTML = '<strong>AI not configured</strong> \u2014 Open Settings to add your API key.';
        }

        if (banner.innerHTML) {
            const phase = document.getElementById('phase-section');
            if (phase) phase.before(banner);
        }
    }

    /**
     * Register the AI Configuration settings section.
     * Called from index.html after SettingsPanel is created.
     */
    registerSettingsSection(settingsPanel) {
        this._settingsPanel = settingsPanel;
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
            'ollama-aipc': [
                { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder 32B' },
                { id: 'mistral:latest', name: 'Mistral' },
                { id: 'llama3.2:latest', name: 'Llama 3.2' },
                { id: 'gemma2:latest', name: 'Gemma 2' }
            ],
            'ollama-rockpc': [
                { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder 32B' },
                { id: 'llama3:8b', name: 'Llama 3 8B' }
            ],
            lmstudio: [
                { id: 'qwen2.5-7b-instruct', name: 'Qwen 2.5 7B Instruct' }
            ],
            'lmstudio-rockpc': [
                { id: 'qwen2.5-7b-instruct', name: 'Qwen 2.5 7B Instruct' }
            ],
            'lmstudio-aipc': [
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
                                <optgroup label="Local">
                                    <option value="ollama" ${provider === 'ollama' ? 'selected' : ''}>Ollama (Local)</option>
                                    <option value="lmstudio" ${provider === 'lmstudio' ? 'selected' : ''}>LM Studio (Local)</option>
                                </optgroup>
                                <optgroup label="ai-pc (192.168.1.162)">
                                    <option value="ollama-aipc" ${provider === 'ollama-aipc' ? 'selected' : ''}>Ollama (ai-pc)</option>
                                    <option value="lmstudio-aipc" ${provider === 'lmstudio-aipc' ? 'selected' : ''}>LM Studio (ai-pc)</option>
                                </optgroup>
                                <optgroup label="ROCK-PC (192.168.1.192)">
                                    <option value="ollama-rockpc" ${provider === 'ollama-rockpc' ? 'selected' : ''}>Ollama (ROCK-PC)</option>
                                    <option value="lmstudio-rockpc" ${provider === 'lmstudio-rockpc' ? 'selected' : ''}>LM Studio (ROCK-PC)</option>
                                </optgroup>
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
                            const isLocal = body.provider.startsWith('ollama') || body.provider.startsWith('lmstudio');
                            const ready = result.licensed && (result.hasApiKey || isLocal);
                            saveStatus.innerHTML = '<span class="as-ok">Saved! ' +
                                (result.licensed ? 'Licensed.' : 'License invalid.') +
                                (isLocal ? ' Local LLM.' : (result.hasApiKey ? ' API key set.' : '')) + '</span>';
                            self.copilotStatus = {
                                licensed: result.licensed,
                                tier: result.tier,
                                provider: body.provider,
                                model: body.model,
                                hasApiKey: result.hasApiKey,
                                apiKeyMemoryOnly: body.apiKeyMemoryOnly
                            };
                            self._renderConfigBanner();
                        } else {
                            saveStatus.innerHTML = '<span class="as-err">Save failed</span>';
                        }
                    } catch (e) {
                        saveStatus.innerHTML = '<span class="as-err">Server error</span>';
                    }
                });
            }
        });

        // Voice settings section
        settingsPanel.registerSection('voice-config', {
            title: 'Voice Settings',
            icon: '',
            render: () => {
                const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
                const currentVoice = localStorage.getItem('ai-ap-voice') || '';
                const currentRate = localStorage.getItem('ai-ap-voice-rate') || '0.95';
                const ttsOn = self._ttsEnabled;

                const voiceOptions = voices
                    .filter(v => v.lang.startsWith('en'))
                    .map(v => `<option value="${v.name}" ${v.name === currentVoice ? 'selected' : ''}>${v.name} (${v.lang})</option>`)
                    .join('');

                const allVoiceOptions = voices
                    .filter(v => !v.lang.startsWith('en'))
                    .map(v => `<option value="${v.name}" ${v.name === currentVoice ? 'selected' : ''}>${v.name} (${v.lang})</option>`)
                    .join('');

                return `
                    <div class="ai-settings">
                        <div class="as-row">
                            <label class="toggle-item">
                                <input type="checkbox" id="vs-tts-enabled" ${ttsOn ? 'checked' : ''}>
                                <span>Enable AI voice</span>
                            </label>
                        </div>
                        <div class="as-row">
                            <label>Voice</label>
                            <select id="vs-voice">
                                <option value="">Auto (best available)</option>
                                <optgroup label="English">${voiceOptions}</optgroup>
                                ${allVoiceOptions ? '<optgroup label="Other">' + allVoiceOptions + '</optgroup>' : ''}
                            </select>
                        </div>
                        <div class="as-row">
                            <label>Speed: <span id="vs-rate-label">${currentRate}x</span></label>
                            <input type="range" id="vs-rate" min="0.5" max="2.0" step="0.05" value="${currentRate}" style="width:100%">
                        </div>
                        <div class="as-row" style="display:flex;gap:8px">
                            <button class="btn-small" id="vs-test">Test Voice</button>
                            <button class="btn-small" id="vs-stop">Stop</button>
                        </div>
                    </div>
                `;
            },
            onMount: (container) => {
                const ttsCheck = container.querySelector('#vs-tts-enabled');
                const voiceSelect = container.querySelector('#vs-voice');
                const rateSlider = container.querySelector('#vs-rate');
                const rateLabel = container.querySelector('#vs-rate-label');

                ttsCheck?.addEventListener('change', () => {
                    self._ttsEnabled = ttsCheck.checked;
                    localStorage.setItem('ai-ap-tts', ttsCheck.checked ? 'true' : 'false');
                });

                voiceSelect?.addEventListener('change', () => {
                    const name = voiceSelect.value;
                    localStorage.setItem('ai-ap-voice', name);
                    if (self._voice) {
                        self._voice.voiceName = name || null;
                        self._voice.voice = null;
                        self._voice.loadVoice();
                    }
                });

                rateSlider?.addEventListener('input', () => {
                    const rate = parseFloat(rateSlider.value);
                    if (rateLabel) rateLabel.textContent = rate.toFixed(2) + 'x';
                    localStorage.setItem('ai-ap-voice-rate', rate);
                    if (self._voice) self._voice.rate = rate;
                });

                container.querySelector('#vs-test')?.addEventListener('click', () => {
                    if (self._voice) {
                        self._voice.speak('Autopilot advisory: maintaining cruise altitude at eight thousand five hundred feet, airspeed one hundred ten knots.');
                    }
                });

                container.querySelector('#vs-stop')?.addEventListener('click', () => {
                    if (self._voice) self._voice.stop();
                });
            }
        });
    }

    // ── Lifecycle ──────────────────────────────────────────

    /** Replace technical command/var names with natural speech */
    _humanizeSpeech(text) {
        if (!text) return text;
        const map = {
            'AP_MASTER': 'autopilot',
            'AP_HDG_HOLD': 'heading hold',
            'AP_HDG_VAR_SET': 'heading bug',
            'AP_ALT_HOLD': 'altitude hold',
            'AP_ALT_VAR_SET': 'target altitude',
            'AP_VS_HOLD': 'vertical speed hold',
            'AP_VS_VAR_SET': 'vertical speed',
            'AP_SPD_VAR_SET': 'target speed',
            'AP_NAV1_HOLD': 'navigation tracking',
            'AP_APR_HOLD': 'approach mode',
            'THROTTLE_SET': 'throttle',
            'MIXTURE_SET': 'mixture',
            'FLAPS_UP': 'flaps up',
            'FLAPS_DOWN': 'flaps down',
            'PARKING_BRAKES': 'parking brake',
            'HEADING_BUG_SET': 'heading bug',
            'AXIS_ELEVATOR_SET': 'elevator',
            'AXIS_RUDDER_SET': 'rudder',
            'AXIS_AILERONS_SET': 'ailerons',
            'XPNDR_IDENT_ON': 'transponder ident',
            'LANDING_LIGHTS_TOGGLE': 'landing lights',
            'IAS': 'airspeed',
            'Vr': 'rotation speed',
            'Vy': 'best climb speed',
            'Vs0': 'stall speed flaps down',
            'Vs1': 'stall speed clean',
            'Vno': 'max cruise speed',
            'Vne': 'never exceed speed',
            'Va': 'maneuvering speed',
            'AP': 'autopilot',
            'VS': 'vertical speed',
            'GS': 'ground speed',
            'HDG': 'heading',
            'ALT': 'altitude',
            'AGL': 'above ground',
            'NAV': 'navigation',
            'APR': 'approach',
            'SPD': 'speed',
            'TOD': 'top of descent',
            'TAWS': 'terrain warning',
            'XPDR': 'transponder',
            'fpm': 'feet per minute',
            'kts': 'knots',
            'NM': 'nautical miles'
        };
        let result = text;
        for (const [key, val] of Object.entries(map)) {
            result = result.replace(new RegExp('\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), val);
        }
        // Clean up remaining underscored terms (e.g. AP_WING_LEVELER → AP WING LEVELER)
        result = result.replace(/([A-Z])_([A-Z])/g, '$1 $2');
        return result;
    }

    _renderATCPanel() {
        if (!this.atcController || !this.elements.atcPanel) return;
        const phase = this.atcController.getPhase();
        const panel = this.elements.atcPanel;

        if (phase === 'INACTIVE') {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = '';
        const phaseEl = this.elements.atcPhase;
        if (phaseEl) {
            phaseEl.textContent = phase.replace(/_/g, ' ');
            phaseEl.className = 'atc-phase';
            if (phase === 'TAXIING') phaseEl.classList.add('active');
            else if (phase === 'HOLD_SHORT' || phase === 'TAKEOFF_CLEARANCE_PENDING') phaseEl.classList.add('hold');
            else if (phase === 'CLEARED_TAKEOFF') phaseEl.classList.add('cleared');
        }

        if (this.elements.atcInstruction) {
            this.elements.atcInstruction.textContent = this.atcController.getATCInstruction();
        }

        const route = this.atcController.getRoute();
        if (this.elements.atcRoute && route) {
            this.elements.atcRoute.textContent = route.taxiways?.length
                ? `WP ${route.currentWaypoint}/${route.waypointCount} | ${Math.round(route.distance_ft)}ft`
                : '';
        }
    }

    destroy() {
        if (this.atcController) {
            this.atcController.destroy();
            this.atcController = null;
        }
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
        if (this._airportPollTimer) {
            clearInterval(this._airportPollTimer);
            this._airportPollTimer = null;
        }
        if (this._syncBroadcastTimer) {
            clearInterval(this._syncBroadcastTimer);
            this._syncBroadcastTimer = null;
        }
        if (this.syncChannel) {
            this.syncChannel.close();
            this.syncChannel = null;
        }
        // Restore original fetch
        if (this._origFetch) {
            window.fetch = this._origFetch;
        }
        if (this._debugPopoutTimer) {
            clearInterval(this._debugPopoutTimer);
            this._debugPopoutTimer = null;
        }
        if (this._debugWindow && !this._debugWindow.closed) {
            this._debugWindow.close();
        }
        if (this._recognition) {
            this._recognition.abort();
            this._recognition = null;
        }
        if (this._voice) {
            this._voice.destroy();
            this._voice = null;
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
