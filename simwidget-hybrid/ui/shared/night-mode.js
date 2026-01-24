/**
 * SimWidget Night Mode Auto-Switch v1.0.0
 * Automatically switches theme based on sim time or system time
 */

class NightMode {
    constructor(options = {}) {
        this.enabled = false;
        this.autoMode = options.autoMode || 'system'; // 'system', 'sim', 'manual'
        this.dayTheme = options.dayTheme || 'default';
        this.nightTheme = options.nightTheme || 'oled';
        this.sunriseHour = options.sunriseHour || 6;
        this.sunsetHour = options.sunsetHour || 18;
        this.ws = null;
        this.simTime = null;
        this.checkInterval = null;

        this.loadState();
        this.init();
    }

    init() {
        if (this.autoMode === 'sim') {
            this.connectWebSocket();
        }

        if (this.enabled) {
            this.startAutoCheck();
        }
    }

    connectWebSocket() {
        const host = location.hostname || 'localhost';
        this.ws = new WebSocket('ws://' + host + ':8080');

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData' && msg.data.localTime !== undefined) {
                    this.simTime = msg.data.localTime;
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }

    startAutoCheck() {
        this.checkAndSwitch();
        this.checkInterval = setInterval(() => this.checkAndSwitch(), 60000);
    }

    stopAutoCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    checkAndSwitch() {
        const hour = this.getCurrentHour();
        const isNight = hour < this.sunriseHour || hour >= this.sunsetHour;

        if (window.themeSwitcher) {
            const targetTheme = isNight ? this.nightTheme : this.dayTheme;
            const currentTheme = window.themeSwitcher.getTheme();

            if (currentTheme !== targetTheme) {
                window.themeSwitcher.setTheme(targetTheme);
                this.notifyChange(isNight);
            }
        }
    }

    getCurrentHour() {
        if (this.autoMode === 'sim' && this.simTime !== null) {
            // Sim time is typically in seconds from midnight
            return Math.floor(this.simTime / 3600) % 24;
        }
        return new Date().getHours();
    }

    notifyChange(isNight) {
        const event = new CustomEvent('nightmodechange', {
            detail: { isNight, theme: isNight ? this.nightTheme : this.dayTheme }
        });
        window.dispatchEvent(event);
    }

    enable() {
        this.enabled = true;
        this.startAutoCheck();
        this.saveState();
    }

    disable() {
        this.enabled = false;
        this.stopAutoCheck();
        this.saveState();
    }

    toggle() {
        this.enabled ? this.disable() : this.enable();
        return this.enabled;
    }

    setAutoMode(mode) {
        this.autoMode = mode;
        if (mode === 'sim' && !this.ws) {
            this.connectWebSocket();
        }
        this.saveState();
    }

    setThemes(dayTheme, nightTheme) {
        this.dayTheme = dayTheme;
        this.nightTheme = nightTheme;
        this.saveState();
    }

    setHours(sunrise, sunset) {
        this.sunriseHour = sunrise;
        this.sunsetHour = sunset;
        this.saveState();
    }

    saveState() {
        try {
            localStorage.setItem('simwidget-night-mode', JSON.stringify({
                enabled: this.enabled,
                autoMode: this.autoMode,
                dayTheme: this.dayTheme,
                nightTheme: this.nightTheme,
                sunriseHour: this.sunriseHour,
                sunsetHour: this.sunsetHour
            }));
        } catch (e) {}
    }

    loadState() {
        try {
            const saved = localStorage.getItem('simwidget-night-mode');
            if (saved) {
                const state = JSON.parse(saved);
                this.enabled = state.enabled || false;
                this.autoMode = state.autoMode || 'system';
                this.dayTheme = state.dayTheme || 'default';
                this.nightTheme = state.nightTheme || 'oled';
                this.sunriseHour = state.sunriseHour || 6;
                this.sunsetHour = state.sunsetHour || 18;
            }
        } catch (e) {}
    }

    getStatus() {
        return {
            enabled: this.enabled,
            autoMode: this.autoMode,
            dayTheme: this.dayTheme,
            nightTheme: this.nightTheme,
            currentHour: this.getCurrentHour(),
            isNight: this.getCurrentHour() < this.sunriseHour || this.getCurrentHour() >= this.sunsetHour
        };
    }
}

// Auto-init
if (typeof window !== 'undefined') {
    window.nightMode = new NightMode();
}
