/**
 * GTN750 Weather Panel v1.0.0
 * METAR decode, flight rules, icing, density altitude
 * Extracted from pane.js
 *
 * Loaded deferred (500ms) alongside overlays via moduleLoader
 *
 * @param {Object} opts
 * @param {GTNCore} opts.core
 * @param {Object} opts.elements - DOM element refs from pane.js
 * @param {number} opts.serverPort
 * @param {Function} opts.getData - Returns current aircraft data
 * @param {Function} opts.getWeatherOverlay - Returns weather overlay instance
 */

class GTNWeatherPanel {
    constructor({ core, elements, serverPort, getData, getWeatherOverlay }) {
        this.core = core;
        this.elements = elements;
        this.serverPort = serverPort;
        this.getData = getData;
        this.getWeatherOverlay = getWeatherOverlay;
    }

    /**
     * Unified weather info panel update — flight rules, decoded METAR grid,
     * computed aviation data, raw METAR, condition icon, and station detail on tap.
     * Falls back to sim weather when no METAR data available.
     */
    updateWxInfoPanel() {
        const data = this.getData();
        const weatherOverlay = this.getWeatherOverlay();

        // Find nearest METAR station
        let nearest = null, nearestDist = Infinity;
        const metarData = weatherOverlay?.metarData;
        if (metarData && metarData.size > 0) {
            metarData.forEach(m => {
                const dist = this.core.calculateDistance(data.latitude, data.longitude, m.lat, m.lon);
                if (dist < nearestDist) { nearestDist = dist; nearest = m; }
            });
        }

        const hasMetar = !!nearest;

        // --- Flight Rules Badge ---
        if (this.elements.wxFltRules) {
            const cat = hasMetar ? (nearest.category || 'VFR') : this._simFlightRules(data);
            this.elements.wxFltRules.textContent = cat;
            this.elements.wxFltRules.className = 'wx-flt-rules wx-flt-' + cat.toLowerCase();
        }
        if (this.elements.wxNearestId) {
            this.elements.wxNearestId.textContent = hasMetar ? nearest.icao : '----';
        }

        // --- Condition Icon (prefer METAR category over sim precip) ---
        this._updateConditionFromMetar(nearest, data);

        // --- Decoded METAR Grid ---
        if (hasMetar) {
            // Wind
            if (this.elements.wxDWind) {
                const dir = nearest.wdir != null ? String(nearest.wdir).padStart(3, '0') : 'VRB';
                const spd = nearest.wspd != null ? nearest.wspd : '--';
                let windStr = `${dir}°/${spd}kt`;
                if (nearest.gust) windStr += `G${nearest.gust}`;
                this.elements.wxDWind.textContent = windStr;
            }
            // Visibility
            if (this.elements.wxDVis) {
                const v = nearest.visib;
                this.elements.wxDVis.textContent = v != null ? (v >= 10 ? '10+SM' : `${v}SM`) : '--SM';
            }
            // Ceiling — lowest BKN/OVC
            if (this.elements.wxDCeil) {
                const clouds = nearest.clouds || [];
                const ceil = clouds.find(c => c.cover === 'BKN' || c.cover === 'OVC');
                if (ceil) {
                    const alt = String(Math.round((ceil.base || 0) / 100)).padStart(3, '0');
                    this.elements.wxDCeil.textContent = `${ceil.cover}${alt}`;
                } else if (clouds.length > 0 && clouds[0].cover === 'CLR') {
                    this.elements.wxDCeil.textContent = 'CLR';
                } else if (clouds.length > 0) {
                    const top = clouds[clouds.length - 1];
                    const alt = String(Math.round((top.base || 0) / 100)).padStart(3, '0');
                    this.elements.wxDCeil.textContent = `${top.cover}${alt}`;
                } else {
                    this.elements.wxDCeil.textContent = 'CLR';
                }
            }
            // Temp/Dewpoint
            if (this.elements.wxDTemp) {
                const t = nearest.temp != null ? nearest.temp : '--';
                const d = nearest.dewp != null ? nearest.dewp : '--';
                this.elements.wxDTemp.textContent = `${t}°/${d}°C`;
                const spread = (nearest.temp != null && nearest.dewp != null) ? Math.abs(nearest.temp - nearest.dewp) : 99;
                this.elements.wxDTemp.classList.toggle('wx-fog-risk', spread <= 3);
            }
            // Altimeter
            if (this.elements.wxDAltim) {
                const alt = nearest.altimeter;
                this.elements.wxDAltim.textContent = alt != null ? `${Number(alt).toFixed(2)}"` : '--.--"';
            }
        } else {
            // Fallback to sim weather data
            const dir = Math.round(data.windDirection || 0);
            const spd = Math.round(data.windSpeed || 0);
            if (this.elements.wxDWind) this.elements.wxDWind.textContent = `${String(dir).padStart(3, '0')}°/${spd}kt`;
            if (this.elements.wxDVis) {
                const visSM = (data.visibility || 10000) / 1609.34;
                this.elements.wxDVis.textContent = visSM >= 10 ? '10+SM' : `${visSM.toFixed(1)}SM`;
            }
            if (this.elements.wxDCeil) this.elements.wxDCeil.textContent = '---';
            if (this.elements.wxDTemp) {
                this.elements.wxDTemp.textContent = `${Math.round(data.ambientTemp || 15)}°C`;
                this.elements.wxDTemp.classList.remove('wx-fog-risk');
            }
            if (this.elements.wxDAltim) this.elements.wxDAltim.textContent = `${(data.ambientPressure || 29.92).toFixed(2)}"`;
        }

        // --- Computed Aviation Data ---
        const oat = hasMetar && nearest.temp != null ? nearest.temp : (data.ambientTemp || 15);
        const alt = data.altitude || 0;
        const baro = hasMetar && nearest.altimeter != null ? nearest.altimeter : (data.ambientPressure || 29.92);

        // Freezing level: surface temp + lapse rate 2°C/1000ft
        if (this.elements.wxFrzLvl) {
            if (oat <= 0) {
                this.elements.wxFrzLvl.textContent = 'SFC';
            } else {
                const frzLvl = Math.round(alt + (oat / 2) * 1000);
                this.elements.wxFrzLvl.textContent = frzLvl.toLocaleString();
            }
        }

        // Density altitude: pressureAlt + 120 * (OAT - stdTemp)
        if (this.elements.wxDnsAlt) {
            const pressureAlt = alt + (29.92 - baro) * 1000;
            const stdTemp = 15 - (pressureAlt / 1000 * 2);
            const dnsAlt = Math.round(pressureAlt + 120 * (oat - stdTemp));
            this.elements.wxDnsAlt.textContent = dnsAlt.toLocaleString();
        }

        // Icing risk
        if (this.elements.wxIcing) {
            const hasMoisture = hasMetar
                ? ((nearest.weather && nearest.weather.length > 0) || (nearest.clouds && nearest.clouds.some(c => c.cover === 'BKN' || c.cover === 'OVC')))
                : ((data.precipState || 0) > 0 || (data.visibility || 10000) < 5000);
            let icing = 'NONE', cls = 'wx-icing-none';
            if (oat <= 2 && oat > -5 && hasMoisture) { icing = 'LIGHT'; cls = 'wx-icing-light'; }
            else if (oat <= -5 && hasMoisture) { icing = 'MOD'; cls = 'wx-icing-moderate'; }
            this.elements.wxIcing.textContent = icing;
            this.elements.wxIcing.className = cls;
        }

        // --- Raw METAR text ---
        if (this.elements.wxMetarText) {
            if (hasMetar) {
                let text = nearest.raw || `${nearest.icao}: ${nearest.category}`;
                if (weatherOverlay.layers.taf) {
                    const tafSummary = weatherOverlay.getNearestTafSummary(data.latitude, data.longitude);
                    if (tafSummary) text += ' | TAF: ' + tafSummary;
                }
                this.elements.wxMetarText.textContent = text;
            } else {
                this.elements.wxMetarText.textContent = 'No METAR data';
            }
        }

        // --- Station Detail (from canvas tap) ---
        this._updateStationDetail(weatherOverlay);

        // Push sim weather to overlay for rendering
        if (weatherOverlay) {
            weatherOverlay.updateSimWeather({
                precipState: data.precipState, visibility: data.visibility,
                windDirection: data.windDirection, windSpeed: data.windSpeed,
                ambientTemp: data.ambientTemp
            });
        }
    }

    /**
     * Derive flight rules from sim data when no METAR available
     */
    _simFlightRules(data) {
        const visSM = (data.visibility || 10000) / 1609.34;
        if (visSM < 1) return 'LIFR';
        if (visSM < 3) return 'IFR';
        if (visSM < 5) return 'MVFR';
        return 'VFR';
    }

    /**
     * Update condition icon/text from METAR category or sim precip fallback
     */
    _updateConditionFromMetar(nearest, data) {
        const iconEl = this.elements.wxConditionIcon;
        const textEl = this.elements.wxConditionText;
        if (!iconEl || !textEl) return;

        if (nearest) {
            const cat = nearest.category || 'VFR';
            const catMap = { VFR: ['☀️', 'Clear'], MVFR: ['🌤️', 'Marginal'], IFR: ['🌧️', 'IFR'], LIFR: ['⛈️', 'Low IFR'] };
            const wx = nearest.weather || [];
            if (wx.some(w => w.includes('TS') || w.includes('GR'))) { iconEl.textContent = '⛈️'; textEl.textContent = 'Storm'; }
            else if (wx.some(w => w.includes('SN'))) { iconEl.textContent = '🌨️'; textEl.textContent = 'Snow'; }
            else if (wx.some(w => w.includes('RA') || w.includes('DZ'))) { iconEl.textContent = '🌧️'; textEl.textContent = 'Rain'; }
            else if (wx.some(w => w.includes('FG'))) { iconEl.textContent = '🌫️'; textEl.textContent = 'Fog'; }
            else if (wx.some(w => w.includes('BR') || w.includes('HZ'))) { iconEl.textContent = '🌁'; textEl.textContent = 'Haze'; }
            else { const [icon, text] = catMap[cat] || catMap.VFR; iconEl.textContent = icon; textEl.textContent = text; }
        } else {
            const precip = data.precipState || 0;
            const vis = data.visibility || 10000;
            const wind = data.windSpeed || 0;
            let icon = '☀️', text = 'Clear';
            if (precip & 4) { icon = '🌨️'; text = 'Snow'; }
            else if (precip & 2) { icon = wind > 25 ? '⛈️' : '🌧️'; text = wind > 25 ? 'Storm' : 'Rain'; }
            else if (vis < 1000) { icon = '🌫️'; text = 'Fog'; }
            else if (vis < 5000) { icon = '🌁'; text = 'Mist'; }
            else if (wind > 30) { icon = '💨'; text = 'Windy'; }
            else if (wind > 15) { icon = '🌤️'; text = 'Breezy'; }
            iconEl.textContent = icon;
            textEl.textContent = text;
        }
    }

    /**
     * Show station detail div when a METAR station is tapped on the canvas
     */
    _updateStationDetail(weatherOverlay) {
        const el = this.elements.wxStationDetail;
        if (!el || !weatherOverlay) return;

        const popup = weatherOverlay._metarPopup;
        if (!popup || !popup.station) {
            el.style.display = 'none';
            return;
        }

        const s = popup.station;
        el.style.display = '';

        const rulesCls = 'wx-flt-' + (s.category || 'vfr').toLowerCase();

        let html = `<span class="wx-sd-icao">${s.icao}</span>`;
        html += `<span class="wx-sd-rules ${rulesCls}" style="display:inline-block;padding:1px 4px;border-radius:2px;font-size:9px;font-weight:700;margin-left:4px;">${s.category || 'VFR'}</span>`;

        const clouds = s.clouds || [];
        if (clouds.length > 0) {
            const skyStr = clouds.map(c => {
                const base = c.base ? Math.round(c.base) : '';
                return `${c.cover}${base ? ' ' + base + 'ft' : ''}`;
            }).join(', ');
            html += `<div class="wx-sd-row">Sky: <b>${skyStr}</b></div>`;
        }

        const wx = s.weather || [];
        if (wx.length > 0) {
            html += `<div class="wx-sd-row">Wx: <b>${wx.join(', ')}</b></div>`;
        }

        if (s.wdir != null || s.wspd != null) {
            let wStr = `${s.wdir != null ? String(s.wdir).padStart(3, '0') : 'VRB'}°/${s.wspd || 0}kt`;
            if (s.gust) wStr += ` G${s.gust}kt`;
            html += `<div class="wx-sd-row">Wind: <b>${wStr}</b></div>`;
        }

        if (s.temp != null) html += `<div class="wx-sd-row">Temp: <b>${s.temp}°C</b> Dew: <b>${s.dewp != null ? s.dewp + '°C' : '--'}</b></div>`;
        if (s.altimeter != null) html += `<div class="wx-sd-row">Altim: <b>${Number(s.altimeter).toFixed(2)}"</b></div>`;

        if (s.raw) html += `<div class="wx-sd-row" style="margin-top:3px;font-size:9px;color:var(--gtn-text-dim);">${s.raw}</div>`;

        el.innerHTML = html;
    }

    /**
     * Set a weather preset via server API
     */
    async setWeatherPreset(preset) {
        GTNCore.log('[GTN750] Setting weather preset:', preset);
        try {
            const response = await fetch(`http://${window.location.hostname}:${this.serverPort}/api/weather/preset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preset })
            });
            const data = await response.json();
            if (data.success) {
                document.querySelectorAll('.wx-preset-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.preset === preset));
                this.elements.wxLiveBtn?.classList.remove('active');
            }
        } catch (e) { console.error('[GTN750] Weather error:', e); }
    }

    /**
     * Enable live weather via server API
     */
    async setLiveWeather() {
        try {
            const response = await fetch(`http://${window.location.hostname}:${this.serverPort}/api/weather/mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'live' })
            });
            const data = await response.json();
            if (data.success) {
                document.querySelectorAll('.wx-preset-btn').forEach(btn => btn.classList.remove('active'));
                this.elements.wxLiveBtn?.classList.add('active');
            }
        } catch (e) { console.error('[GTN750] Live weather error:', e); }
    }

    destroy() {
        // No timers to clean up
    }
}
