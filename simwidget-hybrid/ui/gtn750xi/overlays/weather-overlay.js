/**
 * GTN750 Weather Overlay v2.0 — NEXRAD, METAR, TAF, Satellite IR, Icing
 * Uses RainViewer API for radar/satellite and AVWX for METAR/TAF data
 */

class WeatherOverlay {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.enabled = false;

        // Layer states
        this.layers = {
            nexrad: false,
            simRadar: false,
            metar: false,
            taf: false,
            winds: false,
            lightning: false,
            satellite: false
        };

        // Performance optimization: Layer caching
        this.metarCache = null;
        this.tafCache = null;
        this.metarCacheValid = false;
        this.tafCacheValid = false;
        this.lastCacheState = { range: 0, lat: 0, lon: 0, width: 0, height: 0, metarCount: 0, tafCount: 0 };

        // Sim weather data (updated from widget)
        this.simWeather = {
            precipState: 0,
            visibility: 10000,
            windDirection: 0,
            windSpeed: 0,
            ambientTemp: 15
        };

        // Radar sweep animation
        this.radarSweepAngle = 0;
        this.lastSweepTime = 0;

        // Cached sim radar cells — prevents flickering (regenerated on weather change)
        this._simRadarCells = null;
        this._simRadarScatter = null;
        this._lastSimWeatherKey = '';

        // Radar data
        this.radarTiles = [];
        this.radarTimestamp = null;
        this.radarAge = 0;
        this.radarAnimating = false;
        this.radarFrames = [];
        this.currentFrame = 0;
        this.radarHost = '';
        this.radarTileCache = new Map();
        this.radarTileSize = 256;

        // Satellite IR data
        this.satelliteFrames = [];
        this.satelliteHost = '';

        // METAR data
        this.metarData = new Map();
        this.lastMetarFetch = 0;
        this.metarFetchInterval = 300000; // 5 minutes

        // METAR popup state
        this._metarPopup = null; // { station, x, y, parsed }

        // TAF data
        this.tafData = new Map();
        this.lastTafFetch = 0;
        this.tafFetchInterval = 600000; // 10 minutes

        // Wind data
        this.windData = [];

        // Lightning data
        this.lightningStrikes = [];

        // API endpoints
        this.rainViewerApi = 'https://api.rainviewer.com/public/weather-maps.json';

        // Color scales for radar
        this.radarColors = [
            { dbz: 5, color: '#04e904' },   // Light green
            { dbz: 10, color: '#01c501' },  // Green
            { dbz: 15, color: '#fef700' },  // Yellow
            { dbz: 20, color: '#e5bc00' },  // Gold
            { dbz: 25, color: '#fd9500' },  // Orange
            { dbz: 30, color: '#fd0000' },  // Red
            { dbz: 35, color: '#d40000' },  // Dark red
            { dbz: 40, color: '#bc0000' },  // Maroon
            { dbz: 45, color: '#f800fd' },  // Magenta
            { dbz: 50, color: '#9854c6' },  // Purple
            { dbz: 55, color: '#fdfdfd' }   // White
        ];

        // METAR colors for flight category
        this.metarColors = {
            VFR: '#00ff00',
            MVFR: '#0099ff',
            IFR: '#ff0000',
            LIFR: '#ff00ff'
        };

        // Weather phenomena icons
        this.wxPhenomena = {
            'RA': { icon: '\u{1F327}', desc: 'Rain' },
            'SN': { icon: '\u2744', desc: 'Snow' },
            'TS': { icon: '\u26C8', desc: 'Thunderstorm' },
            'FG': { icon: '\u{1F32B}', desc: 'Fog' },
            'BR': { icon: '\u{1F301}', desc: 'Mist' },
            'HZ': { icon: '\u{1F32B}', desc: 'Haze' },
            'DZ': { icon: '\u{1F326}', desc: 'Drizzle' },
            'SH': { icon: '\u{1F326}', desc: 'Showers' },
            'GR': { icon: '\u{1F328}', desc: 'Hail' },
            'FZ': { icon: '\u{1F976}', desc: 'Freezing' }
        };
    }

    /**
     * Parse raw METAR text into structured data
     */
    parseMetar(raw) {
        if (!raw) return null;

        const result = {
            raw,
            station: null,
            time: null,
            wind: { direction: null, speed: null, gust: null, variable: null },
            visibility: null,
            weather: [],
            clouds: [],
            temp: null,
            dewpoint: null,
            altimeter: null,
            remarks: null
        };

        try {
            const parts = raw.trim().split(/\s+/);
            let i = 0;

            if (/^[A-Z]{4}$/.test(parts[i])) {
                result.station = parts[i++];
            }

            if (/^\d{6}Z$/i.test(parts[i])) {
                result.time = parts[i++];
            }

            if (/^\d{3}\d{2}(G\d{2,3})?(KT|MPS)$/.test(parts[i]) || /^VRB\d{2}(KT|MPS)$/.test(parts[i])) {
                const wind = parts[i++];
                if (wind.startsWith('VRB')) {
                    result.wind.variable = true;
                    result.wind.speed = parseInt(wind.slice(3, 5));
                } else {
                    result.wind.direction = parseInt(wind.slice(0, 3));
                    result.wind.speed = parseInt(wind.slice(3, 5));
                    const gustMatch = wind.match(/G(\d{2,3})/);
                    if (gustMatch) {
                        result.wind.gust = parseInt(gustMatch[1]);
                    }
                }
                if (/^\d{3}V\d{3}$/.test(parts[i])) {
                    result.wind.variableFrom = parseInt(parts[i].slice(0, 3));
                    result.wind.variableTo = parseInt(parts[i].slice(4, 7));
                    i++;
                }
            }

            while (i < parts.length) {
                if (/^P?\d+SM$/.test(parts[i]) || /^\d\/\d+SM$/.test(parts[i])) {
                    result.visibility = parts[i++].replace('SM', '');
                    break;
                }
                if (/^\d{4}$/.test(parts[i]) && parseInt(parts[i]) <= 9999) {
                    result.visibility = parseInt(parts[i++]) + 'm';
                    break;
                }
                if (/^\d$/.test(parts[i]) && /^\d\/\d+SM$/.test(parts[i + 1])) {
                    result.visibility = parts[i] + ' ' + parts[i + 1].replace('SM', '');
                    i += 2;
                    break;
                }
                break;
            }

            while (i < parts.length) {
                const part = parts[i];
                if (/^[-+]?(VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP)?(BR|FG|FU|VA|DU|SA|HZ|PY)?(PO|SQ|FC|SS|DS)?$/.test(part) && part.length >= 2) {
                    result.weather.push({
                        raw: part,
                        intensity: part.startsWith('+') ? 'heavy' : part.startsWith('-') ? 'light' : 'moderate'
                    });
                    i++;
                    continue;
                }
                if (/^(FEW|SCT|BKN|OVC|VV)\d{3}(CB|TCU)?$/.test(part) || /^(CLR|SKC|NSC|NCD)$/.test(part)) {
                    if (part === 'CLR' || part === 'SKC' || part === 'NSC' || part === 'NCD') {
                        result.clouds.push({ type: part, altitude: null });
                    } else {
                        result.clouds.push({
                            type: part.slice(0, 3),
                            altitude: parseInt(part.slice(3, 6)) * 100,
                            modifier: part.slice(6) || null
                        });
                    }
                    i++;
                    continue;
                }
                if (/^M?\d{2}\/M?\d{2}$/.test(part)) {
                    const [temp, dew] = part.split('/');
                    result.temp = temp.startsWith('M') ? -parseInt(temp.slice(1)) : parseInt(temp);
                    result.dewpoint = dew.startsWith('M') ? -parseInt(dew.slice(1)) : parseInt(dew);
                    i++;
                    continue;
                }
                if (/^A\d{4}$/.test(part)) {
                    result.altimeter = (parseInt(part.slice(1)) / 100).toFixed(2);
                    i++;
                    continue;
                }
                if (/^Q\d{4}$/.test(part)) {
                    result.altimeter = parseInt(part.slice(1)) + ' hPa';
                    i++;
                    continue;
                }
                if (part === 'RMK') {
                    result.remarks = parts.slice(i + 1).join(' ');
                    break;
                }
                i++;
            }
            result.category = this.determineFlightCategory(result);
        } catch (e) {
            console.warn('[GTN750] METAR parse error:', e);
        }
        return result;
    }

    /**
     * Determine flight category from parsed METAR
     */
    determineFlightCategory(metar) {
        let ceiling = Infinity;
        for (const cloud of metar.clouds || []) {
            if ((cloud.type === 'BKN' || cloud.type === 'OVC' || cloud.type === 'VV') && cloud.altitude) {
                ceiling = Math.min(ceiling, cloud.altitude);
            }
        }

        let visMiles = 10;
        if (metar.visibility) {
            const vis = metar.visibility.toString();
            if (vis.includes('m')) {
                visMiles = parseInt(vis) / 1609;
            } else if (vis.includes('/')) {
                const [num, den] = vis.replace('P', '').split('/').map(Number);
                visMiles = num / den;
            } else if (vis.startsWith('P')) {
                visMiles = parseInt(vis.slice(1));
            } else {
                visMiles = parseFloat(vis.split(' ').reduce((a, b) => {
                    if (b.includes('/')) {
                        const [n, d] = b.split('/').map(Number);
                        return a + n / d;
                    }
                    return a + parseFloat(b);
                }, 0));
            }
        }

        if (ceiling < 500 || visMiles < 1) return 'LIFR';
        if (ceiling < 1000 || visMiles < 3) return 'IFR';
        if (ceiling <= 3000 || visMiles <= 5) return 'MVFR';
        return 'VFR';
    }

    /**
     * Format parsed METAR for display
     */
    formatMetarDisplay(parsed) {
        if (!parsed) return 'No data';

        const lines = [];
        if (parsed.wind.speed !== null) {
            let windStr = parsed.wind.variable ? 'VRB' : String(parsed.wind.direction).padStart(3, '0') + '\u00B0';
            windStr += ` ${parsed.wind.speed}kt`;
            if (parsed.wind.gust) windStr += ` G${parsed.wind.gust}`;
            lines.push(`Wind: ${windStr}`);
        }
        if (parsed.visibility) {
            lines.push(`Vis: ${parsed.visibility} SM`);
        }
        if (parsed.weather.length > 0) {
            lines.push(`Wx: ${parsed.weather.map(w => w.raw).join(', ')}`);
        }
        if (parsed.clouds.length > 0) {
            const cloudStr = parsed.clouds.map(c => {
                if (!c.altitude) return c.type;
                return `${c.type} ${c.altitude}ft${c.modifier ? ' ' + c.modifier : ''}`;
            }).join(', ');
            lines.push(`Sky: ${cloudStr}`);
        }
        if (parsed.temp !== null) {
            lines.push(`Temp: ${parsed.temp}\u00B0C / Dew: ${parsed.dewpoint}\u00B0C`);
        }
        if (parsed.altimeter) {
            lines.push(`Altim: ${parsed.altimeter}`);
        }
        return lines.join('\n');
    }

    /**
     * Enable/disable weather overlay
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Invalidate cached weather layers (call when data changes)
     */
    invalidateCache() {
        this.metarCacheValid = false;
        this.tafCacheValid = false;
    }

    /**
     * Check if METAR cache needs regeneration
     */
    needsMetarCacheRegen(lat, lon, range, width, height) {
        const state = this.lastCacheState;
        return !this.metarCacheValid ||
               Math.abs(state.lat - lat) > 0.1 ||
               Math.abs(state.lon - lon) > 0.1 ||
               Math.abs(state.range - range) > 10 ||
               state.width !== width ||
               state.height !== height ||
               state.metarCount !== this.metarData.size;
    }

    /**
     * Check if TAF cache needs regeneration
     */
    needsTafCacheRegen(lat, lon, range, width, height) {
        const state = this.lastCacheState;
        return !this.tafCacheValid ||
               Math.abs(state.lat - lat) > 0.1 ||
               Math.abs(state.lon - lon) > 0.1 ||
               Math.abs(state.range - range) > 10 ||
               state.width !== width ||
               state.height !== height ||
               state.tafCount !== this.tafData.size;
    }

    /**
     * Toggle individual weather layer
     */
    toggleLayer(layer) {
        if (this.layers.hasOwnProperty(layer)) {
            this.layers[layer] = !this.layers[layer];
            return this.layers[layer];
        }
        return false;
    }

    /**
     * Set layer state
     */
    setLayer(layer, enabled) {
        if (this.layers.hasOwnProperty(layer)) {
            this.layers[layer] = enabled;
        }
    }

    /**
     * Render weather overlays on map canvas
     */
    render(ctx, aircraft, mapSettings) {
        if (!this.enabled) return;

        const { latitude, longitude } = aircraft;

        if (this.layers.simRadar) {
            this.renderSimWeatherRadar(ctx, latitude, longitude, mapSettings);
        }
        if (this.layers.nexrad) {
            this.renderNexrad(ctx, latitude, longitude, mapSettings);
        }
        if (this.layers.satellite) {
            this.renderSatellite(ctx, latitude, longitude, mapSettings);
        }
        if (this.layers.metar) {
            this.renderMetarDotsReal(ctx, latitude, longitude, mapSettings);
        }
        if (this.layers.taf) {
            this.renderTaf(ctx, latitude, longitude, mapSettings);
        }
        if (this.layers.winds) {
            this.renderWinds(ctx, latitude, longitude, mapSettings);
        }
        if (this.layers.lightning) {
            this.renderLightning(ctx, latitude, longitude, mapSettings);
        }
    }

    /**
     * Update sim weather data from widget
     */
    updateSimWeather(data) {
        if (data.precipState !== undefined) this.simWeather.precipState = data.precipState;
        if (data.visibility !== undefined) this.simWeather.visibility = data.visibility;
        if (data.windDirection !== undefined) this.simWeather.windDirection = data.windDirection;
        if (data.windSpeed !== undefined) this.simWeather.windSpeed = data.windSpeed;
        if (data.ambientTemp !== undefined) this.simWeather.ambientTemp = data.ambientTemp;

        // Regenerate cached cells if weather changed
        const key = `${this.simWeather.precipState}|${Math.round(this.simWeather.visibility / 500)}|${Math.round(this.simWeather.windDirection / 5)}|${Math.round(this.simWeather.windSpeed)}`;
        if (key !== this._lastSimWeatherKey) {
            this._lastSimWeatherKey = key;
            this._simRadarCells = null;
            this._simRadarScatter = null;
        }
    }

    /**
     * Generate cached sim radar cells (called once per weather change, not every frame)
     */
    _generateSimRadarCells(cx, cy, maxRadius, intensity, coverage, windRad) {
        const weatherRadius = maxRadius * coverage;
        const numCells = Math.floor(20 + intensity);

        // Seeded pseudo-random for stability
        let seed = 12345;
        const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };

        const cells = [];
        for (let i = 0; i < numCells; i++) {
            const spread = (rand() - 0.5) * Math.PI;
            const angle = windRad + spread;
            const dist = rand() * weatherRadius * 0.9;
            const x = cx + Math.sin(angle) * dist;
            const y = cy - Math.cos(angle) * dist;
            const cellSize = (3 + rand() * 8) * (intensity / 30);
            const cellIntensity = intensity * (0.5 + rand() * 0.5);
            cells.push({ x, y, size: cellSize, color: this.getRadarColor(cellIntensity) });
        }

        const scatter = [];
        for (let i = 0; i < Math.floor(numCells / 2); i++) {
            const angle = rand() * Math.PI * 2;
            const dist = rand() * weatherRadius;
            const x = cx + Math.sin(angle) * dist;
            const y = cy - Math.cos(angle) * dist;
            const cellSize = 2 + rand() * 4;
            const cellIntensity = intensity * 0.3 * rand();
            scatter.push({ x, y, size: cellSize, color: this.getRadarColor(cellIntensity) });
        }

        return { cells, scatter };
    }

    /**
     * Render sim weather as radar visualization — uses cached cells to prevent flickering
     */
    renderSimWeatherRadar(ctx, lat, lon, mapSettings) {
        const { range, width, height } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const maxRadius = Math.min(width, height) / 2;

        const precip = this.simWeather.precipState || 0;
        const vis = this.simWeather.visibility || 10000;
        const wind = this.simWeather.windSpeed || 0;

        // Update sweep animation
        const now = Date.now();
        if (now - this.lastSweepTime > 50) {
            this.radarSweepAngle = (this.radarSweepAngle + 3) % 360;
            this.lastSweepTime = now;
        }

        ctx.save();

        // Determine weather intensity
        let intensity = 0;
        let weatherType = 'none';
        if (precip & 4) {
            weatherType = 'snow';
            intensity = 30 + (wind > 15 ? 15 : 0);
        } else if (precip & 2) {
            weatherType = 'rain';
            intensity = wind > 25 ? 50 : (wind > 15 ? 40 : 25);
        }
        if (vis < 1000) intensity = Math.max(intensity, 20);
        else if (vis < 3000) intensity = Math.max(intensity, 10);

        // Render cached cells if there's weather
        if (intensity > 0) {
            const coverage = Math.max(0.3, Math.min(1.0, (10000 - vis) / 8000));
            const windRad = (this.simWeather.windDirection || 0) * Math.PI / 180;

            // Generate cells only when weather changes (not every frame)
            if (!this._simRadarCells) {
                const generated = this._generateSimRadarCells(cx, cy, maxRadius, intensity, coverage, windRad);
                this._simRadarCells = generated.cells;
                this._simRadarScatter = generated.scatter;
            }

            ctx.globalAlpha = 0.6;
            for (const cell of this._simRadarCells) {
                ctx.fillStyle = cell.color;
                ctx.beginPath();
                ctx.arc(cell.x, cell.y, cell.size, 0, Math.PI * 2);
                ctx.fill();
            }
            for (const cell of this._simRadarScatter) {
                ctx.fillStyle = cell.color;
                ctx.beginPath();
                ctx.arc(cell.x, cell.y, cell.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        }

        // Draw radar sweep line with glow
        const sweepRad = this.radarSweepAngle * Math.PI / 180;
        ctx.save();
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 6;
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(sweepRad) * maxRadius, cy - Math.cos(sweepRad) * maxRadius);
        ctx.stroke();
        ctx.restore();

        // Draw sweep fade trail with gradient
        const trailArc = 0.6; // radians of trail
        const gradient = ctx.createConicGradient(-Math.PI / 2 + sweepRad - trailArc, cx, cy);
        const startFrac = 0;
        const endFrac = trailArc / (Math.PI * 2);
        gradient.addColorStop(startFrac, 'rgba(0, 255, 0, 0)');
        gradient.addColorStop(endFrac * 0.5, 'rgba(0, 255, 0, 0.08)');
        gradient.addColorStop(endFrac, 'rgba(0, 255, 0, 0.2)');
        // Fill the rest transparent
        gradient.addColorStop(endFrac + 0.001, 'rgba(0, 255, 0, 0)');
        gradient.addColorStop(1.0, 'rgba(0, 255, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw range rings (proportional to current range)
        ctx.strokeStyle = '#1a3a1a';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        [0.25, 0.5, 0.75, 1].forEach(frac => {
            ctx.beginPath();
            ctx.arc(cx, cy, maxRadius * frac, 0, Math.PI * 2);
            ctx.stroke();
        });
        ctx.setLineDash([]);

        // Draw weather type label
        if (intensity > 0) {
            ctx.font = '10px Consolas, monospace';
            ctx.fillStyle = this.getRadarColor(intensity);
            ctx.textAlign = 'left';
            ctx.fillText(weatherType.toUpperCase(), 10, 20);
            ctx.fillStyle = '#888';
            ctx.fillText('SIM WX', 10, 32);
        } else {
            ctx.font = '10px Consolas, monospace';
            ctx.fillStyle = '#00aa00';
            ctx.textAlign = 'left';
            ctx.fillText('CLEAR', 10, 20);
            ctx.fillStyle = '#888';
            ctx.fillText('SIM WX', 10, 32);
        }

        ctx.restore();
    }

    /**
     * Render NEXRAD radar overlay
     */
    renderNexrad(ctx, lat, lon, mapSettings) {
        const { range, width, height, orientation } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;

        ctx.save();
        if (orientation !== 'north') {
            ctx.translate(cx, cy);
            ctx.rotate(-mapSettings.heading * Math.PI / 180);
            ctx.translate(-cx, -cy);
        }

        if (this.radarHost && this.radarFrames.length > 0) {
            this.renderRadarTiles(ctx, lat, lon, mapSettings);
        } else {
            this.renderSimulatedRadar(ctx, lat, lon, mapSettings);
        }

        ctx.restore();
    }

    /**
     * Render real radar tiles from RainViewer (with viewport culling)
     */
    renderRadarTiles(ctx, lat, lon, mapSettings) {
        const { range, width, height } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;

        const degRange = range / 60;
        const zoom = Math.max(3, Math.min(10, Math.floor(8 - Math.log2(degRange))));

        const frame = this.radarFrames[this.currentFrame] || this.radarFrames[this.radarFrames.length - 1];
        if (!frame) return;

        const centerTile = this.latLonToTile(lat, lon, zoom);
        const tilesNeeded = Math.ceil(range / 30) + 1;
        const nmPerTile = 360 / Math.pow(2, zoom) * 60 * Math.cos(lat * Math.PI / 180);
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const tilePixelSize = nmPerTile * pixelsPerNm;

        ctx.globalAlpha = 0.6;

        // Progressive loading: prioritize tiles by distance from center
        const tilePriorities = [];
        for (let dx = -tilesNeeded; dx <= tilesNeeded; dx++) {
            for (let dy = -tilesNeeded; dy <= tilesNeeded; dy++) {
                const tileX = centerTile.x + dx;
                const tileY = centerTile.y + dy;

                const tileLat = this.tileToLat(tileY, zoom);
                const tileLon = this.tileToLon(tileX, zoom);
                const tileLat2 = this.tileToLat(tileY + 1, zoom);
                const tileLon2 = this.tileToLon(tileX + 1, zoom);

                const tileCenterLat = (tileLat + tileLat2) / 2;
                const tileCenterLon = (tileLon + tileLon2) / 2;

                const dist = this.core.calculateDistance(lat, lon, tileCenterLat, tileCenterLon);

                // Aggressive viewport culling: skip tiles outside 1.2x range (was 1.5x)
                if (dist > range * 1.2) continue;

                const brg = this.core.calculateBearing(lat, lon, tileCenterLat, tileCenterLon);
                const angle = this.core.toRad(brg);
                const screenX = cx + Math.sin(angle) * dist * pixelsPerNm;
                const screenY = cy - Math.cos(angle) * dist * pixelsPerNm;

                // Viewport culling: skip tiles outside visible area (with margin)
                const margin = tilePixelSize * 0.5;
                if (screenX + tilePixelSize + margin < 0 || screenX - tilePixelSize - margin > width ||
                    screenY + tilePixelSize + margin < 0 || screenY - tilePixelSize - margin > height) {
                    continue;
                }

                tilePriorities.push({ tileX, tileY, dist, screenX, screenY });
            }
        }

        // Sort by distance (closest first) for progressive loading
        tilePriorities.sort((a, b) => a.dist - b.dist);

        // Render sorted tiles
        tilePriorities.forEach(({ tileX, tileY, screenX, screenY }) => {
            const tilePath = `${frame.path}/${this.radarTileSize}/${zoom}/${tileX}/${tileY}/2/1_1.png`;
            const tileUrl = `${this.radarHost}${tilePath}`;
            this.loadAndDrawTile(ctx, tileUrl, screenX - tilePixelSize / 2, screenY - tilePixelSize / 2, tilePixelSize);
        });

        ctx.globalAlpha = 1.0;
    }

    /**
     * Render satellite IR tiles
     */
    renderSatellite(ctx, lat, lon, mapSettings) {
        if (!this.satelliteHost || this.satelliteFrames.length === 0) return;

        const { range, width, height, orientation } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;

        ctx.save();
        if (orientation !== 'north') {
            ctx.translate(cx, cy);
            ctx.rotate(-mapSettings.heading * Math.PI / 180);
            ctx.translate(-cx, -cy);
        }

        const degRange = range / 60;
        const zoom = Math.max(3, Math.min(8, Math.floor(7 - Math.log2(degRange))));

        const frame = this.satelliteFrames[this.satelliteFrames.length - 1];
        if (!frame) { ctx.restore(); return; }

        const centerTile = this.latLonToTile(lat, lon, zoom);
        const tilesNeeded = Math.ceil(range / 30) + 1;
        const nmPerTile = 360 / Math.pow(2, zoom) * 60 * Math.cos(lat * Math.PI / 180);
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const tilePixelSize = nmPerTile * pixelsPerNm;

        ctx.globalAlpha = 0.45;

        for (let dx = -tilesNeeded; dx <= tilesNeeded; dx++) {
            for (let dy = -tilesNeeded; dy <= tilesNeeded; dy++) {
                const tileX = centerTile.x + dx;
                const tileY = centerTile.y + dy;

                const tileLat = this.tileToLat(tileY, zoom);
                const tileLon = this.tileToLon(tileX, zoom);
                const tileLat2 = this.tileToLat(tileY + 1, zoom);
                const tileLon2 = this.tileToLon(tileX + 1, zoom);

                const tileCenterLat = (tileLat + tileLat2) / 2;
                const tileCenterLon = (tileLon + tileLon2) / 2;

                const dist = this.core.calculateDistance(lat, lon, tileCenterLat, tileCenterLon);
                if (dist > range * 1.5) continue;

                const brg = this.core.calculateBearing(lat, lon, tileCenterLat, tileCenterLon);
                const angle = this.core.toRad(brg);
                const screenX = cx + Math.sin(angle) * dist * pixelsPerNm;
                const screenY = cy - Math.cos(angle) * dist * pixelsPerNm;

                const tilePath = `${frame.path}/${this.radarTileSize}/${zoom}/${tileX}/${tileY}/0/0_0.png`;
                const tileUrl = `${this.satelliteHost}${tilePath}`;

                this.loadAndDrawTile(ctx, tileUrl, screenX - tilePixelSize / 2, screenY - tilePixelSize / 2, tilePixelSize);
            }
        }

        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    /**
     * Load radar/satellite tile and draw when ready
     */
    loadAndDrawTile(ctx, url, x, y, size) {
        let img = this.radarTileCache.get(url);

        if (!img) {
            img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = url;
            this.radarTileCache.set(url, img);

            if (this.radarTileCache.size > 150) {
                const firstKey = this.radarTileCache.keys().next().value;
                this.radarTileCache.delete(firstKey);
            }
        }

        if (img.complete && img.naturalWidth > 0) {
            try {
                ctx.drawImage(img, x, y, size, size);
            } catch (e) {
                // Tile may have failed to load
            }
        }
    }

    /**
     * Convert lat/lon to tile coordinates
     */
    latLonToTile(lat, lon, zoom) {
        const n = Math.pow(2, zoom);
        const x = Math.floor((lon + 180) / 360 * n);
        const latRad = lat * Math.PI / 180;
        const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
        return { x, y };
    }

    tileToLat(y, zoom) {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
        return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }

    tileToLon(x, zoom) {
        return x / Math.pow(2, zoom) * 360 - 180;
    }

    /**
     * Render simulated radar (fallback)
     */
    renderSimulatedRadar(ctx, lat, lon, mapSettings) {
        const { range, width, height } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;

        const radarCells = this.generateSimulatedRadar(lat, lon, range);

        ctx.globalAlpha = 0.5;
        radarCells.forEach(cell => {
            const x = cx + cell.offsetX * pixelsPerNm;
            const y = cy - cell.offsetY * pixelsPerNm;
            const cellSize = cell.size * pixelsPerNm;
            ctx.fillStyle = this.getRadarColor(cell.intensity);
            ctx.fillRect(x - cellSize / 2, y - cellSize / 2, cellSize, cellSize);
        });
        ctx.globalAlpha = 1.0;
    }

    /**
     * Generate simulated radar data
     */
    generateSimulatedRadar(centerLat, centerLon, range) {
        const cells = [];
        const numCells = 20;
        const seed = Math.sin(centerLat * 10) * Math.cos(centerLon * 10);

        for (let i = 0; i < numCells; i++) {
            const angle = (seed * 1000 + i * 137.5) % 360;
            const dist = ((seed * 500 + i * 17) % range) * 0.8;
            cells.push({
                offsetX: Math.sin(angle * Math.PI / 180) * dist,
                offsetY: Math.cos(angle * Math.PI / 180) * dist,
                intensity: 10 + ((seed * 100 + i * 23) % 40),
                size: 1 + ((seed * 50 + i * 7) % 3)
            });
        }
        return cells;
    }

    /**
     * Get radar color for intensity (dBZ)
     */
    getRadarColor(dbz) {
        for (let i = this.radarColors.length - 1; i >= 0; i--) {
            if (dbz >= this.radarColors[i].dbz) {
                return this.radarColors[i].color;
            }
        }
        return 'transparent';
    }

    /**
     * Render METAR dots at airports (simulated positions)
     */
    renderMetarDots(ctx, lat, lon, mapSettings) {
        const { range, width, height, orientation, heading } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const rotation = orientation === 'north' ? 0 : heading;

        const metarStations = this.generateSimulatedMetar(lat, lon, range);

        metarStations.forEach(station => {
            const dist = this.core.calculateDistance(lat, lon, station.lat, station.lon);
            if (dist > range) return;

            const brg = this.core.calculateBearing(lat, lon, station.lat, station.lon);
            const angle = this.core.toRad(brg - rotation);
            const x = cx + Math.sin(angle) * dist * pixelsPerNm;
            const y = cy - Math.cos(angle) * dist * pixelsPerNm;

            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = this.metarColors[station.category] || '#888888';
            ctx.fill();

            ctx.font = '8px Consolas, monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(station.icao, x, y - 8);
        });
    }

    generateSimulatedMetar(centerLat, centerLon, range) {
        const stations = [];
        const categories = ['VFR', 'MVFR', 'IFR', 'LIFR'];
        const step = range / 3;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const lat = centerLat + (i * step / 60);
                const lon = centerLon + (j * step / (60 * Math.cos(centerLat * Math.PI / 180)));
                const catIdx = Math.floor(Math.abs(Math.sin(lat * 100 + lon * 100) * 4)) % 4;
                stations.push({
                    icao: `K${String.fromCharCode(65 + Math.abs(i) * 3 + j)}${String.fromCharCode(66 + Math.abs(j) * 2)}${String.fromCharCode(67 + i + j)}`,
                    lat, lon, category: categories[catIdx]
                });
            }
        }
        return stations;
    }

    /**
     * Render wind barbs
     */
    renderWinds(ctx, lat, lon, mapSettings) {
        const { range, width, height, orientation, heading } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const rotation = orientation === 'north' ? 0 : heading;

        if (this.simWeather.windSpeed > 0) {
            this.drawWindBarb(ctx, cx, cy, this.simWeather.windDirection - rotation, this.simWeather.windSpeed, true);
        }

        const windPoints = this.generateSimulatedWinds(lat, lon, range);
        windPoints.forEach(point => {
            if (point.offsetX === 0 && point.offsetY === 0) return;
            const rotRad = this.core.toRad(rotation);
            const rotX = point.offsetX * Math.cos(rotRad) - point.offsetY * Math.sin(rotRad);
            const rotY = point.offsetX * Math.sin(rotRad) + point.offsetY * Math.cos(rotRad);
            const x = cx + rotX * pixelsPerNm;
            const y = cy - rotY * pixelsPerNm;
            this.drawWindBarb(ctx, x, y, point.direction - rotation, point.speed, false);
        });
    }

    generateSimulatedWinds(centerLat, centerLon, range) {
        const winds = [];
        const step = range / 2;
        const baseDir = this.simWeather.windDirection || 270;
        const baseSpeed = this.simWeather.windSpeed || 10;

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const seed = Math.sin(centerLat * 10 + i * 7) * Math.cos(centerLon * 10 + j * 11);
                winds.push({
                    offsetX: i * step,
                    offsetY: j * step,
                    direction: (baseDir + seed * 15 + 360) % 360,
                    speed: Math.max(0, baseSpeed * (1 + seed * 0.2))
                });
            }
        }
        return winds;
    }

    /**
     * Draw wind barb at position
     */
    drawWindBarb(ctx, x, y, direction, speed, isAircraft = false) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(direction * Math.PI / 180);

        const staffLen = isAircraft ? 25 : 18;
        const barbLen = isAircraft ? 10 : 7;
        const shortBarbLen = isAircraft ? 5 : 4;
        const barbSpacing = isAircraft ? 4 : 3;
        const pennantWidth = isAircraft ? 5 : 4;

        const color = isAircraft ? '#00ffff' : '#00aaff';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = isAircraft ? 2 : 1.5;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -staffLen);
        ctx.stroke();

        if (speed < 3) {
            ctx.beginPath();
            ctx.arc(0, 0, isAircraft ? 5 : 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            return;
        }

        let remaining = Math.round(speed);
        let barbY = -staffLen;

        while (remaining >= 50) {
            ctx.beginPath();
            ctx.moveTo(0, barbY);
            ctx.lineTo(-barbLen, barbY + pennantWidth / 2);
            ctx.lineTo(0, barbY + pennantWidth);
            ctx.closePath();
            ctx.fill();
            barbY += pennantWidth + 1;
            remaining -= 50;
        }

        while (remaining >= 10) {
            ctx.beginPath();
            ctx.moveTo(0, barbY);
            ctx.lineTo(-barbLen, barbY - barbSpacing);
            ctx.stroke();
            barbY += barbSpacing;
            remaining -= 10;
        }

        if (remaining >= 5) {
            if (barbY === -staffLen) barbY += barbSpacing;
            ctx.beginPath();
            ctx.moveTo(0, barbY);
            ctx.lineTo(-shortBarbLen, barbY - barbSpacing / 2);
            ctx.stroke();
        }

        if (isAircraft && speed >= 3) {
            ctx.restore();
            ctx.save();
            ctx.translate(x, y);
            ctx.font = 'bold 10px Consolas, monospace';
            ctx.fillStyle = '#00ffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${Math.round(speed)}kt`, 0, staffLen / 2 + 2);
        }

        ctx.restore();
    }

    /**
     * Render lightning strikes
     */
    renderLightning(ctx, lat, lon, mapSettings) {
        const { range, width, height, orientation, heading } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const rotation = orientation === 'north' ? 0 : heading;

        const hasStorm = this.hasStormActivity();
        const strikes = hasStorm ? this.generateSimulatedLightning(lat, lon, range) : [];

        strikes.forEach(strike => {
            const angle = this.core.toRad(strike.bearing - rotation);
            const x = cx + Math.sin(angle) * strike.distance * pixelsPerNm;
            const y = cy - Math.cos(angle) * strike.distance * pixelsPerNm;
            this.drawLightningBolt(ctx, x, y, strike.age);
        });

        if (strikes.length > 0) {
            ctx.font = '9px Consolas, monospace';
            ctx.fillStyle = '#ffff00';
            ctx.textAlign = 'left';
            ctx.fillText('\u26A1 LIGHTNING', 10, height - 10);
        }
    }

    hasStormActivity() {
        const precip = this.simWeather.precipState || 0;
        const wind = this.simWeather.windSpeed || 0;
        const vis = this.simWeather.visibility || 10000;
        const hasRain = (precip & 2) !== 0;
        const hasSnow = (precip & 4) !== 0;
        return (hasRain && wind > 20) || (hasRain && vis < 3000) || (hasSnow && wind > 20);
    }

    drawLightningBolt(ctx, x, y, age) {
        ctx.save();
        ctx.translate(x, y);

        let color;
        if (age < 2) {
            color = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 8;
        } else if (age < 5) {
            color = '#ffcc00';
            ctx.shadowColor = '#ffcc00';
            ctx.shadowBlur = 4;
        } else if (age < 10) {
            color = '#ff8800';
        } else {
            color = '#ff4400';
        }

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const size = age < 2 ? 10 : 8;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(-size * 0.3, -size * 0.2);
        ctx.lineTo(size * 0.2, -size * 0.1);
        ctx.lineTo(-size * 0.2, size * 0.4);
        ctx.lineTo(size * 0.4, size * 0.1);
        ctx.lineTo(0, size);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    generateSimulatedLightning(lat, lon, range) {
        const strikes = [];
        const time = Date.now() / 1000;
        const wind = this.simWeather.windSpeed || 0;
        const precip = this.simWeather.precipState || 0;
        const intensity = Math.min(10, Math.floor(wind / 5) + ((precip & 2) ? 3 : 0));
        const numStrikes = Math.max(3, intensity);
        const windDir = this.simWeather.windDirection || 0;

        for (let i = 0; i < numStrikes; i++) {
            const spread = (Math.random() - 0.5) * 120;
            const angle = (windDir + spread + 360) % 360;
            const minDist = range * 0.2;
            const maxDist = range * 0.8;
            const distance = minDist + Math.random() * (maxDist - minDist);
            const age = ((time + i * 7) % 15);
            strikes.push({ bearing: angle, distance, age });
        }
        return strikes;
    }

    // ===== WEATHER PAGE (full-page rendering) =====

    /**
     * Render weather page with full display
     */
    renderWeatherPage(ctx, aircraft, width, height, range = 50) {
        const cx = width / 2;
        const cy = height / 2;
        const maxRadius = Math.min(width, height) / 2;
        const pixelsPerNm = maxRadius / range;

        // Radial gradient background for depth
        const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
        bgGrad.addColorStop(0, '#0f1e2d');
        bgGrad.addColorStop(1, '#0a1520');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Draw proportional range rings with labels
        ctx.save();
        ctx.strokeStyle = '#1a3a4a';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.font = '9px Consolas, monospace';
        ctx.fillStyle = '#3a6a7a';
        ctx.textAlign = 'center';

        const ringFractions = [0.25, 0.5, 0.75, 1.0];
        ringFractions.forEach(frac => {
            const r = maxRadius * frac;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();

            // Distance label
            const dist = Math.round(range * frac);
            ctx.fillText(`${dist}`, cx + r - 14, cy - 4);
        });
        ctx.setLineDash([]);
        ctx.restore();

        // Compass rose — N/S/E/W labels
        ctx.save();
        ctx.font = 'bold 11px Consolas, monospace';
        ctx.fillStyle = '#4a8a9a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', cx, 12);
        ctx.fillText('S', cx, height - 8);
        ctx.fillText('E', width - 8, cy);
        ctx.fillText('W', 10, cy);
        ctx.restore();

        // Draw own aircraft (chevron matching main map)
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 8);
        ctx.lineTo(cx - 6, cy + 5);
        ctx.lineTo(cx, cy + 2);
        ctx.lineTo(cx + 6, cy + 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Build mapSettings for overlay rendering
        const mapSettings = {
            range,
            orientation: 'north',
            width,
            height,
            heading: aircraft.heading
        };

        // Render weather layers
        if (this.layers.satellite) {
            this.renderSatellite(ctx, aircraft.latitude, aircraft.longitude, mapSettings);
        }
        if (this.layers.simRadar) {
            this.renderSimWeatherRadar(ctx, aircraft.latitude, aircraft.longitude, mapSettings);
        }
        if (this.layers.nexrad) {
            this.renderNexrad(ctx, aircraft.latitude, aircraft.longitude, mapSettings);
        }
        if (this.layers.metar) {
            this.renderMetarDotsReal(ctx, aircraft.latitude, aircraft.longitude, mapSettings);
        }
        if (this.layers.taf) {
            this.renderTaf(ctx, aircraft.latitude, aircraft.longitude, mapSettings);
        }
        if (this.layers.winds) {
            this.renderWinds(ctx, aircraft.latitude, aircraft.longitude, mapSettings);
        }
        if (this.layers.lightning) {
            this.renderLightning(ctx, aircraft.latitude, aircraft.longitude, mapSettings);
        }

        // Icing risk indicator
        this.renderIcingRisk(ctx, aircraft, width, height, range);

        // Draw legend
        this.drawLegend(ctx, width, height);

        // METAR popup overlay
        if (this._metarPopup) {
            this.renderMetarPopup(ctx, width, height);
        }
    }

    /**
     * Render METAR dots using real data when available — with glow for severe stations (cached)
     */
    renderMetarDotsReal(ctx, lat, lon, mapSettings) {
        const { range, width, height, orientation, heading } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const rotation = orientation === 'north' ? 0 : heading;

        const stations = this.metarData.size > 0
            ? Array.from(this.metarData.values())
            : this.generateSimulatedMetar(lat, lon, range);

        // Check if we need to regenerate cache
        if (this.needsMetarCacheRegen(lat, lon, range, width, height)) {
            // Create off-screen canvas for caching
            if (!this.metarCache || this.metarCache.width !== width || this.metarCache.height !== height) {
                this.metarCache = document.createElement('canvas');
                this.metarCache.width = width;
                this.metarCache.height = height;
            }

            const cacheCtx = this.metarCache.getContext('2d');
            cacheCtx.clearRect(0, 0, width, height);

            // Render to cache
            this._renderMetarLayer(cacheCtx, stations, lat, lon, cx, cy, pixelsPerNm, rotation, range, width, height);

            // Update cache state
            this.lastCacheState.lat = lat;
            this.lastCacheState.lon = lon;
            this.lastCacheState.range = range;
            this.lastCacheState.width = width;
            this.lastCacheState.height = height;
            this.lastCacheState.metarCount = this.metarData.size;
            this.metarCacheValid = true;
        }

        // Draw cached layer (fast!)
        if (this.metarCache) {
            ctx.drawImage(this.metarCache, 0, 0);
        }
    }

    /**
     * Internal: Render METAR layer to given context
     */
    _renderMetarLayer(ctx, stations, lat, lon, cx, cy, pixelsPerNm, rotation, range, width, height) {
        // Store screen positions for tap detection
        this._metarScreenPositions = [];

        stations.forEach(station => {
            const dist = this.core.calculateDistance(lat, lon, station.lat, station.lon);
            if (dist > range) return;

            const brg = this.core.calculateBearing(lat, lon, station.lat, station.lon);
            const angle = this.core.toRad(brg - rotation);
            const x = cx + Math.sin(angle) * dist * pixelsPerNm;
            const y = cy - Math.cos(angle) * dist * pixelsPerNm;

            const color = this.metarColors[station.category] || '#888888';
            const isSevere = station.category === 'IFR' || station.category === 'LIFR';
            const dotRadius = isSevere ? 8 : 6;

            // Pulsing glow for severe weather stations
            if (isSevere) {
                ctx.save();
                const pulse = 0.4 + 0.3 * Math.sin(Date.now() / 400);
                ctx.shadowColor = color;
                ctx.shadowBlur = 10 * pulse;
                ctx.beginPath();
                ctx.arc(x, y, dotRadius + 2, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.25 * pulse;
                ctx.fill();
                ctx.restore();
            }

            // Main dot
            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Wind barb at station
            if (station.wdir !== null && station.wdir !== undefined && station.wspd) {
                this.drawWindBarb(ctx, x, y - 12, station.wdir - rotation, station.wspd, false);
            }

            // Station ID
            ctx.font = '8px Consolas, monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(station.icao, x, y + dotRadius + 8);

            // Weather phenomena icon
            if (station.weather && station.weather.length > 0) {
                const wxCode = station.weather[0].raw.replace(/[-+]/, '').slice(0, 2);
                const wxInfo = this.wxPhenomena[wxCode];
                if (wxInfo) {
                    ctx.font = '10px Arial';
                    ctx.fillText(wxInfo.icon, x + dotRadius + 6, y + 4);
                }
            }

            // Low visibility label
            if (station.visib) {
                const visNum = parseFloat(station.visib);
                if (!isNaN(visNum) && visNum < 5) {
                    ctx.font = '7px Consolas, monospace';
                    ctx.fillStyle = visNum < 1 ? '#ff00ff' : visNum < 3 ? '#ff0000' : '#ffff00';
                    ctx.fillText(`${station.visib}SM`, x, y + dotRadius + 16);
                }
            }

            // Store position for tap detection
            this._metarScreenPositions.push({ x, y, radius: dotRadius + 4, station });
        });
    }

    /**
     * Render TAF markers at airports with forecast data (cached)
     */
    renderTaf(ctx, lat, lon, mapSettings) {
        const { range, width, height, orientation, heading } = mapSettings;
        const cx = width / 2;
        const cy = height / 2;
        const pixelsPerNm = Math.min(width, height) / 2 / range;
        const rotation = orientation === 'north' ? 0 : heading;

        // Use TAF data if available, otherwise render TAF for airports with METAR positions
        const tafStations = this.tafData.size > 0
            ? Array.from(this.tafData.values())
            : [];

        if (tafStations.length === 0) return;

        // Check if we need to regenerate cache
        if (this.needsTafCacheRegen(lat, lon, range, width, height)) {
            // Create off-screen canvas for caching
            if (!this.tafCache || this.tafCache.width !== width || this.tafCache.height !== height) {
                this.tafCache = document.createElement('canvas');
                this.tafCache.width = width;
                this.tafCache.height = height;
            }

            const cacheCtx = this.tafCache.getContext('2d');
            cacheCtx.clearRect(0, 0, width, height);

            // Render to cache
            this._renderTafLayer(cacheCtx, tafStations, lat, lon, cx, cy, pixelsPerNm, rotation, range);

            // Update cache state
            this.lastCacheState.tafCount = this.tafData.size;
            this.tafCacheValid = true;
        }

        // Draw cached layer (fast!)
        if (this.tafCache) {
            ctx.drawImage(this.tafCache, 0, 0);
        }
    }

    /**
     * Internal: Render TAF layer to given context
     */
    _renderTafLayer(ctx, tafStations, lat, lon, cx, cy, pixelsPerNm, rotation, range) {

        tafStations.forEach(taf => {
            const dist = this.core.calculateDistance(lat, lon, taf.lat, taf.lon);
            if (dist > range) return;

            const brg = this.core.calculateBearing(lat, lon, taf.lat, taf.lon);
            const angle = this.core.toRad(brg - rotation);
            const x = cx + Math.sin(angle) * dist * pixelsPerNm;
            const y = cy - Math.cos(angle) * dist * pixelsPerNm;

            // Determine worst forecast category in next 6h
            const worstCategory = taf.worstCategory || 'VFR';
            const color = this.metarColors[worstCategory] || '#888888';

            // Draw diamond-shaped TAF marker
            const size = 7;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size, y);
            ctx.lineTo(x, y + size);
            ctx.lineTo(x - size, y);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.6;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // TAF label
            ctx.font = '7px Consolas, monospace';
            ctx.fillStyle = '#cccccc';
            ctx.textAlign = 'center';
            ctx.fillText('TAF', x, y - size - 3);
            ctx.fillStyle = color;
            ctx.fillText(taf.icao, x, y + size + 8);
            ctx.restore();
        });
    }

    /**
     * Render icing risk indicator band
     */
    renderIcingRisk(ctx, aircraft, width, height, range) {
        const temp = this.simWeather.ambientTemp;
        const precip = this.simWeather.precipState || 0;
        const vis = this.simWeather.visibility || 10000;

        // Show icing risk when temp is near or below freezing and there's visible moisture
        const hasMoisture = (precip > 0) || (vis < 5000);
        const icingRisk = temp <= 2 && hasMoisture;

        if (!icingRisk) return;

        ctx.save();

        // Draw icing risk band across the bottom
        const bandHeight = 20;
        const bandY = height - bandHeight - 2;

        const grad = ctx.createLinearGradient(0, bandY, 0, bandY + bandHeight);
        grad.addColorStop(0, 'rgba(0, 150, 255, 0)');
        grad.addColorStop(0.3, 'rgba(0, 150, 255, 0.25)');
        grad.addColorStop(0.7, 'rgba(0, 150, 255, 0.25)');
        grad.addColorStop(1, 'rgba(0, 150, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, bandY, width, bandHeight);

        // Icing label
        ctx.font = 'bold 9px Consolas, monospace';
        ctx.fillStyle = '#00aaff';
        ctx.textAlign = 'right';
        const riskLevel = temp <= -5 ? 'MODERATE' : 'LIGHT';
        ctx.fillText(`ICE: ${riskLevel} (${Math.round(temp)}\u00B0C)`, width - 8, bandY + bandHeight / 2 + 3);

        ctx.restore();
    }

    /**
     * Handle canvas tap for METAR popup
     */
    handleCanvasTap(canvasX, canvasY) {
        if (!this._metarScreenPositions) return false;

        for (const pos of this._metarScreenPositions) {
            const dx = canvasX - pos.x;
            const dy = canvasY - pos.y;
            if (dx * dx + dy * dy <= pos.radius * pos.radius) {
                this._metarPopup = {
                    station: pos.station,
                    x: pos.x,
                    y: pos.y
                };
                return true;
            }
        }

        // Tap outside — dismiss popup
        this._metarPopup = null;
        return false;
    }

    /**
     * Dismiss METAR popup
     */
    dismissMetarPopup() {
        this._metarPopup = null;
    }

    /**
     * Render METAR detail popup near a tapped station
     */
    renderMetarPopup(ctx, width, height) {
        const popup = this._metarPopup;
        if (!popup || !popup.station) return;

        const s = popup.station;
        const parsed = s.parsed || null;
        const lines = [];

        lines.push(s.icao + ' - ' + (s.category || 'N/A'));
        if (s.wdir !== null && s.wdir !== undefined) {
            lines.push(`Wind: ${String(s.wdir).padStart(3, '0')}\u00B0/${s.wspd || 0}kt${s.gust ? ' G' + s.gust : ''}`);
        }
        if (s.visib) lines.push(`Vis: ${s.visib} SM`);
        if (s.clouds && s.clouds.length > 0) {
            const sky = s.clouds.map(c => c.altitude ? `${c.type} ${c.altitude}` : c.type).join(' ');
            lines.push(`Sky: ${sky}`);
        }
        if (s.temp !== null && s.temp !== undefined) {
            lines.push(`Temp: ${s.temp}\u00B0C / Dew: ${s.dewp !== undefined ? s.dewp : '--'}\u00B0C`);
        }
        if (s.altimeter || (parsed && parsed.altimeter)) {
            lines.push(`Altim: ${s.altimeter || parsed.altimeter}`);
        }

        // Calculate popup position (avoid edges)
        const boxW = 150;
        const lineH = 13;
        const boxH = lines.length * lineH + 10;
        let bx = popup.x + 12;
        let by = popup.y - boxH / 2;
        if (bx + boxW > width - 5) bx = popup.x - boxW - 12;
        if (by < 5) by = 5;
        if (by + boxH > height - 5) by = height - boxH - 5;

        // Draw popup background
        ctx.save();
        ctx.fillStyle = 'rgba(5, 15, 25, 0.92)';
        ctx.strokeStyle = this.metarColors[s.category] || '#666';
        ctx.lineWidth = 1.5;

        // Rounded rectangle
        const r = 4;
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + boxW - r, by);
        ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + r);
        ctx.lineTo(bx + boxW, by + boxH - r);
        ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH);
        ctx.lineTo(bx + r, by + boxH);
        ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw text lines
        ctx.font = '10px Consolas, monospace';
        ctx.textAlign = 'left';
        lines.forEach((line, idx) => {
            ctx.fillStyle = idx === 0 ? (this.metarColors[s.category] || '#ffffff') : '#cccccc';
            if (idx === 0) ctx.font = 'bold 10px Consolas, monospace';
            else ctx.font = '10px Consolas, monospace';
            ctx.fillText(line, bx + 6, by + 12 + idx * lineH);
        });

        ctx.restore();
    }

    /**
     * Draw weather legend — radar color bar + METAR categories
     */
    drawLegend(ctx, width, height) {
        const legendX = 8;
        let legendY = height - 72;

        ctx.save();

        // Legend background
        const legendW = 180;
        const legendH = 68;
        ctx.fillStyle = 'rgba(5, 15, 25, 0.85)';
        ctx.strokeStyle = '#1a3a4a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(legendX, legendY, legendW, legendH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.font = '9px Consolas, monospace';

        // METAR category row
        if (this.layers.metar || this.layers.taf) {
            const my = legendY + 12;
            Object.entries(this.metarColors).forEach(([cat, color], idx) => {
                const mx = legendX + 6 + idx * 42;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(mx + 4, my, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#cccccc';
                ctx.textAlign = 'left';
                ctx.fillText(cat, mx + 12, my + 3);
            });
        }

        // Radar color bar
        if (this.layers.nexrad || this.layers.simRadar) {
            const ry = legendY + 24;
            ctx.fillStyle = '#888888';
            ctx.textAlign = 'left';
            ctx.fillText('Radar:', legendX + 6, ry + 9);

            const barX = legendX + 50;
            const barW = 120;
            const barH = 10;
            const numSteps = this.radarColors.length;
            const stepW = barW / numSteps;

            this.radarColors.forEach((rc, idx) => {
                ctx.fillStyle = rc.color;
                ctx.fillRect(barX + idx * stepW, ry, stepW, barH);
            });

            ctx.strokeStyle = '#3a5a6a';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(barX, ry, barW, barH);

            // dBZ labels
            ctx.font = '7px Consolas, monospace';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText('5', barX, ry + barH + 8);
            ctx.fillText('30', barX + barW / 2, ry + barH + 8);
            ctx.fillText('55+', barX + barW, ry + barH + 8);
        }

        // Active layers indicator
        const activeLayers = Object.entries(this.layers).filter(([, v]) => v).map(([k]) => k.toUpperCase());
        if (activeLayers.length > 0) {
            ctx.font = '7px Consolas, monospace';
            ctx.fillStyle = '#4a8a6a';
            ctx.textAlign = 'left';
            ctx.fillText(activeLayers.join(' | '), legendX + 6, legendY + legendH - 4);
        }

        ctx.restore();
    }

    // ===== DATA FETCHING =====

    /**
     * Fetch real radar + satellite data from backend (RainViewer proxy)
     */
    async fetchRadarData() {
        try {
            const port = location.port || (location.protocol === 'https:' ? 443 : 80);
            const response = await fetch(`http://${location.hostname}:${port}/api/weather/radar`);
            const data = await response.json();

            if (data.radar && data.radar.length > 0) {
                this.radarFrames = data.radar;
                this.radarHost = data.host;
                const latest = this.radarFrames[this.radarFrames.length - 1];
                this.radarTimestamp = latest.time;
                this.radarAge = Math.round((Date.now() / 1000 - latest.time) / 60);
                GTNCore.log(`[GTN750] Radar data loaded: ${this.radarFrames.length} frames, ${this.radarAge}min old`);
            }

            // Satellite IR data from same RainViewer response
            if (data.satellite && data.satellite.infrared && data.satellite.infrared.length > 0) {
                this.satelliteFrames = data.satellite.infrared;
                this.satelliteHost = data.host;
                GTNCore.log(`[GTN750] Satellite IR loaded: ${this.satelliteFrames.length} frames`);
            }
        } catch (e) {
            console.warn('[GTN750] Failed to fetch radar data:', e);
        }
    }

    /**
     * Fetch METARs for nearby airports
     */
    async fetchNearbyMetars(lat, lon, radius = 100) {
        if (Date.now() - this.lastMetarFetch < this.metarFetchInterval) {
            return;
        }

        try {
            const port = location.port || (location.protocol === 'https:' ? 443 : 80);
            const url = `http://${location.hostname}:${port}/api/weather/metar/nearby?lat=${lat}&lon=${lon}&radius=${radius}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.metars && data.metars.length > 0) {
                this.metarData.clear();
                data.metars.forEach(m => {
                    const parsed = m.raw ? this.parseMetar(m.raw) : null;
                    this.metarData.set(m.icao, {
                        icao: m.icao,
                        lat: m.lat,
                        lon: m.lon,
                        category: parsed?.category || m.flight_rules || 'VFR',
                        raw: m.raw,
                        parsed: parsed,
                        temp: parsed?.temp ?? m.temp,
                        dewp: parsed?.dewpoint ?? m.dewp,
                        wdir: parsed?.wind?.direction ?? m.wdir,
                        wspd: parsed?.wind?.speed ?? m.wspd,
                        gust: parsed?.wind?.gust,
                        visib: parsed?.visibility ?? m.visib,
                        clouds: parsed?.clouds || [],
                        weather: parsed?.weather || [],
                        altimeter: parsed?.altimeter
                    });
                });
                this.lastMetarFetch = Date.now();
                this.metarCacheValid = false; // Invalidate cache on new data
                GTNCore.log(`[GTN750] Loaded ${data.metars.length} METARs (parsed)`);
            }
        } catch (e) {
            console.warn('[GTN750] Failed to fetch nearby METARs:', e);
        }
    }

    /**
     * Fetch single METAR
     */
    async fetchMetar(icao) {
        try {
            const port = location.port || (location.protocol === 'https:' ? 443 : 80);
            const response = await fetch(`http://${location.hostname}:${port}/api/weather/metar/${icao}`);
            const data = await response.json();

            if (data.raw || data.station) {
                return {
                    icao: data.station || icao,
                    raw: data.raw,
                    category: data.flight_rules || 'VFR',
                    temp: data.temperature?.value,
                    dewp: data.dewpoint?.value,
                    wdir: data.wind_direction?.value,
                    wspd: data.wind_speed?.value,
                    visib: data.visibility?.value,
                    altim: data.altimeter?.value
                };
            }
        } catch (e) {
            console.warn(`[GTN750] Failed to fetch METAR for ${icao}:`, e);
        }
        return null;
    }

    /**
     * Fetch TAF data for nearby airports
     */
    async fetchTaf(lat, lon, radius = 100) {
        if (Date.now() - this.lastTafFetch < this.tafFetchInterval) {
            return;
        }

        try {
            const port = location.port || (location.protocol === 'https:' ? 443 : 80);
            const url = `http://${location.hostname}:${port}/api/weather/taf/nearby?lat=${lat}&lon=${lon}&radius=${radius}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.tafs && data.tafs.length > 0) {
                this.tafData.clear();
                data.tafs.forEach(t => {
                    // Parse worst category in next 6h from forecast groups
                    let worstCategory = 'VFR';
                    const catPriority = { LIFR: 4, IFR: 3, MVFR: 2, VFR: 1 };

                    if (t.forecast) {
                        t.forecast.forEach(fg => {
                            const cat = fg.flight_rules || 'VFR';
                            if ((catPriority[cat] || 0) > (catPriority[worstCategory] || 0)) {
                                worstCategory = cat;
                            }
                        });
                    }

                    this.tafData.set(t.icao, {
                        icao: t.icao,
                        lat: t.lat || (this.metarData.get(t.icao)?.lat),
                        lon: t.lon || (this.metarData.get(t.icao)?.lon),
                        raw: t.raw,
                        forecast: t.forecast || [],
                        worstCategory
                    });
                });
                this.lastTafFetch = Date.now();
                this.tafCacheValid = false; // Invalidate cache on new data
                GTNCore.log(`[GTN750] Loaded ${data.tafs.length} TAFs`);
            }
        } catch (e) {
            console.warn('[GTN750] Failed to fetch TAF data:', e);
        }
    }

    /**
     * Start auto-refresh for weather data
     */
    startAutoRefresh(lat, lon) {
        this.fetchRadarData();
        this.fetchNearbyMetars(lat, lon);
        this.fetchTaf(lat, lon);

        this.radarRefreshInterval = setInterval(() => {
            this.fetchRadarData();
        }, 120000);

        this.metarRefreshInterval = setInterval(() => {
            this.fetchNearbyMetars(lat, lon);
        }, 300000);

        this._tafRefreshInterval = setInterval(() => {
            this.fetchTaf(lat, lon);
        }, 600000);
    }

    /**
     * Start radar animation loop
     */
    startRadarAnimation() {
        if (this.radarAnimating) return;
        this.radarAnimating = true;

        this.radarAnimationInterval = setInterval(() => {
            if (this.radarFrames.length > 0) {
                this.currentFrame = (this.currentFrame + 1) % this.radarFrames.length;
            }
        }, 500);
    }

    stopRadarAnimation() {
        this.radarAnimating = false;
        if (this.radarAnimationInterval) {
            clearInterval(this.radarAnimationInterval);
            this.radarAnimationInterval = null;
        }
        this.currentFrame = this.radarFrames.length - 1;
    }

    toggleRadarAnimation() {
        if (this.radarAnimating) {
            this.stopRadarAnimation();
        } else {
            this.startRadarAnimation();
        }
        return this.radarAnimating;
    }

    getCurrentFrameTime() {
        if (this.radarFrames.length === 0) return null;
        const frame = this.radarFrames[this.currentFrame];
        if (!frame) return null;
        return new Date(frame.time * 1000);
    }

    hasRadarData() {
        return this.radarHost && this.radarFrames.length > 0;
    }

    stopAutoRefresh() {
        if (this.radarRefreshInterval) {
            clearInterval(this.radarRefreshInterval);
            this.radarRefreshInterval = null;
        }
        if (this.metarRefreshInterval) {
            clearInterval(this.metarRefreshInterval);
            this.metarRefreshInterval = null;
        }
        if (this._tafRefreshInterval) {
            clearInterval(this._tafRefreshInterval);
            this._tafRefreshInterval = null;
        }
    }

    getMetarText(icao) {
        const metar = this.metarData.get(icao);
        return metar?.raw || 'No METAR available';
    }

    /**
     * Get nearest TAF summary text
     */
    getNearestTafSummary(lat, lon) {
        if (this.tafData.size === 0) return null;

        let nearest = null;
        let nearestDist = Infinity;
        this.tafData.forEach(taf => {
            if (!taf.lat || !taf.lon) return;
            const dist = this.core.calculateDistance(lat, lon, taf.lat, taf.lon);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = taf;
            }
        });

        if (!nearest) return null;

        const lines = [`TAF ${nearest.icao} - ${nearest.worstCategory}`];
        if (nearest.forecast && nearest.forecast.length > 0) {
            nearest.forecast.slice(0, 3).forEach(fg => {
                const type = fg.change_indicator || 'FM';
                const cat = fg.flight_rules || 'VFR';
                const windStr = fg.wind ? `${fg.wind.direction || 'VRB'}\u00B0/${fg.wind.speed || 0}kt` : '';
                const visStr = fg.visibility ? `vis ${fg.visibility.value}` : '';
                lines.push(`${type}: ${cat} ${windStr} ${visStr}`.trim());
            });
        }
        return lines.join('\n');
    }

    getLayers() {
        return { ...this.layers };
    }

    getRadarAge() {
        return this.radarAge;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherOverlay;
}
