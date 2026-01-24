/**
 * SimWidget Multiplayer Sync Server
 * Enables shared cockpit - sync widget state between pilots
 */

const WebSocket = require('ws');

class SyncServer {
    constructor(port = 8085) {
        this.port = port;
        this.rooms = new Map(); // roomCode -> { clients: Set, state: {} }
        this.clientRooms = new Map(); // ws -> roomCode
        this.wss = null;
    }

    start() {
        this.wss = new WebSocket.Server({ port: this.port });

        this.wss.on('connection', (ws, req) => {
            console.log('[Sync] Client connected');

            ws.isAlive = true;
            ws.on('pong', () => { ws.isAlive = true; });

            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data);
                    this.handleMessage(ws, msg);
                } catch (e) {
                    console.error('[Sync] Invalid message:', e.message);
                }
            });

            ws.on('close', () => {
                this.handleDisconnect(ws);
            });

            ws.on('error', (err) => {
                console.error('[Sync] WebSocket error:', err.message);
            });
        });

        // Heartbeat to detect dead connections
        setInterval(() => {
            this.wss.clients.forEach(ws => {
                if (!ws.isAlive) {
                    this.handleDisconnect(ws);
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        console.log('[Sync] Server started on port', this.port);
    }

    handleMessage(ws, msg) {
        switch (msg.type) {
            case 'create-room':
                this.createRoom(ws, msg);
                break;
            case 'join-room':
                this.joinRoom(ws, msg);
                break;
            case 'leave-room':
                this.leaveRoom(ws);
                break;
            case 'sync-state':
                this.syncState(ws, msg);
                break;
            case 'sync-action':
                this.syncAction(ws, msg);
                break;
            case 'chat':
                this.broadcastChat(ws, msg);
                break;
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
        }
    }

    createRoom(ws, msg) {
        const roomCode = this.generateRoomCode();
        const pilotName = msg.pilotName || 'Pilot 1';

        this.rooms.set(roomCode, {
            clients: new Set([ws]),
            pilots: new Map([[ws, { name: pilotName, role: 'captain', joinedAt: Date.now() }]]),
            state: {},
            createdAt: Date.now()
        });

        this.clientRooms.set(ws, roomCode);

        ws.send(JSON.stringify({
            type: 'room-created',
            roomCode,
            pilotName,
            role: 'captain'
        }));

        console.log('[Sync] Room created:', roomCode);
    }

    joinRoom(ws, msg) {
        const { roomCode, pilotName = 'Pilot' } = msg;

        if (!this.rooms.has(roomCode)) {
            ws.send(JSON.stringify({
                type: 'error',
                error: 'Room not found'
            }));
            return;
        }

        const room = this.rooms.get(roomCode);

        // Leave any existing room
        this.leaveRoom(ws);

        // Join new room
        room.clients.add(ws);
        room.pilots.set(ws, {
            name: pilotName,
            role: 'first-officer',
            joinedAt: Date.now()
        });
        this.clientRooms.set(ws, roomCode);

        // Send current state to new pilot
        ws.send(JSON.stringify({
            type: 'room-joined',
            roomCode,
            pilotName,
            role: 'first-officer',
            pilots: this.getPilotList(room),
            state: room.state
        }));

        // Notify others
        this.broadcast(roomCode, {
            type: 'pilot-joined',
            pilotName,
            pilots: this.getPilotList(room)
        }, ws);

        console.log('[Sync] Pilot joined room:', roomCode, pilotName);
    }

    leaveRoom(ws) {
        const roomCode = this.clientRooms.get(ws);
        if (!roomCode) return;

        const room = this.rooms.get(roomCode);
        if (!room) return;

        const pilot = room.pilots.get(ws);
        room.clients.delete(ws);
        room.pilots.delete(ws);
        this.clientRooms.delete(ws);

        if (room.clients.size === 0) {
            // Room empty, delete it
            this.rooms.delete(roomCode);
            console.log('[Sync] Room deleted:', roomCode);
        } else {
            // Notify remaining pilots
            this.broadcast(roomCode, {
                type: 'pilot-left',
                pilotName: pilot?.name || 'Unknown',
                pilots: this.getPilotList(room)
            });
        }
    }

    syncState(ws, msg) {
        const roomCode = this.clientRooms.get(ws);
        if (!roomCode) return;

        const room = this.rooms.get(roomCode);
        if (!room) return;

        const { widget, state } = msg;

        // Update room state
        room.state[widget] = state;

        // Broadcast to others
        this.broadcast(roomCode, {
            type: 'state-update',
            widget,
            state,
            from: room.pilots.get(ws)?.name || 'Unknown'
        }, ws);
    }

    syncAction(ws, msg) {
        const roomCode = this.clientRooms.get(ws);
        if (!roomCode) return;

        const room = this.rooms.get(roomCode);
        if (!room) return;

        // Broadcast action to all including sender for confirmation
        this.broadcast(roomCode, {
            type: 'action',
            widget: msg.widget,
            action: msg.action,
            data: msg.data,
            from: room.pilots.get(ws)?.name || 'Unknown'
        });
    }

    broadcastChat(ws, msg) {
        const roomCode = this.clientRooms.get(ws);
        if (!roomCode) return;

        const room = this.rooms.get(roomCode);
        if (!room) return;

        this.broadcast(roomCode, {
            type: 'chat',
            message: msg.message,
            from: room.pilots.get(ws)?.name || 'Unknown',
            timestamp: Date.now()
        });
    }

    broadcast(roomCode, msg, exclude = null) {
        const room = this.rooms.get(roomCode);
        if (!room) return;

        const data = JSON.stringify(msg);
        room.clients.forEach(client => {
            if (client !== exclude && client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    }

    handleDisconnect(ws) {
        this.leaveRoom(ws);
        console.log('[Sync] Client disconnected');
    }

    getPilotList(room) {
        const pilots = [];
        room.pilots.forEach((info, client) => {
            pilots.push({
                name: info.name,
                role: info.role,
                connected: client.readyState === WebSocket.OPEN
            });
        });
        return pilots;
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    getStats() {
        return {
            rooms: this.rooms.size,
            clients: this.wss?.clients?.size || 0,
            roomList: Array.from(this.rooms.entries()).map(([code, room]) => ({
                code,
                pilots: room.pilots.size,
                createdAt: room.createdAt
            }))
        };
    }
}

// Run standalone or export
if (require.main === module) {
    const server = new SyncServer(8085);
    server.start();
} else {
    module.exports = SyncServer;
}
