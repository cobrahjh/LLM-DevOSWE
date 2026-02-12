/**
 * Navigation Database API Routes
 * Provides REST endpoints for airport, navaid, waypoint, airway, and procedure queries.
 * Data source: FAA CIFP parsed into SQLite (see tools/navdata/build-navdb.js)
 *
 * Pattern follows ai-pilot-api.js: exports setupNavdataRoutes(app)
 */

const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'navdb.sqlite');
let db = null;

// Earth radius in nautical miles
const R_NM = 3440.065;

function openDatabase() {
    if (db) return db;
    if (!fs.existsSync(DB_PATH)) return null;

    try {
        const Database = require('better-sqlite3');
        db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
        db.pragma('journal_mode = WAL');
        db.pragma('cache_size = -8000'); // 8MB read cache
        console.log('[NavDB] Database opened:', DB_PATH);
        return db;
    } catch (e) {
        console.warn('[NavDB] Failed to open database:', e.message);
        return null;
    }
}

// ── Haversine distance (nm) ────────────────────────────────────────
function haversineNm(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R_NM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Bearing from point 1 to point 2 (degrees true)
function bearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// Convert range (nm) to approximate lat/lon bounding box offsets
function rangeToDeg(rangeNm, lat) {
    const dLat = rangeNm / 60; // 1° lat ≈ 60nm
    const dLon = rangeNm / (60 * Math.cos(lat * Math.PI / 180)); // Adjust for latitude
    return { dLat, dLon };
}

// ── Middleware: require database ───────────────────────────────────
function requireDb(req, res, next) {
    if (!openDatabase()) {
        return res.status(503).json({
            error: 'Navigation database not available',
            hint: 'Run: node tools/navdata/build-navdb.js'
        });
    }
    next();
}

// ── Route setup ────────────────────────────────────────────────────
function setupNavdataRoutes(app) {
    // Try to open DB at startup
    openDatabase();

    // Status / health check
    app.get('/api/navdb/status', (req, res) => {
        const d = openDatabase();
        if (!d) {
            return res.status(503).json({ available: false, hint: 'Run: node tools/navdata/build-navdb.js' });
        }

        const meta = {};
        for (const row of d.prepare('SELECT key, value FROM navdb_meta').iterate()) {
            meta[row.key] = row.value;
        }

        res.json({
            available: true,
            airac_cycle: meta.airac_cycle || 'unknown',
            build_date: meta.build_date,
            source: meta.source,
            counts: {
                airports: parseInt(meta.airports) || 0,
                navaids: parseInt(meta.navaids) || 0,
                ndbs: parseInt(meta.ndbs) || 0,
                waypoints: parseInt(meta.waypoints) || 0,
                airways: parseInt(meta.airways) || 0,
                procedures: parseInt(meta.procedures) || 0,
                procedure_legs: parseInt(meta.procedure_legs) || 0
            }
        });
    });

    // ── Nearby queries ─────────────────────────────────────────────

    app.get('/api/navdb/nearby/airports', requireDb, (req, res) => {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);
        const range = parseFloat(req.query.range) || 50;
        const limit = parseInt(req.query.limit) || 25;

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: 'lat and lon required' });
        }

        const { dLat, dLon } = rangeToDeg(range, lat);
        const rows = db.prepare(`
            SELECT icao, name, lat, lon, elevation, magvar, longest_runway, public_military
            FROM airports
            WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
        `).all(lat - dLat, lat + dLat, lon - dLon, lon + dLon);

        const results = rows
            .map(r => ({
                ...r,
                distance: Math.round(haversineNm(lat, lon, r.lat, r.lon) * 10) / 10,
                bearing: Math.round(bearing(lat, lon, r.lat, r.lon))
            }))
            .filter(r => r.distance <= range)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, limit);

        res.json({ items: results, count: results.length, source: 'navdb' });
    });

    app.get('/api/navdb/nearby/navaids', requireDb, (req, res) => {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);
        const range = parseFloat(req.query.range) || 50;
        const limit = parseInt(req.query.limit) || 25;

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: 'lat and lon required' });
        }

        const { dLat, dLon } = rangeToDeg(range, lat);
        const rows = db.prepare(`
            SELECT ident, name, type, lat, lon, freq, magvar, elevation
            FROM navaids
            WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
        `).all(lat - dLat, lat + dLat, lon - dLon, lon + dLon);

        const results = rows
            .map(r => ({
                id: r.ident,
                name: r.name,
                type: r.type,
                freq: r.freq ? r.freq.toFixed(2) : null,
                lat: r.lat,
                lon: r.lon,
                distance: Math.round(haversineNm(lat, lon, r.lat, r.lon) * 10) / 10,
                bearing: Math.round(bearing(lat, lon, r.lat, r.lon))
            }))
            .filter(r => r.distance <= range)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, limit);

        res.json({ items: results, count: results.length, source: 'navdb' });
    });

    app.get('/api/navdb/nearby/ndbs', requireDb, (req, res) => {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);
        const range = parseFloat(req.query.range) || 50;
        const limit = parseInt(req.query.limit) || 25;

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: 'lat and lon required' });
        }

        const { dLat, dLon } = rangeToDeg(range, lat);
        const rows = db.prepare(`
            SELECT ident, name, lat, lon, freq, magvar
            FROM ndbs
            WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
        `).all(lat - dLat, lat + dLat, lon - dLon, lon + dLon);

        const results = rows
            .map(r => ({
                id: r.ident,
                name: r.name,
                type: 'NDB',
                freq: r.freq ? r.freq.toString() : null,
                lat: r.lat,
                lon: r.lon,
                distance: Math.round(haversineNm(lat, lon, r.lat, r.lon) * 10) / 10,
                bearing: Math.round(bearing(lat, lon, r.lat, r.lon))
            }))
            .filter(r => r.distance <= range)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, limit);

        res.json({ items: results, count: results.length, source: 'navdb' });
    });

    app.get('/api/navdb/nearby/fixes', requireDb, (req, res) => {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);
        const range = parseFloat(req.query.range) || 50;
        const limit = parseInt(req.query.limit) || 25;

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: 'lat and lon required' });
        }

        const { dLat, dLon } = rangeToDeg(range, lat);
        const rows = db.prepare(`
            SELECT ident, name, lat, lon, type
            FROM waypoints
            WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?
            AND airport_icao IS NULL
        `).all(lat - dLat, lat + dLat, lon - dLon, lon + dLon);

        const results = rows
            .map(r => ({
                id: r.ident,
                name: r.name || r.ident,
                type: 'FIX',
                lat: r.lat,
                lon: r.lon,
                distance: Math.round(haversineNm(lat, lon, r.lat, r.lon) * 10) / 10,
                bearing: Math.round(bearing(lat, lon, r.lat, r.lon))
            }))
            .filter(r => r.distance <= range)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, limit);

        res.json({ items: results, count: results.length, source: 'navdb' });
    });

    // ── Airport detail ─────────────────────────────────────────────

    app.get('/api/navdb/airport/:icao', requireDb, (req, res) => {
        const icao = req.params.icao.toUpperCase();
        const airport = db.prepare('SELECT * FROM airports WHERE icao = ?').get(icao);
        if (!airport) {
            return res.status(404).json({ error: 'Airport not found', icao });
        }

        const runways = db.prepare('SELECT * FROM runways WHERE airport_icao = ? ORDER BY ident').all(icao);

        res.json({ ...airport, runways });
    });

    // ── Procedures ─────────────────────────────────────────────────

    app.get('/api/navdb/procedures/:icao', requireDb, (req, res) => {
        const icao = req.params.icao.toUpperCase();

        // Check airport exists
        const airport = db.prepare('SELECT icao FROM airports WHERE icao = ?').get(icao);
        if (!airport) {
            return res.status(404).json({ error: 'Airport not found', icao });
        }

        const procs = db.prepare(`
            SELECT id, type, ident, runway, transition
            FROM procedures
            WHERE airport_icao = ?
            ORDER BY type, ident, transition
        `).all(icao);

        // Group by type
        const departures = [];
        const arrivals = [];
        const approaches = [];

        // Deduplicate by ident (merge transitions)
        const seen = { SID: new Map(), STAR: new Map(), APPROACH: new Map() };

        for (const p of procs) {
            const map = seen[p.type];
            if (!map) continue;

            // Clean transition: strip leading route type digit (e.g., "4RW08" → "RW08", "6HBU" → "HBU")
            const cleanTrans = cleanTransition(p.transition);
            const cleanRwy = cleanTransition(p.runway);

            if (!map.has(p.ident)) {
                // Collect runways from runway transitions (starting with RW)
                const runways = [];
                if (cleanRwy && cleanRwy.startsWith('RW')) runways.push(cleanRwy);
                else if (cleanTrans && cleanTrans.startsWith('RW')) runways.push(cleanTrans);

                const entry = {
                    id: p.id,
                    name: p.ident,
                    runway: runways.length ? runways[0] : 'ALL',
                    runways,
                    transition: cleanTrans || null,
                    transitions: cleanTrans ? [cleanTrans] : [],
                    type: p.type === 'APPROACH' ? guessApproachType(p.ident) : p.type
                };
                map.set(p.ident, entry);

                if (p.type === 'SID') departures.push(entry);
                else if (p.type === 'STAR') arrivals.push(entry);
                else approaches.push(entry);
            } else {
                // Add transition to existing entry
                const existing = map.get(p.ident);
                if (cleanTrans && !existing.transitions.includes(cleanTrans)) {
                    existing.transitions.push(cleanTrans);
                    // Track unique runways
                    if (cleanTrans.startsWith('RW') && !existing.runways.includes(cleanTrans)) {
                        existing.runways.push(cleanTrans);
                    }
                }
            }
        }

        // Build runway display string for each procedure
        for (const map of Object.values(seen)) {
            for (const entry of map.values()) {
                if (entry.runways.length > 0) {
                    entry.runway = entry.runways.map(r => r.replace('RW', '')).join('/');
                }
            }
        }

        res.json({
            airport: icao,
            departures,
            arrivals,
            approaches,
            source: 'navdb'
        });
    });

    app.get('/api/navdb/procedure/:id/legs', requireDb, (req, res) => {
        const procId = parseInt(req.params.id, 10);
        if (isNaN(procId)) {
            return res.status(400).json({ error: 'Invalid procedure ID' });
        }

        const proc = db.prepare('SELECT * FROM procedures WHERE id = ?').get(procId);
        if (!proc) {
            return res.status(404).json({ error: 'Procedure not found' });
        }

        const legs = db.prepare(`
            SELECT seq, fix_ident, fix_lat, fix_lon, path_term, turn_dir,
                   alt_desc, alt1, alt2, speed_limit, course, distance, rec_navaid
            FROM procedure_legs
            WHERE procedure_id = ?
            ORDER BY seq
        `).all(procId);

        // Convert to waypoint format for flight plan display
        const waypoints = legs
            .filter(l => l.fix_ident && l.fix_lat !== null)
            .map((l, i) => ({
                ident: l.fix_ident,
                lat: l.fix_lat,
                lon: l.fix_lon,
                type: i === 0 ? 'IAF' : (i === legs.length - 1 ? 'MAP' : 'WAYPOINT'),
                pathTerm: l.path_term,
                altDesc: l.alt_desc,
                alt1: l.alt1,
                alt2: l.alt2,
                speedLimit: l.speed_limit,
                course: l.course
            }));

        res.json({
            procedure: {
                id: proc.id,
                airport: proc.airport_icao,
                type: proc.type,
                ident: proc.ident,
                runway: proc.runway,
                transition: proc.transition
            },
            legs,
            waypoints,
            source: 'navdb'
        });
    });

    // ── Airway ─────────────────────────────────────────────────────

    app.get('/api/navdb/airway/:ident', requireDb, (req, res) => {
        const ident = req.params.ident.toUpperCase();

        const fixes = db.prepare(`
            SELECT fix_ident, fix_lat, fix_lon, min_alt, max_alt, route_type
            FROM airways
            WHERE ident = ?
            ORDER BY seq
        `).all(ident);

        if (!fixes.length) {
            return res.status(404).json({ error: 'Airway not found', ident });
        }

        res.json({
            ident,
            route_type: fixes[0].route_type,
            fixes: fixes.map(f => ({
                ident: f.fix_ident,
                lat: f.fix_lat,
                lon: f.fix_lon,
                min_alt: f.min_alt,
                max_alt: f.max_alt
            })),
            source: 'navdb'
        });
    });

    // ── Cross-type search ──────────────────────────────────────────

    app.get('/api/navdb/search/:ident', requireDb, (req, res) => {
        const ident = req.params.ident.toUpperCase();
        if (!/^[A-Z0-9]{2,5}$/.test(ident)) {
            return res.status(400).json({ error: 'Invalid identifier (2-5 alphanumeric chars)' });
        }

        const results = [];

        // Search airports
        const airports = db.prepare('SELECT icao, name, lat, lon, elevation FROM airports WHERE icao = ?').all(ident);
        for (const a of airports) {
            results.push({
                ident: a.icao, name: a.name, type: 'AIRPORT',
                lat: a.lat, lon: a.lon, elevation: a.elevation
            });
        }

        // Search navaids
        const navaids = db.prepare('SELECT ident, name, type, lat, lon, freq FROM navaids WHERE ident = ?').all(ident);
        for (const n of navaids) {
            results.push({
                ident: n.ident, name: n.name, type: n.type,
                lat: n.lat, lon: n.lon, freq: n.freq
            });
        }

        // Search NDBs
        const ndbs = db.prepare('SELECT ident, name, lat, lon, freq FROM ndbs WHERE ident = ?').all(ident);
        for (const n of ndbs) {
            results.push({
                ident: n.ident, name: n.name, type: 'NDB',
                lat: n.lat, lon: n.lon, freq: n.freq
            });
        }

        // Search waypoints (enroute only, not terminal)
        const wps = db.prepare('SELECT ident, name, lat, lon FROM waypoints WHERE ident = ? AND airport_icao IS NULL LIMIT 5').all(ident);
        for (const w of wps) {
            results.push({
                ident: w.ident, name: w.name || w.ident, type: 'FIX',
                lat: w.lat, lon: w.lon
            });
        }

        if (!results.length) {
            return res.status(404).json({ error: 'Identifier not found', ident });
        }

        // Return best match first (airport > VOR > NDB > FIX)
        const priority = { AIRPORT: 0, 'VOR/DME': 1, VOR: 1, DME: 2, TACAN: 2, NDB: 3, FIX: 4 };
        results.sort((a, b) => (priority[a.type] ?? 5) - (priority[b.type] ?? 5));

        res.json({
            ident,
            results,
            best: results[0],
            source: 'navdb'
        });
    });

    console.log('[NavDB] API routes registered (/api/navdb/*)');
}

// ── Helpers ────────────────────────────────────────────────────────

// Clean transition/runway: strip leading route type digit from ARINC 424 data
// e.g., "4RW08" → "RW08", "6HBU" → "HBU", "5" → null, "RW08" → "RW08"
function cleanTransition(val) {
    if (!val) return null;
    val = val.trim();
    if (!val) return null;
    // If it starts with a digit and has more chars, strip the digit (route type prefix)
    if (/^\d.+/.test(val)) return val.substring(1);
    // If it's just a digit (e.g., common route "5"), return null
    if (/^\d$/.test(val)) return null;
    return val;
}

function guessApproachType(ident) {
    if (!ident) return 'OTHER';
    const id = ident.toUpperCase();
    if (id.startsWith('I')) return 'ILS';
    if (id.startsWith('R')) return 'RNAV';
    if (id.startsWith('V')) return 'VOR';
    if (id.startsWith('N')) return 'NDB';
    if (id.startsWith('L')) return 'LOC';
    if (id.startsWith('S')) return 'LOC/BC';
    if (id.startsWith('D')) return 'VOR/DME';
    if (id.startsWith('H')) return 'RNAV(RNP)';
    if (id.startsWith('P')) return 'GPS';
    if (id.startsWith('Q')) return 'NDB/DME';
    return 'OTHER';
}

module.exports = { setupNavdataRoutes };
