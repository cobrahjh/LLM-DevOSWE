/**
 * GTN SimVar Handler - MSFS native data source
 * Drop-in replacement for GTNDataHandler when running inside MSFS
 * Reads SimVar API directly instead of WebSocket
 *
 * Interface contract (same as GTNDataHandler):
 *   - constructor({ core, serverPort, elements, onDataUpdate })
 *   - connect()           → starts SimVar polling loop
 *   - updateUI(data, nav1)
 *   - startTrafficPolling(isActive, overlay)
 *   - startClock()
 *   - setHasSimTime(bool)
 *   - swapFrequency(radio)
 *   - destroy()
 */

class GTNSimVarHandler {
    constructor(options = {}) {
        this.core = options.core || null;
        this.serverPort = options.serverPort || 8080;
        this.elements = options.elements || {};
        this.onDataUpdate = options.onDataUpdate || null;

        this.navaidCache = [];
        this.trafficPollingInterval = null;
        this._clockInterval = null;
        this._pollInterval = null;
        this._destroyed = false;
        this._hasSimTime = false;

        this.POLL_RATE = 100; // ms — 10Hz like real avionics
    }

    // ===== SIMVAR POLLING =====

    connect() {
        if (typeof SimVar === 'undefined') {
            console.warn('[GTN750-SV] SimVar not available, retrying in 1s...');
            setTimeout(() => this.connect(), 1000);
            return;
        }

        GTNCore.log('[GTN750-SV] SimVar connected, starting poll loop');
        if (this.elements.conn) this.elements.conn.classList.add('connected');
        if (this.elements.sysGpsStatus) this.elements.sysGpsStatus.textContent = '3D FIX';

        this._pollInterval = setInterval(() => this._poll(), this.POLL_RATE);
    }

    _poll() {
        if (this._destroyed) return;
        if (typeof SimVar === 'undefined') return;

        try {
            const d = {
                // Position
                latitude: SimVar.GetSimVarValue('GPS POSITION LAT', 'degrees latitude'),
                longitude: SimVar.GetSimVarValue('GPS POSITION LON', 'degrees longitude'),
                altitude: SimVar.GetSimVarValue('INDICATED ALTITUDE', 'feet'),
                altitudeMSL: SimVar.GetSimVarValue('INDICATED ALTITUDE', 'feet'),
                altitudeAGL: SimVar.GetSimVarValue('PLANE ALT ABOVE GROUND', 'feet'),

                // Movement
                groundSpeed: SimVar.GetSimVarValue('GPS GROUND SPEED', 'knots'),
                heading: SimVar.GetSimVarValue('HEADING INDICATOR', 'degrees'),
                groundTrack: SimVar.GetSimVarValue('GPS GROUND TRUE TRACK', 'degrees'),
                magvar: SimVar.GetSimVarValue('MAGVAR', 'degrees'),
                verticalSpeed: SimVar.GetSimVarValue('VERTICAL SPEED', 'feet per minute'),

                // Radios
                com1Active: SimVar.GetSimVarValue('COM ACTIVE FREQUENCY:1', 'MHz'),
                com1Standby: SimVar.GetSimVarValue('COM STANDBY FREQUENCY:1', 'MHz'),
                com2Active: SimVar.GetSimVarValue('COM ACTIVE FREQUENCY:2', 'MHz'),
                com2Standby: SimVar.GetSimVarValue('COM STANDBY FREQUENCY:2', 'MHz'),
                nav1Active: SimVar.GetSimVarValue('NAV ACTIVE FREQUENCY:1', 'MHz'),
                nav1Standby: SimVar.GetSimVarValue('NAV STANDBY FREQUENCY:1', 'MHz'),
                transponder: SimVar.GetSimVarValue('TRANSPONDER CODE:1', 'number'),

                // NAV1 signal
                nav1Signal: SimVar.GetSimVarValue('NAV SIGNAL:1', 'number'),
                nav1Radial: SimVar.GetSimVarValue('NAV RADIAL:1', 'degrees'),
                nav1Dme: SimVar.GetSimVarValue('NAV DME:1', 'nautical miles'),
                nav1Ident: SimVar.GetSimVarValue('NAV IDENT:1', 'string'),
                nav1Obs: SimVar.GetSimVarValue('NAV OBS:1', 'degrees'),
                nav1Cdi: SimVar.GetSimVarValue('NAV CDI:1', 'number'),
                nav1GsFlag: SimVar.GetSimVarValue('NAV GS FLAG:1', 'bool'),
                nav1Gs: SimVar.GetSimVarValue('NAV GLIDE SLOPE:1', 'degrees'),
                nav1ToFrom: SimVar.GetSimVarValue('NAV TOFROM:1', 'enum'),

                // NAV2 signal
                nav2Signal: SimVar.GetSimVarValue('NAV SIGNAL:2', 'number'),
                nav2Radial: SimVar.GetSimVarValue('NAV RADIAL:2', 'degrees'),
                nav2Obs: SimVar.GetSimVarValue('NAV OBS:2', 'degrees'),
                nav2Cdi: SimVar.GetSimVarValue('NAV CDI:2', 'number'),
                nav2ToFrom: SimVar.GetSimVarValue('NAV TOFROM:2', 'enum'),

                // GPS
                gpsCourse: SimVar.GetSimVarValue('GPS WP DESIRED TRACK', 'degrees'),
                gpsCdi: SimVar.GetSimVarValue('GPS WP CROSS TRK', 'nautical miles'),
                gpsWpDist: SimVar.GetSimVarValue('GPS WP DISTANCE', 'nautical miles'),
                gpsWpBrg: SimVar.GetSimVarValue('GPS WP BEARING', 'degrees'),

                // Time
                zuluTime: SimVar.GetSimVarValue('E:ZULU TIME', 'seconds') / 3600,

                // Weather
                windDirection: SimVar.GetSimVarValue('AMBIENT WIND DIRECTION', 'degrees'),
                windSpeed: SimVar.GetSimVarValue('AMBIENT WIND VELOCITY', 'knots'),
                ambientTemp: SimVar.GetSimVarValue('AMBIENT TEMPERATURE', 'celsius'),
                ambientPressure: SimVar.GetSimVarValue('KOHLSMAN SETTING HG', 'inHg'),
                visibility: SimVar.GetSimVarValue('AMBIENT VISIBILITY', 'meters'),
                precipState: SimVar.GetSimVarValue('AMBIENT PRECIP STATE', 'mask'),

                // Fuel
                fuelTotal: SimVar.GetSimVarValue('FUEL TOTAL QUANTITY', 'gallons'),
                fuelFlow: SimVar.GetSimVarValue('ENG FUEL FLOW GPH:1', 'gallons per hour'),
                fuelCapacity: SimVar.GetSimVarValue('FUEL TOTAL CAPACITY', 'gallons')
            };

            if (this.onDataUpdate) this.onDataUpdate(d);
        } catch (e) {
            console.error('[GTN750-SV] Poll error:', e);
        }
    }

    // ===== UI UPDATES (same interface as GTNDataHandler) =====

    updateUI(data, nav1) {
        if (this.elements.com1) this.elements.com1.textContent = data.com1Active.toFixed(2);
        if (this.elements.com1Stby) this.elements.com1Stby.textContent = data.com1Standby.toFixed(2);
        if (this.elements.com2) this.elements.com2.textContent = data.com2Active.toFixed(2);
        if (this.elements.com2Stby) this.elements.com2Stby.textContent = data.com2Standby.toFixed(2);
        if (this.elements.nav1) this.elements.nav1.textContent = data.nav1Active.toFixed(2);
        if (this.elements.nav1Stby) this.elements.nav1Stby.textContent = data.nav1Standby.toFixed(2);
        if (this.elements.xpdr) this.elements.xpdr.textContent = data.transponder.toString().padStart(4, '0');

        this.updateNavTuningInfo(data, nav1);

        if (this.elements.utcTime && data.zuluTime && this.core) {
            this.elements.utcTime.textContent = this.core.formatTime(data.zuluTime);
        }
    }

    updateNavTuningInfo(data, nav1) {
        const hasSignal = nav1 && nav1.signal > 10;

        if (this.elements.nav1Ident) {
            if (hasSignal) {
                this.elements.nav1Ident.textContent = nav1.ident || 'VOR';
                this.elements.nav1Ident.classList.remove('no-signal');
            } else {
                this.elements.nav1Ident.textContent = '---';
                this.elements.nav1Ident.classList.add('no-signal');
            }
        }

        if (this.elements.nav1Radial) {
            if (hasSignal && nav1.radial !== undefined) {
                const radial = Math.round(nav1.radial);
                this.elements.nav1Radial.textContent = `R${radial.toString().padStart(3, '0')}\u00B0`;
            } else {
                this.elements.nav1Radial.textContent = 'R---\u00B0';
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

    lookupNavaidByFreq(freq, nearestPage) {
        if (nearestPage?.items && nearestPage.activeType === 'vor') {
            const match = nearestPage.items.find(v =>
                Math.abs(parseFloat(v.freq) - freq) < 0.01
            );
            if (match) return match.id;
        }
        return null;
    }

    // ===== TRAFFIC (TCAS via SimVar) =====

    startTrafficPolling(isTrafficActive, trafficOverlay) {
        this.trafficPollingInterval = setInterval(() => {
            if (!isTrafficActive() || typeof SimVar === 'undefined') return;
            this._pollTraffic(trafficOverlay);
        }, 2000);
    }

    _pollTraffic(trafficOverlay) {
        if (!trafficOverlay) return;
        try {
            const count = SimVar.GetSimVarValue('AI TRAFFIC STATE', 'number') || 0;
            const traffic = [];
            for (let i = 1; i <= Math.min(count, 20); i++) {
                const lat = SimVar.GetSimVarValue(`AI TRAFFIC FROMAIRPORT LATITUDE:${i}`, 'degrees');
                const lon = SimVar.GetSimVarValue(`AI TRAFFIC FROMAIRPORT LONGITUDE:${i}`, 'degrees');
                const alt = SimVar.GetSimVarValue(`AI TRAFFIC ALTITUDE:${i}`, 'feet');
                if (lat && lon) {
                    traffic.push({ lat, lon, altitude: alt, id: `T${i}` });
                }
            }
            if (traffic.length > 0) trafficOverlay.updateTargets(traffic);
        } catch (e) {
            // TCAS SimVars may not be available
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

    setHasSimTime(has) {
        this._hasSimTime = has;
    }

    // ===== FREQUENCY SWAP (K: events) =====

    swapFrequency(radio) {
        if (typeof SimVar === 'undefined') return;
        const events = {
            COM1: 'K:COM_STBY_RADIO_SWAP',
            COM2: 'K:COM2_RADIO_SWAP',
            NAV1: 'K:NAV1_RADIO_SWAP'
        };
        const event = events[radio];
        if (event) {
            SimVar.SetSimVarValue(event, 'Number', 1);
            GTNCore.log(`[GTN750-SV] Swapped ${radio}`);
        }
    }

    // ===== CLEANUP =====

    destroy() {
        this._destroyed = true;
        if (this._pollInterval) clearInterval(this._pollInterval);
        if (this._clockInterval) clearInterval(this._clockInterval);
        if (this.trafficPollingInterval) clearInterval(this.trafficPollingInterval);
    }
}
