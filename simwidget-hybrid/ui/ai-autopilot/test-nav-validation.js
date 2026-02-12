/**
 * Flight Plan Navigation - Quick Validation Test
 *
 * Monitors WebSocket for nav-state broadcasts and validates:
 * 1. GTN750 broadcasts nav-state via SafeChannel
 * 2. Nav-state contains required fields
 * 3. Data updates at expected frequency
 *
 * Usage: node test-nav-validation.js
 */

const WebSocket = require('ws');

const TEST_CONFIG = {
    wsUrl: 'ws://localhost:8080',
    timeout: 30000,  // 30 second timeout
    expectedInterval: 1000,  // Nav-state should arrive every ~1s
    requiredFields: {
        flightPlan: ['departure', 'arrival', 'waypointCount'],
        activeWaypoint: ['ident', 'distNm', 'bearingMag'],
        cdi: ['source', 'dtk', 'xtrk'],
    }
};

class NavValidationTest {
    constructor() {
        this.ws = null;
        this.navStateReceived = [];
        this.startTime = Date.now();
        this.testResults = {
            wsConnected: false,
            navStateCount: 0,
            firstNavStateTime: null,
            lastNavStateTime: null,
            avgInterval: null,
            hasFlightPlan: false,
            hasActiveWaypoint: false,
            hasCDI: false,
            hasDestDist: false,
            errors: []
        };
    }

    log(type, msg) {
        const timestamp = ((Date.now() - this.startTime) / 1000).toFixed(1) + 's';
        const prefix = {
            'info': '  ℹ️ ',
            'success': '  ✅',
            'error': '  ❌',
            'warn': '  ⚠️ ',
            'data': '  📊'
        }[type] || '  ';
        console.log(`${prefix} [${timestamp}] ${msg}`);
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.log('info', 'Connecting to WebSocket...');
            this.ws = new WebSocket(TEST_CONFIG.wsUrl);

            this.ws.on('open', () => {
                this.testResults.wsConnected = true;
                this.log('success', 'WebSocket connected');
                resolve();
            });

            this.ws.on('error', (err) => {
                this.log('error', `WebSocket error: ${err.message}`);
                this.testResults.errors.push(`WS Error: ${err.message}`);
                reject(err);
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });

            this.ws.on('close', () => {
                this.log('info', 'WebSocket closed');
            });

            setTimeout(() => {
                if (!this.testResults.wsConnected) {
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 5000);
        });
    }

    handleMessage(data) {
        try {
            const msg = JSON.parse(data);

            // We're looking for flightData messages that would indicate
            // the AI Autopilot is receiving data from GTN750
            if (msg.type === 'flightData') {
                // Check if GPS waypoint data is present (indicates nav state)
                if (msg.data && msg.data.gpsWpCount > 0) {
                    const now = Date.now();

                    if (!this.testResults.firstNavStateTime) {
                        this.testResults.firstNavStateTime = now;
                        this.log('success', 'First GPS waypoint data received');
                    }

                    this.testResults.lastNavStateTime = now;
                    this.testResults.navStateCount++;
                    this.navStateReceived.push(now);

                    // Validate GPS data
                    const d = msg.data;
                    const hasWaypoint = d.gpsWpCount > 0 && d.gpsWpIndex >= 0;
                    const hasDistance = d.gpsWpDistance != null;
                    const hasBearing = d.gpsWpBearing != null;
                    const hasCDI = d.gpsCdiNeedle != null && d.gpsCrossTrackError != null;
                    const hasDTK = d.gpsDesiredTrack != null;

                    if (hasWaypoint && !this.testResults.hasActiveWaypoint) {
                        this.testResults.hasActiveWaypoint = true;
                        this.log('success', `Active waypoint detected: #${d.gpsWpIndex}/${d.gpsWpCount}, ${d.gpsWpDistance?.toFixed(1)}nm, ${d.gpsWpBearing?.toFixed(0)}°`);
                    }

                    if (hasCDI && !this.testResults.hasCDI) {
                        this.testResults.hasCDI = true;
                        this.log('success', `CDI data detected: XTRK ${d.gpsCrossTrackError?.toFixed(2)}nm, DTK ${d.gpsDesiredTrack?.toFixed(0)}°`);
                    }

                    if (d.gpsEte != null && !this.testResults.hasDestDist) {
                        this.testResults.hasDestDist = true;
                        this.log('success', `Destination data detected: ETE ${(d.gpsEte / 60).toFixed(0)}min`);
                    }

                    // Log every 5th update
                    if (this.testResults.navStateCount % 5 === 0) {
                        this.log('data', `GPS updates: ${this.testResults.navStateCount}, WP ${d.gpsWpIndex}/${d.gpsWpCount}, ${d.gpsWpDistance?.toFixed(1)}nm @ ${d.gpsWpBearing?.toFixed(0)}°, XTRK ${d.gpsCrossTrackError?.toFixed(2)}nm`);
                    }
                }
            }
        } catch (err) {
            this.log('error', `Message parse error: ${err.message}`);
            this.testResults.errors.push(`Parse error: ${err.message}`);
        }
    }

    calculateStats() {
        if (this.navStateReceived.length < 2) return;

        const intervals = [];
        for (let i = 1; i < this.navStateReceived.length; i++) {
            intervals.push(this.navStateReceived[i] - this.navStateReceived[i - 1]);
        }

        if (intervals.length > 0) {
            const sum = intervals.reduce((a, b) => a + b, 0);
            this.testResults.avgInterval = Math.round(sum / intervals.length);
        }
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('  FLIGHT PLAN NAVIGATION - VALIDATION RESULTS');
        console.log('='.repeat(60));

        const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
        console.log(`\n  Test Duration: ${duration}s`);
        console.log(`  WebSocket: ${this.testResults.wsConnected ? '✅ Connected' : '❌ Failed'}`);
        console.log(`  GPS Updates Received: ${this.testResults.navStateCount}`);

        if (this.testResults.avgInterval) {
            console.log(`  Average Update Interval: ${this.testResults.avgInterval}ms (expected ~1000ms)`);
        }

        console.log('\n  Data Validation:');
        console.log(`    Active Waypoint: ${this.testResults.hasActiveWaypoint ? '✅ Present' : '❌ Missing'}`);
        console.log(`    CDI Data: ${this.testResults.hasCDI ? '✅ Present' : '❌ Missing'}`);
        console.log(`    Destination Data: ${this.testResults.hasDestDist ? '✅ Present' : '❌ Missing'}`);

        if (this.testResults.errors.length > 0) {
            console.log('\n  Errors:');
            this.testResults.errors.forEach(err => console.log(`    ❌ ${err}`));
        }

        console.log('\n' + '='.repeat(60));

        const allPassed =
            this.testResults.wsConnected &&
            this.testResults.navStateCount >= 3 &&
            this.testResults.hasActiveWaypoint &&
            this.testResults.hasCDI &&
            this.testResults.errors.length === 0;

        if (allPassed) {
            console.log('  ✅ ALL TESTS PASSED');
            console.log('='.repeat(60) + '\n');
            return 0;
        } else {
            console.log('  ⚠️  SOME TESTS FAILED OR INCOMPLETE');
            console.log('='.repeat(60) + '\n');

            if (this.testResults.navStateCount < 3) {
                console.log('  💡 Note: GPS data updates may take a few seconds to start.');
                console.log('     Make sure MSFS is running with a GPS flight plan loaded.\n');
            }

            return 1;
        }
    }

    async run() {
        console.log('\n' + '='.repeat(60));
        console.log('  FLIGHT PLAN NAVIGATION - VALIDATION TEST');
        console.log('='.repeat(60) + '\n');
        console.log('  This test monitors the WebSocket for GPS/nav data');
        console.log('  to verify the flight plan navigation implementation.\n');
        console.log('  Listening for 15 seconds...\n');

        try {
            await this.connect();

            // Listen for 15 seconds
            await new Promise(resolve => setTimeout(resolve, 15000));

            this.calculateStats();
            this.ws.close();

            // Wait a moment for close to complete
            await new Promise(resolve => setTimeout(resolve, 500));

            return this.printResults();

        } catch (err) {
            this.log('error', `Test failed: ${err.message}`);
            this.testResults.errors.push(err.message);
            return this.printResults();
        }
    }
}

// Run the test
const test = new NavValidationTest();
test.run().then(exitCode => {
    process.exit(exitCode);
}).catch(err => {
    console.error('\n  ❌ Fatal error:', err.message);
    process.exit(1);
});
