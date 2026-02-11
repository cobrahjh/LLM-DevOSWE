#!/usr/bin/env node
/**
 * Download FAA CIFP (Coded Instrument Flight Procedures) data
 * Source: FAA 28-day NASR subscription (ARINC 424 format)
 * Free download, updated every 28 days (AIRAC cycle)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { createUnzip } = require('zlib');

const OUTPUT_DIR = path.join(__dirname);
const CIFP_FILE = path.join(OUTPUT_DIR, 'FAACIFP18');

// FAA distributes CIFP via their NASR subscription service
// The URL follows a predictable pattern based on the current AIRAC cycle
const CIFP_URL = 'https://aeronav.faa.gov/Upload_313-d/cifp/FAACIFP18.zip';

function download(url) {
    return new Promise((resolve, reject) => {
        console.log(`[CIFP] Downloading from ${url}...`);
        const follow = (url, redirects = 0) => {
            if (redirects > 5) return reject(new Error('Too many redirects'));
            https.get(url, { headers: { 'User-Agent': 'SimGlass-NavDB/1.0' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return follow(res.headers.location, redirects + 1);
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

async function extractZip(zipBuffer) {
    // FAA CIFP zip contains a single file: FAACIFP18
    // Use Node's built-in zip handling via child_process as fallback
    const zipPath = path.join(OUTPUT_DIR, 'FAACIFP18.zip');
    fs.writeFileSync(zipPath, zipBuffer);
    console.log('[CIFP] Extracting zip...');

    // Try using PowerShell to extract (Windows)
    const { execSync } = require('child_process');
    try {
        execSync(`powershell -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${OUTPUT_DIR}'"`, {
            timeout: 30000
        });
    } catch (e) {
        // Try unzip command (Linux/Mac)
        try {
            execSync(`unzip -o "${zipPath}" -d "${OUTPUT_DIR}"`, { timeout: 30000 });
        } catch (e2) {
            throw new Error('Cannot extract zip. Install unzip or use PowerShell on Windows.');
        }
    }

    // Clean up zip
    fs.unlinkSync(zipPath);

    // Check for the CIFP file
    if (fs.existsSync(CIFP_FILE)) {
        const stats = fs.statSync(CIFP_FILE);
        console.log(`[CIFP] Extracted: FAACIFP18 (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
        return CIFP_FILE;
    }

    // Sometimes it's in a subdirectory
    const files = fs.readdirSync(OUTPUT_DIR);
    for (const f of files) {
        const fp = path.join(OUTPUT_DIR, f);
        if (fs.statSync(fp).isDirectory()) {
            const inner = path.join(fp, 'FAACIFP18');
            if (fs.existsSync(inner)) {
                fs.renameSync(inner, CIFP_FILE);
                console.log(`[CIFP] Extracted: FAACIFP18 (found in ${f}/)`);
                return CIFP_FILE;
            }
        }
    }

    throw new Error('FAACIFP18 not found in zip archive');
}

async function downloadCIFP() {
    // Check if we already have a recent file
    if (fs.existsSync(CIFP_FILE)) {
        const stats = fs.statSync(CIFP_FILE);
        const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
        if (ageDays < 28) {
            console.log(`[CIFP] Using existing FAACIFP18 (${ageDays.toFixed(0)} days old)`);
            return CIFP_FILE;
        }
        console.log(`[CIFP] Existing file is ${ageDays.toFixed(0)} days old, re-downloading...`);
    }

    const zipBuffer = await download(CIFP_URL);
    return extractZip(zipBuffer);
}

module.exports = { downloadCIFP, CIFP_FILE };

if (require.main === module) {
    downloadCIFP()
        .then(f => console.log(`[CIFP] Ready: ${f}`))
        .catch(e => { console.error('[CIFP] Failed:', e.message); process.exit(1); });
}
