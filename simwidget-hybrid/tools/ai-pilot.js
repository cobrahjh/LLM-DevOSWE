#!/usr/bin/env node
/**
 * Headless AI Pilot — Node.js process that flies the aircraft
 * Runs alongside server.js on harold-pc, connects via WebSocket.
 * No browser needed — immune to tab freezing.
 *
 * Usage: node tools/ai-pilot.js [--host 127.0.0.1] [--port 8080]
 *
 * Controls: Press keys in terminal:
 *   a = toggle AI on/off
 *   c = toggle auto-controls (AI has flight controls)
 *   q = quit
 */

const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

// ── Parse args ──
const args = process.argv.slice(2);
const host = args.includes('--host') ? args[args.indexOf('--host') + 1] : '127.0.0.1';
const port = args.includes('--port') ? args[args.indexOf('--port') + 1] : '8080';
const wsUrl = `ws://${host}:${port}`;

// ── Load browser modules in Node.js context ──
// These are plain JS classes with no browser dependencies
function loadModule(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const script = new vm.Script(code, { filename: path.basename(filePath) });
    script.runInThisContext();
}

// Load in dependency order
loadModule(path.join(__dirname, '../ui/ai-autopilot/data/aircraft-profiles.js'));
loadModule(path.join(__dirname, '../ui/ai-autopilot/modules/flight-phase.js'));
loadModule(path.join(__dirname, '../ui/ai-autopilot/modules/command-queue.js'));
loadModule(path.join(__dirname, '../ui/ai-autopilot/modules/rule-engine.js'));

// ── State ──
let aiEnabled = false;
let autoControls = false;
let lastData = null;
let wsCount = 0;
let cmdCount = 0;
let ws = null;
let reconnectTimer = null;

// AP state tracking (mirrors what sim reports)
const ap = {
    master: false, headingHold: false, altitudeHold: false,
    vsHold: false, speedHold: false, navHold: false, aprHold: false
};
const setValues = { heading: 0, altitude: 8500, vs: 0, speed: 110 };

// ── Initialize modules ──
const profile = AIRCRAFT_PROFILES.C172;

const commandQueue = new CommandQueue({
    sendCommand: (cmd) => sendWsCommand(cmd),
    profile: profile,
    onCommandExecuted: (entry) => {
        cmdCount++;
        if (entry.description) {
            log('CMD', entry.description);
        }
    }
});

const flightPhase = new FlightPhase({
    targetCruiseAlt: 8500,
    profile: profile,
    onPhaseChange: (newPhase, oldPhase) => {
        log('PHASE', `${oldPhase} → ${newPhase}`);
    }
});

const ruleEngine = new RuleEngine({
    profile: profile,
    commandQueue: commandQueue
});

// ── WebSocket ──
function sendWsCommand(cmd) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
        if (typeof cmd === 'string') {
            ws.send(JSON.stringify({ type: 'command', command: cmd }));
        } else if (cmd && cmd.command) {
            ws.send(JSON.stringify({ type: 'command', command: cmd.command, value: cmd.value }));
        }
    } catch (e) {
        log('ERR', 'Send failed: ' + e.message);
    }
}

function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    log('WS', `Connecting to ${wsUrl}...`);
    ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        log('WS', 'Connected');
        if (reconnectTimer) { clearInterval(reconnectTimer); reconnectTimer = null; }
    });

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);
            if (msg.type === 'flightData' && msg.data) {
                wsCount++;
                onFlightData(msg.data);
            }
        } catch (e) {
            // ignore parse errors
        }
    });

    ws.on('close', () => {
        log('WS', 'Disconnected');
        scheduleReconnect();
    });

    ws.on('error', (e) => {
        log('ERR', 'WS error: ' + e.message);
    });
}

function scheduleReconnect() {
    if (!reconnectTimer) {
        reconnectTimer = setInterval(() => {
            log('WS', 'Reconnecting...');
            connect();
        }, 3000);
    }
}

// ── Flight Data Handler ──
function onFlightData(d) {
    lastData = d;

    // Update AP state from sim
    if (d.apMaster !== undefined) ap.master = d.apMaster;
    if (d.apHdgLock !== undefined) ap.headingHold = d.apHdgLock;
    if (d.apAltLock !== undefined) ap.altitudeHold = d.apAltLock;
    if (d.apVsLock !== undefined) ap.vsHold = d.apVsLock;
    if (d.apSpdLock !== undefined) ap.speedHold = d.apSpdLock;
    if (d.apNavLock !== undefined) ap.navHold = d.apNavLock;
    if (d.apAprLock !== undefined) ap.aprHold = d.apAprLock;

    // Update set values
    if (d.apHdgSet !== undefined) setValues.heading = Math.round(d.apHdgSet);
    if (d.apAltSet !== undefined) setValues.altitude = Math.round(d.apAltSet);
    if (d.apVsSet !== undefined) setValues.vs = Math.round(d.apVsSet);
    if (d.apSpdSet !== undefined) setValues.speed = Math.round(d.apSpdSet);

    if (!aiEnabled) return;

    // Update flight phase
    flightPhase.update(d);

    // Run rule engine (with auto-controls if enabled)
    if (autoControls) {
        ruleEngine.evaluate(flightPhase.phase, d, ap);
    }
}

// ── Logging ──
const LOG_COLORS = {
    WS: '\x1b[36m',    // cyan
    CMD: '\x1b[33m',   // yellow
    PHASE: '\x1b[35m', // magenta
    ERR: '\x1b[31m',   // red
    AI: '\x1b[32m',    // green
    INFO: '\x1b[37m'   // white
};
const RESET = '\x1b[0m';

function log(cat, msg) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const color = LOG_COLORS[cat] || RESET;
    console.log(`${color}[${time}] [${cat}]${RESET} ${msg}`);
}

// ── Status display ──
let lastStatusLine = '';
function updateStatus() {
    if (!lastData) return;
    const d = lastData;
    const phase = flightPhase.phase;
    const subPhase = ruleEngine.getTakeoffSubPhase();
    const phaseStr = subPhase ? `${phase}/${subPhase}` : phase;

    const line = [
        `AI:${aiEnabled ? 'ON' : 'off'}`,
        `CTRL:${autoControls ? 'ON' : 'off'}`,
        `Phase:${phaseStr}`,
        `ALT:${Math.round(d.altitude || 0)}`,
        `SPD:${Math.round(d.speed || 0)}`,
        `HDG:${Math.round(d.heading || 0)}`,
        `VS:${Math.round(d.verticalSpeed || 0)}`,
        `THR:${Math.round(d.throttle || 0)}%`,
        `PCH:${(d.pitch || 0).toFixed(1)}`,
        `BNK:${(d.bank || 0).toFixed(1)}`,
        `GND:${d.onGround ? 'Y' : 'N'}`,
        `WS:${wsCount}`,
        `CMD:${cmdCount}`
    ].join(' | ');

    // Only print if changed
    if (line !== lastStatusLine) {
        lastStatusLine = line;
        process.stdout.write('\r\x1b[K' + line);
    }
}

// ── Keyboard input ──
if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (key) => {
        switch (key) {
            case 'a':
                aiEnabled = !aiEnabled;
                console.log('');
                log('AI', aiEnabled ? 'AI ENABLED' : 'AI DISABLED');
                if (!aiEnabled) {
                    // Release controls when disabling
                    sendWsCommand({ command: 'AXIS_ELEVATOR_SET', value: 0 });
                    sendWsCommand({ command: 'AXIS_RUDDER_SET', value: 0 });
                    sendWsCommand({ command: 'AXIS_AILERONS_SET', value: 0 });
                }
                break;
            case 'c':
                autoControls = !autoControls;
                ruleEngine.autoControls = autoControls;
                console.log('');
                log('AI', autoControls ? 'AUTO CONTROLS ON — AI has the flight controls' : 'AUTO CONTROLS OFF');
                if (!autoControls) {
                    sendWsCommand({ command: 'AXIS_ELEVATOR_SET', value: 0 });
                    sendWsCommand({ command: 'AXIS_RUDDER_SET', value: 0 });
                    sendWsCommand({ command: 'AXIS_AILERONS_SET', value: 0 });
                }
                break;
            case 'q':
            case '\u0003': // Ctrl+C
                console.log('');
                log('AI', 'Shutting down — releasing controls');
                sendWsCommand({ command: 'AXIS_ELEVATOR_SET', value: 0 });
                sendWsCommand({ command: 'AXIS_RUDDER_SET', value: 0 });
                sendWsCommand({ command: 'AXIS_AILERONS_SET', value: 0 });
                setTimeout(() => process.exit(0), 500);
                break;
        }
    });
}

// ── Main ──
console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║       SimGlass Headless AI Pilot v1.0.0         ║');
console.log('║  No browser needed — runs as Node.js process    ║');
console.log('╠══════════════════════════════════════════════════╣');
console.log('║  Keys:  a = toggle AI    c = toggle controls    ║');
console.log('║         q = quit                                ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('');
log('INFO', `Server: ${wsUrl}`);
log('INFO', `Profile: ${profile.name}`);
console.log('');

connect();

// Status line update at 4Hz
setInterval(updateStatus, 250);

// WS rate logging every 10s
let prevWsCount = 0;
setInterval(() => {
    const rate = (wsCount - prevWsCount) / 10;
    prevWsCount = wsCount;
    if (rate > 0) {
        // Only log if actively receiving data
        // log('WS', `${rate.toFixed(0)} msg/s`);
    }
}, 10000);
