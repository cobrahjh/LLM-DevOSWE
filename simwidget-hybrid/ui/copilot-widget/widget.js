/**
 * AI Copilot Widget - SimWidget
 * Full-featured AI copilot for MSFS
 */

// Checklist data (simplified - imports from checklist-widget would be better)
const CHECKLISTS = {
    generic: {
        preflight: [
            { text: 'Battery', action: 'ON' },
            { text: 'Fuel Selector', action: 'BOTH' },
            { text: 'Flaps', action: 'UP' },
            { text: 'Parking Brake', action: 'SET' }
        ],
        startup: [
            { text: 'Mixture', action: 'RICH' },
            { text: 'Throttle', action: 'IDLE' },
            { text: 'Master', action: 'ON' },
            { text: 'Ignition', action: 'START' },
            { text: 'Oil Pressure', action: 'GREEN' }
        ],
        taxi: [
            { text: 'Brakes', action: 'CHECK' },
            { text: 'Instruments', action: 'CHECK' },
            { text: 'Nav Lights', action: 'ON' }
        ],
        takeoff: [
            { text: 'Flaps', action: 'SET' },
            { text: 'Trim', action: 'SET' },
            { text: 'Transponder', action: 'ALT' },
            { text: 'Lights', action: 'ON' }
        ],
        cruise: [
            { text: 'Power', action: 'SET' },
            { text: 'Mixture', action: 'LEAN' }
        ],
        landing: [
            { text: 'Mixture', action: 'RICH' },
            { text: 'Gear', action: 'DOWN' },
            { text: 'Flaps', action: 'AS REQUIRED' }
        ],
        shutdown: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Mixture', action: 'CUTOFF' },
            { text: 'Master', action: 'OFF' }
        ]
    },
    c172: {
        preflight: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Master Switch', action: 'ON' },
            { text: 'Fuel Quantity', action: 'CHECK' },
            { text: 'Master Switch', action: 'OFF' },
            { text: 'Fuel Selector', action: 'BOTH' }
        ],
        startup: [
            { text: 'Seats/Belts', action: 'SECURE' },
            { text: 'Circuit Breakers', action: 'IN' },
            { text: 'Mixture', action: 'RICH' },
            { text: 'Carb Heat', action: 'COLD' },
            { text: 'Master', action: 'ON' },
            { text: 'Beacon', action: 'ON' },
            { text: 'Prime', action: '3 STROKES' },
            { text: 'Ignition', action: 'START' },
            { text: 'Oil Pressure', action: 'GREEN' }
        ],
        taxi: [
            { text: 'Brakes', action: 'CHECK' },
            { text: 'Heading Indicator', action: 'SET' },
            { text: 'Attitude', action: 'CHECK' }
        ],
        takeoff: [
            { text: 'Runup', action: 'COMPLETE' },
            { text: 'Flaps', action: '0-10°' },
            { text: 'Trim', action: 'TAKEOFF' },
            { text: 'Transponder', action: 'ALT' },
            { text: 'Lights', action: 'ON' }
        ],
        cruise: [
            { text: 'Power', action: '2300 RPM' },
            { text: 'Mixture', action: 'LEAN' },
            { text: 'Trim', action: 'ADJUST' }
        ],
        landing: [
            { text: 'ATIS', action: 'RECEIVED' },
            { text: 'Mixture', action: 'RICH' },
            { text: 'Carb Heat', action: 'ON' },
            { text: 'Flaps', action: 'AS REQUIRED' }
        ],
        shutdown: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Avionics', action: 'OFF' },
            { text: 'Mixture', action: 'CUTOFF' },
            { text: 'Ignition', action: 'OFF' },
            { text: 'Master', action: 'OFF' }
        ]
    },
    a320: {
        preflight: [
            { text: 'Battery', action: 'ON' },
            { text: 'External Power', action: 'ON' },
            { text: 'APU', action: 'START' },
            { text: 'ADIRS', action: 'NAV' }
        ],
        startup: [
            { text: 'Beacon', action: 'ON' },
            { text: 'Engine Mode', action: 'IGN/START' },
            { text: 'Engine 2', action: 'START' },
            { text: 'Engine 1', action: 'START' },
            { text: 'APU', action: 'OFF' }
        ],
        taxi: [
            { text: 'Flight Controls', action: 'CHECK' },
            { text: 'Flaps', action: 'CONFIG 1+F' },
            { text: 'Auto Brake', action: 'MAX' }
        ],
        takeoff: [
            { text: 'Transponder', action: 'ON' },
            { text: 'TCAS', action: 'TA/RA' },
            { text: 'Strobe', action: 'ON' },
            { text: 'Landing Lights', action: 'ON' }
        ],
        cruise: [
            { text: 'Seat Belt Signs', action: 'AS REQ' },
            { text: 'Landing Lights', action: 'OFF' }
        ],
        landing: [
            { text: 'Auto Brake', action: 'SET' },
            { text: 'Gear', action: 'DOWN' },
            { text: 'Flaps', action: 'FULL' },
            { text: 'Spoilers', action: 'ARM' }
        ],
        shutdown: [
            { text: 'Parking Brake', action: 'SET' },
            { text: 'Engine 1', action: 'OFF' },
            { text: 'Engine 2', action: 'OFF' },
            { text: 'Beacon', action: 'OFF' }
        ]
    }
};

class AICopilot {
    constructor() {
        this.currentMode = 'assist';
        this.voiceEnabled = true;
        this.isListening = false;
        this.synth = window.speechSynthesis;
        this.recognition = null;

        // Flight data
        this.flightData = {
            altitude: 0,
            speed: 0,
            heading: 0,
            vspeed: 0,
            onGround: true,
            gearDown: true,
            flaps: 0
        };
        this.lastAltitudeCallout = 0;
        this.lastSpeedCallout = 0;

        // Checklist state
        this.checklistAircraft = 'generic';
        this.checklistPhase = 'preflight';
        this.checklistIndex = 0;
        this.checkedItems = [];
        this.autoRunning = false;

        // Callout settings
        this.callouts = {
            altitude: true,
            speed: true,
            approach: false,
            gear: true,
            flaps: true
        };

        // V-speeds
        this.vSpeeds = {
            vr: 55,
            v2: 62,
            vref: 65
        };

        this.init();
    }

    init() {
        this.initTabs();
        this.initAssistMode();
        this.initChecklistMode();
        this.initATCMode();
        this.initAdvisorMode();
        this.initVoice();
        this.initWebSocket();
        this.loadSettings();
    }

    // === Tab Navigation ===
    initTabs() {
        document.querySelectorAll('.copilot-tabs .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchMode(tab.dataset.mode);
            });
        });
    }

    switchMode(mode) {
        this.currentMode = mode;

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-mode="${mode}"]`).classList.add('active');

        document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-' + mode).classList.add('active');
    }

    // === Assist Mode ===
    initAssistMode() {
        const input = document.getElementById('pilot-input');
        const sendBtn = document.getElementById('btn-send');

        sendBtn.addEventListener('click', () => this.handlePilotInput());
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handlePilotInput();
        });
    }

    handlePilotInput() {
        const input = document.getElementById('pilot-input');
        const text = input.value.trim();
        if (!text) return;

        this.addMessage(text, 'pilot');
        input.value = '';

        // Process command
        this.processCommand(text);
    }

    processCommand(text) {
        const lower = text.toLowerCase();

        // Checklist commands
        if (lower.includes('checklist') || lower.includes('check')) {
            if (lower.includes('startup') || lower.includes('start')) {
                this.startChecklist('startup');
                this.respond('Starting engine start checklist.');
            } else if (lower.includes('takeoff')) {
                this.startChecklist('takeoff');
                this.respond('Starting before takeoff checklist.');
            } else if (lower.includes('landing')) {
                this.startChecklist('landing');
                this.respond('Starting before landing checklist.');
            } else if (lower.includes('next') || lower === 'check') {
                this.checkNextItem();
            } else {
                this.respond('Which checklist? Say startup, takeoff, or landing.');
            }
            return;
        }

        // Flight info
        if (lower.includes('altitude') || lower.includes('how high')) {
            this.respond('Current altitude is ' + Math.round(this.flightData.altitude) + ' feet.');
            return;
        }

        if (lower.includes('speed') || lower.includes('how fast')) {
            this.respond('Current airspeed is ' + Math.round(this.flightData.speed) + ' knots.');
            return;
        }

        if (lower.includes('heading')) {
            this.respond('Current heading is ' + Math.round(this.flightData.heading) + ' degrees.');
            return;
        }

        // Gear reminder
        if (lower.includes('gear')) {
            const gearStatus = this.flightData.gearDown ? 'down' : 'up';
            this.respond('Gear is currently ' + gearStatus + '.');
            return;
        }

        // Default response
        this.respond('I can help with checklists, callouts, and flight information. Try "startup checklist" or "what\'s my altitude?"');
    }

    addMessage(text, sender) {
        const area = document.getElementById('message-area');
        const msg = document.createElement('div');
        msg.className = 'message ' + sender;
        const span = document.createElement('span');
        span.className = 'msg-text';
        span.textContent = text;
        msg.appendChild(span);
        area.appendChild(msg);
        area.scrollTop = area.scrollHeight;
    }

    respond(text) {
        this.addMessage(text, 'copilot');
        if (this.voiceEnabled) {
            this.speak(text);
        }
    }

    // === Checklist Mode ===
    initChecklistMode() {
        document.getElementById('checklist-aircraft').addEventListener('change', (e) => {
            this.checklistAircraft = e.target.value;
            this.renderChecklist();
        });

        document.getElementById('checklist-phase').addEventListener('change', (e) => {
            this.checklistPhase = e.target.value;
            this.checklistIndex = 0;
            this.checkedItems = [];
            this.renderChecklist();
        });

        document.getElementById('btn-checklist-reset').addEventListener('click', () => {
            this.resetChecklist();
        });

        document.getElementById('btn-checklist-auto').addEventListener('click', () => {
            this.toggleAutoRun();
        });

        this.renderChecklist();
    }

    renderChecklist() {
        const container = document.getElementById('checklist-items');
        container.replaceChildren();

        const items = CHECKLISTS[this.checklistAircraft]?.[this.checklistPhase] || [];

        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'checklist-item';
            if (this.checkedItems.includes(index)) div.classList.add('checked');
            if (index === this.checklistIndex && !this.checkedItems.includes(index)) {
                div.classList.add('active');
            }

            const checkbox = document.createElement('div');
            checkbox.className = 'item-checkbox';

            const text = document.createElement('span');
            text.className = 'item-text';
            text.textContent = item.text;

            const action = document.createElement('span');
            action.className = 'item-action';
            action.textContent = item.action;

            div.appendChild(checkbox);
            div.appendChild(text);
            div.appendChild(action);

            div.addEventListener('click', () => {
                this.toggleChecklistItem(index);
            });

            container.appendChild(div);
        });
    }

    toggleChecklistItem(index) {
        const idx = this.checkedItems.indexOf(index);
        if (idx === -1) {
            this.checkedItems.push(index);
            const items = CHECKLISTS[this.checklistAircraft]?.[this.checklistPhase] || [];
            if (this.voiceEnabled && items[index]) {
                this.speak(items[index].text + ', ' + items[index].action + ', check.');
            }
        } else {
            this.checkedItems.splice(idx, 1);
        }
        this.advanceChecklist();
        this.renderChecklist();
    }

    advanceChecklist() {
        const items = CHECKLISTS[this.checklistAircraft]?.[this.checklistPhase] || [];
        // Find next unchecked
        for (let i = 0; i < items.length; i++) {
            if (!this.checkedItems.includes(i)) {
                this.checklistIndex = i;
                return;
            }
        }
        // All done
        this.checklistIndex = items.length;
        if (this.checkedItems.length === items.length && items.length > 0) {
            this.speak(this.checklistPhase + ' checklist complete.');
        }
    }

    checkNextItem() {
        const items = CHECKLISTS[this.checklistAircraft]?.[this.checklistPhase] || [];
        if (this.checklistIndex < items.length) {
            this.toggleChecklistItem(this.checklistIndex);
        }
    }

    resetChecklist() {
        this.checkedItems = [];
        this.checklistIndex = 0;
        this.autoRunning = false;
        document.getElementById('btn-checklist-auto').textContent = '▶ Auto Run';
        document.getElementById('btn-checklist-auto').classList.remove('running');
        this.renderChecklist();
    }

    startChecklist(phase) {
        this.checklistPhase = phase;
        document.getElementById('checklist-phase').value = phase;
        this.resetChecklist();
        this.switchMode('checklist');

        const items = CHECKLISTS[this.checklistAircraft]?.[phase] || [];
        if (items.length > 0) {
            this.speak(phase + ' checklist. ' + items[0].text + '?');
        }
    }

    toggleAutoRun() {
        this.autoRunning = !this.autoRunning;
        const btn = document.getElementById('btn-checklist-auto');

        if (this.autoRunning) {
            btn.textContent = '⏹ Stop';
            btn.classList.add('running');
            this.runAutoChecklist();
        } else {
            btn.textContent = '▶ Auto Run';
            btn.classList.remove('running');
        }
    }

    async runAutoChecklist() {
        const items = CHECKLISTS[this.checklistAircraft]?.[this.checklistPhase] || [];

        while (this.autoRunning && this.checklistIndex < items.length) {
            const item = items[this.checklistIndex];
            this.speak(item.text + '?');

            // Wait for response or timeout
            await this.sleep(3000);

            if (!this.autoRunning) break;

            this.speak(item.action);
            await this.sleep(1500);

            if (!this.autoRunning) break;

            this.toggleChecklistItem(this.checklistIndex);
            await this.sleep(1000);
        }

        if (this.autoRunning) {
            this.autoRunning = false;
            document.getElementById('btn-checklist-auto').textContent = '▶ Auto Run';
            document.getElementById('btn-checklist-auto').classList.remove('running');
        }
    }

    // === ATC Mode ===
    initATCMode() {
        document.querySelectorAll('.atc-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleATCAction(btn.dataset.action);
            });
        });
    }

    handleATCAction(action) {
        const callsign = 'November One Two Three Alpha Bravo';

        switch (action) {
            case 'request-taxi':
                this.addATCMessage('Ground, ' + callsign + ', at the ramp, request taxi to active runway.', 'outgoing');
                this.speak('Ground, ' + callsign + ', at the ramp, request taxi to active runway.');
                break;

            case 'request-takeoff':
                this.addATCMessage('Tower, ' + callsign + ', holding short runway, ready for departure.', 'outgoing');
                this.speak('Tower, ' + callsign + ', holding short, ready for departure.');
                break;

            case 'request-landing':
                this.addATCMessage('Tower, ' + callsign + ', 10 miles out, inbound for landing.', 'outgoing');
                this.speak('Tower, ' + callsign + ', 10 miles out, inbound for landing.');
                break;

            case 'readback':
                this.speak('Roger, ' + callsign + '.');
                break;
        }
    }

    addATCMessage(text, type) {
        const container = document.getElementById('atc-messages');
        const msg = document.createElement('div');
        msg.className = 'atc-msg ' + type;

        const callsign = document.createElement('span');
        callsign.className = 'callsign';
        callsign.textContent = type === 'incoming' ? 'ATC' : 'YOU';

        const msgText = document.createElement('span');
        msgText.className = 'msg';
        msgText.textContent = text;

        msg.appendChild(callsign);
        msg.appendChild(msgText);
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    // === Advisor Mode ===
    initAdvisorMode() {
        // Callout toggles
        document.getElementById('callout-altitude').addEventListener('change', (e) => {
            this.callouts.altitude = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('callout-speed').addEventListener('change', (e) => {
            this.callouts.speed = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('callout-approach').addEventListener('change', (e) => {
            this.callouts.approach = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('callout-gear').addEventListener('change', (e) => {
            this.callouts.gear = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('callout-flaps').addEventListener('change', (e) => {
            this.callouts.flaps = e.target.checked;
            this.saveSettings();
        });

        // V-speeds
        document.getElementById('vspeed-vr').addEventListener('change', (e) => {
            this.vSpeeds.vr = parseInt(e.target.value) || 55;
            this.saveSettings();
        });

        document.getElementById('vspeed-v2').addEventListener('change', (e) => {
            this.vSpeeds.v2 = parseInt(e.target.value) || 62;
            this.saveSettings();
        });

        document.getElementById('vspeed-vref').addEventListener('change', (e) => {
            this.vSpeeds.vref = parseInt(e.target.value) || 65;
            this.saveSettings();
        });
    }

    // === Voice ===
    initVoice() {
        const voiceBtn = document.getElementById('btn-voice');
        voiceBtn.classList.toggle('active', this.voiceEnabled);
        voiceBtn.addEventListener('click', () => {
            this.voiceEnabled = !this.voiceEnabled;
            voiceBtn.classList.toggle('active', this.voiceEnabled);
            voiceBtn.textContent = this.voiceEnabled ? '🔊' : '🔇';
        });

        const listenBtn = document.getElementById('btn-listen');
        listenBtn.addEventListener('click', () => {
            this.toggleListening();
        });

        this.initSpeechRecognition();
    }

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            this.handlePilotInput();
            document.getElementById('pilot-input').value = text;
            this.handlePilotInput();
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                this.recognition.start();
            }
        };
    }

    toggleListening() {
        if (!this.recognition) return;

        this.isListening = !this.isListening;
        const btn = document.getElementById('btn-listen');

        if (this.isListening) {
            btn.classList.add('active', 'listening');
            this.recognition.start();
            this.updateStatus('Listening...');
        } else {
            btn.classList.remove('active', 'listening');
            this.recognition.stop();
            this.updateStatus('Standing by');
        }
    }

    speak(text) {
        if (!this.synth || !this.voiceEnabled) return;

        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Prefer British voice for copilot feel
        const voices = this.synth.getVoices();
        const preferred = voices.find(v =>
            v.name.includes('Google UK English Female') ||
            v.name.includes('Microsoft Hazel') ||
            v.lang === 'en-GB'
        );
        if (preferred) utterance.voice = preferred;

        this.synth.speak(utterance);
    }

    updateStatus(text) {
        document.getElementById('copilot-status').textContent = text;
    }

    // === Flight Data ===
    initWebSocket() {
        const wsUrl = 'ws://' + window.location.host;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.updateFlightData(data);
                } catch (e) {}
            };

            this.ws.onclose = () => {
                setTimeout(() => this.initWebSocket(), 3000);
            };
        } catch (e) {
            setTimeout(() => this.initWebSocket(), 5000);
        }

        // Fallback polling
        this.pollFlightData();
    }

    async pollFlightData() {
        try {
            const res = await fetch('/api/simvars');
            if (res.ok) {
                const data = await res.json();
                this.updateFlightData(data);
            }
        } catch (e) {}

        setTimeout(() => this.pollFlightData(), 2000);
    }

    updateFlightData(data) {
        const prev = { ...this.flightData };

        this.flightData.altitude = data.PLANE_ALTITUDE || data.altitude || 0;
        this.flightData.speed = data.AIRSPEED_INDICATED || data.speed || 0;
        this.flightData.heading = data.PLANE_HEADING_DEGREES_TRUE || data.heading || 0;
        this.flightData.vspeed = data.VERTICAL_SPEED || data.vspeed || 0;
        this.flightData.onGround = data.SIM_ON_GROUND || data.onGround || false;
        this.flightData.gearDown = data.GEAR_HANDLE_POSITION !== 0;

        // Update display
        document.getElementById('stat-altitude').textContent = Math.round(this.flightData.altitude);
        document.getElementById('stat-speed').textContent = Math.round(this.flightData.speed);
        document.getElementById('stat-heading').textContent = Math.round(this.flightData.heading) + '°';
        document.getElementById('stat-vspeed').textContent = Math.round(this.flightData.vspeed);

        // Process callouts
        this.processCallouts(prev);
    }

    processCallouts(prev) {
        const alt = Math.round(this.flightData.altitude);
        const speed = Math.round(this.flightData.speed);

        // Altitude callouts (every 1000ft)
        if (this.callouts.altitude && !this.flightData.onGround) {
            const currentK = Math.floor(alt / 1000);
            const lastK = Math.floor(this.lastAltitudeCallout / 1000);

            if (currentK !== lastK && alt > 100) {
                this.speak(currentK + ' thousand');
                this.lastAltitudeCallout = alt;
            }
        }

        // Speed callouts
        if (this.callouts.speed && this.flightData.onGround) {
            // Vr callout
            if (prev.speed < this.vSpeeds.vr && speed >= this.vSpeeds.vr) {
                this.speak('V1, rotate');
            }
            // V2 callout
            if (prev.speed < this.vSpeeds.v2 && speed >= this.vSpeeds.v2) {
                this.speak('V2');
            }
        }

        // Gear warning
        if (this.callouts.gear) {
            if (alt < 1000 && !this.flightData.onGround && !this.flightData.gearDown && this.flightData.vspeed < -500) {
                this.speak('Gear! Check gear!');
            }
        }
    }

    // === Settings ===
    saveSettings() {
        try {
            localStorage.setItem('copilot-settings', JSON.stringify({
                callouts: this.callouts,
                vSpeeds: this.vSpeeds,
                voiceEnabled: this.voiceEnabled
            }));
        } catch (e) {}
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('copilot-settings');
            if (saved) {
                const s = JSON.parse(saved);
                this.callouts = { ...this.callouts, ...s.callouts };
                this.vSpeeds = { ...this.vSpeeds, ...s.vSpeeds };
                this.voiceEnabled = s.voiceEnabled !== false;

                // Apply to UI
                document.getElementById('callout-altitude').checked = this.callouts.altitude;
                document.getElementById('callout-speed').checked = this.callouts.speed;
                document.getElementById('callout-approach').checked = this.callouts.approach;
                document.getElementById('callout-gear').checked = this.callouts.gear;
                document.getElementById('callout-flaps').checked = this.callouts.flaps;
                document.getElementById('vspeed-vr').value = this.vSpeeds.vr;
                document.getElementById('vspeed-v2').value = this.vSpeeds.v2;
                document.getElementById('vspeed-vref').value = this.vSpeeds.vref;
            }
        } catch (e) {}
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.copilot = new AICopilot();
});
