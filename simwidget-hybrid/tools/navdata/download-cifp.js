#!/usr/bin/env node
/**
 * Download FAA CIFP (Coded Instrument Flight Procedures) data
 * Source: FAA 28-day NASR subscription (ARINC 424 format)
 * Free download, updated every 28 days (AIRAC cycle)
 *
 * Download page: https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/cifp/download/
 * URL pattern: https://aeronav.faa.gov/Upload_313-d/cifp/CIFP_YYMMDD.zip
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname);
const CIFP_FILE = path.join(OUTPUT_DIR, 'FAACIFP18');

// FAA CIFP download page — we scrape it for the current zip URL
const CIFP_INDEX_URL = 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/cifp/download/';
const CIFP_BASE = 'https://aeronav.faa.gov/Upload_313-d/cifp/';

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const follow = (url, redirects = 0) => {
            if (redirects > 5) return reject(new Error('Too many redirects'));
            const proto = url.startsWith('https') ? https : require('http');
            proto.get(url, { headers: { 'User-Agent': 'SimGlass-NavDB/1.0' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    let loc = res.headers.location;
                    if (loc.startsWith('/')) loc = new URL(loc, url).href;
                    return follow(loc, redirects + 1);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }
                const chunks = [];
                let received = 0;
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                    received += chunk.length;
                });
                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.on('error', reject);
            }).on('error', reject);
        };
        follow(url);
    });
}

function download(url) {
    return new Promise((resolve, reject) => {
        console.log(`[CIFP] Downloading from ${url}...`);
        const follow = (url, redirects = 0) => {
            if (redirects > 5) return reject(new Error('Too many redirects'));
            const proto = url.startsWith('https') ? https : require('http');
            proto.get(url, { headers: { 'User-Agent': 'SimGlass-NavDB/1.0' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    let loc = res.headers.location;
                    if (loc.startsWith('/')) loc = new URL(loc, url).href;
                    return follow(loc, redirects + 1);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }
                const chunks = [];
                let received = 0;
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                    received += chunk.length;
                    if (received % (1024 * 1024) < chunk.length) {
                        process.stdout.write(`\r[CIFP] Downloaded ${(received / 1024 / 1024).toFixed(1)} MB`);
                    }
                });
                res.on('end', () => {
                    console.log(`\n[CIFP] Download complete: ${(received / 1024 / 1024).toFixed(1)} MB`);
                    resolve(Buffer.concat(chunks));
                });
                res.on('error', reject);
            }).on('error', reject);
        };
        follow(url);
    });
}

/**
 * Find the current CIFP zip URL from the FAA download page.
 * Falls back to guessing the URL based on the current date.
 */
async function findCifpUrl() {
    // Try scraping the download page
    try {
        console.log('[CIFP] Checking FAA download page for current CIFP...');
        const html = (await httpsGet(CIFP_INDEX_URL)).toString('utf8');
        // Look for CIFP_YYMMDD.zip links
        const matches = [...html.matchAll(/CIFP_(\d{6})\.zip/g)];
        if (matches.length > 0) {
            // Pick the most recent (highest date code) that is current or past
            const today = new Date();
            const yy = today.getFullYear() % 100;
            const mm = today.getMonth() + 1;
            const dd = today.getDate();
            const todayCode = yy * 10000 + mm * 100 + dd;

            // Sort descending
            const codes = matches.map(m => ({
                code: parseInt(m[1], 10),
                filename: `CIFP_${m[1]}.zip`
            })).sort((a, b) => b.code - a.code);

            // Find the most recent cycle that has started (effective date <= today)
            const current = codes.find(c => c.code <= todayCode) || codes[0];
            const url = `${CIFP_BASE}${current.filename}`;
            console.log(`[CIFP] Found: ${current.filename}`);
            return url;
        }
    } catch (e) {
        console.log(`[CIFP] Could not scrape download page: ${e.message}`);
    }

    // Fallback: guess based on AIRAC 28-day cycle
    // AIRAC cycles start on specific dates. We'll compute the most recent one.
    const epoch = new Date('2026-01-22'); // Known cycle start
    const now = new Date();
    const daysSinceEpoch = Math.floor((now - epoch) / (1000 * 60 * 60 * 24));
    const cyclesSinceEpoch = Math.floor(daysSinceEpoch / 28);
    const currentCycleStart = new Date(epoch.getTime() + cyclesSinceEpoch * 28 * 24 * 60 * 60 * 1000);

    const yy = String(currentCycleStart.getFullYear() % 100).padStart(2, '0');
    const mm = String(currentCycleStart.getMonth() + 1).padStart(2, '0');
    const dd = String(currentCycleStart.getDate()).padStart(2, '0');
    const filename = `CIFP_${yy}${mm}${dd}.zip`;
    const url = `${CIFP_BASE}${filename}`;
    console.log(`[CIFP] Guessed current cycle: ${filename}`);
    return url;
}

async function extractZip(zipBuffer) {
    const zipPath = path.join(OUTPUT_DIR, 'FAACIFP18.zip');
    fs.writeFileSync(zipPath, zipBuffer);
    console.log('[CIFP] Extracting zip...');

    const { execSync } = require('child_process');
    try {
        execSync(`powershell -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${OUTPUT_DIR}'"`, {
            timeout: 60000
        });
    } catch (e) {
        try {
            execSync(`unzip -o "${zipPath}" -d "${OUTPUT_DIR}"`, { timeout: 30000 });
        } catch (e2) {
            throw new Error('Cannot extract zip. Install unzip or use PowerShell on Windows.');
        }
    }

    fs.unlinkSync(zipPath);

    // The extracted file might be named FAACIFP18 or FAACIFP18.txt or similar
    if (fs.existsSync(CIFP_FILE)) {
        const stats = fs.statSync(CIFP_FILE);
        console.log(`[CIFP] Extracted: FAACIFP18 (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
        return CIFP_FILE;
    }

    // Search for the CIFP file in the output directory
    const files = fs.readdirSync(OUTPUT_DIR);
    for (const f of files) {
        const fp = path.join(OUTPUT_DIR, f);
        const stat = fs.statSync(fp);

        // Check for the file directly (might have different name)
        if (!stat.isDirectory() && f.toUpperCase().startsWith('FAACIFP') && stat.size > 1000000) {
            if (fp !== CIFP_FILE) fs.renameSync(fp, CIFP_FILE);
            console.log(`[CIFP] Extracted: ${f} → FAACIFP18 (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
            return CIFP_FILE;
        }

        // Check subdirectories
        if (stat.isDirectory()) {
            const innerFiles = fs.readdirSync(fp);
            for (const inf of innerFiles) {
                const innerPath = path.join(fp, inf);
                const innerStat = fs.statSync(innerPath);
                if (inf.toUpperCase().startsWith('FAACIFP') && innerStat.size > 1000000) {
                    fs.renameSync(innerPath, CIFP_FILE);
                    console.log(`[CIFP] Extracted: ${f}/${inf} → FAACIFP18 (${(innerStat.size / 1024 / 1024).toFixed(1)} MB)`);
                    // Clean up empty dir
                    try { fs.rmdirSync(fp); } catch (e) { /* ignore */ }
                    return CIFP_FILE;
                }
            }
        }
    }

    // List what we got for debugging
    console.log('[CIFP] Files in output dir:', files.join(', '));
    throw new Error('FAACIFP18 not found in zip archive');
}

async function downloadCIFP() {
    // Check if we already have a file from the current AIRAC cycle
    if (fs.existsSync(CIFP_FILE)) {
        const stats = fs.statSync(CIFP_FILE);
        // Compute current AIRAC cycle start date (28-day cycles from known epoch)
        const epoch = new Date('2026-01-22T00:00:00Z');
        const daysSinceEpoch = Math.floor((Date.now() - epoch.getTime()) / 86400000);
        const cyclesSinceEpoch = Math.floor(daysSinceEpoch / 28);
        const currentCycleStart = new Date(epoch.getTime() + cyclesSinceEpoch * 28 * 86400000);
        if (stats.mtimeMs >= currentCycleStart.getTime()) {
            const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
            console.log(`[CIFP] Using existing FAACIFP18 (current cycle, ${ageDays.toFixed(0)} days old)`);
            return CIFP_FILE;
        }
        console.log(`[CIFP] Existing file is from a previous AIRAC cycle — re-downloading...`);
    }

    const url = await findCifpUrl();
    const zipBuffer = await download(url);
    return extractZip(zipBuffer);
}

module.exports = { downloadCIFP, CIFP_FILE };

if (require.main === module) {
    downloadCIFP()
        .then(f => console.log(`[CIFP] Ready: ${f}`))
        .catch(e => { console.error('[CIFP] Failed:', e.message); process.exit(1); });
}
