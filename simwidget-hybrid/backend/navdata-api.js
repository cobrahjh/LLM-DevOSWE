/**
 * Navigation Database API Routes
 * Provides REST endpoints for airport, navaid, waypoint, airway, and procedure queries.
 * Data source: FAA CIFP parsed into SQLite (see tools/navdata/build-navdb.js)
 *
 * Pattern follows ai-pilot-api.js: exports setupNavdataRoutes(app)
 */

const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const DB_PATH = path.join(__dirname, 'data', 'navdb.sqlite');
let db = null;

// ── AIRAC Update Job ─────────────────────────────────────────────
let updateJob = { status: 'idle', progress: 0, message: null, startedAt: null };

// Earth radius in nautical miles
const R_NM = 3440.065;

// ── AIRAC Cycle Date Computation ────────────────────────────────────
// Reference: AIRAC 2501 = January 23, 2025 (±1 day accuracy within a few years)
function airacCycleToDate(cycleStr) {
    if (!cycleStr || cycleStr === 'unknown') return null;
    const ref = new Date('2025-01-23T00:00:00Z');
    const year = parseInt(cycleStr.substring(0, 2)) + 2000;
    const num  = parseInt(cycleStr.substring(2));
    if (isNaN(year) || isNaN(num)) return null;
    const offset = (year - 2025) * 13 + (num - 1);
    const d = new Date(ref);
    d.setUTCDate(d.getUTCDate() + offset * 28);
    return d;
}

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
    const startupDb = openDatabase();

    // Startup AIRAC expiry check
    if (startupDb) {
        try {
            const meta = {};
            for (const row of startupDb.prepare('SELECT key, value FROM navdb_meta').iterate()) {
                meta[row.key] = row.value;
            }
            const cycle = meta.airac_cycle;
            const expiry = airacCycleToDate(cycle);
            if (expiry) {
                const expiryWithGrace = new Date(expiry.getTime() + 28 * 86400000);
                const now = new Date();
                if (now > expiryWithGrace) {
                    console.warn(`[NavDB] ⚠️  AIRAC ${cycle} EXPIRED on ${expiry.toDateString()} — update via POST /api/navdb/update`);
                } else if (now > expiry) {
                    console.warn(`[NavDB] ⚠️  AIRAC ${cycle} expired ${expiry.toDateString()} — update recommended`);
                } else {
                    const daysLeft = Math.ceil((expiry - now) / 86400000);
                    console.log(`[NavDB] AIRAC ${cycle} — expires ${expiry.toDateString()} (${daysLeft} days)`);
                }
            }
        } catch (e) { /* non-fatal */ }
    }

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

        const cycleStart = airacCycleToDate(meta.airac_cycle);
        const cycleExpiry = cycleStart ? new Date(cycleStart.getTime() + 28 * 86400000) : null;

        res.json({
            available: true,
            airac_cycle: meta.airac_cycle || 'unknown',
            airac_effective: cycleStart ? cycleStart.toISOString() : null,
            airac_expiry: cycleExpiry ? cycleExpiry.toISOString() : null,
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

    app.get('/api/navdb/nearby/airways', requireDb, (req, res) => {
        const lat = parseFloat(req.query.lat);
        const lon = parseFloat(req.query.lon);
        const range = parseFloat(req.query.range) || 100;
        const limit = parseInt(req.query.limit) || 50;

        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({ error: 'lat and lon required' });
        }

        const { dLat, dLon } = rangeToDeg(range, lat);

        // Get unique airways that have fixes within the region
        const rows = db.prepare(`
            SELECT DISTINCT ident, route_type
            FROM airways
            WHERE fix_lat BETWEEN ? AND ? AND fix_lon BETWEEN ? AND ?
            ORDER BY ident
            LIMIT ?
        `).all(lat - dLat, lat + dLat, lon - dLon, lon + dLon, limit);

        const results = rows.map(r => ({
            ident: r.ident,
            type: r.route_type,
            category: r.route_type === 'J' ? 'Jet' : 'Victor'
        }));

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

        // Group by type - each transition is a separate entry
        const departures = [];
        const arrivals = [];
        const approaches = [];

        for (const p of procs) {
            // Clean transition: strip leading route type digit (e.g., "4RW08" → "RW08", "6HBU" → "HBU")
            const cleanTrans = cleanTransition(p.transition);
            const cleanRwy = cleanTransition(p.runway);

            // Build display name: "IDENT.TRANSITION" or just "IDENT" if no transition
            let displayName = p.ident;
            if (cleanTrans) {
                displayName = `${p.ident}.${cleanTrans}`;
            }

            // Extract runway for display
            let runway = 'ALL';
            if (cleanRwy && cleanRwy.startsWith('RW')) {
                runway = cleanRwy.replace('RW', '');
            } else if (cleanTrans && cleanTrans.startsWith('RW')) {
                runway = cleanTrans.replace('RW', '');
            }

            const entry = {
                id: p.id,
                name: displayName,
                ident: p.ident,        // Base procedure identifier
                runway,
                transition: cleanTrans || null,
                type: p.type === 'APPROACH' ? guessApproachType(p.ident) : p.type
            };

            if (p.type === 'SID') departures.push(entry);
            else if (p.type === 'STAR') arrivals.push(entry);
            else approaches.push(entry);
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

        // Detect missed approach legs
        // Priority 1: seq >= 100 (ARINC 424 standard for missed approach)
        // Priority 2: HM/HA/HF (holding patterns - strong missed approach indicators)
        // Note: CA/VM/VI/FA/FM can appear in normal approaches, so not reliable
        let missedStartSeq = legs.findIndex(l => l.seq >= 100);

        // If no seq >= 100, look for holding patterns
        if (missedStartSeq === -1) {
            const holdingPathTerms = ['HM', 'HA', 'HF'];
            missedStartSeq = legs.findIndex(l =>
                l.path_term && holdingPathTerms.includes(l.path_term)
            );
        }

        const approachLegs = missedStartSeq >= 0 ? legs.slice(0, missedStartSeq) : legs;
        const missedLegs = missedStartSeq >= 0 ? legs.slice(missedStartSeq) : [];

        // Convert to waypoint format for flight plan display
        const waypoints = approachLegs
            .filter(l => l.fix_ident && l.fix_lat !== null)
            .map((l, i) => ({
                ident: l.fix_ident,
                lat: l.fix_lat,
                lon: l.fix_lon,
                type: i === 0 ? 'IAF' : (i === approachLegs.length - 1 ? 'MAP' : 'WAYPOINT'),
                pathTerm: l.path_term,
                altDesc: l.alt_desc,
                alt1: l.alt1,
                alt2: l.alt2,
                speedLimit: l.speed_limit,
                course: l.course
            }));

        // Convert missed approach legs to waypoints
        const missedWaypoints = missedLegs
            .filter(l => l.fix_ident && l.fix_lat !== null)
            .map(l => ({
                ident: l.fix_ident,
                lat: l.fix_lat,
                lon: l.fix_lon,
                type: 'MISSED',
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
            legs: approachLegs,
            waypoints,
            hasMissedApproach: missedLegs.length > 0,
            missedApproachLegs: missedLegs,
            missedApproachWaypoints: missedWaypoints,
            source: 'navdb'
        });
    });

    // ── Airway ─────────────────────────────────────────────────────

    app.get('/api/navdb/airway/:ident', requireDb, (req, res) => {
        const ident = req.params.ident.toUpperCase();
        const entryFix = req.query.entry ? req.query.entry.toUpperCase() : null;
        const exitFix = req.query.exit ? req.query.exit.toUpperCase() : null;

        const fixes = db.prepare(`
            SELECT fix_ident, fix_lat, fix_lon, min_alt, max_alt, route_type, seq
            FROM airways
            WHERE ident = ?
            ORDER BY seq
        `).all(ident);

        if (!fixes.length) {
            return res.status(404).json({ error: 'Airway not found', ident });
        }

        let segmentFixes = fixes;

        // Extract segment if entry/exit specified
        if (entryFix && exitFix) {
            const entryIdx = fixes.findIndex(f => f.fix_ident === entryFix);
            const exitIdx = fixes.findIndex(f => f.fix_ident === exitFix);

            if (entryIdx === -1) {
                return res.status(404).json({ error: 'Entry fix not found on airway', fix: entryFix });
            }
            if (exitIdx === -1) {
                return res.status(404).json({ error: 'Exit fix not found on airway', fix: exitFix });
            }

            // Airway can be traversed in either direction
            if (entryIdx < exitIdx) {
                segmentFixes = fixes.slice(entryIdx, exitIdx + 1);
            } else {
                segmentFixes = fixes.slice(exitIdx, entryIdx + 1).reverse();
            }
        }

        res.json({
            ident,
            route_type: fixes[0].route_type,
            entry: entryFix,
            exit: exitFix,
            fixes: segmentFixes.map(f => ({
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

    // ── AIRAC Database Update ───────────────────────────────────────

    app.post('/api/navdb/update', (req, res) => {
        if (updateJob.status !== 'idle' && updateJob.status !== 'complete' && updateJob.status !== 'error') {
            return res.status(409).json({ error: 'Update already in progress', status: updateJob.status });
        }
        runUpdate();
        res.json({ started: true, message: 'AIRAC database update started' });
    });

    app.get('/api/navdb/update-status', (req, res) => {
        res.json({ ...updateJob });
    });

    console.log('[NavDB] API routes registered (/api/navdb/*)');
}

// ── Run AIRAC Update ─────────────────────────────────────────────
function runUpdate() {
    updateJob = { status: 'downloading', progress: 25, message: 'Downloading FAA CIFP data...', startedAt: Date.now() };

    // Close DB so SQLite file can be replaced
    if (db) {
        try { db.close(); } catch (e) { /* ignore */ }
        db = null;
    }

    const buildScript = path.join(__dirname, '..', 'tools', 'navdata', 'build-navdb.js');
    const child = execFile('node', [buildScript], { timeout: 300000 }, (err, stdout, stderr) => {
        if (err) {
            console.error('[NavDB] Update failed:', err.message);
            updateJob = { status: 'error', progress: 0, message: err.message, startedAt: updateJob.startedAt };
        } else {
            console.log('[NavDB] Update complete');
            updateJob = { status: 'complete', progress: 100, message: 'AIRAC database updated successfully', startedAt: updateJob.startedAt };
        }
        // Reopen DB
        openDatabase();
    });

    // Monitor stdout for phase changes
    child.stdout.on('data', (data) => {
        const text = data.toString();
        if (text.includes('[CIFP] Extracting')) {
            updateJob.status = 'extracting';
            updateJob.progress = 40;
            updateJob.message = 'Extracting CIFP archive...';
        } else if (text.includes('parseCIFP') || text.includes('Parsing') || text.includes('airports')) {
            updateJob.status = 'parsing';
            updateJob.progress = 60;
            updateJob.message = 'Parsing ARINC 424 data into SQLite...';
        } else if (text.includes('Verification') || text.includes('Verify')) {
            updateJob.progress = 90;
            updateJob.message = 'Verifying database...';
        }
    });
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
