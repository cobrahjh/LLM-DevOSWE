#!/usr/bin/env node
/**
 * Build Navigation Database
 * Orchestrates: download FAA CIFP → parse ARINC 424 → SQLite database
 *
 * Usage:
 *   node build-navdb.js              # Download + build
 *   node build-navdb.js --skip-download  # Parse only (FAACIFP18 must exist)
 *   node build-navdb.js --verify     # Build + verify key records
 */

const path = require('path');
const fs = require('fs');
const { downloadCIFP, CIFP_FILE } = require('./download-cifp');
const { parseCIFP } = require('./parse-cifp');

const DB_PATH = path.join(__dirname, '..', '..', 'backend', 'data', 'navdb.sqlite');
const args = process.argv.slice(2);
const skipDownload = args.includes('--skip-download');
const doVerify = args.includes('--verify');

async function verify() {
    const Database = require('better-sqlite3');
    if (!fs.existsSync(DB_PATH)) {
        console.error('[Verify] Database not found:', DB_PATH);
        return false;
    }

    const db = new Database(DB_PATH, { readonly: true });
    let ok = true;

    // Check KDEN
    const kden = db.prepare('SELECT * FROM airports WHERE icao = ?').get('KDEN');
    if (kden) {
        const latOk = Math.abs(kden.lat - 39.856) < 0.01;
        const lonOk = Math.abs(kden.lon - (-104.674)) < 0.01;
        console.log(`[Verify] KDEN: ${kden.name} (${kden.lat}, ${kden.lon}) ${latOk && lonOk ? 'OK' : 'COORDS OFF'}`);
        if (!latOk || !lonOk) ok = false;
    } else {
        console.error('[Verify] KDEN not found!');
        ok = false;
    }

    // Check JFK VOR
    const jfk = db.prepare("SELECT * FROM navaids WHERE ident = 'JFK'").get();
    if (jfk) {
        console.log(`[Verify] JFK VOR: ${jfk.name} (${jfk.lat}, ${jfk.lon}) freq=${jfk.freq} OK`);
    } else {
        console.warn('[Verify] JFK VOR not found (may not be in CIFP data)');
    }

    // Check counts
    const tables = ['airports', 'navaids', 'ndbs', 'waypoints', 'airways', 'procedures', 'procedure_legs'];
    const expectedMin = { airports: 5000, navaids: 500, ndbs: 100, waypoints: 10000, airways: 5000, procedures: 5000, procedure_legs: 20000 };

    for (const t of tables) {
        const count = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c;
        const min = expectedMin[t] || 0;
        const status = count >= min ? 'OK' : `LOW (expected >=${min})`;
        console.log(`[Verify] ${t}: ${count.toLocaleString()} ${status}`);
        if (count < min) ok = false;
    }

    // Check KDEN procedures
    const kdenProcs = db.prepare("SELECT type, COUNT(*) as c FROM procedures WHERE airport_icao = 'KDEN' GROUP BY type").all();
    console.log('[Verify] KDEN procedures:', kdenProcs.map(p => `${p.type}=${p.c}`).join(', '));

    // Meta info
    const meta = db.prepare('SELECT * FROM navdb_meta').all();
    for (const m of meta) {
        console.log(`[Verify] meta.${m.key} = ${m.value}`);
    }

    db.close();
    return ok;
}

async function main() {
    console.log('=== SimGlass Navigation Database Builder ===\n');

    // Step 1: Download
    if (!skipDownload) {
        await downloadCIFP();
    } else {
        if (!fs.existsSync(CIFP_FILE)) {
            console.error(`[Build] CIFP file not found: ${CIFP_FILE}`);
            console.error('[Build] Run without --skip-download to fetch it.');
            process.exit(1);
        }
        console.log(`[Build] Using existing: ${CIFP_FILE}`);
    }

    // Step 2: Parse
    const counts = await parseCIFP(CIFP_FILE, DB_PATH);

    // Step 3: Verify (always runs — exits with code 1 on failure so caller knows)
    console.log('\n=== Verification ===\n');
    const ok = await verify();
    if (ok) {
        console.log('\nBUILD SUCCESSFUL');
    } else {
        console.error('\nBUILD FAILED: verification checks did not pass');
        process.exit(1);
    }
}

main().catch(e => {
    console.error('[Build] Fatal:', e.message);
    process.exit(1);
});
