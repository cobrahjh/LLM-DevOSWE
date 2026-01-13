/**
 * SimWidget Aviation Data Service
 * Version: v1.0.0
 * Last updated: 2026-01-06
 * 
 * Real-time aviation data:
 * - METAR weather reports
 * - NOTAMs (Notices to Air Missions)
 * - ILS/VOR frequencies
 * - Airport information
 */

class AviationDataService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = {
            metar: 10 * 60 * 1000,      // 10 minutes
            taf: 30 * 60 * 1000,         // 30 minutes
            notam: 60 * 60 * 1000,       // 1 hour
            airport: 24 * 60 * 60 * 1000 // 24 hours
        };
        
        // Free API endpoints
        this.endpoints = {
            // AVWX - Free tier available
            avwx: 'https://avwx.rest/api',
            // CheckWX - Free tier
            checkwx: 'https://api.checkwx.com',
            // FAA NOTAM API
            faa: 'https://external-api.faa.gov/notamapi/v1'
        };
        
        this.apiKeys = {
            avwx: null,      // Set via settings
            checkwx: null
        };
    }

    // ========== METAR ==========

    async getMETAR(icao) {
        icao = icao.toUpperCase();
        const cacheKey = `metar_${icao}`;
        
        // Check cache
        const cached = this.getFromCache(cacheKey, this.cacheExpiry.metar);
        if (cached) return cached;

        try {
            // Try AVWX first
            const data = await this.fetchAVWX(`/metar/${icao}`);
            
            const result = {
                icao: icao,
                raw: data.raw,
                time: data.time?.dt,
                wind: this.parseWind(data),
                visibility: data.visibility?.repr,
                clouds: this.parseClouds(data.clouds),
                temperature: data.temperature?.value,
                dewpoint: data.dewpoint?.value,
                altimeter: data.altimeter?.value,
                flightRules: data.flight_rules,
                remarks: data.remarks
            };

            this.setCache(cacheKey, result);
            return result;
        } catch (err) {
            console.error(`[AviationData] METAR fetch failed for ${icao}:`, err);
            return this.getFallbackMETAR(icao);
        }
    }

    parseWind(data) {
        if (!data.wind_direction && !data.wind_speed) return null;
        return {
            direction: data.wind_direction?.value || 0,
            speed: data.wind_speed?.value || 0,
            gust: data.wind_gust?.value || null,
            variable: data.wind_direction?.repr === 'VRB'
        };
    }

    parseClouds(clouds) {
        if (!clouds || !clouds.length) return [];
        return clouds.map(c => ({
            type: c.type,
            altitude: c.altitude * 100, // Convert to feet
            repr: c.repr
        }));
    }

    // ========== TAF (Forecast) ==========

    async getTAF(icao) {
        icao = icao.toUpperCase();
        const cacheKey = `taf_${icao}`;
        
        const cached = this.getFromCache(cacheKey, this.cacheExpiry.taf);
        if (cached) return cached;

        try {
            const data = await this.fetchAVWX(`/taf/${icao}`);
            
            const result = {
                icao: icao,
                raw: data.raw,
                time: data.time?.dt,
                forecast: data.forecast?.map(f => ({
                    start: f.start_time?.dt,
                    end: f.end_time?.dt,
                    type: f.type,
                    wind: this.parseWind(f),
                    visibility: f.visibility?.repr,
                    clouds: this.parseClouds(f.clouds),
                    flightRules: f.flight_rules
                })) || []
            };

            this.setCache(cacheKey, result);
            return result;
        } catch (err) {
            console.error(`[AviationData] TAF fetch failed for ${icao}:`, err);
            return null;
        }
    }

    // ========== NOTAMs ==========

    async getNOTAMs(icao) {
        icao = icao.toUpperCase();
        const cacheKey = `notam_${icao}`;
        
        const cached = this.getFromCache(cacheKey, this.cacheExpiry.notam);
        if (cached) return cached;

        try {
            // FAA NOTAM API
            const response = await fetch(
                `${this.endpoints.faa}/notams?icaoLocation=${icao}`,
                {
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            const result = {
                icao: icao,
                count: data.items?.length || 0,
                notams: (data.items || []).map(n => ({
                    id: n.id,
                    type: n.type,
                    category: this.categorizeNOTAM(n),
                    text: n.text,
                    effective: n.effectiveStart,
                    expires: n.effectiveEnd,
                    priority: this.getNOTAMPriority(n)
                })).sort((a, b) => b.priority - a.priority)
            };

            this.setCache(cacheKey, result);
            return result;
        } catch (err) {
            console.error(`[AviationData] NOTAM fetch failed for ${icao}:`, err);
            return { icao, count: 0, notams: [], error: err.message };
        }
    }

    categorizeNOTAM(notam) {
        const text = (notam.text || '').toUpperCase();
        if (text.includes('RWY') || text.includes('RUNWAY')) return 'RUNWAY';
        if (text.includes('TWY') || text.includes('TAXIWAY')) return 'TAXIWAY';
        if (text.includes('NAV') || text.includes('VOR') || text.includes('ILS')) return 'NAVAID';
        if (text.includes('OBST') || text.includes('CRANE')) return 'OBSTACLE';
        if (text.includes('AD') || text.includes('AIRPORT')) return 'AIRPORT';
        return 'OTHER';
    }

    getNOTAMPriority(notam) {
        const text = (notam.text || '').toUpperCase();
        if (text.includes('CLSD') || text.includes('CLOSED')) return 5;
        if (text.includes('UNSERVICEABLE') || text.includes('U/S')) return 4;
        if (text.includes('CAUTION') || text.includes('WARNING')) return 3;
        if (text.includes('BIRDS') || text.includes('WILDLIFE')) return 2;
        return 1;
    }

    // ========== Airport & Navaid Data ==========

    async getAirportInfo(icao) {
        icao = icao.toUpperCase();
        const cacheKey = `airport_${icao}`;
        
        const cached = this.getFromCache(cacheKey, this.cacheExpiry.airport);
        if (cached) return cached;

        try {
            const data = await this.fetchAVWX(`/station/${icao}`);
            
            const result = {
                icao: icao,
                iata: data.iata,
                name: data.name,
                city: data.city,
                country: data.country,
                elevation: data.elevation_ft,
                latitude: data.latitude,
                longitude: data.longitude,
                runways: data.runways?.map(r => ({
                    ident: `${r.ident1}/${r.ident2}`,
                    length: r.length_ft,
                    width: r.width_ft,
                    surface: r.surface
                })) || []
            };

            this.setCache(cacheKey, result);
            return result;
        } catch (err) {
            console.error(`[AviationData] Airport info failed for ${icao}:`, err);
            return null;
        }
    }

    async getILSFrequencies(icao) {
        icao = icao.toUpperCase();
        
        // This would typically come from a navaid database
        // For now, using airport info + common ILS data
        const airport = await this.getAirportInfo(icao);
        if (!airport) return null;

        // Placeholder - in production, fetch from navaid DB
        return {
            icao: icao,
            approaches: airport.runways?.map(r => ({
                runway: r.ident,
                type: 'ILS',
                frequency: null, // Would come from navaid DB
                course: null,
                glideslope: 3.0
            })) || [],
            note: 'Frequencies require navaid database subscription'
        };
    }

    // ========== Utility Methods ==========

    async fetchAVWX(endpoint) {
        const headers = {
            'Accept': 'application/json'
        };
        
        if (this.apiKeys.avwx) {
            headers['Authorization'] = `Token ${this.apiKeys.avwx}`;
        }

        const response = await fetch(`${this.endpoints.avwx}${endpoint}`, { headers });
        
        if (!response.ok) {
            throw new Error(`AVWX API error: ${response.status}`);
        }
        
        return response.json();
    }

    async getFallbackMETAR(icao) {
        // Fallback to CheckWX or cached data
        console.log(`[AviationData] Using fallback for ${icao}`);
        return {
            icao: icao,
            raw: 'DATA UNAVAILABLE',
            error: 'Unable to fetch current METAR'
        };
    }

    // ========== Cache Management ==========

    getFromCache(key, maxAge) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() - item.timestamp > maxAge) {
            this.cache.delete(key);
            return null;
        }
        
        return item.data;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    // ========== API Key Management ==========

    setAPIKey(service, key) {
        if (this.apiKeys.hasOwnProperty(service)) {
            this.apiKeys[service] = key;
        }
    }
}

// ========== Widget Integration ==========

class AviationDataWidget {
    constructor($api) {
        this.$api = $api;
        this.service = new AviationDataService();
        this.currentAirport = null;
        this.nearestAirport = null;
    }

    html_created() {
        this.loadAPIKeys();
        this.render();
        console.log('[AviationData Widget] Initialized');
    }

    async loop_1hz() {
        // Update nearest airport based on GPS position
        await this.updateNearestAirport();
    }

    exit() {
        this.service.clearCache();
    }

    loadAPIKeys() {
        const avwxKey = this.$api.datastore.get('avwx_api_key');
        if (avwxKey) {
            this.service.setAPIKey('avwx', avwxKey);
        }
    }

    async updateNearestAirport() {
        try {
            const lat = await this.$api.variables.get('GPS POSITION LAT');
            const lon = await this.$api.variables.get('GPS POSITION LON');
            
            // Would calculate nearest airport from database
            // For now, just log position
            console.log(`[AviationData] Position: ${lat}, ${lon}`);
        } catch (err) {
            // Ignore - sim might not be running
        }
    }

    render() {
        const container = document.getElementById('aviation-data-container');
        if (!container) return;

        container.innerHTML = `
            <div class="aviation-panel">
                <div class="aviation-header">
                    <span>Aviation Data</span>
                    <input type="text" id="icao-input" placeholder="ICAO" maxlength="4" />
                    <button id="fetch-btn">Get Data</button>
                </div>
                <div class="aviation-tabs">
                    <button class="tab active" data-tab="metar">METAR</button>
                    <button class="tab" data-tab="taf">TAF</button>
                    <button class="tab" data-tab="notam">NOTAMs</button>
                    <button class="tab" data-tab="airport">Airport</button>
                </div>
                <div class="aviation-content" id="aviation-content">
                    <p class="placeholder">Enter an ICAO code above</p>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('fetch-btn')?.addEventListener('click', () => {
            const icao = document.getElementById('icao-input')?.value;
            if (icao?.length === 4) {
                this.fetchData(icao);
            }
        });

        document.querySelectorAll('.aviation-tabs .tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.showTab(e.target.dataset.tab);
            });
        });
    }

    async fetchData(icao) {
        this.currentAirport = icao;
        const content = document.getElementById('aviation-content');
        content.innerHTML = '<p class="loading">Loading...</p>';

        try {
            const [metar, taf, notams, airport] = await Promise.all([
                this.service.getMETAR(icao),
                this.service.getTAF(icao),
                this.service.getNOTAMs(icao),
                this.service.getAirportInfo(icao)
            ]);

            this.data = { metar, taf, notams, airport };
            this.showTab('metar');
        } catch (err) {
            content.innerHTML = `<p class="error">Error: ${err.message}</p>`;
        }
    }

    showTab(tab) {
        const content = document.getElementById('aviation-content');
        if (!this.data) {
            content.innerHTML = '<p class="placeholder">No data loaded</p>';
            return;
        }

        switch (tab) {
            case 'metar':
                content.innerHTML = this.renderMETAR(this.data.metar);
                break;
            case 'taf':
                content.innerHTML = this.renderTAF(this.data.taf);
                break;
            case 'notam':
                content.innerHTML = this.renderNOTAMs(this.data.notams);
                break;
            case 'airport':
                content.innerHTML = this.renderAirport(this.data.airport);
                break;
        }
    }

    renderMETAR(metar) {
        if (!metar || metar.error) {
            return `<p class="error">${metar?.error || 'No METAR available'}</p>`;
        }

        return `
            <div class="metar-display">
                <div class="metar-raw">${metar.raw}</div>
                <div class="metar-decoded">
                    <div class="metar-item">
                        <label>Flight Rules</label>
                        <span class="flight-rules ${metar.flightRules?.toLowerCase()}">${metar.flightRules || 'N/A'}</span>
                    </div>
                    ${metar.wind ? `
                    <div class="metar-item">
                        <label>Wind</label>
                        <span>${metar.wind.direction}° @ ${metar.wind.speed}kt${metar.wind.gust ? ` G${metar.wind.gust}` : ''}</span>
                    </div>` : ''}
                    <div class="metar-item">
                        <label>Visibility</label>
                        <span>${metar.visibility || 'N/A'}</span>
                    </div>
                    <div class="metar-item">
                        <label>Temp/Dew</label>
                        <span>${metar.temperature || '--'}°C / ${metar.dewpoint || '--'}°C</span>
                    </div>
                    <div class="metar-item">
                        <label>Altimeter</label>
                        <span>${metar.altimeter || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderTAF(taf) {
        if (!taf) return '<p class="error">No TAF available</p>';
        
        return `
            <div class="taf-display">
                <div class="taf-raw">${taf.raw}</div>
            </div>
        `;
    }

    renderNOTAMs(notams) {
        if (!notams || notams.count === 0) {
            return '<p class="info">No active NOTAMs</p>';
        }

        return `
            <div class="notam-list">
                <div class="notam-header">${notams.count} Active NOTAMs</div>
                ${notams.notams.slice(0, 10).map(n => `
                    <div class="notam-item priority-${n.priority}">
                        <span class="notam-category">${n.category}</span>
                        <p class="notam-text">${n.text?.substring(0, 200)}${n.text?.length > 200 ? '...' : ''}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderAirport(airport) {
        if (!airport) return '<p class="error">Airport info unavailable</p>';

        return `
            <div class="airport-info">
                <h3>${airport.name}</h3>
                <p>${airport.city}, ${airport.country}</p>
                <div class="airport-details">
                    <div><label>Elevation:</label> ${airport.elevation} ft</div>
                    <div><label>Coordinates:</label> ${airport.latitude?.toFixed(4)}, ${airport.longitude?.toFixed(4)}</div>
                </div>
                ${airport.runways?.length ? `
                <div class="runway-list">
                    <h4>Runways</h4>
                    ${airport.runways.map(r => `
                        <div class="runway">${r.ident} - ${r.length}ft x ${r.width}ft (${r.surface})</div>
                    `).join('')}
                </div>` : ''}
            </div>
        `;
    }
}

// Global instance
let aviationWidget = null;

// SimWidget hooks
function html_created($api) {
    aviationWidget = new AviationDataWidget($api);
    aviationWidget.html_created();
}

function loop_1hz($api) {
    if (aviationWidget) aviationWidget.loop_1hz();
}

function exit($api) {
    if (aviationWidget) aviationWidget.exit();
}

// Export
if (typeof module !== 'undefined') {
    module.exports = { AviationDataService, AviationDataWidget, html_created, loop_1hz, exit };
}
