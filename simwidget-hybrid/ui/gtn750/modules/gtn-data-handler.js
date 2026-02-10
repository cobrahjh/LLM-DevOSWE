/**
 * GTN Data Handler - WebSocket connection, sim data parsing, UI updates
 * Extracted from widget.js for modular architecture
 */

class GTNDataHandler {
    constructor(options = {}) {
        this.core = options.core || null;
        this.serverPort = options.serverPort || 8080;
        this.elements = options.elements || {};
        this.onDataUpdate = options.onDataUpdate || null;

        this.ws = null;
        this.reconnectDelay = 3000;

        // Navaid cache for frequency lookup
        this.navaidCache = [];

        // Traffic polling
        this.trafficPollingInterval = null;

        // Timer handles for cleanup
        this._clockInterval = null;
        this._reconnectTimer = null;
        this._destroyed = false;
    }

    // ===== WEBSOCKET =====

    connect() {
        const host = window.location.hostname || 'localhost';
        const wsUrl = `ws://${host}:${this.serverPort}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            GTNCore.log('[GTN750] Connected');
            if (this.elements.conn) this.elements.conn.classList.add('connected');
            if (this.elements.sysGpsStatus) {
                this.elements.sysGpsStatus.textContent = '3D FIX';
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    if (this.onDataUpdate) {
                        this.onDataUpdate(msg.data);
                    }
                }
            } catch (e) {
                console.warn('[GTN750] WebSocket message error:', e.message);
            }
        };

        this.ws.onclose = () => {
            if (this.elements.conn) this.elements.conn.classList.remove('connected');
            if (this.elements.sysGpsStatus) {
                this.elements.sysGpsStatus.textContent = 'NO GPS';
            }
            if (!this._destroyed) {
                this._reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
            }
        };

        this.ws.onerror = (e) => {
            console.warn('[GTN750] WebSocket error:', e.message || 'Connection error');
        };
    }

    // ===== UI UPDATES =====

    /**
     * Update frequency and basic UI elements from sim data
     * @param {Object} data - Current sim data
     * @param {Object} nav1 - NAV1 radio state
     */
    updateUI(data, nav1) {
        if (this.elements.com1) this.elements.com1.textContent = data.com1Active.toFixed(2);
        if (this.elements.com1Stby) this.elements.com1Stby.textContent = data.com1Standby.toFixed(2);
        if (this.elements.com2) this.elements.com2.textContent = data.com2Active.toFixed(2);
        if (this.elements.com2Stby) this.elements.com2Stby.textContent = data.com2Standby.toFixed(2);
        if (this.elements.nav1) this.elements.nav1.textContent = data.nav1Active.toFixed(2);
        if (this.elements.nav1Stby) this.elements.nav1Stby.textContent = data.nav1Standby.toFixed(2);
        if (this.elements.xpdr) this.elements.xpdr.textContent = Math.round(data.transponder).toString(16).toUpperCase().padStart(4, '0');

        // Transponder mode and ident
        if (this.elements.xpdrMode && data.transponderState !== undefined) {
            const modeMap = { 0: 'OFF', 1: 'SBY', 2: 'TST', 3: 'ON', 4: 'ALT', 5: 'GND' };
            this.elements.xpdrMode.textContent = modeMap[data.transponderState] || 'ON';
        }
        if (this.elements.xpdrIdent) {
            this.elements.xpdrIdent.classList.toggle('active', !!data.transponderIdent);
        }
        if (this.elements.xpdrModeIndicator) {
            this.elements.xpdrModeIndicator.style.visibility = data.transponderIdent ? 'visible' : 'hidden';
        }

        this.updateNavTuningInfo(data, nav1);

        if (this.elements.utcTime && data.zuluTime && this.core) {
            this.elements.utcTime.textContent = this.core.formatTime(data.zuluTime);
        }
    }

    /**
     * Update NAV1 tuning info (station ident, radial, DME)
     */
    updateNavTuningInfo(data, nav1) {
        const hasSignal = nav1 && nav1.signal > 10;

        if (this.elements.nav1Ident) {
            if (hasSignal) {
                let ident = nav1.ident;
                if (!ident) {
                    ident = this.lookupNavaidByFreq(data.nav1Active);
                }
                this.elements.nav1Ident.textContent = ident || 'VOR';
                this.elements.nav1Ident.classList.remove('no-signal');
            } else {
                this.elements.nav1Ident.textContent = '---';
                this.elements.nav1Ident.classList.add('no-signal');
            }
        }

        if (this.elements.nav1Radial) {
            if (hasSignal && nav1.radial !== undefined) {
                const radial = Math.round(nav1.radial);
                this.elements.nav1Radial.textContent = `R${radial.toString().padStart(3, '0')}°`;
            } else {
                this.elements.nav1Radial.textContent = 'R---°';
            }
        }

        if (this.elements.nav1Dme) {
            if (hasSignal && nav1.dme !== undefined && nav1.dme > 0) {
                this.elements.nav1Dme.textContent = nav1.dme.toFixed(1);
                this.elements.nav1Dme.classList.remove('no-dme');
            } else {
                this.elements.nav1Dme.textContent = '--.-';
                this.elements.nav1Dme.classList.add('no-dme');
            }
        }
    }

    /**
     * Look up navaid identifier by frequency
     * @param {number} freq - NAV frequency
     * @param {Object} nearestPage - Optional nearest page reference for VOR lookups
     * @returns {string|null}
     */
    lookupNavaidByFreq(freq, nearestPage) {
        if (nearestPage?.items && nearestPage.activeType === 'vor') {
            const match = nearestPage.items.find(v =>
                Math.abs(parseFloat(v.freq) - freq) < 0.01
            );
            if (match) return match.id;
        }

        if (this.navaidCache) {
            const match = this.navaidCache.find(n =>
                Math.abs(parseFloat(n.freq) - freq) < 0.01
            );
            if (match) return match.id;
        }

        return null;
    }

    // ===== TRAFFIC POLLING =====

    /**
     * Start polling for traffic data
     * @param {Function} isTrafficActive - Returns true when traffic overlay or page is active
     * @param {Object} trafficOverlay - TrafficOverlay instance
     */
    startTrafficPolling(isTrafficActive, trafficOverlay) {
        this.trafficPollingInterval = setInterval(() => {
            if (isTrafficActive()) {
                this.fetchTrafficData(trafficOverlay);
            }
        }, 2000);
        this.fetchTrafficData(trafficOverlay);
    }

    async fetchTrafficData(trafficOverlay) {
        try {
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/traffic`);
            if (response.ok) {
                const data = await response.json();
                if (trafficOverlay && data.traffic) {
                    trafficOverlay.updateTargets(data.traffic);
                }
            }
        } catch (e) {
            // Silently fail
        }
    }

    // ===== CLOCK =====

    startClock() {
        this._clockInterval = setInterval(() => {
            if (this.elements.utcTime && !this._hasSimTime) {
                const now = new Date();
                const h = now.getUTCHours().toString().padStart(2, '0');
                const m = now.getUTCMinutes().toString().padStart(2, '0');
                const s = now.getUTCSeconds().toString().padStart(2, '0');
                this.elements.utcTime.textContent = `${h}:${m}:${s}Z`;
            }
        }, 1000);
    }

    /**
     * Indicate that sim time is available (disables fallback clock)
     */
    setHasSimTime(has) {
        this._hasSimTime = has;
    }

    // ===== FREQUENCY SWAP =====

    // ===== CLEANUP =====

    destroy() {
        this._destroyed = true;
        if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
        if (this._clockInterval) clearInterval(this._clockInterval);
        if (this.trafficPollingInterval) clearInterval(this.trafficPollingInterval);
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
        }
    }

    async swapFrequency(radio) {
        try {
            await fetch(`http://${location.hostname}:${this.serverPort}/api/simconnect/event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: `${radio}_RADIO_SWAP` })
            });
        } catch (e) {
            console.error(`[GTN750] Swap ${radio} failed:`, e);
        }
    }
}
