/**
 * Convert EarthEnv 5km max-elevation GeoTIFF → compact terrain grid for SimGlass
 *
 * Input:  elevation_5KMma_GMTEDma.tif (17MB GeoTIFF, 8640x3360, ~5km resolution)
 * Output: terrain-grid.bin (binary Int16 grid, served to browser)
 *
 * Usage: node convert-geotiff.js
 */

const GeoTIFF = require('geotiff');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const INPUT = path.join(__dirname, 'elevation_5KMma_GMTEDma.tif');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'ui', 'shared', 'data');

(async () => {
    console.log('=== EarthEnv GeoTIFF → SimGlass Terrain Grid ===\n');

    // Read GeoTIFF
    console.log('Reading GeoTIFF...');
    const data = fs.readFileSync(INPUT);
    const tiff = await GeoTIFF.fromArrayBuffer(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    );
    const image = await tiff.getImage();

    const srcW = image.getWidth();    // 8640
    const srcH = image.getHeight();   // 3360
    const [lonMin, latMin, lonMax, latMax] = image.getBoundingBox();
    const srcCellDeg = Math.abs(image.getResolution()[0]); // ~0.04167°

    console.log(`  Source: ${srcW} x ${srcH}, ${srcCellDeg.toFixed(4)}° (~${(srcCellDeg * 111.12).toFixed(1)}km)`);
    console.log(`  BBox: [${lonMin}, ${latMin}] to [${lonMax}, ${latMax}]`);

    // Read all raster data
    console.log('\nReading raster data...');
    const rasters = await image.readRasters();
    const src = rasters[0]; // Float32Array

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Helper to build a binary terrain grid
    function buildBinaryGrid(label, factor) {
        const w = Math.floor(srcW / factor);
        const h = Math.floor(srcH / factor);
        const cellDeg = srcCellDeg * factor;

        console.log(`\n--- ${label}: ${w}x${h}, ${cellDeg.toFixed(4)}° (~${(cellDeg*111.12).toFixed(1)}km) ---`);

        // Downsample using MAX (safety: highest point in each block)
        const grid = new Int16Array(w * h);
        let landCells = 0, maxElev = -9999;

        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
                let maxVal = -9999;
                for (let dy = 0; dy < factor; dy++) {
                    for (let dx = 0; dx < factor; dx++) {
                        const srcIdx = (row * factor + dy) * srcW + (col * factor + dx);
                        if (srcIdx < src.length) {
                            const v = src[srcIdx];
                            if (v > maxVal) maxVal = v;
                        }
                    }
                }
                const val = Math.round(maxVal);
                grid[row * w + col] = val;
                if (val > 0) landCells++;
                if (val > maxElev) maxElev = val;
            }
        }

        console.log(`  Land cells: ${landCells.toLocaleString()} / ${(w*h).toLocaleString()} (${(landCells/(w*h)*100).toFixed(1)}%)`);
        console.log(`  Max elevation: ${maxElev}m (${Math.round(maxElev*3.28084)}ft)`);

        // Binary format:
        // [0-3]   magic "TGRD"
        // [4-5]   version (1)
        // [6-7]   width
        // [8-9]   height
        // [10-13] latMin * 1000 (Int32)
        // [14-17] latMax * 1000 (Int32)
        // [18-21] lonMin * 1000 (Int32)
        // [22-25] lonMax * 1000 (Int32)
        // [26-29] resolution * 100000 (Int32)
        // [30-31] reserved
        // [32...] Int16 elevations row-major
        const headerSize = 32;
        const buf = Buffer.alloc(headerSize + w * h * 2);

        buf.write('TGRD', 0, 4, 'ascii');
        buf.writeUInt16LE(1, 4);
        buf.writeUInt16LE(w, 6);
        buf.writeUInt16LE(h, 8);
        buf.writeInt32LE(Math.round(latMin * 1000), 10);
        buf.writeInt32LE(Math.round(latMax * 1000), 14);
        buf.writeInt32LE(Math.round(lonMin * 1000), 18);
        buf.writeInt32LE(Math.round(lonMax * 1000), 22);
        buf.writeInt32LE(Math.round(cellDeg * 100000), 26);
        buf.writeUInt16LE(0, 30);

        for (let i = 0; i < grid.length; i++) {
            buf.writeInt16LE(grid[i], headerSize + i * 2);
        }

        return { buf, grid, w, h, cellDeg, landCells, maxElev };
    }

    // Build grids at multiple resolutions
    const grids = [
        { label: '5km (1x)', factor: 1 },
        { label: '10km (2x)', factor: 2 },
        { label: '20km (4x)', factor: 4 },
    ];

    const results = {};
    for (const g of grids) {
        const result = buildBinaryGrid(g.label, g.factor);
        const filename = `terrain-grid-${g.label.split(' ')[0]}.bin`;
        const outPath = path.join(OUTPUT_DIR, filename);

        fs.writeFileSync(outPath, result.buf);
        const rawSize = result.buf.length;

        const gz = zlib.gzipSync(result.buf, { level: 9 });
        fs.writeFileSync(outPath + '.gz', gz);

        console.log(`  Raw:    ${(rawSize / 1024 / 1024).toFixed(1)}MB`);
        console.log(`  Gzip:   ${(gz.length / 1024 / 1024).toFixed(1)}MB`);
        console.log(`  Output: ${filename}`);

        results[g.label] = { ...result, rawSize, gzSize: gz.length, filename };
    }

    // Verification against known elevations
    console.log('\n--- Verification (10km grid) ---');
    const r = results['10km (2x)'];

    function lookup(lat, lon) {
        const row = Math.floor((latMax - lat) / r.cellDeg);
        const col = Math.floor((lon - lonMin) / r.cellDeg);
        if (row < 0 || row >= r.h || col < 0 || col >= r.w) return null;
        return r.grid[row * r.w + col];
    }

    const spots = [
        ['Mt Everest',   27.99,   86.93, 8849],
        ['Mt Rainier',   46.85, -121.76, 4392],
        ['Denver',       39.74, -104.99, 1609],
        ['Seattle',      47.61, -122.33,   56],
        ['Death Valley', 36.23, -116.83,  -86],
        ['Miami',        25.79,  -80.13,    0],
        ['KBFI (Boeing)',47.53, -122.30,    6],
        ['KJFK',         40.64,  -73.78,    4],
        ['EGLL (Heathrow)', 51.47, -0.46,  25],
    ];

    for (const [name, lat, lon, actual] of spots) {
        const elev = lookup(lat, lon);
        if (elev === null) { console.log(`  ${name.padEnd(20)} OUT OF RANGE`); continue; }
        const ft = Math.round(elev * 3.28084);
        const diff = elev - actual;
        console.log(`  ${name.padEnd(20)} ${String(elev).padStart(5)}m (${String(ft).padStart(6)}ft) [expect ~${actual}m, diff ${diff > 0 ? '+' : ''}${diff}m]`);
    }

    // Summary
    console.log('\n=== Summary ===');
    for (const [label, r] of Object.entries(results)) {
        console.log(`  ${label.padEnd(12)} ${r.filename.padEnd(28)} ${(r.rawSize/1024/1024).toFixed(1)}MB raw, ${(r.gzSize/1024/1024).toFixed(1)}MB gz`);
    }
    console.log('\nRecommended for browser: terrain-grid-10km.bin (gzip served by Express)');
    console.log('Recommended for backend API: terrain-grid-5km.bin');
})();
