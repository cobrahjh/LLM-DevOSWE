/**
 * Voice Announcer - Shared TTS Service
 * Provides text-to-speech for all SimGlasss
 *
 * Usage:
 *   const announcer = new VoiceAnnouncer();
 *   announcer.speak('Hello pilot');
 *   announcer.speakWeather(metarData);
 *   announcer.speakWaypoint(waypointData);
 */

class VoiceAnnouncer {
    constructor(options = {}) {
        this.synth = window.speechSynthesis;
        this.enabled = options.enabled !== false;
        this.rate = options.rate || 1.0;
        this.pitch = options.pitch || 1.0;
        this.volume = options.volume || 1.0;
        this.voiceName = options.voice || null;
        this.voice = null;

        // Queue for sequential announcements
        this.queue = [];
        this.speaking = false;

        // Load preferred voice
        this.loadVoice();

        // Listen for cross-widget announcements
        this.initSyncListener();
    }

    loadVoice() {
        if (!this.synth) return;

        const setVoice = () => {
            const voices = this.synth.getVoices();

            // Priority: user preference > British female > any English
            if (this.voiceName) {
                this.voice = voices.find(v => v.name === this.voiceName);
            }

            if (!this.voice) {
                // Prefer natural-sounding voices
                this.voice = voices.find(v =>
                    v.name.includes('Samantha') ||
                    v.name.includes('Google UK English Female') ||
                    v.name.includes('Microsoft Hazel') ||
                    v.name.includes('Zira')
                );
            }

            if (!this.voice) {
                this.voice = voices.find(v => v.lang.startsWith('en'));
            }
        };

        if (this.synth.getVoices().length > 0) {
            setVoice();
        } else {
            this.synth.onvoiceschanged = setVoice;
        }
    }

    initSyncListener() {
        this._syncChannel = new BroadcastChannel('SimGlass-voice');
        this._syncChannel.onmessage = (event) => {
            const { type, data } = event.data;

            switch (type) {
                case 'speak':
                    this.speak(data.text, data.priority);
                    break;
                case 'speak-weather':
                    this.speakWeather(data);
                    break;
                case 'speak-waypoint':
                    this.speakWaypoint(data);
                    break;
                case 'stop':
                    this.stop();
                    break;
                case 'toggle':
                    this.enabled = !this.enabled;
                    break;
                case 'speak-tcas':
                    this.speakTCAS(data.type, data.aircraft);
                    break;
                case 'speak-failure':
                    this.speakFailure(data.system, data.detail, data.severity);
                    break;
                case 'speak-failures-summary':
                    this.speakFailuresSummary(data.failures);
                    break;
            }
        };
    }

    speak(text, priority = false) {
        if (!this.synth || !this.enabled || !text) return;

        if (priority) {
            this.synth.cancel();
            this.queue = [];
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;
        utterance.volume = this.volume;

        if (this.voice) {
            utterance.voice = this.voice;
        }

        utterance.onend = () => {
            this.speaking = false;
            this.processQueue();
        };

        utterance.onerror = () => {
            this.speaking = false;
            this.processQueue();
        };

        if (this.speaking) {
            this.queue.push(utterance);
        } else {
            this.speaking = true;
            this.synth.speak(utterance);
        }
    }

    processQueue() {
        if (this.queue.length > 0 && !this.speaking) {
            this.speaking = true;
            this.synth.speak(this.queue.shift());
        }
    }

    stop() {
        if (this.synth) {
            this.synth.cancel();
            this.queue = [];
            this.speaking = false;
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stop();
        }
        return this.enabled;
    }

    // Weather announcement
    speakWeather(data) {
        if (!data) return;

        const station = data.station || data.icao || 'airport';
        const raw = data.raw || '';

        // Parse components
        const wind = this.formatWindForSpeech(data);
        const visibility = this.formatVisibilityForSpeech(data);
        const ceiling = this.formatCeilingForSpeech(data);
        const temp = this.formatTempForSpeech(data);
        const altimeter = this.formatAltimeterForSpeech(data);
        const category = data.flight_rules || this.getFlightCategory(data);

        let announcement = `${station} weather. `;
        announcement += `${category} conditions. `;
        announcement += wind + '. ';
        announcement += visibility + '. ';
        if (ceiling) announcement += ceiling + '. ';
        announcement += temp + '. ';
        announcement += altimeter + '.';

        this.speak(announcement);
    }

    formatWindForSpeech(data) {
        if (!data.wind_speed || data.wind_speed.value === 0) {
            return 'Wind calm';
        }

        const dir = data.wind_direction?.value || 'variable';
        const speed = data.wind_speed.value;
        const gust = data.wind_gust?.value;

        let wind = `Wind ${this.spellDigits(dir)} at ${speed}`;
        if (gust) {
            wind += ` gusting ${gust}`;
        }
        return wind;
    }

    formatVisibilityForSpeech(data) {
        if (!data.visibility) return 'Visibility not reported';

        const vis = data.visibility.value;
        if (vis >= 10) return 'Visibility ten or more';
        if (vis >= 1) return `Visibility ${vis} miles`;
        return `Visibility ${vis} mile`;
    }

    formatCeilingForSpeech(data) {
        if (!data.clouds || data.clouds.length === 0) return 'Sky clear';

        for (const cloud of data.clouds) {
            if (cloud.type === 'BKN' || cloud.type === 'OVC') {
                const alt = cloud.altitude || cloud.base_feet_agl;
                const type = cloud.type === 'BKN' ? 'broken' : 'overcast';
                return `Ceiling ${this.formatAltitudeForSpeech(alt)} ${type}`;
            }
        }

        const first = data.clouds[0];
        if (first) {
            const types = { 'FEW': 'few', 'SCT': 'scattered', 'BKN': 'broken', 'OVC': 'overcast' };
            return `${types[first.type] || first.type} clouds at ${this.formatAltitudeForSpeech(first.altitude || first.base_feet_agl)}`;
        }

        return null;
    }

    formatTempForSpeech(data) {
        if (!data.temperature) return 'Temperature not reported';

        const temp = data.temperature.value;
        const dew = data.dewpoint?.value;

        let text = `Temperature ${temp}`;
        if (dew !== undefined) {
            text += `, dewpoint ${dew}`;
        }
        return text;
    }

    formatAltimeterForSpeech(data) {
        if (!data.altimeter) return 'Altimeter not reported';

        const alt = data.altimeter.value;
        // Convert to spoken format (e.g., 30.12 -> "three zero one two")
        const digits = alt.toFixed(2).replace('.', '');
        return `Altimeter ${this.spellDigits(digits)}`;
    }

    formatAltitudeForSpeech(feet) {
        if (feet >= 1000) {
            const thousands = Math.floor(feet / 1000);
            const hundreds = Math.floor((feet % 1000) / 100);
            if (hundreds > 0) {
                return `${thousands} thousand ${hundreds} hundred`;
            }
            return `${thousands} thousand`;
        }
        return `${feet} feet`;
    }

    spellDigits(value) {
        const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];
        return String(value).split('').map(d => {
            const num = parseInt(d);
            return isNaN(num) ? d : words[num];
        }).join(' ');
    }

    getFlightCategory(data) {
        const vis = data.visibility?.value || 10;
        const ceiling = this.getCeiling(data);

        if (vis < 1 || ceiling < 500) return 'Low IFR';
        if (vis < 3 || ceiling < 1000) return 'IFR';
        if (vis < 5 || ceiling < 3000) return 'Marginal VFR';
        return 'VFR';
    }

    getCeiling(data) {
        if (!data.clouds || data.clouds.length === 0) return 99999;
        for (const cloud of data.clouds) {
            if (cloud.type === 'BKN' || cloud.type === 'OVC') {
                return cloud.altitude || cloud.base_feet_agl || 99999;
            }
        }
        return 99999;
    }

    // Waypoint announcement
    speakWaypoint(data) {
        if (!data) return;

        const ident = data.ident || data.name || 'waypoint';
        const distance = data.distance;
        const ete = data.ete;
        const alt = data.altitude || data.alt;

        let announcement = `Next waypoint ${this.spellIdent(ident)}`;

        if (distance) {
            announcement += `, ${Math.round(distance)} miles`;
        }

        if (ete) {
            const mins = Math.round(ete / 60);
            if (mins > 0) {
                announcement += `, ${mins} minute${mins !== 1 ? 's' : ''}`;
            }
        }

        if (alt && alt > 0) {
            announcement += `, at ${this.formatAltitudeForSpeech(alt)}`;
        }

        this.speak(announcement);
    }

    spellIdent(ident) {
        // Spell out waypoint identifiers phonetically
        const phonetic = {
            'A': 'alpha', 'B': 'bravo', 'C': 'charlie', 'D': 'delta',
            'E': 'echo', 'F': 'foxtrot', 'G': 'golf', 'H': 'hotel',
            'I': 'india', 'J': 'juliet', 'K': 'kilo', 'L': 'lima',
            'M': 'mike', 'N': 'november', 'O': 'oscar', 'P': 'papa',
            'Q': 'quebec', 'R': 'romeo', 'S': 'sierra', 'T': 'tango',
            'U': 'uniform', 'V': 'victor', 'W': 'whiskey', 'X': 'xray',
            'Y': 'yankee', 'Z': 'zulu'
        };
        const numbers = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];

        // If it looks like an airport code, just say it
        if (ident.length === 4 && ident.match(/^[A-Z]{4}$/)) {
            return ident;
        }

        // Otherwise spell it out
        return ident.toUpperCase().split('').map(c => {
            if (phonetic[c]) return phonetic[c];
            const num = parseInt(c);
            if (!isNaN(num)) return numbers[num];
            return c;
        }).join(' ');
    }

    // TCAS traffic alert
    speakTCAS(type, aircraft = null) {
        let announcement;

        switch (type) {
            case 'ra':
                // Resolution Advisory - immediate action required
                this.stop(); // Cancel any current speech
                announcement = 'Traffic! Traffic!';
                if (aircraft) {
                    const clock = this.bearingToClock(aircraft.relativeBearing);
                    const vertDir = aircraft.altDiff > 0 ? 'high' : aircraft.altDiff < 0 ? 'low' : '';
                    announcement = `Traffic! ${clock} o'clock, ${vertDir}, ${Math.round(aircraft.distance)} miles`;
                }
                this.speak(announcement, true); // Priority speech
                break;

            case 'ta':
                // Traffic Advisory
                announcement = 'Traffic';
                if (aircraft) {
                    const clock = this.bearingToClock(aircraft.relativeBearing);
                    announcement = `Traffic, ${clock} o'clock, ${Math.round(aircraft.distance)} miles`;
                }
                this.speak(announcement);
                break;

            case 'clear':
                this.speak('Clear of conflict');
                break;
        }
    }

    bearingToClock(bearing) {
        // Convert relative bearing to clock position
        const normalized = ((bearing % 360) + 360) % 360;
        let clock = Math.round(normalized / 30);
        if (clock === 0) clock = 12;
        return clock;
    }

    // System failure alert
    speakFailure(system, detail = null, severity = 'warning') {
        const systemNames = {
            engine1: 'Engine one',
            engine2: 'Engine two',
            electrical: 'Electrical system',
            hydraulic: 'Hydraulic system',
            fuel: 'Fuel system',
            avionics: 'Avionics',
            gear: 'Landing gear',
            flaps: 'Flaps'
        };

        const name = systemNames[system] || system;
        let announcement;

        if (severity === 'critical') {
            this.stop(); // Cancel current speech for critical alerts
            announcement = `Warning! ${name} failure!`;
            if (detail) announcement += ` ${detail}`;
            this.speak(announcement, true);
        } else if (severity === 'caution') {
            announcement = `Caution. ${name}`;
            if (detail) announcement += `. ${detail}`;
            this.speak(announcement);
        } else {
            announcement = `${name} ${detail || 'status change'}`;
            this.speak(announcement);
        }
    }

    // Multiple failures summary
    speakFailuresSummary(failures) {
        if (!failures || failures.length === 0) {
            this.speak('All systems normal');
            return;
        }

        const count = failures.length;
        let announcement = `${count} system${count > 1 ? 's' : ''} require attention. `;

        failures.slice(0, 3).forEach(f => {
            announcement += `${f.name || f.system}. `;
        });

        if (failures.length > 3) {
            announcement += `And ${failures.length - 3} more.`;
        }

        this.speak(announcement);
    }

    // Broadcast methods for cross-widget communication
    destroy() {
        this.stop();
        if (this._syncChannel) {
            this._syncChannel.close();
            this._syncChannel = null;
        }
    }

    static broadcast(type, data) {
        const channel = new BroadcastChannel('SimGlass-voice');
        channel.postMessage({ type, data });
        channel.close();
    }

    static speakText(text, priority = false) {
        VoiceAnnouncer.broadcast('speak', { text, priority });
    }

    static announceWeather(weatherData) {
        VoiceAnnouncer.broadcast('speak-weather', weatherData);
    }

    static announceWaypoint(waypointData) {
        VoiceAnnouncer.broadcast('speak-waypoint', waypointData);
    }

    static stopSpeaking() {
        VoiceAnnouncer.broadcast('stop', {});
    }

    static announceTCAS(type, aircraft = null) {
        VoiceAnnouncer.broadcast('speak-tcas', { type, aircraft });
    }

    static announceFailure(system, detail = null, severity = 'warning') {
        VoiceAnnouncer.broadcast('speak-failure', { system, detail, severity });
    }

    static announceFailuresSummary(failures) {
        VoiceAnnouncer.broadcast('speak-failures-summary', { failures });
    }
}

// Auto-initialize if included in a widget
if (typeof window !== 'undefined') {
    window.VoiceAnnouncer = VoiceAnnouncer;
}
