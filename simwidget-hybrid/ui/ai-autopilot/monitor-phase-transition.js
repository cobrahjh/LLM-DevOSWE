/**
 * Monitor phase transitions and module loading in real-time
 * Usage: node monitor-phase-transition.js
 */

const fetch = require('node-fetch');

let lastPhase = null;
let lastModules = {
    atc: false,
    wind: false,
    llm: false
};

const API_URL = 'http://192.168.1.42:8080/api/status';

async function checkStatus() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        const phase = data.flightData?.aiAutopilot?.phase || 'UNKNOWN';
        const altitude = Math.round(data.flightData?.altitude || 0);
        const agl = Math.round(data.flightData?.altitudeAGL || 0);
        const speed = Math.round(data.flightData?.speed || 0);
        const onGround = data.flightData?.onGround;

        // Detect phase change
        if (phase !== lastPhase && lastPhase !== null) {
            const timestamp = new Date().toLocaleTimeString();
            console.log('\n' + '='.repeat(70));
            console.log(`🔄 [${timestamp}] PHASE TRANSITION: ${lastPhase} → ${phase}`);
            console.log('='.repeat(70));

            // Determine what should load
            const isGround = ['PREFLIGHT', 'TAXI'].includes(phase);
            const isAirborne = ['TAKEOFF', 'DEPARTURE', 'CLIMB', 'CRUISE', 'DESCENT', 'APPROACH', 'LANDING'].includes(phase);

            if (isGround) {
                console.log('📋 Expected: ATCController should be loaded');
                console.log('📋 Expected: WindCompensation should NOT be loaded');
            } else if (isAirborne) {
                console.log('📋 Expected: WindCompensation should be LOADING NOW ⏳');
                console.log('📋 Expected: ATCController remains loaded (cached)');
            }

            console.log('\n⚠️  Check browser console for:');
            if (isAirborne && phase === 'TAKEOFF') {
                console.log('   "✓ Loaded WindCompensation module (airborne phases)"');
            }
            console.log('\n' + '='.repeat(70) + '\n');
        }

        lastPhase = phase;

        // Display status
        const phaseIcon = {
            'PREFLIGHT': '🅿️',
            'TAXI': '🚕',
            'TAKEOFF': '🛫',
            'DEPARTURE': '⬆️',
            'CLIMB': '📈',
            'CRUISE': '✈️',
            'DESCENT': '📉',
            'APPROACH': '🎯',
            'LANDING': '🛬'
        }[phase] || '❓';

        const groundIcon = onGround ? '🟢 GROUND' : '🔴 AIRBORNE';

        process.stdout.write(`\r${phaseIcon} ${phase.padEnd(10)} | ${groundIcon} | ALT: ${altitude}ft (${agl}ft AGL) | SPD: ${speed}kt | Waiting for takeoff...`);

    } catch (error) {
        process.stdout.write(`\r❌ Error: ${error.message}`);
    }
}

console.log('🔍 Phase Transition Monitor Started');
console.log('📡 Monitoring: ' + API_URL);
console.log('🎯 Waiting for TAXI → TAKEOFF transition...\n');
console.log('📋 Instructions:');
console.log('   1. In MSFS, advance throttle and start takeoff roll');
console.log('   2. Watch for phase change notification below');
console.log('   3. Open browser console on AI Autopilot widget');
console.log('   4. Look for "✓ Loaded WindCompensation module" message\n');
console.log('='.repeat(70) + '\n');

// Poll every 500ms for responsive monitoring
const interval = setInterval(checkStatus, 500);

// Graceful shutdown
process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\n✅ Monitor stopped');
    process.exit(0);
});
