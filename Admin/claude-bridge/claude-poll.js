/**
 * Claude Code Polling Helper v1.0.0
 *
 * Simple script to poll Smart Router for messages.
 * Run this at start of Claude Code session.
 *
 * Usage: node claude-poll.js [connect|poll|disconnect]
 *
 * Path: C:\LLM-DevOSWE\Admin\claude-bridge\claude-poll.js
 */

const http = require('http');

const ROUTER_URL = 'http://localhost:8610';

function post(path, body = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${ROUTER_URL}${path}`);
        const req = http.request({
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve({ raw: data }); }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify(body));
        req.end();
    });
}

function get(path) {
    return new Promise((resolve, reject) => {
        http.get(`${ROUTER_URL}${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Parse error')); }
            });
        }).on('error', reject);
    });
}

async function connect() {
    const result = await post('/api/claude/connect', { sessionId: `claude-${Date.now()}` });
    console.log('Connected:', result);
    return result;
}

async function disconnect() {
    const result = await post('/api/claude/disconnect');
    console.log('Disconnected:', result);
    return result;
}

async function poll() {
    const result = await get('/api/messages/next');
    if (result.hasMessage) {
        console.log('\n=== NEW MESSAGE ===');
        console.log(`ID: ${result.id}`);
        console.log(`Content: ${result.content}`);
        console.log(`Age: ${result.age}`);
        console.log('==================\n');
    }
    return result;
}

async function complete(id, response, success = true) {
    const result = await post(`/api/messages/${id}/complete`, { response, success });
    console.log('Completed:', result);
    return result;
}

async function status() {
    const result = await get('/api/claude/status');
    console.log('Status:', JSON.stringify(result, null, 2));
    return result;
}

// CLI interface
const cmd = process.argv[2];

if (cmd === 'connect') {
    connect().catch(console.error);
} else if (cmd === 'disconnect') {
    disconnect().catch(console.error);
} else if (cmd === 'poll') {
    poll().catch(console.error);
} else if (cmd === 'status') {
    status().catch(console.error);
} else {
    console.log('Usage: node claude-poll.js [connect|poll|disconnect|status]');
}

module.exports = { connect, disconnect, poll, complete, status };
