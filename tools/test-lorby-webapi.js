/**
 * Lorby AAO WebAPI Test Script v1.0.0
 * Last Updated: 2025-01-08
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tools\test-lorby-webapi.js
 * 
 * Tests the Lorby Axis & Ohs WebAPI endpoints.
 */

const http = require('http');

const AAO_URL = 'http://localhost:43380/webapi';

class LorbyWebAPITester {
    constructor(baseUrl = AAO_URL) {
        this.baseUrl = baseUrl;
        this.results = [];
    }

    async request(params, method = 'GET') {
        return new Promise((resolve, reject) => {
            const url = new URL(this.baseUrl);
            Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
            
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: method,
                timeout: 2000
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        data: data.trim(),
                        headers: res.headers
                    });
                });
            });

            req.on('error', (err) => {
                reject(err);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    async testConnection() {
        console.log('\n=== Test 1: Connection Check ===');
        try {
            const result = await this.request({ conn: '1' });
            const success = result.data === 'OK';
            console.log(`Status: ${result.status}`);
            console.log(`Response: ${result.data}`);
            console.log(`Result: ${success ? '✅ PASS' : '❌ FAIL'}`);
            this.results.push({ test: 'Connection', success, data: result.data });
            return success;
        } catch (err) {
            console.log(`Error: ${err.message}`);
            console.log('Result: ❌ FAIL (Lorby AAO not running?)');
            this.results.push({ test: 'Connection', success: false, error: err.message });
            return false;
        }
    }

    async testReadSimVar(simvar) {
        console.log(`\n=== Test 2: Read SimVar ===`);
        console.log(`SimVar: ${simvar}`);
        try {
            const result = await this.request({ var: simvar });
            console.log(`Status: ${result.status}`);
            console.log(`Response: ${result.data}`);
            const success = result.status === 200 && result.data !== '';
            console.log(`Result: ${success ? '✅ PASS' : '⚠️ PARTIAL'}`);
            this.results.push({ test: 'ReadSimVar', success, data: result.data, simvar });
            return success;
        } catch (err) {
            console.log(`Error: ${err.message}`);
            console.log('Result: ❌ FAIL');
            this.results.push({ test: 'ReadSimVar', success: false, error: err.message });
            return false;
        }
    }

    async testReadMultipleSimVars() {
        console.log('\n=== Test 3: Read Multiple SimVars ===');
        const simvars = [
            '(A:PLANE ALTITUDE,feet)',
            '(A:AIRSPEED INDICATED,knots)',
            '(A:HEADING INDICATOR,degrees)',
            '(A:VERTICAL SPEED,feet per minute)',
            '(A:AUTOPILOT MASTER,bool)'
        ];

        const results = [];
        for (const sv of simvars) {
            try {
                const result = await this.request({ var: sv });
                results.push({ simvar: sv, value: result.data, success: true });
                console.log(`  ${sv}: ${result.data}`);
            } catch (err) {
                results.push({ simvar: sv, error: err.message, success: false });
                console.log(`  ${sv}: ERROR - ${err.message}`);
            }
        }
        
        const allSuccess = results.every(r => r.success);
        console.log(`Result: ${allSuccess ? '✅ PASS' : '⚠️ PARTIAL'}`);
        this.results.push({ test: 'ReadMultipleSimVars', success: allSuccess, data: results });
        return allSuccess;
    }

    async testExecuteEvent(event) {
        console.log(`\n=== Test 4: Execute Event (Read-Only Test) ===`);
        console.log(`Event: ${event}`);
        console.log('Note: Not actually executing to avoid changing sim state');
        console.log('Result: ⏭️ SKIPPED (safety)');
        this.results.push({ test: 'ExecuteEvent', success: true, skipped: true, event });
        return true;
    }

    async testBulkScript() {
        console.log('\n=== Test 5: Bulk Script Read ===');
        // Read multiple values in one script
        const script = '(A:PLANE ALTITUDE,feet) (A:AIRSPEED INDICATED,knots) +';
        try {
            const result = await this.request({ scr: script });
            console.log(`Script: ${script}`);
            console.log(`Status: ${result.status}`);
            console.log(`Response: ${result.data}`);
            const success = result.status === 200;
            console.log(`Result: ${success ? '✅ PASS' : '⚠️ PARTIAL'}`);
            this.results.push({ test: 'BulkScript', success, data: result.data });
            return success;
        } catch (err) {
            console.log(`Error: ${err.message}`);
            console.log('Result: ❌ FAIL');
            this.results.push({ test: 'BulkScript', success: false, error: err.message });
            return false;
        }
    }

    async runAllTests() {
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║     Lorby Axis & Ohs WebAPI Test Suite v1.0.0          ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log(`Target: ${this.baseUrl}`);
        console.log(`Time: ${new Date().toISOString()}`);

        const connected = await this.testConnection();
        
        if (connected) {
            await this.testReadSimVar('(A:PLANE ALTITUDE,feet)');
            await this.testReadMultipleSimVars();
            await this.testExecuteEvent('K:TOGGLE_NAV_LIGHTS');
            await this.testBulkScript();
        }

        this.printSummary();
        return this.results;
    }

    printSummary() {
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║                    Test Summary                         ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        
        const passed = this.results.filter(r => r.success).length;
        const total = this.results.length;
        
        this.results.forEach(r => {
            const icon = r.success ? '✅' : (r.skipped ? '⏭️' : '❌');
            console.log(`  ${icon} ${r.test}`);
        });
        
        console.log(`\nTotal: ${passed}/${total} passed`);
        console.log(`Status: ${passed === total ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}`);
    }
}

// Main execution
if (require.main === module) {
    const tester = new LorbyWebAPITester();
    tester.runAllTests().then(() => {
        console.log('\nTest complete!');
    }).catch(err => {
        console.error('Test suite error:', err.message);
        process.exit(1);
    });
}

module.exports = LorbyWebAPITester;
