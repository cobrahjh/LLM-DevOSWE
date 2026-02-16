#!/usr/bin/env node
/**
 * FAA CIFP (ARINC 424) Parser → SQLite Navigation Database
 *
 * Parses fixed-width ARINC 424 records from FAACIFP18 file into a SQLite database.
 * Record types handled:
 *   PA - Airport                    PG - Runway
 *   D  - VOR/DME/TACAN            DB - NDB
 *   EA - Enroute Waypoint          PC - Terminal Waypoint
 *   ER - Enroute Airway            PD/PE/PF - SID/STAR/Approach
 *
 * Reference: ARINC 424 Supplement 18 (FAA variant)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Default paths
const DEFAULT_CIFP = path.join(__dirname, 'FAACIFP18');
const DEFAULT_DB = path.join(__dirname, '..', '..', 'backend', 'data', 'navdb.sqlite');

// ── Coordinate Parsing ─────────────────────────────────────────────
// ARINC 424 stores coordinates as: N40393900 W073464700 (DDMMSSCC format)
// DD=degrees, MM=minutes, SS=seconds, CC=centiseconds
function parseLatitude(s) {
    if (!s || s.length < 9) return null;
    s = s.trim();
    if (!s) return null;
    const hem = s[0];
    const deg = parseInt(s.substring(1, 3), 10);
    const min = parseInt(s.substring(3, 5), 10);
    const sec = parseInt(s.substring(5, 7), 10);
    const cs  = parseInt(s.substring(7, 9), 10);
    if (isNaN(deg) || isNaN(min) || isNaN(sec)) return null;
    let val = deg + min / 60 + (sec + cs / 100) / 3600;
    if (hem === 'S') val = -val;
    return Math.round(val * 1e6) / 1e6;
}

function parseLongitude(s) {
    if (!s || s.length < 10) return null;
    s = s.trim();
    if (!s) return null;
    const hem = s[0];
    const deg = parseInt(s.substring(1, 4), 10);
    const min = parseInt(s.substring(4, 6), 10);
    const sec = parseInt(s.substring(6, 8), 10);
    const cs  = parseInt(s.substring(8, 10), 10);
    if (isNaN(deg) || isNaN(min) || isNaN(sec)) return null;
    let val = deg + min / 60 + (sec + cs / 100) / 3600;
    if (hem === 'W') val = -val;
    return Math.round(val * 1e6) / 1e6;
}

// Parse magnetic variation: E0150 = East 15.0°, W0025 = West 2.5°
function parseMagVar(s) {
    if (!s || s.length < 5) return 0;
    s = s.trim();
    if (!s) return 0;
    const hem = s[0];
    const val = parseInt(s.substring(1), 10) / 10;
    if (isNaN(val)) return 0;
    return hem === 'W' ? val : -val; // West is positive magvar
}

// Parse altitude: FL350 → 35000, 05000 → 5000
function parseAltitude(s) {
    if (!s) return null;
    s = s.trim();
    if (!s) return null;
    if (s.startsWith('FL')) return parseInt(s.substring(2), 10) * 100;
    const val = parseInt(s, 10);
    return isNaN(val) ? null : val;
}

// Parse frequency: 11470 → 114.70
function parseFrequency(s) {
    if (!s) return null;
    s = s.trim();
    const val = parseInt(s, 10);
    if (isNaN(val)) return null;
    return val / 100;
}

// Parse NDB frequency: 0350 → 350
function parseNdbFrequency(s) {
    if (!s) return null;
    s = s.trim();
    const val = parseInt(s, 10);
    if (isNaN(val)) return null;
    return val / 10;
}

// ── Database Setup ─────────────────────────────────────────────────
function createDatabase(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = OFF');     // Speed up bulk insert
    db.pragma('cache_size = -64000');   // 64MB cache

    db.exec(`
        CREATE TABLE navdb_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE airports (
            icao TEXT PRIMARY KEY,
            name TEXT,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            elevation INTEGER,
            magvar REAL,
            iata TEXT,
            transition_alt INTEGER,
            longest_runway INTEGER,
            public_military TEXT DEFAULT 'C'
        );

        CREATE TABLE runways (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            airport_icao TEXT NOT NULL,
            ident TEXT NOT NULL,
            length INTEGER,
            width INTEGER,
            surface TEXT,
            lat REAL,
            lon REAL,
            heading REAL,
            ils_freq REAL,
            ils_ident TEXT,
            glideslope REAL,
            threshold_elev INTEGER,
            FOREIGN KEY (airport_icao) REFERENCES airports(icao)
        );

        CREATE TABLE navaids (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ident TEXT NOT NULL,
            name TEXT,
            type TEXT NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            freq REAL,
            magvar REAL,
            elevation INTEGER,
            range_nm INTEGER,
            region TEXT
        );

        CREATE TABLE ndbs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ident TEXT NOT NULL,
            name TEXT,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            freq REAL,
            magvar REAL,
            region TEXT
        );

        CREATE TABLE waypoints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ident TEXT NOT NULL,
            name TEXT,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            type TEXT DEFAULT 'WPT',
            region TEXT,
            airport_icao TEXT
        );

        CREATE TABLE airways (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ident TEXT NOT NULL,
            seq INTEGER NOT NULL,
            fix_ident TEXT NOT NULL,
            fix_lat REAL,
            fix_lon REAL,
            route_type TEXT,
            min_alt INTEGER,
            max_alt INTEGER,
            direction TEXT
        );

        CREATE TABLE procedures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            airport_icao TEXT NOT NULL,
            type TEXT NOT NULL,
            ident TEXT NOT NULL,
            runway TEXT,
            transition TEXT,
            FOREIGN KEY (airport_icao) REFERENCES airports(icao)
        );

        CREATE TABLE procedure_legs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            procedure_id INTEGER NOT NULL,
            seq INTEGER NOT NULL,
            fix_ident TEXT,
            fix_lat REAL,
            fix_lon REAL,
            path_term TEXT,
            turn_dir TEXT,
            alt_desc TEXT,
            alt1 INTEGER,
            alt2 INTEGER,
            speed_limit INTEGER,
            course REAL,
            distance REAL,
            rec_navaid TEXT,
            FOREIGN KEY (procedure_id) REFERENCES procedures(id)
        );

        -- Spatial indexes for bounding-box queries
        CREATE INDEX idx_airports_lat ON airports(lat);
        CREATE INDEX idx_airports_lon ON airports(lon);
        CREATE INDEX idx_airports_icao ON airports(icao);

        CREATE INDEX idx_runways_airport ON runways(airport_icao);

        CREATE INDEX idx_navaids_ident ON navaids(ident);
        CREATE INDEX idx_navaids_lat ON navaids(lat);
        CREATE INDEX idx_navaids_lon ON navaids(lon);

        CREATE INDEX idx_ndbs_ident ON ndbs(ident);
        CREATE INDEX idx_ndbs_lat ON ndbs(lat);
        CREATE INDEX idx_ndbs_lon ON ndbs(lon);

        CREATE INDEX idx_waypoints_ident ON waypoints(ident);
        CREATE INDEX idx_waypoints_lat ON waypoints(lat);
        CREATE INDEX idx_waypoints_lon ON waypoints(lon);

        CREATE INDEX idx_airways_ident ON airways(ident);
        CREATE INDEX idx_airways_fix ON airways(fix_ident);

        CREATE INDEX idx_procedures_airport ON procedures(airport_icao);
        CREATE INDEX idx_procedures_type ON procedures(airport_icao, type);

        CREATE INDEX idx_procedure_legs_proc ON procedure_legs(procedure_id);
    `);

    return db;
}

// ── ARINC 424 Record Parsers ───────────────────────────────────────

// col() extracts a 1-based substring from the fixed-width record
function col(line, start, end) {
    return line.substring(start - 1, end).trim();
}

function parseAirportRecord(line) {
    // ARINC 424 PA record (Airport Reference Point)
    // Columns based on FAA CIFP18 format
    const contNr = col(line, 22, 22);
    if (contNr !== '0' && contNr !== '1' && contNr !== '') return null;

    const icao = col(line, 7, 10);
    if (!icao || icao.length < 3) return null;

    const lat = parseLatitude(col(line, 33, 41));
    const lon = parseLongitude(col(line, 42, 51));
    if (lat === null || lon === null) return null;

    const magvar = parseMagVar(col(line, 52, 56));
    const elevation = parseInt(col(line, 57, 61), 10) || null;
    const name = col(line, 94, 123);
    const iata = col(line, 80, 82);
    const transAlt = parseInt(col(line, 72, 76), 10) || null;
    const longestRwy = parseInt(col(line, 78, 80), 10) || null;
    const pubMil = col(line, 18, 18) || 'C';

    return {
        icao, name: name || icao, lat, lon, elevation, magvar,
        iata: iata || null, transition_alt: transAlt,
        longest_runway: longestRwy ? longestRwy * 100 : null,
        public_military: pubMil
    };
}

function parseRunwayRecord(line) {
    // ARINC 424 PG record
    const icao = col(line, 7, 10);
    const ident = col(line, 14, 18);
    if (!icao || !ident) return null;

    const length = parseInt(col(line, 23, 27), 10) || null;
    const width = parseInt(col(line, 78, 80), 10) || null;
    const heading = parseInt(col(line, 28, 31), 10);
    const lat = parseLatitude(col(line, 33, 41));
    const lon = parseLongitude(col(line, 42, 51));

    // ILS frequency and ident
    const ilsFreq = parseFrequency(col(line, 52, 56));
    const ilsIdent = col(line, 57, 60);
    const glideslope = parseInt(col(line, 68, 70), 10);
    const thresholdElev = parseInt(col(line, 71, 75), 10) || null;

    return {
        airport_icao: icao, ident, length, width,
        surface: null, // Not in ARINC 424
        lat, lon,
        heading: heading ? heading / 10 : null,
        ils_freq: ilsFreq, ils_ident: ilsIdent || null,
        glideslope: glideslope ? glideslope / 10 : null,
        threshold_elev: thresholdElev
    };
}

function parseNavaidRecord(line) {
    // ARINC 424 D record (VOR/DME/TACAN)
    const ident = col(line, 14, 17);
    if (!ident) return null;

    const contNr = col(line, 22, 22);
    if (contNr !== '0' && contNr !== '1' && contNr !== '') return null;

    const lat = parseLatitude(col(line, 33, 41));
    const lon = parseLongitude(col(line, 42, 51));
    if (lat === null || lon === null) return null;

    // Navaid class determines type (col 27-31)
    const navClass = col(line, 27, 31);
    let type = 'VOR';
    if (navClass.includes('D') && navClass.includes('V')) type = 'VOR/DME';
    else if (navClass.includes('D')) type = 'DME';
    else if (navClass.includes('T')) type = 'TACAN';

    const freq = parseFrequency(col(line, 23, 27));
    const magvar = parseMagVar(col(line, 52, 56));
    const elevation = parseInt(col(line, 57, 61), 10) || null;
    const name = col(line, 94, 123);
    const range = parseInt(col(line, 81, 83), 10) || null;
    const region = col(line, 5, 6);

    return {
        ident, name: name || ident, type, lat, lon, freq,
        magvar, elevation, range_nm: range, region
    };
}

function parseNdbRecord(line) {
    // ARINC 424 DB record
    const ident = col(line, 14, 17);
    if (!ident) return null;

    const contNr = col(line, 22, 22);
    if (contNr !== '0' && contNr !== '1' && contNr !== '') return null;

    const lat = parseLatitude(col(line, 33, 41));
    const lon = parseLongitude(col(line, 42, 51));
    if (lat === null || lon === null) return null;

    const freq = parseNdbFrequency(col(line, 23, 27));
    const magvar = parseMagVar(col(line, 52, 56));
    const name = col(line, 94, 123);
    const region = col(line, 5, 6);

    return { ident, name: name || ident, lat, lon, freq, magvar, region };
}

function parseWaypointRecord(line, isTerminal) {
    // ARINC 424 EA (enroute) or PC (terminal) record
    const ident = col(line, 14, 18);
    if (!ident) return null;

    const contNr = col(line, 22, 22);
    if (contNr !== '0' && contNr !== '1' && contNr !== '') return null;

    const lat = parseLatitude(col(line, 33, 41));
    const lon = parseLongitude(col(line, 42, 51));
    if (lat === null || lon === null) return null;

    const name = col(line, 99, 123);
    const region = col(line, 5, 6);
    const airportIcao = isTerminal ? col(line, 7, 10) : null;
    const waypointType = col(line, 27, 29);

    return {
        ident, name: name || ident, lat, lon,
        type: waypointType || 'WPT', region,
        airport_icao: airportIcao
    };
}

function parseAirwayRecord(line) {
    // ARINC 424 ER record (Enroute Airway)
    const ident = col(line, 14, 18);
    if (!ident) return null;

    const seq = parseInt(col(line, 26, 29), 10) || 0;
    const fixIdent = col(line, 30, 34);
    if (!fixIdent) return null;

    const fixLat = parseLatitude(col(line, 40, 48));
    const fixLon = parseLongitude(col(line, 49, 58));

    const routeType = col(line, 20, 20); // J=Jet, V=Victor, etc
    const minAlt = parseAltitude(col(line, 84, 88));
    const maxAlt = parseAltitude(col(line, 89, 93));
    const direction = col(line, 25, 25);

    return {
        ident, seq, fix_ident: fixIdent,
        fix_lat: fixLat, fix_lon: fixLon,
        route_type: routeType, min_alt: minAlt, max_alt: maxAlt,
        direction: direction || null
    };
}

// ── Procedure Records (SID/STAR/Approach) ──────────────────────────

function parseProcedureRecord(line, recType) {
    // PD = SID, PE = STAR, PF = Approach
    const icao = col(line, 7, 10);
    const ident = col(line, 14, 19);
    if (!icao || !ident) return null;

    // Col 20 = Route Type digit (1-9), Col 21-25 = Transition Identifier
    const routeTypeCode = col(line, 20, 20);
    const transIdent = col(line, 21, 25);
    const seqNr = parseInt(col(line, 27, 29), 10) || 0;
    const fixIdent = col(line, 30, 34);
    const contNr = col(line, 26, 26);

    // Determine procedure type
    let procType;
    if (recType === 'PD') procType = 'SID';
    else if (recType === 'PE') procType = 'STAR';
    else procType = 'APPROACH';

    // Runway from runway transitions (RW##), otherwise null
    const runway = transIdent.startsWith('RW') ? transIdent : null;

    // Path terminator (TF, CF, DF, IF, etc.)
    const pathTerm = col(line, 48, 49);
    const turnDir = col(line, 50, 50);

    // Fix coordinates
    const fixLat = parseLatitude(col(line, 40, 48));
    const fixLon = parseLongitude(col(line, 49, 58));

    // Altitude constraints
    const altDesc = col(line, 83, 83);
    const alt1 = parseAltitude(col(line, 84, 88));
    const alt2 = parseAltitude(col(line, 89, 93));

    // Speed constraint
    const speedLimit = parseInt(col(line, 100, 102), 10) || null;

    // Course and distance
    const course = parseInt(col(line, 71, 74), 10);
    const distance = parseInt(col(line, 75, 78), 10);

    // Recommended navaid
    const recNavaid = col(line, 51, 54);

    return {
        airport_icao: icao,
        proc_type: procType,
        proc_ident: ident.trim(),
        transition: transIdent.trim() || null,
        runway: runway.trim() || null,
        seq: seqNr,
        fix_ident: fixIdent || null,
        fix_lat: fixLat,
        fix_lon: fixLon,
        path_term: pathTerm || null,
        turn_dir: turnDir || null,
        alt_desc: altDesc || null,
        alt1, alt2,
        speed_limit: speedLimit,
        course: course ? course / 10 : null,
        distance: distance ? distance / 10 : null,
        rec_navaid: recNavaid || null
    };
}

// ── Resolve fix coordinates ────────────────────────────────────────
// Some procedure legs reference fixes by ident without inline coordinates.
// After parsing, resolve them from the waypoints/navaids tables.
function resolveFixCoordinates(db) {
    console.log('[Parse] Resolving procedure fix coordinates...');

    // Build lookup from waypoints + navaids + ndbs + airports
    const fixLookup = new Map();

    for (const row of db.prepare('SELECT ident, lat, lon FROM waypoints').iterate()) {
        fixLookup.set(row.ident, { lat: row.lat, lon: row.lon });
    }
    for (const row of db.prepare('SELECT ident, lat, lon FROM navaids').iterate()) {
        fixLookup.set(row.ident, { lat: row.lat, lon: row.lon });
    }
    for (const row of db.prepare('SELECT ident, lat, lon FROM ndbs').iterate()) {
        fixLookup.set(row.ident, { lat: row.lat, lon: row.lon });
    }
    for (const row of db.prepare('SELECT icao AS ident, lat, lon FROM airports').iterate()) {
        fixLookup.set(row.ident, { lat: row.lat, lon: row.lon });
    }

    const update = db.prepare('UPDATE procedure_legs SET fix_lat = ?, fix_lon = ? WHERE id = ?');
    const unresolved = db.prepare(
        'SELECT id, fix_ident FROM procedure_legs WHERE fix_ident IS NOT NULL AND fix_lat IS NULL'
    ).all();

    let resolved = 0;
    const batch = db.transaction(() => {
        for (const row of unresolved) {
            const fix = fixLookup.get(row.fix_ident);
            if (fix) {
                update.run(fix.lat, fix.lon, row.id);
                resolved++;
            }
        }
    });
    batch();

    console.log(`[Parse] Resolved ${resolved}/${unresolved.length} fix coordinates`);
}

// ── Main Parser ────────────────────────────────────────────────────

async function parseCIFP(cifpPath, dbPath) {
    cifpPath = cifpPath || DEFAULT_CIFP;
    dbPath = dbPath || DEFAULT_DB;

    if (!fs.existsSync(cifpPath)) {
        throw new Error(`CIFP file not found: ${cifpPath}\nRun download-cifp.js first.`);
    }

    console.log(`[Parse] Reading ${cifpPath}...`);
    const db = createDatabase(dbPath);

    // Prepared statements for bulk insert
    const stmts = {
        airport: db.prepare(`INSERT OR IGNORE INTO airports (icao, name, lat, lon, elevation, magvar, iata, transition_alt, longest_runway, public_military) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
        runway: db.prepare(`INSERT INTO runways (airport_icao, ident, length, width, surface, lat, lon, heading, ils_freq, ils_ident, glideslope, threshold_elev) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
        navaid: db.prepare(`INSERT INTO navaids (ident, name, type, lat, lon, freq, magvar, elevation, range_nm, region) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
        ndb: db.prepare(`INSERT INTO ndbs (ident, name, lat, lon, freq, magvar, region) VALUES (?, ?, ?, ?, ?, ?, ?)`),
        waypoint: db.prepare(`INSERT INTO waypoints (ident, name, lat, lon, type, region, airport_icao) VALUES (?, ?, ?, ?, ?, ?, ?)`),
        airway: db.prepare(`INSERT INTO airways (ident, seq, fix_ident, fix_lat, fix_lon, route_type, min_alt, max_alt, direction) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
        procedure: db.prepare(`INSERT INTO procedures (airport_icao, type, ident, runway, transition) VALUES (?, ?, ?, ?, ?)`),
        procLeg: db.prepare(`INSERT INTO procedure_legs (procedure_id, seq, fix_ident, fix_lat, fix_lon, path_term, turn_dir, alt_desc, alt1, alt2, speed_limit, course, distance, rec_navaid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    };

    // Track unique procedure headers to avoid duplicates
    const procMap = new Map(); // key → procedure_id

    const counts = {
        airports: 0, runways: 0, navaids: 0, ndbs: 0,
        waypoints: 0, airways: 0, procedures: 0, procedureLegs: 0,
        lines: 0, errors: 0
    };

    // Dedupe sets
    const seenNavaids = new Set();
    const seenNdbs = new Set();
    const seenWaypoints = new Set();

    // Read file line by line
    const fileStream = fs.createReadStream(cifpPath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    // Batch insert in transactions of 10000 records
    const BATCH_SIZE = 10000;
    let batchCount = 0;
    let inTransaction = false;

    function beginBatch() {
        if (!inTransaction) {
            db.exec('BEGIN TRANSACTION');
            inTransaction = true;
        }
    }

    function commitBatch() {
        if (inTransaction) {
            db.exec('COMMIT');
            inTransaction = false;
        }
    }

    function maybeBatch() {
        batchCount++;
        if (batchCount >= BATCH_SIZE) {
            commitBatch();
            beginBatch();
            batchCount = 0;
        }
    }

    beginBatch();

    for await (const line of rl) {
        counts.lines++;

        if (line.length < 40) continue; // Skip short/header lines

        try {
            // Record type identification based on ARINC 424 section codes
            const recType = col(line, 1, 1);  // S=Standard
            const custArea = col(line, 2, 4);  // Customer area (USA, etc)
            const secCode = col(line, 5, 5);   // Section code
            const subCode = col(line, 6, 6);   // Subsection code
            const secCode2 = col(line, 13, 13); // Alt section code position

            if (recType !== 'S') continue; // Only standard records

            // Airport (PA)
            if (secCode === 'P' && !subCode && secCode2 === 'A') {
                const rec = parseAirportRecord(line);
                if (rec) {
                    stmts.airport.run(rec.icao, rec.name, rec.lat, rec.lon, rec.elevation, rec.magvar, rec.iata, rec.transition_alt, rec.longest_runway, rec.public_military);
                    counts.airports++;
                    maybeBatch();
                }
            }
            // Runway (PG)
            else if (secCode === 'P' && !subCode && secCode2 === 'G') {
                const rec = parseRunwayRecord(line);
                if (rec) {
                    stmts.runway.run(rec.airport_icao, rec.ident, rec.length, rec.width, rec.surface, rec.lat, rec.lon, rec.heading, rec.ils_freq, rec.ils_ident, rec.glideslope, rec.threshold_elev);
                    counts.runways++;
                    maybeBatch();
                }
            }
            // VOR/DME/TACAN (D)
            else if (secCode === 'D' && !subCode) {
                const rec = parseNavaidRecord(line);
                if (rec) {
                    const key = `${rec.ident}_${rec.region}`;
                    if (!seenNavaids.has(key)) {
                        seenNavaids.add(key);
                        stmts.navaid.run(rec.ident, rec.name, rec.type, rec.lat, rec.lon, rec.freq, rec.magvar, rec.elevation, rec.range_nm, rec.region);
                        counts.navaids++;
                        maybeBatch();
                    }
                }
            }
            // NDB (DB)
            else if (secCode === 'D' && subCode === 'B') {
                const rec = parseNdbRecord(line);
                if (rec) {
                    const key = `${rec.ident}_${rec.region}`;
                    if (!seenNdbs.has(key)) {
                        seenNdbs.add(key);
                        stmts.ndb.run(rec.ident, rec.name, rec.lat, rec.lon, rec.freq, rec.magvar, rec.region);
                        counts.ndbs++;
                        maybeBatch();
                    }
                }
            }
            // Enroute Waypoint (EA)
            else if (secCode === 'E' && subCode === 'A') {
                const rec = parseWaypointRecord(line, false);
                if (rec) {
                    const key = `${rec.ident}_${rec.region}`;
                    if (!seenWaypoints.has(key)) {
                        seenWaypoints.add(key);
                        stmts.waypoint.run(rec.ident, rec.name, rec.lat, rec.lon, rec.type, rec.region, null);
                        counts.waypoints++;
                        maybeBatch();
                    }
                }
            }
            // Terminal Waypoint (PC)
            else if (secCode === 'P' && !subCode && secCode2 === 'C') {
                const rec = parseWaypointRecord(line, true);
                if (rec) {
                    const key = `${rec.ident}_${rec.airport_icao}`;
                    if (!seenWaypoints.has(key)) {
                        seenWaypoints.add(key);
                        stmts.waypoint.run(rec.ident, rec.name, rec.lat, rec.lon, rec.type, rec.region, rec.airport_icao);
                        counts.waypoints++;
                        maybeBatch();
                    }
                }
            }
            // Enroute Airway (ER)
            else if (secCode === 'E' && subCode === 'R') {
                const rec = parseAirwayRecord(line);
                if (rec) {
                    stmts.airway.run(rec.ident, rec.seq, rec.fix_ident, rec.fix_lat, rec.fix_lon, rec.route_type, rec.min_alt, rec.max_alt, rec.direction);
                    counts.airways++;
                    maybeBatch();
                }
            }
            // SID (PD), STAR (PE), Approach (PF)
            else if (secCode === 'P' && !subCode && (secCode2 === 'D' || secCode2 === 'E' || secCode2 === 'F')) {
                const recTypeStr = 'P' + secCode2;
                const rec = parseProcedureRecord(line, recTypeStr);
                if (rec) {
                    // Build a unique key for the procedure header
                    const procKey = `${rec.airport_icao}|${rec.proc_type}|${rec.proc_ident}|${rec.transition || ''}`;

                    let procedureId = procMap.get(procKey);
                    if (!procedureId) {
                        const info = stmts.procedure.run(
                            rec.airport_icao, rec.proc_type, rec.proc_ident,
                            rec.runway, rec.transition
                        );
                        procedureId = info.lastInsertRowid;
                        procMap.set(procKey, procedureId);
                        counts.procedures++;
                    }

                    // Insert leg
                    stmts.procLeg.run(
                        procedureId, rec.seq, rec.fix_ident, rec.fix_lat, rec.fix_lon,
                        rec.path_term, rec.turn_dir, rec.alt_desc, rec.alt1, rec.alt2,
                        rec.speed_limit, rec.course, rec.distance, rec.rec_navaid
                    );
                    counts.procedureLegs++;
                    maybeBatch();
                }
            }
        } catch (e) {
            counts.errors++;
            if (counts.errors <= 10) {
                console.warn(`[Parse] Error at line ${counts.lines}: ${e.message}`);
            }
        }

        // Progress
        if (counts.lines % 100000 === 0) {
            process.stdout.write(`\r[Parse] ${counts.lines} lines processed...`);
        }
    }

    commitBatch();
    console.log(`\n[Parse] File read complete: ${counts.lines} lines`);

    // Resolve fix coordinates for procedure legs
    resolveFixCoordinates(db);

    // Write metadata
    const now = new Date().toISOString();
    const metaStmt = db.prepare('INSERT INTO navdb_meta (key, value) VALUES (?, ?)');
    metaStmt.run('build_date', now);
    metaStmt.run('source', 'FAA CIFP (FAACIFP18)');
    metaStmt.run('airports', counts.airports.toString());
    metaStmt.run('navaids', counts.navaids.toString());
    metaStmt.run('ndbs', counts.ndbs.toString());
    metaStmt.run('waypoints', counts.waypoints.toString());
    metaStmt.run('airways', counts.airways.toString());
    metaStmt.run('procedures', counts.procedures.toString());
    metaStmt.run('procedure_legs', counts.procedureLegs.toString());
    metaStmt.run('parse_errors', counts.errors.toString());

    // Try to extract AIRAC info from the file header
    // HDR04 contains "VOLUME 2601  EFFECTIVE 22 JAN 2026" — the 4-digit number is the AIRAC cycle
    try {
        const header = fs.readFileSync(cifpPath, { encoding: 'utf8', flag: 'r' }).substring(0, 600);
        const cycleMatch = header.match(/VOLUME\s+(\d{4})/);
        if (cycleMatch) {
            metaStmt.run('airac_cycle', cycleMatch[1]);
        }
    } catch (e) { /* ignore */ }

    db.close();

    console.log('\n[Parse] === Build Summary ===');
    console.log(`  Airports:       ${counts.airports.toLocaleString()}`);
    console.log(`  Runways:        ${counts.runways.toLocaleString()}`);
    console.log(`  VOR/DME/TACAN:  ${counts.navaids.toLocaleString()}`);
    console.log(`  NDBs:           ${counts.ndbs.toLocaleString()}`);
    console.log(`  Waypoints:      ${counts.waypoints.toLocaleString()}`);
    console.log(`  Airways:        ${counts.airways.toLocaleString()}`);
    console.log(`  Procedures:     ${counts.procedures.toLocaleString()}`);
    console.log(`  Procedure legs: ${counts.procedureLegs.toLocaleString()}`);
    console.log(`  Parse errors:   ${counts.errors}`);
    console.log(`  Database:       ${dbPath}`);

    const dbSize = fs.statSync(dbPath).size;
    console.log(`  Database size:  ${(dbSize / 1024 / 1024).toFixed(1)} MB`);

    return counts;
}

module.exports = { parseCIFP };

if (require.main === module) {
    const args = process.argv.slice(2);
    const cifpPath = args[0] || DEFAULT_CIFP;
    const dbPath = args[1] || DEFAULT_DB;
    parseCIFP(cifpPath, dbPath).catch(e => {
        console.error('[Parse] Failed:', e.message);
        process.exit(1);
    });
}
