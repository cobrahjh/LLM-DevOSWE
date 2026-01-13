/**
 * SimWidget AI Co-Pilot Agent
 * Routes through Relay Service (NO direct API - not cost effective)
 */

// Relay service URL (default: localhost:8600)
const RELAY_URL = 'http://localhost:8600';

class CoPilotAgent {
    constructor(options = {}) {
        this.relayUrl = options.relayUrl || RELAY_URL;
        this.model = options.model || 'claude-sonnet-4-20250514';
        this.simState = {};
        this.conversationHistory = [];
        this.maxHistory = 20;
        this.pollInterval = 1000;
        this.pollTimeout = 120000; // 2 minutes max wait

        // System prompt for aviation context
        this.systemPrompt = `You are an expert flight simulator co-pilot assistant. You have access to real-time aircraft data and can help pilots with:

1. **Flight Operations**: Approach briefings, checklists, procedures
2. **Systems Monitoring**: Fuel, engines, electrical, hydraulics
3. **Navigation**: Waypoints, frequencies, courses
4. **Emergency Procedures**: Quick reference for abnormal situations
5. **General Advice**: Tips, techniques, best practices

CURRENT AIRCRAFT STATE:
{{AIRCRAFT_STATE}}

RULES:
- Be concise but thorough for safety-critical information
- Always confirm before executing sim commands
- Use standard aviation phraseology when appropriate
- If unsure, say so - never guess on safety matters
- Format checklists and procedures clearly
- Provide frequencies, altitudes, headings as numbers

You can execute these commands by responding with JSON:
{"command": "K:EVENT_NAME", "value": 0}

Available commands include autopilot, lights, gear, flaps, and more.`;
    }

    updateSimState(state) {
        this.simState = state;
    }

    formatAircraftState() {
        const s = this.simState;
        if (!s || Object.keys(s).length === 0) return 'No aircraft data available';

        return `Aircraft: ${s.title || 'Unknown'}
Altitude: ${Math.round(s.altitude || 0)} ft | Speed: ${Math.round(s.airspeed || 0)} kts
Heading: ${Math.round(s.heading || 0)}° | VS: ${Math.round(s.vs || 0)} fpm
Autopilot: ${s.apMaster ? 'ON' : 'OFF'} | Gear: ${s.gearDown ? 'DOWN' : 'UP'}
Fuel: ${Math.round(s.fuelPct || 0)}% | Engine: ${s.engineRunning ? 'RUNNING' : 'OFF'}`;
    }

    async chat(userMessage) {
        const systemWithState = this.systemPrompt.replace('{{AIRCRAFT_STATE}}', this.formatAircraftState());
        this.conversationHistory.push({ role: 'user', content: userMessage });

        if (this.conversationHistory.length > this.maxHistory) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistory);
        }

        try {
            // Queue message to relay service
            const queueResponse = await fetch(`${this.relayUrl}/api/queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: userMessage,
                    context: {
                        system: systemWithState,
                        history: this.conversationHistory.slice(-10) // Last 10 messages for context
                    },
                    source: 'copilot'
                })
            });

            if (!queueResponse.ok) {
                throw new Error(`Relay queue failed: ${queueResponse.status}`);
            }

            const { messageId } = await queueResponse.json();

            // Poll for response
            const response = await this.pollForResponse(messageId);

            if (response.status === 'completed' && response.response) {
                this.conversationHistory.push({ role: 'assistant', content: response.response });
                return {
                    success: true,
                    message: response.response,
                    commands: this.extractCommands(response.response)
                };
            } else {
                throw new Error(response.error || 'No response received');
            }
        } catch (error) {
            // Check if relay is running
            if (error.message.includes('fetch') || error.message.includes('network')) {
                return {
                    success: false,
                    error: 'Relay Service not running. Start it on port 8600.',
                    commands: []
                };
            }
            return { success: false, error: error.message, commands: [] };
        }
    }

    async pollForResponse(messageId) {
        const startTime = Date.now();

        while (Date.now() - startTime < this.pollTimeout) {
            try {
                const response = await fetch(`${this.relayUrl}/api/queue/${messageId}`);
                if (!response.ok) throw new Error(`Poll failed: ${response.status}`);

                const result = await response.json();

                if (result.status === 'completed' || result.status === 'expired') {
                    return result;
                }

                // Wait before next poll
                await new Promise(r => setTimeout(r, this.pollInterval));
            } catch (error) {
                throw error;
            }
        }

        return { status: 'expired', error: 'Response timeout' };
    }

    extractCommands(text) {
        const commands = [];
        const regex = /\{"command":\s*"([^"]+)",\s*"value":\s*(\d+)\}/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            commands.push({ command: match[1], value: parseInt(match[2]) });
        }
        return commands;
    }

    clearHistory() { this.conversationHistory = []; }
}

class VoiceAgent {
    constructor(options = {}) {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.onResult = options.onResult || (() => {});
        this.init();
    }

    init() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;

        this.recognition = new SR();
        this.recognition.continuous = false;
        this.recognition.lang = 'en-US';
        this.recognition.onresult = (e) => this.onResult(e.results[0][0].transcript);
        this.recognition.onend = () => { this.isListening = false; };
    }

    start() {
        if (!this.recognition || this.isListening) return;
        this.recognition.start();
        this.isListening = true;
    }

    stop() {
        if (this.recognition) this.recognition.stop();
        this.isListening = false;
    }

    speak(text) {
        if (!this.synthesis) return;
        this.synthesis.cancel();
        this.synthesis.speak(new SpeechSynthesisUtterance(text));
    }
}

if (typeof module !== 'undefined') module.exports = { CoPilotAgent, VoiceAgent };
else { window.CoPilotAgent = CoPilotAgent; window.VoiceAgent = VoiceAgent; }
