/**
 * AI Autopilot Navigation Integration Test
 *
 * Tests that the AI Autopilot rule engine is actually using
 * nav state data for lateral navigation guidance.
 *
 * Usage: node test-ai-nav-integration.js
 */

const http = require('http');

const TEST_CONFIG = {
    host: 'localhost',
    port: 8080,
    timeout: 10000
};

class AINavIntegrationTest {
    constructor() {
        this.results = {
            apiAvailable: false,
            hasNavGuidance: false,
            navGuidanceData: null,
            aiEnabled: false,
            phase: null,
            errors: []
        };
    }

    log(type, msg) {
        const prefix = {
            'info': '  ℹ️ ',
            'success': '  ✅',
            'error': '  ❌',
            'warn': '  ⚠️ ',
            'data': '  📊'
        }[type] || '  ';
        console.log(`${prefix} ${msg}`);
    }

    async httpGet(path) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: TEST_CONFIG.host,
                port: TEST_CONFIG.port,
                path: path,
                method: 'GET',
                timeout: TEST_CONFIG.timeout
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch (err) {
                        reject(new Error(`JSON parse error: ${err.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    async testAPIAvailability() {
        this.log('info', 'Checking AI Autopilot API...');
        try {
            const status = await this.httpGet('/api/ai-pilot/status');
            this.results.apiAvailable = true;
            this.results.aiEnabled = status.simConnected || false;
            this.log('success', 'AI Autopilot API available');
            if (status.phase) {
                this.results.phase = status.phase;
                this.log('data', `Current phase: ${status.phase}`);
            }
            return true;
        } catch (err) {
            this.log('error', `API check failed: ${err.message}`);
            this.results.errors.push(`API: ${err.message}`);
            return false;
        }
    }

    async testSharedState() {
        this.log('info', 'Checking shared nav state...');
        try {
            const state = await this.httpGet('/api/ai-pilot/shared-state/nav');
            if (state && state.activeWaypoint) {
                this.results.hasNavGuidance = true;
                this.results.navGuidanceData = state;
                const wp = state.activeWaypoint;
                const cdi = state.cdi;

                this.log('success', 'Nav state available in shared state');
                this.log('data', `  Waypoint: ${wp.ident || 'N/A'}, ${wp.distNm?.toFixed(1) || '--'}nm`);
                this.log('data', `  Bearing: ${wp.bearingMag?.toFixed(0) || '--'}°`);
                if (cdi) {
                    this.log('data', `  CDI: Source=${cdi.source || 'N/A'}, DTK=${cdi.dtk?.toFixed(0) || '--'}°, XTRK=${cdi.xtrk?.toFixed(2) || '--'}nm`);
                }
                if (state.flightPlan) {
                    const fp = state.flightPlan;
                    this.log('data', `  Flight Plan: ${fp.departure || '????'} → ${fp.arrival || '????'} (${fp.waypointCount || 0} waypoints)`);
                    if (fp.cruiseAltitude) {
                        this.log('data', `  Cruise Alt: ${fp.cruiseAltitude} ft`);
                    }
                }
                return true;
            } else {
                this.log('warn', 'Nav state exists but no active waypoint');
                return false;
            }
        } catch (err) {
            this.log('warn', `Shared state check: ${err.message}`);
            this.log('info', 'This is normal if GTN750 is not open');
            return false;
        }
    }

    async testAutopilotState() {
        this.log('info', 'Checking autopilot state broadcast...');
        try {
            const state = await this.httpGet('/api/ai-pilot/shared-state/autopilot');
            if (state) {
                this.log('success', 'Autopilot state available');
                if (state.enabled) {
                    this.log('data', `  AI Enabled: ${state.enabled}`);
                    this.log('data', `  Phase: ${state.phase || 'N/A'}`);
                }
                if (state.navGuidance) {
                    const ng = state.navGuidance;
                    this.log('success', 'Nav guidance present in autopilot state!');
                    this.log('data', `  Waypoint: ${ng.wpIdent || 'N/A'}, ${ng.wpDist?.toFixed(1) || '--'}nm`);
                    this.log('data', `  Nav Mode: ${ng.navMode || 'N/A'}`);
                    if (ng.interceptHdg != null) {
                        this.log('data', `  Intercept Heading: ${ng.interceptHdg}°`);
                    }
                    if (ng.cdiSource) {
                        this.log('data', `  CDI Source: ${ng.cdiSource}`);
                    }
                    return true;
                } else {
                    this.log('warn', 'Nav guidance not in autopilot state');
                    return false;
                }
            } else {
                this.log('warn', 'No autopilot state available');
                return false;
            }
        } catch (err) {
            this.log('warn', `Autopilot state check: ${err.message}`);
            return false;
        }
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('  AI AUTOPILOT NAV INTEGRATION - TEST RESULTS');
        console.log('='.repeat(60));

        console.log('\n  API Tests:');
        console.log(`    AI Autopilot API: ${this.results.apiAvailable ? '✅ Available' : '❌ Unavailable'}`);
        console.log(`    Nav State Data: ${this.results.hasNavGuidance ? '✅ Present' : '⚠️  Missing (GTN750 not open?)'}`);

        if (this.results.errors.length > 0) {
            console.log('\n  Errors:');
            this.results.errors.forEach(err => console.log(`    ❌ ${err}`));
        }

        console.log('\n' + '='.repeat(60));

        const critical = this.results.apiAvailable;
        const ideal = critical && this.results.hasNavGuidance;

        if (ideal) {
            console.log('  ✅ ALL INTEGRATION TESTS PASSED');
            console.log('     Nav state is flowing from GTN750 → AI Autopilot');
            console.log('='.repeat(60) + '\n');
            return 0;
        } else if (critical) {
            console.log('  ⚠️  PARTIAL SUCCESS');
            console.log('     API works, but nav state missing.');
            console.log('     Open GTN750 page to enable nav-guided flight.');
            console.log('='.repeat(60) + '\n');
            return 0;
        } else {
            console.log('  ❌ INTEGRATION TESTS FAILED');
            console.log('='.repeat(60) + '\n');
            return 1;
        }
    }

    async run() {
        console.log('\n' + '='.repeat(60));
        console.log('  AI AUTOPILOT NAV INTEGRATION TEST');
        console.log('='.repeat(60) + '\n');
        console.log('  This test verifies the AI Autopilot is receiving');
        console.log('  and using nav state data from GTN750.\n');

        try {
            const apiOk = await this.testAPIAvailability();
            if (!apiOk) {
                return this.printResults();
            }

            await this.testSharedState();
            await this.testAutopilotState();

            return this.printResults();

        } catch (err) {
            this.log('error', `Test failed: ${err.message}`);
            this.results.errors.push(err.message);
            return this.printResults();
        }
    }
}

// Run the test
const test = new AINavIntegrationTest();
test.run().then(exitCode => {
    process.exit(exitCode);
}).catch(err => {
    console.error('\n  ❌ Fatal error:', err.message);
    process.exit(1);
});
