/**
 * SimWidget Test Runner v1.2.0
 * 
 * Automated testing with stored expected results (fixtures)
 * Tests: Plugins, Services, Widgets, APIs
 * 
 * Usage:
 *   node tests/test-runner.js              # Run all tests
 *   node tests/test-runner.js --update     # Update fixtures with current results
 *   node tests/test-runner.js --db         # Save results to database
 *   node tests/test-runner.js --cloud      # Save to db AND sync to Supabase
 *   node tests/test-runner.js plugins      # Run only plugin tests
 *   node tests/test-runner.js services     # Run only service tests
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tests\test-runner.js
 * Last Updated: 2025-01-08
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Config
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const RESULTS_DIR = path.join(__dirname, 'results');
const SERVER_URL = 'http://localhost:8080';
const LORBY_URL = 'http://localhost:43380';

// Ensure directories exist
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR);

// Test state
const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: []
};

const args = process.argv.slice(2);
const UPDATE_MODE = args.includes('--update');
const DB_MODE = args.includes('--db') || args.includes('--cloud');
const CLOUD_MODE = args.includes('--cloud');
const FILTER = args.find(a => !a.startsWith('--'));

// Database (optional)
let db = null;
let runId = null;
let cloud = null;

if (DB_MODE) {
    try {
        const TestDatabase = require('./test-db');
        db = new TestDatabase();
    } catch (err) {
        console.log('Warning: Database not available, results will not be saved');
    }
}

// Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

/**
 * HTTP request helper
 */
function httpGet(url, timeout = 3000) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, { timeout }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Timeout')));
    });
}

/**
 * Load fixture (expected result)
 */
function loadFixture(name) {
    const fixturePath = path.join(FIXTURES_DIR, `${name}.json`);
    if (fs.existsSync(fixturePath)) {
        return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    }
    return null;
}

/**
 * Save fixture
 */
function saveFixture(name, data) {
    const fixturePath = path.join(FIXTURES_DIR, `${name}.json`);
    fs.writeFileSync(fixturePath, JSON.stringify(data, null, 2));
    console.log(`${CYAN}[FIXTURE] Saved: ${name}.json${RESET}`);
}

/**
 * Deep compare objects
 */
function deepEqual(a, b, path = '') {
    if (a === b) return { equal: true };
    
    if (typeof a !== typeof b) {
        return { equal: false, path, expected: a, actual: b };
    }
    
    if (typeof a !== 'object' || a === null || b === null) {
        return { equal: false, path, expected: a, actual: b };
    }
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    // Check for missing keys
    for (const key of keysA) {
        if (!keysB.includes(key)) {
            return { equal: false, path: `${path}.${key}`, expected: a[key], actual: undefined };
        }
    }
    
    // Check values
    for (const key of keysA) {
        const result = deepEqual(a[key], b[key], `${path}.${key}`);
        if (!result.equal) return result;
    }
    
    return { equal: true };
}

/**
 * Run a single test
 */
async function runTest(category, name, testFn) {
    const testId = `${category}/${name}`;
    const startTime = Date.now();
    
    try {
        const result = await testFn();
        const duration = Date.now() - startTime;
        
        // Load expected fixture
        const fixtureName = `${category}-${name}`;
        const expected = loadFixture(fixtureName);
        
        if (UPDATE_MODE) {
            // Update fixture with current result
            saveFixture(fixtureName, result);
            results.tests.push({ id: testId, status: 'updated', duration });
            return;
        }
        
        if (!expected) {
            // No fixture yet
            console.log(`${YELLOW}[SKIP]${RESET} ${testId} - No fixture (run with --update)`);
            results.skipped++;
            results.tests.push({ id: testId, status: 'skipped', duration });
            return;
        }
        
        // Compare result to fixture
        const comparison = deepEqual(expected, result);
        
        if (comparison.equal) {
            console.log(`${GREEN}[PASS]${RESET} ${testId} (${duration}ms)`);
            results.passed++;
            results.tests.push({ id: testId, status: 'passed', duration });
        } else {
            console.log(`${RED}[FAIL]${RESET} ${testId}`);
            console.log(`  Path: ${comparison.path}`);
            console.log(`  Expected: ${JSON.stringify(comparison.expected)}`);
            console.log(`  Actual: ${JSON.stringify(comparison.actual)}`);
            results.failed++;
            results.tests.push({ id: testId, status: 'failed', duration, diff: comparison });
        }
        
    } catch (err) {
        const duration = Date.now() - startTime;
        console.log(`${RED}[ERROR]${RESET} ${testId}: ${err.message}`);
        results.failed++;
        results.tests.push({ id: testId, status: 'error', error: err.message, duration });
    }
}

// ============================================================
// TEST SUITES
// ============================================================

/**
 * Plugin Tests
 */
async function testPlugins() {
    console.log(`\n${CYAN}=== Plugin Tests ===${RESET}\n`);
    
    // Test: Plugin loader discovers plugins
    await runTest('plugins', 'discovery', async () => {
        const PluginLoader = require('../plugins/plugin-loader');
        const loader = new PluginLoader({ pluginsDir: path.join(__dirname, '../plugins') });
        const discovered = loader.discover();
        return {
            count: discovered.length,
            ids: discovered.map(p => p.id).sort()
        };
    });
    
    // Test: Core plugin manifest
    await runTest('plugins', 'core-manifest', async () => {
        const manifest = JSON.parse(fs.readFileSync(
            path.join(__dirname, '../plugins/core/manifest.json'), 'utf8'
        ));
        return {
            id: manifest.id,
            required: manifest.required,
            provides: manifest.provides.sort()
        };
    });
    
    // Test: All manifests valid JSON
    await runTest('plugins', 'manifests-valid', async () => {
        const pluginsDir = path.join(__dirname, '../plugins');
        const errors = [];
        
        for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const manifestPath = path.join(pluginsDir, entry.name, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                try {
                    JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                } catch (e) {
                    errors.push({ plugin: entry.name, error: e.message });
                }
            }
        }
        
        return { valid: errors.length === 0, errors };
    });
}

/**
 * Template Tests (Widget Templates)
 */
async function testTemplates() {
    console.log(`\n${CYAN}=== Template Tests ===${RESET}\n`);
    
    const templatesDir = path.join(__dirname, '../templates');
    const templateTypes = ['control-widget', 'display-widget', 'tool-widget'];
    
    // Test: All templates exist
    await runTest('templates', 'directories-exist', async () => {
        const exists = {};
        for (const type of templateTypes) {
            exists[type] = fs.existsSync(path.join(templatesDir, type));
        }
        return { 
            allExist: Object.values(exists).every(v => v),
            templates: exists
        };
    });
    
    // Test: Shared files exist
    await runTest('templates', 'shared-files', async () => {
        const sharedDir = path.join(templatesDir, 'shared');
        const requiredFiles = ['widget-common.css', 'widget-base.js'];
        const exists = {};
        for (const file of requiredFiles) {
            exists[file] = fs.existsSync(path.join(sharedDir, file));
        }
        return {
            allExist: Object.values(exists).every(v => v),
            files: exists
        };
    });
    
    // Test: Each template has required files
    await runTest('templates', 'required-files', async () => {
        const requiredFiles = ['index.html', 'widget.js', 'widget.css', 'manifest.json'];
        const results = {};
        
        for (const type of templateTypes) {
            const templateDir = path.join(templatesDir, type);
            const files = {};
            for (const file of requiredFiles) {
                files[file] = fs.existsSync(path.join(templateDir, file));
            }
            results[type] = {
                complete: Object.values(files).every(v => v),
                files
            };
        }
        
        return {
            allComplete: Object.values(results).every(r => r.complete),
            templates: results
        };
    });
    
    // Test: All manifests valid JSON with required fields
    await runTest('templates', 'manifests-valid', async () => {
        const requiredFields = ['id', 'name', 'version', 'type', 'entry', 'components'];
        const results = {};
        
        for (const type of templateTypes) {
            const manifestPath = path.join(templatesDir, type, 'manifest.json');
            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                const hasFields = {};
                for (const field of requiredFields) {
                    hasFields[field] = field in manifest;
                }
                results[type] = {
                    valid: true,
                    hasRequiredFields: Object.values(hasFields).every(v => v),
                    fields: hasFields
                };
            } catch (e) {
                results[type] = { valid: false, error: e.message };
            }
        }
        
        return {
            allValid: Object.values(results).every(r => r.valid && r.hasRequiredFields),
            manifests: results
        };
    });
    
    // Test: HTML templates have required structure
    await runTest('templates', 'html-structure', async () => {
        const requiredElements = [
            'widget-container',
            'widget-header',
            'widget-content',
            'btn-transparency',
            'btn-settings',
            'settings-panel'
        ];
        const results = {};
        
        for (const type of templateTypes) {
            const htmlPath = path.join(templatesDir, type, 'index.html');
            const html = fs.readFileSync(htmlPath, 'utf8');
            const found = {};
            for (const element of requiredElements) {
                found[element] = html.includes(element);
            }
            results[type] = {
                complete: Object.values(found).every(v => v),
                elements: found
            };
        }
        
        return {
            allComplete: Object.values(results).every(r => r.complete),
            templates: results
        };
    });
    
    // Test: CSS has required variables
    await runTest('templates', 'css-variables', async () => {
        const cssPath = path.join(templatesDir, 'shared', 'widget-common.css');
        const css = fs.readFileSync(cssPath, 'utf8');
        
        const requiredVars = [
            '--bg-primary',
            '--text-primary',
            '--accent-color',
            '--border-color',
            '--header-height'
        ];
        
        const found = {};
        for (const v of requiredVars) {
            found[v] = css.includes(v);
        }
        
        return {
            allPresent: Object.values(found).every(v => v),
            variables: found
        };
    });
    
    // Test: JS base class has required methods
    await runTest('templates', 'base-class-methods', async () => {
        const jsPath = path.join(templatesDir, 'shared', 'widget-base.js');
        const js = fs.readFileSync(jsPath, 'utf8');
        
        const requiredMethods = [
            'connectWebSocket',
            'sendCommand',
            'saveSettings',
            'loadSettings',
            'updateStatus',
            'toggleTransparency'
        ];
        
        const found = {};
        for (const method of requiredMethods) {
            found[method] = js.includes(method);
        }
        
        return {
            allPresent: Object.values(found).every(v => v),
            methods: found
        };
    });
}

/**
 * File Inspection Tests
 */
async function testFileInspection() {
    console.log(`\n${CYAN}=== File Inspection Tests ===${RESET}\n`);
    
    const FileInspector = require('./lib/file-inspector');
    const inspector = new FileInspector();
    const projectDir = path.join(__dirname, '..');
    
    // Test: File Inspector loads
    await runTest('files', 'inspector-loads', async () => {
        return {
            loaded: typeof FileInspector === 'function',
            hasMethods: ['inspect', 'detectType', 'scanDirectory'].every(m => 
                typeof inspector[m] === 'function'
            )
        };
    });
    
    // Test: Detect file types
    await runTest('files', 'type-detection', async () => {
        const testFiles = {
            js: path.join(projectDir, 'package.json'),
            html: path.join(projectDir, 'simwidget-hybrid', 'ui', 'aircraft-control', 'index.html'),
            css: path.join(projectDir, 'templates', 'shared', 'widget-common.css')
        };
        
        const results = {};
        for (const [expected, filePath] of Object.entries(testFiles)) {
            if (fs.existsSync(filePath)) {
                const type = inspector.detectType(filePath);
                results[expected] = { detected: type.type, match: true };
            }
        }
        
        return { results, allDetected: Object.keys(results).length > 0 };
    });
    
    // Test: Inspect JavaScript files
    await runTest('files', 'js-inspection', async () => {
        const jsFile = path.join(projectDir, 'templates', 'shared', 'widget-base.js');
        const result = inspector.inspectJS(jsFile);
        
        return {
            hasMetadata: !!result.name && !!result.size,
            hasHash: !!result.md5 && !!result.sha256,
            hasDependencies: !!result.dependencies,
            hasScan: !!result.scan
        };
    });
    
    // Test: Inspect JSON files
    await runTest('files', 'json-inspection', async () => {
        const jsonFile = path.join(projectDir, 'package.json');
        const result = inspector.inspectJSON(jsonFile);
        
        return {
            valid: result.valid,
            isPackageJson: result.isPackageJson,
            hasKeys: result.keys?.length > 0
        };
    });
    
    // Test: Inspect CSS files
    await runTest('files', 'css-inspection', async () => {
        const cssFile = path.join(projectDir, 'templates', 'shared', 'widget-common.css');
        const result = inspector.inspectCSS(cssFile);
        
        return {
            hasMetadata: !!result.name,
            hasAnalysis: !!result.analysis,
            hasVariables: result.analysis?.variableCount > 0
        };
    });
    
    // Test: Inspect HTML files
    await runTest('files', 'html-inspection', async () => {
        const htmlFile = path.join(projectDir, 'templates', 'control-widget', 'index.html');
        const result = inspector.inspectHTML(htmlFile);
        
        return {
            hasMetadata: !!result.name,
            hasDoctype: result.analysis?.hasDoctype,
            hasAnalysis: !!result.analysis
        };
    });
    
    // Test: Directory scan
    await runTest('files', 'directory-scan', async () => {
        const scanDir = path.join(projectDir, 'templates');
        const result = inspector.scanDirectory(scanDir, { maxDepth: 2 });
        
        return {
            scanned: true,
            totalFiles: result.summary.total,
            hasTypeBreakdown: Object.keys(result.summary.byType).length > 0,
            hasExtBreakdown: Object.keys(result.summary.byExtension).length > 0
        };
    });
    
    // Test: Magic bytes detection
    await runTest('files', 'magic-bytes', async () => {
        const sqliteDb = path.join(projectDir, 'tests', 'history.sqlite');
        let sqliteResult = { detected: false };
        
        if (fs.existsSync(sqliteDb)) {
            const type = inspector.detectType(sqliteDb);
            sqliteResult = { detected: type.type === 'sqlite', name: type.name };
        }
        
        return {
            sqlite: sqliteResult
        };
    });
    
    // Test: File metadata
    await runTest('files', 'metadata-extraction', async () => {
        const testFile = path.join(projectDir, 'package.json');
        const meta = inspector.getMetadata(testFile);
        
        return {
            hasPath: !!meta.path,
            hasName: !!meta.name,
            hasSize: typeof meta.size === 'number',
            hasMd5: !!meta.md5 && meta.md5.length === 32,
            hasSha256: !!meta.sha256 && meta.sha256.length === 64,
            hasTimestamps: !!meta.created && !!meta.modified
        };
    });
    
    // Test: Binary detection
    await runTest('files', 'binary-detection', async () => {
        const textFile = path.join(projectDir, 'package.json');
        const textResult = inspector.inspectGeneric(textFile);
        
        return {
            textDetected: textResult.isBinary === false,
            hasScan: !!textResult.scan
        };
    });
    
    // Test: Scan node_modules binaries (if any .node files exist)
    await runTest('files', 'node-addon-scan', async () => {
        const nodeModules = path.join(projectDir, 'node_modules');
        let foundAddon = false;
        let addonInfo = null;
        
        // Quick search for .node files
        const searchForNode = (dir, depth = 0) => {
            if (depth > 3 || foundAddon) return;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (foundAddon) break;
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory() && entry.name !== '.bin') {
                        searchForNode(fullPath, depth + 1);
                    } else if (entry.name.endsWith('.node')) {
                        foundAddon = true;
                        addonInfo = inspector.inspect(fullPath);
                    }
                }
            } catch {}
        };
        
        if (fs.existsSync(nodeModules)) {
            searchForNode(nodeModules);
        }
        
        return {
            searched: true,
            foundAddon,
            addonValid: addonInfo ? addonInfo.pe?.valid : null
        };
    });
}

/**
 * Service Tests (External APIs)
 */
async function testServices() {
    console.log(`\n${CYAN}=== Service Tests ===${RESET}\n`);
    
    // Test: SimWidget server responds
    await runTest('services', 'server-status', async () => {
        const { status, data } = await httpGet(`${SERVER_URL}/api/status`);
        return {
            reachable: status === 200,
            hasVersion: !!data.version,
            hasPlugins: Array.isArray(data.plugins)
        };
    });
    
    // Test: Lorby AAO connection
    await runTest('services', 'lorby-connection', async () => {
        try {
            const { data } = await httpGet(`${LORBY_URL}/webapi?conn=1`);
            return { connected: data === 'OK' || data.includes('OK') };
        } catch {
            return { connected: false };
        }
    });
    
    // Test: Lorby SimVar read
    await runTest('services', 'lorby-simvar', async () => {
        try {
            const { data } = await httpGet(`${LORBY_URL}/webapi?var=(E:ZULU TIME,Seconds)`);
            const value = parseFloat(data);
            return { 
                readable: !isNaN(value),
                type: typeof value
            };
        } catch {
            return { readable: false };
        }
    });
}

/**
 * Widget Tests
 */
async function testWidgets() {
    console.log(`\n${CYAN}=== Widget Tests ===${RESET}\n`);
    
    const widgets = [
        'flight-data-widget',
        'aircraft-control',
        'voice-control',
        'flight-recorder'
    ];
    
    for (const widget of widgets) {
        await runTest('widgets', `${widget}-loads`, async () => {
            try {
                const { status } = await httpGet(`${SERVER_URL}/ui/${widget}/`);
                return { loads: status === 200 };
            } catch {
                return { loads: false };
            }
        });
    }
}

/**
 * API Tests
 */
async function testAPIs() {
    console.log(`\n${CYAN}=== API Tests ===${RESET}\n`);
    
    // Test: Flight data endpoint (via /api/status which contains flightData)
    await runTest('api', 'flight-data-structure', async () => {
        const { status, data } = await httpGet(`${SERVER_URL}/api/status`);
        const flightData = data.flightData || {};
        return {
            status,
            hasAltitude: 'altitude' in flightData,
            hasSpeed: 'speed' in flightData,
            hasHeading: 'heading' in flightData,
            hasConnected: 'connected' in flightData
        };
    });
    
    // Test: Plugins endpoint
    await runTest('api', 'plugins-list', async () => {
        const { status, data } = await httpGet(`${SERVER_URL}/api/plugins`);
        return {
            status,
            isArray: Array.isArray(data),
            count: Array.isArray(data) ? data.length : 0
        };
    });
    
    // Test: Keymaps endpoint
    await runTest('api', 'keymaps', async () => {
        const { status, data } = await httpGet(`${SERVER_URL}/api/keymaps`);
        return {
            status,
            hasCategories: typeof data === 'object'
        };
    });
}

/**
 * Security Tests
 */
async function testSecurity() {
    console.log(`\n${CYAN}=== Security Tests ===${RESET}\n`);
    
    // Load security test suite
    try {
        const securityTests = require('./suites/security.test.js');
        
        for (const test of securityTests) {
            await runTest(test.category, test.name, test.run);
        }
    } catch (err) {
        console.log(`${YELLOW}[SKIP]${RESET} Security tests - ${err.message}`);
    }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
    console.log(`\n${CYAN}╔════════════════════════════════════════╗${RESET}`);
    console.log(`${CYAN}║   SimWidget Test Runner v1.1.0         ║${RESET}`);
    console.log(`${CYAN}╚════════════════════════════════════════╝${RESET}`);
    
    if (UPDATE_MODE) {
        console.log(`\n${YELLOW}⚠ UPDATE MODE - Saving current results as fixtures${RESET}\n`);
    }
    
    if (DB_MODE && db) {
        console.log(`${CYAN}📊 Database mode - results will be saved to history${RESET}\n`);
        runId = db.startRun(FILTER ? `scheduled:${FILTER}` : 'scheduled');
    }
    
    const startTime = Date.now();
    
    // Run test suites based on filter
    if (!FILTER || FILTER === 'plugins') await testPlugins();
    if (!FILTER || FILTER === 'templates') await testTemplates();
    if (!FILTER || FILTER === 'files') await testFileInspection();
    if (!FILTER || FILTER === 'services') await testServices();
    if (!FILTER || FILTER === 'widgets') await testWidgets();
    if (!FILTER || FILTER === 'api') await testAPIs();
    if (!FILTER || FILTER === 'security') await testSecurity();
    
    const totalTime = Date.now() - startTime;
    
    // Summary
    console.log(`\n${CYAN}═══════════════════════════════════════${RESET}`);
    console.log(`${GREEN}Passed: ${results.passed}${RESET}`);
    console.log(`${RED}Failed: ${results.failed}${RESET}`);
    console.log(`${YELLOW}Skipped: ${results.skipped}${RESET}`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`${CYAN}═══════════════════════════════════════${RESET}\n`);
    
    // Save to database
    if (DB_MODE && db && runId) {
        db.completeRun(runId, {
            duration: totalTime,
            passed: results.passed,
            failed: results.failed,
            skipped: results.skipped
        });
        
        // Record individual results
        for (const test of results.tests) {
            db.recordResult(runId, test);
        }
        
        console.log(`${GREEN}✓${RESET} Results saved to database (Run #${runId})`);
        
        // Cloud sync if requested
        if (CLOUD_MODE) {
            try {
                const SupabaseSync = require('./lib/supabase-client');
                cloud = new SupabaseSync();
                
                if (cloud.enabled) {
                    const syncResult = await cloud.syncToCloud(db);
                    if (syncResult.success) {
                        console.log(`${GREEN}☁${RESET} Synced ${syncResult.synced} run(s) to cloud`);
                    } else {
                        console.log(`${YELLOW}☁${RESET} Cloud sync failed: ${syncResult.reason}`);
                    }
                } else {
                    console.log(`${YELLOW}☁${RESET} Cloud not configured - skipping sync`);
                }
            } catch (err) {
                console.log(`${YELLOW}☁${RESET} Cloud sync error: ${err.message}`);
            }
        }
        
        db.close();
    }
    
    // Save JSON results
    const resultsFile = path.join(RESULTS_DIR, `results-${Date.now()}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        duration: totalTime,
        runId: runId || null,
        summary: {
            passed: results.passed,
            failed: results.failed,
            skipped: results.skipped
        },
        tests: results.tests
    }, null, 2));
    
    console.log(`Results saved: ${resultsFile}`);
    
    // Exit code
    process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(console.error);
