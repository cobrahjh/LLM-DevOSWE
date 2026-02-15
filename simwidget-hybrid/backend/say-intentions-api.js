/**
 * Say Intentions ATC Voice API Integration
 * Type: module | Category: backend
 * Path: backend/say-intentions-api.js
 *
 * Integrates Say Intentions AI voice ATC with existing ATC system.
 * Provides real voice communications for:
 * - Ground control (taxi clearances)
 * - Tower (takeoff/landing clearances)
 * - Approach (IFR arrivals)
 * - Departure (IFR departures)
 */

const path = require('path');
const fs = require('fs');

const SI_API_BASE = 'https://apipri.sayintentions.ai/sapi';
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

class SayIntentionsAPI {
    constructor() {
        this._apiKey = null;
        this._enabled = false;
        this._loadConfig();
    }

    /**
     * Load API key from config
     */
    _loadConfig() {
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
                if (config.sayIntentions) {
                    this._apiKey = config.sayIntentions.apiKey || null;
                    this._enabled = config.sayIntentions.enabled !== false;
                }
            }
        } catch (e) {
            console.error('[Say Intentions] Config load error:', e.message);
        }
    }

    /**
     * Check if Say Intentions is enabled and configured
     */
    isEnabled() {
        return this._enabled && !!this._apiKey;
    }

    /**
     * Request ground clearance (taxi, pushback)
     * @param {Object} params
     * @param {string} params.airport - ICAO code (e.g., "KDEN")
     * @param {string} params.runway - Runway identifier (e.g., "16R")
     * @param {string} params.position - Current position (e.g., "Gate B5")
     * @param {string} params.callsign - Aircraft callsign (e.g., "N12345")
     * @param {Array<string>} [params.route] - Taxi route (e.g., ["B", "A"])
     * @returns {Promise<{success: boolean, voiceUrl?: string, text?: string, error?: string}>}
     */
    async requestGroundClearance(params) {
        if (!this.isEnabled()) {
            return { success: false, error: 'Say Intentions not configured' };
        }

        try {
            // Generate ATC instruction text (from existing system)
            const taxiRoute = params.route ? ` via ${params.route.join(', ')}` : '';
            const instruction = `${params.callsign}, ${params.airport} Ground, taxi to runway ${params.runway}${taxiRoute}, hold short`;

            // Request voice generation from Say Intentions
            const response = await fetch(`${SI_API_BASE}/ground/clearance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this._apiKey}`
                },
                body: JSON.stringify({
                    airport: params.airport,
                    runway: params.runway,
                    position: params.position,
                    callsign: params.callsign,
                    route: params.route || [],
                    instruction: instruction
                })
            });

            const data = await response.json();
            console.log('[Say Intentions] API response:', JSON.stringify(data));

            if (!response.ok) {
                console.warn(`[Say Intentions] API returned ${response.status}:`, data);
                // Fall back to synthetic voice (just return text)
                return {
                    success: true,
                    voiceUrl: null,
                    text: instruction,
                    duration: null,
                    synthetic: true,
                    apiError: data.error || `HTTP ${response.status}`
                };
            }

            return {
                success: true,
                voiceUrl: data.audioUrl || data.audio || data.url || null,
                text: data.text || instruction,
                duration: data.duration || null,
                synthetic: !data.audioUrl
            };
        } catch (err) {
            console.error('[Say Intentions] Ground clearance error:', err.message);
            // Fall back to synthetic (text only)
            const taxiRoute = params.route ? ` via ${params.route.join(', ')}` : '';
            const instruction = `${params.callsign}, ${params.airport} Ground, taxi to runway ${params.runway}${taxiRoute}, hold short`;
            return {
                success: true,
                voiceUrl: null,
                text: instruction,
                duration: null,
                synthetic: true,
                fallback: true,
                error: err.message
            };
        }
    }

    /**
     * Request takeoff clearance
     * @param {Object} params
     * @param {string} params.airport - ICAO code
     * @param {string} params.runway - Runway identifier
     * @param {string} params.callsign - Aircraft callsign
     * @returns {Promise<{success: boolean, voiceUrl?: string, text?: string, error?: string}>}
     */
    async requestTakeoffClearance(params) {
        if (!this.isEnabled()) {
            return { success: false, error: 'Say Intentions not configured' };
        }

        try {
            const instruction = `${params.callsign}, ${params.airport} Tower, runway ${params.runway}, cleared for takeoff`;

            const response = await fetch(`${SI_API_BASE}/tower/takeoff`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this._apiKey}`
                },
                body: JSON.stringify({
                    airport: params.airport,
                    runway: params.runway,
                    callsign: params.callsign,
                    instruction: instruction
                })
            });

            if (!response.ok) {
                throw new Error(`Say Intentions API error: ${response.status}`);
            }

            const data = await response.json();
            return {
                success: true,
                voiceUrl: data.audioUrl || null,
                text: data.text || instruction,
                duration: data.duration || null
            };
        } catch (err) {
            console.error('[Say Intentions] Takeoff clearance error:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Send pilot transmission (voice recognition transcript)
     * @param {Object} params
     * @param {string} params.airport - ICAO code
     * @param {string} params.callsign - Aircraft callsign
     * @param {string} params.message - Pilot message transcript
     * @param {string} params.context - Context (ground, tower, approach, departure)
     * @returns {Promise<{success: boolean, voiceUrl?: string, text?: string, error?: string}>}
     */
    async sendPilotTransmission(params) {
        if (!this.isEnabled()) {
            return { success: false, error: 'Say Intentions not configured' };
        }

        try {
            const response = await fetch(`${SI_API_BASE}/pilot/transmit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this._apiKey}`
                },
                body: JSON.stringify({
                    airport: params.airport,
                    callsign: params.callsign,
                    message: params.message,
                    context: params.context || 'ground'
                })
            });

            if (!response.ok) {
                throw new Error(`Say Intentions API error: ${response.status}`);
            }

            const data = await response.json();
            return {
                success: true,
                voiceUrl: data.audioUrl || null,
                text: data.text || '',
                response: data.response || null
            };
        } catch (err) {
            console.error('[Say Intentions] Pilot transmission error:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Get frequency for airport (ground, tower, approach, departure)
     * @param {string} airport - ICAO code
     * @param {string} type - Frequency type (ground, tower, approach, departure)
     * @returns {Promise<{success: boolean, frequency?: string, name?: string, error?: string}>}
     */
    async getFrequency(airport, type = 'ground') {
        if (!this.isEnabled()) {
            return { success: false, error: 'Say Intentions not configured' };
        }

        try {
            const response = await fetch(`${SI_API_BASE}/airport/${airport}/frequency/${type}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this._apiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`Say Intentions API error: ${response.status}`);
            }

            const data = await response.json();
            return {
                success: true,
                frequency: data.frequency || null,
                name: data.name || null
            };
        } catch (err) {
            console.error('[Say Intentions] Frequency lookup error:', err.message);
            return { success: false, error: err.message };
        }
    }
}

module.exports = SayIntentionsAPI;
