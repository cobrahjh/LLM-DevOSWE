/**
 * GTN750 Frequency Tuner Module
 *
 * Handles COM/NAV frequency tuning, validation, swapping, and database integration.
 *
 * Features:
 * - Active/standby frequency swapping
 * - Manual frequency tuning with validation
 * - Frequency memory (last 10 frequencies per radio)
 * - Database integration (airports, VORs, ILS)
 * - SimConnect API integration
 *
 * @version 1.0.0
 * @created 2026-02-13
 */

class GTNFrequencyTuner {
    constructor(options = {}) {
        this.serverPort = options.serverPort || 8080;
        this.onFrequencyChange = options.onFrequencyChange || null;

        // Current frequencies
        this.frequencies = {
            com1: { active: 118.000, standby: 118.000 },
            com2: { active: 118.000, standby: 118.000 },
            nav1: { active: 108.000, standby: 108.000 },
            nav2: { active: 108.000, standby: 108.000 }
        };

        // Frequency ranges and increments
        this.ranges = {
            com: { min: 118.000, max: 136.975, increment: 0.025, spacing25: true },
            nav: { min: 108.000, max: 117.950, increment: 0.050, spacing25: false }
        };

        // Frequency memory (last 10 per radio)
        this.memory = {
            com1: [],
            com2: [],
            nav1: [],
            nav2: []
        };

        // Load memory from localStorage
        this.loadMemory();

        this._destroyed = false;
    }

    /**
     * Update frequencies from SimConnect data
     * @param {Object} data - Flight data with radio frequencies
     */
    update(data) {
        if (this._destroyed) return;

        if (data.com1Active !== undefined) this.frequencies.com1.active = data.com1Active;
        if (data.com1Standby !== undefined) this.frequencies.com1.standby = data.com1Standby;
        if (data.com2Active !== undefined) this.frequencies.com2.active = data.com2Active;
        if (data.com2Standby !== undefined) this.frequencies.com2.standby = data.com2Standby;
        if (data.nav1Active !== undefined) this.frequencies.nav1.active = data.nav1Active;
        if (data.nav1Standby !== undefined) this.frequencies.nav1.standby = data.nav1Standby;
        if (data.nav2Active !== undefined) this.frequencies.nav2.active = data.nav2Active;
        if (data.nav2Standby !== undefined) this.frequencies.nav2.standby = data.nav2Standby;
    }

    /**
     * Get current frequency for radio
     * @param {string} radio - Radio name (com1, com2, nav1, nav2)
     * @param {string} type - 'active' or 'standby'
     * @returns {number} Frequency in MHz
     */
    getFrequency(radio, type = 'active') {
        return this.frequencies[radio]?.[type] || 0;
    }

    /**
     * Set frequency (sends to SimConnect)
     * @param {string} radio - Radio name (com1, com2, nav1, nav2)
     * @param {string} type - 'active' or 'standby'
     * @param {number} frequency - Frequency in MHz
     * @returns {Promise<boolean>} Success status
     */
    async setFrequency(radio, type, frequency) {
        if (this._destroyed) return false;

        // Validate frequency
        const radioType = radio.startsWith('com') ? 'com' : 'nav';
        if (!this.validateFrequency(frequency, radioType)) {
            console.error(`[FreqTuner] Invalid ${radioType} frequency: ${frequency}`);
            return false;
        }

        try {
            const response = await fetch(
                `http://${location.hostname}:${this.serverPort}/api/radio/${radio}/${type}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ frequency })
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Update local state
            this.frequencies[radio][type] = frequency;

            // Add to memory if setting standby
            if (type === 'standby') {
                this.addToMemory(radio, frequency);
            }

            // Trigger callback
            if (this.onFrequencyChange) {
                this.onFrequencyChange(radio, type, frequency);
            }

            GTNCore.log(`[FreqTuner] ${radio} ${type} set to ${frequency.toFixed(3)}`);
            return true;

        } catch (error) {
            console.error(`[FreqTuner] Failed to set ${radio} ${type}:`, error);
            return false;
        }
    }

    /**
     * Swap active and standby frequencies
     * @param {string} radio - Radio name (com1, com2, nav1, nav2)
     * @returns {Promise<boolean>} Success status
     */
    async swapFrequencies(radio) {
        if (this._destroyed) return false;

        try {
            const response = await fetch(
                `http://${location.hostname}:${this.serverPort}/api/radio/${radio}/swap`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Swap local state
            const temp = this.frequencies[radio].active;
            this.frequencies[radio].active = this.frequencies[radio].standby;
            this.frequencies[radio].standby = temp;

            // Trigger callback
            if (this.onFrequencyChange) {
                this.onFrequencyChange(radio, 'swap', this.frequencies[radio].active);
            }

            GTNCore.log(`[FreqTuner] ${radio} swapped: ${this.frequencies[radio].active.toFixed(3)} ⇄ ${this.frequencies[radio].standby.toFixed(3)}`);
            return true;

        } catch (error) {
            console.error(`[FreqTuner] Failed to swap ${radio}:`, error);
            return false;
        }
    }

    /**
     * Validate frequency against radio type ranges
     * @param {number} frequency - Frequency in MHz
     * @param {string} radioType - 'com' or 'nav'
     * @returns {boolean} Valid status
     */
    validateFrequency(frequency, radioType) {
        const range = this.ranges[radioType];
        if (!range) return false;

        // Check range
        if (frequency < range.min || frequency > range.max) return false;

        // Check increment (COM uses 25kHz spacing, NAV uses 50kHz)
        const multiplier = 1000 / (range.increment * 1000);
        const rounded = Math.round(frequency * multiplier) / multiplier;

        return Math.abs(frequency - rounded) < 0.001;
    }

    /**
     * Increment frequency by one step
     * @param {number} frequency - Current frequency
     * @param {string} radioType - 'com' or 'nav'
     * @param {number} direction - 1 for up, -1 for down
     * @returns {number} New frequency
     */
    incrementFrequency(frequency, radioType, direction = 1) {
        const range = this.ranges[radioType];
        if (!range) return frequency;

        let newFreq = frequency + (range.increment * direction);

        // Wrap around at limits
        if (newFreq > range.max) newFreq = range.min;
        if (newFreq < range.min) newFreq = range.max;

        // Round to increment precision
        const multiplier = 1000 / (range.increment * 1000);
        newFreq = Math.round(newFreq * multiplier) / multiplier;

        return newFreq;
    }

    /**
     * Format frequency for display
     * @param {number} frequency - Frequency in MHz
     * @param {string} radioType - 'com' or 'nav'
     * @returns {string} Formatted frequency
     */
    formatFrequency(frequency, radioType) {
        if (!frequency) return '---. ---';

        // COM: 118.000, NAV: 108.00
        const decimals = radioType === 'com' ? 3 : 2;
        return frequency.toFixed(decimals);
    }

    /**
     * Parse frequency from string input
     * @param {string} input - Frequency string (e.g., "118.5", "118500")
     * @param {string} radioType - 'com' or 'nav'
     * @returns {number|null} Parsed frequency or null if invalid
     */
    parseFrequency(input, radioType) {
        if (!input) return null;

        // Remove spaces and convert to string
        input = String(input).trim().replace(/\s/g, '');

        // Try parsing as decimal (118.5)
        if (input.includes('.')) {
            const freq = parseFloat(input);
            return this.validateFrequency(freq, radioType) ? freq : null;
        }

        // Try parsing as integer (118500 = 118.500)
        const num = parseInt(input, 10);
        if (isNaN(num)) return null;

        // Convert based on number of digits
        let freq;
        if (num >= 100000) {
            // 5-6 digits: 118500 = 118.500
            freq = num / 1000;
        } else if (num >= 10000) {
            // 4-5 digits: 11850 = 118.50
            freq = num / 100;
        } else {
            // 3 digits: 118 = 118.000
            freq = num;
        }

        return this.validateFrequency(freq, radioType) ? freq : null;
    }

    /**
     * Add frequency to memory
     * @param {string} radio - Radio name
     * @param {number} frequency - Frequency in MHz
     */
    addToMemory(radio, frequency) {
        if (!this.memory[radio]) return;

        // Remove if already exists
        const index = this.memory[radio].indexOf(frequency);
        if (index > -1) {
            this.memory[radio].splice(index, 1);
        }

        // Add to front
        this.memory[radio].unshift(frequency);

        // Keep only last 10
        if (this.memory[radio].length > 10) {
            this.memory[radio].pop();
        }

        this.saveMemory();
    }

    /**
     * Get memory for radio
     * @param {string} radio - Radio name
     * @returns {Array<number>} Frequency list
     */
    getMemory(radio) {
        return this.memory[radio] || [];
    }

    /**
     * Clear memory for radio
     * @param {string} radio - Radio name
     */
    clearMemory(radio) {
        if (this.memory[radio]) {
            this.memory[radio] = [];
            this.saveMemory();
        }
    }

    /**
     * Save memory to localStorage
     */
    saveMemory() {
        try {
            localStorage.setItem('gtn750-freq-memory', JSON.stringify(this.memory));
        } catch (e) {
            console.error('[FreqTuner] Failed to save memory:', e);
        }
    }

    /**
     * Load memory from localStorage
     */
    loadMemory() {
        try {
            const stored = localStorage.getItem('gtn750-freq-memory');
            if (stored) {
                this.memory = JSON.parse(stored);
            }
        } catch (e) {
            console.error('[FreqTuner] Failed to load memory:', e);
        }
    }

    /**
     * Get frequency identifier from NavDB
     * @param {number} frequency - Frequency in MHz
     * @param {string} type - 'com' or 'nav'
     * @returns {Promise<string|null>} Identifier (e.g., "KDEN TWR", "DEN VOR")
     */
    async getFrequencyIdentifier(frequency, type) {
        // This would query NavDB for airport COM frequencies or VOR/ILS NAV frequencies
        // For now, return null (to be implemented with NavDB integration)
        return null;
    }

    /**
     * Clean up resources
     */
    destroy() {
        this._destroyed = true;
        this.saveMemory();
        GTNCore.log('[FreqTuner] Destroyed');
    }
}
