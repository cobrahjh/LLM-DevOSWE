/**
 * Lorby AAO WebAPI Test & Integration
 * Version: 1.0.0
 * Last Updated: 2025-01-08
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tools\lorby-aao-api.js
 * 
 * Tests and documents the Lorby Axis & Ohs WebAPI endpoints.
 */

const http = require('http');
const url = require('url');

const AAO_BASE_URL = 'http://localhost:43380/webapi';

class LorbyAAOClient {
    constructor(baseUrl = AAO_BASE_URL) {
        this.baseUrl = baseUrl;
        this.connected = false;
        this.lastError = null;
    }

    /**
     * Make HTTP GET request to AAO
     */
    async request(params) {
        return new Promise((resolve, reject) => {
            const queryString = new URLSearchParams(params).toString();
            const fullUrl = `${this.baseUrl}?${queryString}`;
            
            const req = http.get(fullUrl, { timeout: 2000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        data: data.trim()
                    });
                });
            });
            
            req.on('error', (err) => {
                this.lastError = err.message;
                reject(err);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    /**
     * Check connection to Lorby AAO
     */
    async checkConnection() {
        try {
            const result = await this.request({ conn: '1' });
            this.connected = result.data === 'OK';
            return this.connected;
        } catch (err) {
            this.connected = false;
            this.lastError = err.message;
            return false;
        }
    }

    /**
     * Execute a SimConnect event or RPN script
     */
    async executeEvent(eventScript) {
        try {
            const result = await this.request({ evt: eventScript });
            return { success: true, response: result.data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Read a single SimVar
     */
    async readVar(simvar) {
        try {
            const result = await this.request({ var: simvar });
            const value = parseFloat(result.data);
            return { success: true, value, raw: result.data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Read multiple SimVars at once
     */
    async readVars(simvars) {
        try {
            const varString = simvars.join('|');
            const result = await this.request({ vars: varString });
            const values = result.data.split('|').map(v => parseFloat(v));
            return { 
                success: true, 
                values,
                pairs: simvars.reduce((acc, sv, i) => {
                    acc[sv] = values[i];
                    return acc;
                }, {})
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Write an LVar value
     */
    async writeLVar(lvarName, value) {
        const script = `${value} (>L:${lvarName})`;
        return this.executeEvent(script);
    }

    /**
     * Toggle an LVar boolean
     */
    async toggleLVar(lvarName) {
        const script = `(L:${lvarName}) ! (>L:${lvarName})`;
        return this.executeEvent(script);
    }

    /**
     * Trigger an H:event
     */
    async triggerHVar(hvarName) {
        const script = `(>H:${hvarName})`;
        return this.executeEvent(script);
    }

    /**
     * Send K:event
     */
    async sendKEvent(eventName, value = 1) {
        const script = `${value} (>K:${eventName})`;
        return this.executeEvent(script);
    }
}

// ═══════════════════════════════════════════════════════════
// API TEST SUITE
// ═══════════════════════════════════════════════════════════

async function runAPITests() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Lorby AAO WebAPI Test Suite');
    console.log('═══════════════════════════════════════════════════════════\n');

    const client = new LorbyAAOClient();
    const results = [];

    // Test 1: Connection Check
    console.log('Test 1: Connection Check');
    console.log('  URL: http://localhost:43380/webapi?conn=1');
    try {
        const connected = await client.checkConnection();
        console.log(`  Result: ${connected ? '✅ CONNECTED' : '❌ NOT CONNECTED'}\n`);
        results.push({ test: 'Connection', passed: connected });
    } catch (err) {
        console.log(`  Result: ❌ ERROR - ${err.message}\n`);
        results.push({ test: 'Connection', passed: false, error: err.message });
    }

    if (!client.connected) {
        console.log('⚠️  Lorby AAO not running. Start MSFS and Lorby AAO to test full API.\n');
        return results;
    }

    // Test 2: Read Altitude
    console.log('Test 2: Read SimVar (Altitude)');
    console.log('  URL: ?var=(A:PLANE ALTITUDE,feet)');
    const altResult = await client.readVar('(A:PLANE ALTITUDE,feet)');
    console.log(`  Result: ${altResult.success ? `✅ ${altResult.value} feet` : `❌ ${altResult.error}`}\n`);
    results.push({ test: 'Read Altitude', passed: altResult.success, value: altResult.value });

    // Test 3: Read Multiple Vars
    console.log('Test 3: Read Multiple SimVars');
    const multiVars = [
        '(A:PLANE ALTITUDE,feet)',
        '(A:AIRSPEED INDICATED,knots)',
        '(A:HEADING INDICATOR,degrees)'
    ];
    console.log(`  URL: ?vars=${multiVars.join('|')}`);
    const multiResult = await client.readVars(multiVars);
    if (multiResult.success) {
        console.log(`  Result: ✅`);
        console.log(`    Altitude: ${multiResult.values[0]} ft`);
        console.log(`    Airspeed: ${multiResult.values[1]} kts`);
        console.log(`    Heading:  ${multiResult.values[2]}°\n`);
    } else {
        console.log(`  Result: ❌ ${multiResult.error}\n`);
    }
    results.push({ test: 'Read Multiple', passed: multiResult.success });

    // Test 4: Read Light Status
    console.log('Test 4: Read Light Status');
    console.log('  URL: ?var=(A:LIGHT NAV,Bool)');
    const navLight = await client.readVar('(A:LIGHT NAV,Bool)');
    console.log(`  Result: ${navLight.success ? `✅ Nav Light: ${navLight.value ? 'ON' : 'OFF'}` : `❌ ${navLight.error}`}\n`);
    results.push({ test: 'Read Nav Light', passed: navLight.success });

    // Test 5: Execute K:event (toggle nav lights)
    console.log('Test 5: Execute K:Event (DO NOT RUN IN PRODUCTION)');
    console.log('  Would execute: 1 (>K:TOGGLE_NAV_LIGHTS)');
    console.log('  Skipping to avoid changing sim state\n');
    results.push({ test: 'K:Event', passed: true, skipped: true });

    // Test 6: Read Autopilot Status
    console.log('Test 6: Read Autopilot Status');
    const apVars = [
        '(A:AUTOPILOT MASTER,Bool)',
        '(A:AUTOPILOT HEADING LOCK,Bool)',
        '(A:AUTOPILOT ALTITUDE LOCK,Bool)'
    ];
    const apResult = await client.readVars(apVars);
    if (apResult.success) {
        console.log(`  Result: ✅`);
        console.log(`    AP Master: ${apResult.values[0] ? 'ON' : 'OFF'}`);
        console.log(`    HDG Hold:  ${apResult.values[1] ? 'ON' : 'OFF'}`);
        console.log(`    ALT Hold:  ${apResult.values[2] ? 'ON' : 'OFF'}\n`);
    } else {
        console.log(`  Result: ❌ ${apResult.error}\n`);
    }
    results.push({ test: 'Read AP Status', passed: apResult.success });

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Test Summary');
    console.log('═══════════════════════════════════════════════════════════');
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    console.log(`  Passed: ${passed}/${total}`);
    results.forEach(r => {
        const icon = r.passed ? '✅' : '❌';
        const note = r.skipped ? ' (skipped)' : '';
        console.log(`    ${icon} ${r.test}${note}`);
    });

    return results;
}

// ═══════════════════════════════════════════════════════════
// DOCUMENTED ENDPOINTS
// ═══════════════════════════════════════════════════════════

const DOCUMENTED_ENDPOINTS = {
    connection: {
        url: '?conn=1',
        description: 'Check if Lorby AAO is connected to MSFS',
        response: 'OK or empty'
    },
    executeEvent: {
        url: '?evt={RPN_SCRIPT}',
        description: 'Execute RPN script or SimConnect event',
        examples: [
            '?evt=1 (>K:TOGGLE_NAV_LIGHTS)',
            '?evt=(>H:AS1000_PFD_VOL_1_DEC)',
            '?evt=(L:MyLvar) ! (>L:MyLvar)'
        ]
    },
    readVar: {
        url: '?var={SIMVAR}',
        description: 'Read single SimVar value',
        examples: [
            '?var=(A:PLANE ALTITUDE,feet)',
            '?var=(L:A32NX_FCU_ALT_MANAGED)'
        ]
    },
    readVars: {
        url: '?vars={VAR1}|{VAR2}|{VAR3}',
        description: 'Read multiple SimVars (pipe-separated)',
        response: 'Pipe-separated values'
    }
};

// Export
module.exports = { LorbyAAOClient, runAPITests, DOCUMENTED_ENDPOINTS };

// Run if executed directly
if (require.main === module) {
    runAPITests()
        .then(() => console.log('\nTest complete.'))
        .catch(err => console.error('Test failed:', err));
}
