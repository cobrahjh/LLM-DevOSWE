/**
 * SimWidget Auto Theme v1.0.0
 *
 * Automatically switches theme based on simulator time.
 * Uses the existing SimWidgetThemes system for theme management.
 *
 * Features:
 * - Listens for sim time via WebSocket or polls /api/simvars
 * - Switches to dark/midnight theme during night (19:00-06:00)
 * - Switches to light theme during day (06:00-19:00)
 * - Toggle to enable/disable auto-switching
 * - Respects manual theme selection when disabled
 * - Broadcasts changes via 'simwidget-theme' BroadcastChannel
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'simwidget-auto-theme';
    const POLL_INTERVAL = 60000; // 1 minute
    const WS_RECONNECT_DELAY = 5000;

    // Default configuration
    const DEFAULT_CONFIG = {
        enabled: false,
        dayTheme: 'light',
        nightTheme: 'midnight',
        sunriseHour: 6,
        sunsetHour: 19,
        useSimTime: true  // true = sim time, false = system time
    };

    class AutoTheme {
        constructor() {
            this.config = { ...DEFAULT_CONFIG };
            this.ws = null;
            this.simTime = null;  // Hours from midnight (e.g., 14.5 = 14:30)
            this.pollInterval = null;
            this.wsReconnectTimeout = null;
            this.lastAppliedTheme = null;

            this.loadConfig();
            this.init();
        }

        /**
         * Initialize the auto theme system
         */
        init() {
            // Start WebSocket connection for sim time
            if (this.config.useSimTime) {
                this.connectWebSocket();
            }

            // Start auto-check if enabled
            if (this.config.enabled) {
                this.startAutoCheck();
            }

            // Listen for manual theme changes to track state
            window.addEventListener('simwidget-theme-changed', (e) => {
                if (!this.config.enabled) {
                    // When auto mode is off, respect manual changes
                    this.lastAppliedTheme = e.detail.theme;
                }
            });

            console.log('[AutoTheme] Initialized:', this.config.enabled ? 'enabled' : 'disabled');
        }

        /**
         * Connect to WebSocket for real-time sim data
         */
        connectWebSocket() {
            if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
                return;
            }

            const host = location.hostname || 'localhost';
            const port = location.port || '8080';
            const wsUrl = `ws://${host}:${port}`;

            try {
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('[AutoTheme] WebSocket connected');
                    if (this.wsReconnectTimeout) {
                        clearTimeout(this.wsReconnectTimeout);
                        this.wsReconnectTimeout = null;
                    }
                };

                this.ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.type === 'flightData' && msg.data && msg.data.localTime !== undefined) {
                            this.simTime = msg.data.localTime;
                            // Check theme on each update if enabled
                            if (this.config.enabled) {
                                this.checkAndSwitch();
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                };

                this.ws.onclose = () => {
                    console.log('[AutoTheme] WebSocket disconnected, reconnecting...');
                    this.scheduleReconnect();
                };

                this.ws.onerror = () => {
                    // Error will trigger onclose
                };
            } catch (e) {
                console.warn('[AutoTheme] WebSocket connection failed:', e.message);
                this.scheduleReconnect();
            }
        }

        /**
         * Schedule WebSocket reconnection
         */
        scheduleReconnect() {
            if (this.wsReconnectTimeout) return;
            this.wsReconnectTimeout = setTimeout(() => {
                this.wsReconnectTimeout = null;
                if (this.config.useSimTime) {
                    this.connectWebSocket();
                }
            }, WS_RECONNECT_DELAY);
        }

        /**
         * Poll simvars API for time (fallback when WebSocket not available)
         */
        async pollSimVars() {
            try {
                const response = await fetch('/api/simvars');
                if (response.ok) {
                    const data = await response.json();
                    if (data.localTime !== undefined) {
                        this.simTime = data.localTime;
                    }
                }
            } catch (e) {
                // Ignore fetch errors, will retry on next poll
            }
        }

        /**
         * Start automatic theme checking
         */
        startAutoCheck() {
            this.checkAndSwitch();

            // Clear existing interval
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
            }

            this.pollInterval = setInterval(() => {
                // Poll for sim data if WebSocket is not connected
                if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                    this.pollSimVars();
                }
                this.checkAndSwitch();
            }, POLL_INTERVAL);
        }

        /**
         * Stop automatic theme checking
         */
        stopAutoCheck() {
            if (this.pollInterval) {
                clearInterval(this.pollInterval);
                this.pollInterval = null;
            }
        }

        /**
         * Get current hour (from sim time or system time)
         * @returns {number} Hour of day (0-23)
         */
        getCurrentHour() {
            if (this.config.useSimTime && this.simTime !== null) {
                // simTime is in hours from midnight (e.g., 14.5 = 14:30)
                return Math.floor(this.simTime) % 24;
            }
            return new Date().getHours();
        }

        /**
         * Check if it's night time
         * @returns {boolean} True if night time
         */
        isNightTime() {
            const hour = this.getCurrentHour();
            return hour >= this.config.sunsetHour || hour < this.config.sunriseHour;
        }

        /**
         * Check current time and switch theme if needed
         */
        checkAndSwitch() {
            if (!this.config.enabled) return;
            if (typeof SimWidgetThemes === 'undefined') {
                console.warn('[AutoTheme] SimWidgetThemes not available');
                return;
            }

            const isNight = this.isNightTime();
            const targetTheme = isNight ? this.config.nightTheme : this.config.dayTheme;
            const currentTheme = SimWidgetThemes.getCurrentTheme();

            if (currentTheme !== targetTheme) {
                SimWidgetThemes.setTheme(targetTheme);
                this.lastAppliedTheme = targetTheme;
                console.log(`[AutoTheme] Switched to ${targetTheme} (hour: ${this.getCurrentHour()}, night: ${isNight})`);

                // Dispatch custom event for local listeners
                window.dispatchEvent(new CustomEvent('simwidget-auto-theme-changed', {
                    detail: {
                        theme: targetTheme,
                        isNight: isNight,
                        hour: this.getCurrentHour(),
                        source: this.config.useSimTime ? 'sim' : 'system'
                    }
                }));
            }
        }

        /**
         * Enable auto theme switching
         */
        enable() {
            this.config.enabled = true;
            this.saveConfig();

            if (this.config.useSimTime) {
                this.connectWebSocket();
            }
            this.startAutoCheck();

            console.log('[AutoTheme] Enabled');
        }

        /**
         * Disable auto theme switching
         */
        disable() {
            this.config.enabled = false;
            this.saveConfig();
            this.stopAutoCheck();

            console.log('[AutoTheme] Disabled');
        }

        /**
         * Toggle auto theme on/off
         * @returns {boolean} New enabled state
         */
        toggle() {
            if (this.config.enabled) {
                this.disable();
            } else {
                this.enable();
            }
            return this.config.enabled;
        }

        /**
         * Check if auto theme is enabled
         * @returns {boolean} Enabled state
         */
        isEnabled() {
            return this.config.enabled;
        }

        /**
         * Set whether to use sim time or system time
         * @param {boolean} useSim - True to use sim time, false for system time
         */
        setUseSimTime(useSim) {
            this.config.useSimTime = useSim;
            this.saveConfig();

            if (useSim) {
                this.connectWebSocket();
            }

            if (this.config.enabled) {
                this.checkAndSwitch();
            }
        }

        /**
         * Set day and night themes
         * @param {string} dayTheme - Theme ID for daytime
         * @param {string} nightTheme - Theme ID for nighttime
         */
        setThemes(dayTheme, nightTheme) {
            if (dayTheme) this.config.dayTheme = dayTheme;
            if (nightTheme) this.config.nightTheme = nightTheme;
            this.saveConfig();

            if (this.config.enabled) {
                this.checkAndSwitch();
            }
        }

        /**
         * Set sunrise and sunset hours
         * @param {number} sunrise - Hour for sunrise (0-23)
         * @param {number} sunset - Hour for sunset (0-23)
         */
        setHours(sunrise, sunset) {
            if (typeof sunrise === 'number') this.config.sunriseHour = sunrise;
            if (typeof sunset === 'number') this.config.sunsetHour = sunset;
            this.saveConfig();

            if (this.config.enabled) {
                this.checkAndSwitch();
            }
        }

        /**
         * Get current configuration
         * @returns {Object} Current config
         */
        getConfig() {
            return { ...this.config };
        }

        /**
         * Get current status
         * @returns {Object} Status info
         */
        getStatus() {
            return {
                enabled: this.config.enabled,
                useSimTime: this.config.useSimTime,
                dayTheme: this.config.dayTheme,
                nightTheme: this.config.nightTheme,
                sunriseHour: this.config.sunriseHour,
                sunsetHour: this.config.sunsetHour,
                currentHour: this.getCurrentHour(),
                isNight: this.isNightTime(),
                simTimeAvailable: this.simTime !== null,
                wsConnected: this.ws && this.ws.readyState === WebSocket.OPEN
            };
        }

        /**
         * Save configuration to localStorage
         */
        saveConfig() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
            } catch (e) {
                console.warn('[AutoTheme] Failed to save config:', e.message);
            }
        }

        /**
         * Load configuration from localStorage
         */
        loadConfig() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.config = { ...DEFAULT_CONFIG, ...parsed };
                }
            } catch (e) {
                console.warn('[AutoTheme] Failed to load config:', e.message);
            }
        }

        /**
         * Create a toggle switch element for UI integration
         * @param {Object} options - Configuration options
         * @returns {HTMLElement} Toggle container element
         */
        createToggle(options = {}) {
            const container = document.createElement('label');
            container.className = `auto-theme-toggle ${options.className || ''}`.trim();
            container.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                user-select: none;
                font-size: 12px;
                color: var(--widget-text, #fff);
            `;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.config.enabled;
            checkbox.style.cssText = `
                width: 16px;
                height: 16px;
                accent-color: var(--widget-accent, #667eea);
                cursor: pointer;
            `;

            const label = document.createElement('span');
            label.textContent = options.label || 'Auto Night Mode';

            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.enable();
                } else {
                    this.disable();
                }
            });

            // Update checkbox when state changes externally
            window.addEventListener('simwidget-auto-theme-changed', () => {
                checkbox.checked = this.config.enabled;
            });

            container.appendChild(checkbox);
            container.appendChild(label);

            return container;
        }

        /**
         * Destroy the auto theme instance
         */
        destroy() {
            this.stopAutoCheck();

            if (this.wsReconnectTimeout) {
                clearTimeout(this.wsReconnectTimeout);
            }

            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
        }
    }

    // Create singleton instance
    const autoTheme = new AutoTheme();

    // Export to window
    if (typeof window !== 'undefined') {
        window.SimWidgetAutoTheme = autoTheme;
    }

    // ES module export
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = autoTheme;
    }

})();
