/**
 * SimWidget Server - SimConnect Bridge
 * Uses node-simconnect v4.0.0
 */

const { open, Protocol, SimConnectDataType, SimConnectPeriod, SimConnectConstants } = require('node-simconnect');
const WebSocket = require('ws');

// Configuration
const WS_PORT = 8484;
const APP_NAME = 'SimWidget Engine';

// State
let handle = null;
let connected = false;
let simVarValues = {};

// WebSocket Server
const wss = new WebSocket.Server({ port: WS_PORT });
console.log(`[Server] WebSocket server running on port ${WS_PORT}`);

// Broadcast to all connected clients
function broadcast(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('[Server] Overlay client connected');
    
    ws.send(JSON.stringify({
        type: 'status',
        connected: connected,
        simVars: simVarValues
    }));
    
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            handleClientMessage(msg);
        } catch (e) {
            console.error('[Server] Invalid message:', e.message);
        }
    });
    
    ws.on('close', () => {
        console.log('[Server] Overlay client disconnected');
    });
});

// Handle messages from overlay
function handleClientMessage(msg) {
    if (!handle || !connected) {
        console.log('[Server] Not connected to sim');
        return;
    }
    
    if (msg.type === 'command' && msg.event) {
        const eventName = msg.event.startsWith('K:') ? msg.event.substring(2) : msg.event;
        console.log(`[Server] Triggering: ${eventName}`);
        
        try {
            const eventId = 1000 + Math.floor(Math.random() * 1000);
            handle.mapClientEventToSimEvent(eventId, eventName);
            handle.transmitClientEvent(0, eventId, msg.value || 0, 1, 16);
        } catch (e) {
            console.error('[Server] Event error:', e.message);
        }
    }
}

// SimVar definitions
const DEFINITION_ID = 1;
const REQUEST_ID = 1;

const simVarDefs = [
    { name: 'INDICATED ALTITUDE', unit: 'feet', type: SimConnectDataType.FLOAT64 },
    { name: 'AIRSPEED INDICATED', unit: 'knots', type: SimConnectDataType.FLOAT64 },
    { name: 'HEADING INDICATOR', unit: 'degrees', type: SimConnectDataType.FLOAT64 },
    { name: 'VERTICAL SPEED', unit: 'feet per minute', type: SimConnectDataType.FLOAT64 },
    { name: 'GROUND VELOCITY', unit: 'knots', type: SimConnectDataType.FLOAT64 },
    { name: 'AUTOPILOT MASTER', unit: 'bool', type: SimConnectDataType.INT32 },
    { name: 'AUTOPILOT HEADING LOCK', unit: 'bool', type: SimConnectDataType.INT32 },
    { name: 'AUTOPILOT HEADING LOCK DIR', unit: 'degrees', type: SimConnectDataType.FLOAT64 },
    { name: 'AUTOPILOT ALTITUDE LOCK', unit: 'bool', type: SimConnectDataType.INT32 },
    { name: 'AUTOPILOT ALTITUDE LOCK VAR', unit: 'feet', type: SimConnectDataType.FLOAT64 },
    { name: 'AUTOPILOT VERTICAL HOLD', unit: 'bool', type: SimConnectDataType.INT32 },
    { name: 'AUTOPILOT VERTICAL HOLD VAR', unit: 'feet per minute', type: SimConnectDataType.FLOAT64 },
    { name: 'LIGHT NAV', unit: 'bool', type: SimConnectDataType.INT32 },
    { name: 'LIGHT BEACON', unit: 'bool', type: SimConnectDataType.INT32 },
    { name: 'LIGHT STROBE', unit: 'bool', type: SimConnectDataType.INT32 },
    { name: 'LIGHT LANDING', unit: 'bool', type: SimConnectDataType.INT32 },
    { name: 'BRAKE PARKING POSITION', unit: 'bool', type: SimConnectDataType.INT32 },
    { name: 'GEAR HANDLE POSITION', unit: 'bool', type: SimConnectDataType.INT32 },
    { name: 'FLAPS HANDLE PERCENT', unit: 'percent', type: SimConnectDataType.FLOAT64 },
    { name: 'GENERAL ENG COMBUSTION:1', unit: 'bool', type: SimConnectDataType.INT32 },
    { name: 'GENERAL ENG THROTTLE LEVER POSITION:1', unit: 'percent', type: SimConnectDataType.FLOAT64 },
    { name: 'FUEL TOTAL QUANTITY', unit: 'gallons', type: SimConnectDataType.FLOAT64 },
    { name: 'SIM ON GROUND', unit: 'bool', type: SimConnectDataType.INT32 },
];

// Connect to SimConnect
async function connectToSim() {
    console.log('[SimConnect] Connecting to MSFS...');
    
    try {
        // In node-simconnect v4, open() returns { handle }
        const result = await open(APP_NAME, Protocol.KittyHawk);
        
        // The handle is directly on result or result itself is the handle
        handle = result.handle ? result.handle : result;
        
        console.log('[SimConnect] ✓ Connected to MSFS!');
        connected = true;
        broadcast({ type: 'status', connected: true });
        
        // Set up event listeners on the handle
        handle.on('close', () => {
            console.log('[SimConnect] ✗ Disconnected');
            connected = false;
            handle = null;
            broadcast({ type: 'status', connected: false });
            setTimeout(connectToSim, 5000);
        });
        
        handle.on('exception', (e) => {
            console.error('[SimConnect] Exception:', e);
        });
        
        handle.on('simObjectData', (recvData) => {
            if (recvData.requestID === REQUEST_ID) {
                handleSimData(recvData);
            }
        });
        
        // Register and request simvars
        registerSimVars();
        
    } catch (error) {
        console.log('[SimConnect] Connection failed:', error.message);
        console.log('[SimConnect] Retrying in 5 seconds...');
        setTimeout(connectToSim, 5000);
    }
}

// Register simvar definitions
function registerSimVars() {
    if (!handle) return;
    
    console.log('[SimConnect] Registering simvars...');
    
    try {
        // Add each simvar to the data definition
        simVarDefs.forEach((def) => {
            handle.addToDataDefinition(
                DEFINITION_ID,
                def.name,
                def.unit,
                def.type
            );
        });
        
        // Request data every second
        handle.requestDataOnSimObject(
            REQUEST_ID,
            DEFINITION_ID,
            SimConnectConstants.OBJECT_ID_USER,
            SimConnectPeriod.SECOND
        );
        
        console.log('[SimConnect] ✓ Receiving data...');
        
    } catch (e) {
        console.error('[SimConnect] Registration error:', e.message);
    }
}

// Handle incoming simvar data
function handleSimData(recvData) {
    const data = recvData.data;
    if (!data) return;
    
    const formatted = {};
    
    // Read values in order using the data buffer methods
    simVarDefs.forEach((def) => {
        const key = `A:${def.name}`;
        let value;
        
        try {
            if (def.type === SimConnectDataType.INT32) {
                value = data.readInt32();
            } else {
                value = data.readFloat64();
            }
        } catch (e) {
            value = 0;
        }
        
        formatted[key] = {
            value: value,
            unit: def.unit
        };
    });
    
    simVarValues = formatted;
    broadcast({ type: 'simvars', data: formatted });
    
    // Log first data receipt
    if (!this.dataReceived) {
        this.dataReceived = true;
        const alt = formatted['A:INDICATED ALTITUDE']?.value || 0;
        const spd = formatted['A:AIRSPEED INDICATED']?.value || 0;
        console.log(`[SimConnect] ✓ Data: Alt=${Math.round(alt)}ft, Spd=${Math.round(spd)}kts`);
    }
}

// Start server
console.log('╔════════════════════════════════════════╗');
console.log('║     SimWidget Engine Server v1.0       ║');
console.log('╠════════════════════════════════════════╣');
console.log('║  WebSocket: ws://localhost:8484        ║');
console.log('║  Make sure MSFS is running!            ║');
console.log('╚════════════════════════════════════════╝');

connectToSim();

process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');
    wss.close();
    process.exit(0);
});

process.on('uncaughtException', (e) => {
    console.error('[Server] Error:', e.message);
});
