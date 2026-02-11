#!/usr/bin/env node
/**
 * AI Pilot takeoff test: connect, enable AI, monitor for 90s
 * Assumes aircraft is already positioned on runway in MSFS.
 * Usage: node tools/ai-pilot-test.js [--time 90]
 */
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const host = '127.0.0.1';
const port = '8080';
const wsUrl = `ws://${host}:${port}`;

// Parse --time arg (default 90s)
const args = process.argv.slice(2);
const timeIdx = args.indexOf('--time');
const testDuration = timeIdx >= 0 ? parseInt(args[timeIdx + 1]) * 1000 : 90000;

// ── Load browser modules ──
function loadModule(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const script = new vm.Script(code, { filename: path.basename(filePath) });
    script.runInThisContext();
}

loadModule(path.join(__dirname, '../ui/ai-autopilot/data/aircraft-profiles.js'));
loadModule(path.join(__dirname, '../ui/ai-autopilot/modules/flight-phase.js'));
loadModule(path.join(__dirname, '../ui/ai-autopilot/modules/command-queue.js'));
loadModule(path.join(__dirname, '../ui/ai-autopilot/modules/rule-engine.js'));

console.log('Modules loaded OK');
console.log('Profile:', AIRCRAFT_PROFILES.C172.name);
console.log(`Test duration: ${testDuration / 1000}s`);

const profile = AIRCRAFT_PROFILES.C172;
let wsCount = 0;
let cmdCount = 0;
let lastData = null;

const ap = {
    master: false, headingHold: false, altitudeHold: false,
    vsHold: false, speedHold: false, navHold: false, aprHold: false
};

const commandQueue = new CommandQueue({
    sendCommand: (cmd) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        if (typeof cmd === 'string') {
            ws.send(JSON.stringify({ type: 'command', command: cmd }));
        } else if (cmd && cmd.command) {
            ws.send(JSON.stringify({ type: 'command', command: cmd.command, value: cmd.value }));
        }
        cmdCount++;
    },
    profile: profile,
    onCommandExecuted: (entry) => {
        if (entry.description) {
            console.log(`  [CMD] ${entry.description}`);
        }
    }
});

const flightPhase = new FlightPhase({
    targetCruiseAlt: 8500,
    profile: profile,
    onPhaseChange: (n, o) => console.log(`  [PHASE] ${o} → ${n}`)
});

const ruleEngine = new RuleEngine({
    profile: profile,
    commandQueue: commandQueue
});

// ── Connect ──
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('Connected to ' + wsUrl);

    // Wait 3s to count messages
    setTimeout(() => {
        console.log(`\nData rate: ${wsCount} msgs in 3s = ${(wsCount/3).toFixed(0)}/s`);
        if (wsCount < 10) {
            console.log('ERROR: Not enough data. Server may not be broadcasting.');
            process.exit(1);
        }

        console.log(`Flight data: alt=${Math.round(lastData?.altitude||0)} spd=${Math.round(lastData?.speed||0)} hdg=${Math.round(lastData?.heading||0)} pch=${(lastData?.pitch||0).toFixed(1)} bnk=${(lastData?.bank||0).toFixed(1)} gnd=${lastData?.onGround}`);
        console.log(`Phase: ${flightPhase.phase}`);

        console.log(`\n=== ENABLING AI + AUTO CONTROLS (${testDuration/1000}s) ===\n`);

        // Status every 2s
        let elapsed = 0;
        const iv = setInterval(() => {
            elapsed += 2;
            const d = lastData;
            if (!d) return;
            const sub = ruleEngine.getTakeoffSubPhase();
            const phStr = sub ? `${flightPhase.phase}/${sub}` : flightPhase.phase;
            console.log(`[${elapsed}s] ${phStr} | spd:${Math.round(d.speed||0)} alt:${Math.round(d.altitude||0)} agl:${Math.round(d.altitudeAGL||0)} vs:${Math.round(d.verticalSpeed||0)} pch:${(d.pitch||0).toFixed(1)} thr:${Math.round(d.throttle||0)}% bnk:${(d.bank||0).toFixed(1)} hdg:${Math.round(d.heading||0)} gnd:${d.onGround?'Y':'N'} cmds:${cmdCount}`);
        }, 2000);

        setTimeout(() => {
            clearInterval(iv);
            console.log(`\n=== ${testDuration/1000}s COMPLETE ===`);
            console.log(`Total: ${wsCount} msgs, ${cmdCount} commands`);
            console.log('Releasing controls...');
            ws.send(JSON.stringify({ type: 'command', command: 'AXIS_ELEVATOR_SET', value: 0 }));
            ws.send(JSON.stringify({ type: 'command', command: 'AXIS_RUDDER_SET', value: 0 }));
            ws.send(JSON.stringify({ type: 'command', command: 'AXIS_AILERONS_SET', value: 0 }));
            setTimeout(() => { ws.close(); process.exit(0); }, 1000);
        }, testDuration);
    }, 3000);
});

ws.on('message', (raw) => {
    try {
        const msg = JSON.parse(raw);
        if (msg.type === 'flightData' && msg.data) {
            wsCount++;
            lastData = msg.data;

            // Update AP state
            const d = msg.data;
            if (d.apMaster !== undefined) ap.master = d.apMaster;
            if (d.apHdgLock !== undefined) ap.headingHold = d.apHdgLock;
            if (d.apAltLock !== undefined) ap.altitudeHold = d.apAltLock;
            if (d.apVsLock !== undefined) ap.vsHold = d.apVsLock;
            if (d.apSpdLock !== undefined) ap.speedHold = d.apSpdLock;

            // Run AI if enabled (enabled after 3s warmup)
            if (wsCount > 100) {
                flightPhase.update(d);
                ruleEngine.evaluate(flightPhase.phase, d, ap);
            }
        }
    } catch(e) {}
});

ws.on('error', (e) => { console.error('WS error:', e.message); process.exit(1); });
ws.on('close', () => { console.log('Disconnected'); });
