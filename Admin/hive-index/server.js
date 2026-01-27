/**
 * HIVE INDEX SERVER
 * Port: 8888
 * Purpose: Unified index of all projects, services, features
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8880;

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.url === '/health' || req.url === '/api/health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', service: 'hive-index' }));
        return;
    }

    // Serve index.html
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(fs.readFileSync(indexPath, 'utf8'));
    } else {
        res.writeHead(404);
        res.end('Index not found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║              🐝 HIVE INDEX v1.0.0                      ║');
    console.log('╠═══════════════════════════════════════════════════════╣');
    console.log(`║  URL: http://localhost:${PORT}                           ║`);
    console.log('║  Everything in one place.                             ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
});
