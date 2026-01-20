/**
 * HTTPS Proxy for Hive Services
 * Wraps HTTP services with HTTPS for secure mic/camera access
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CERT_DIR = path.join(__dirname, 'certs');
const HTTPS_PORT = process.env.HTTPS_PORT || 8443;

// Services to proxy
const SERVICES = {
    '/kittbox': { target: 'http://127.0.0.1:8585', name: 'KittBox' },
    '/relay': { target: 'http://127.0.0.1:8600', name: 'Relay' },
    '/oracle': { target: 'http://127.0.0.1:3002', name: 'Oracle' },
    '/hivemind': { target: 'http://127.0.0.1:8701', name: 'Hive-Mind' },
    '/whisper': { target: 'http://127.0.0.1:8660', name: 'Whisper' }
};

// Load certificates
const options = {
    key: fs.readFileSync(path.join(CERT_DIR, 'hive-key.pem')),
    cert: fs.readFileSync(path.join(CERT_DIR, 'hive-cert.pem'))
};

// Create HTTPS server
const server = https.createServer(options, (req, res) => {
    // CORS headers for browser access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Find matching service
    let targetUrl = null;
    let servicePath = '';

    for (const [prefix, service] of Object.entries(SERVICES)) {
        if (req.url.startsWith(prefix)) {
            targetUrl = service.target;
            servicePath = req.url.slice(prefix.length) || '/';
            break;
        }
    }

    // Default to KittBox for everything not matched
    if (!targetUrl) {
        targetUrl = SERVICES['/kittbox'].target;
        servicePath = req.url;
    }


    // Proxy the request
    const proxyUrl = new URL(servicePath, targetUrl);

    const proxyReq = http.request({
        hostname: proxyUrl.hostname,
        port: proxyUrl.port,
        path: proxyUrl.pathname + proxyUrl.search,
        method: req.method,
        headers: { ...req.headers, host: proxyUrl.host }
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error(`[HTTPS Proxy] Error: ${err.message}`);
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'Service unavailable', message: err.message }));
    });

    req.pipe(proxyReq);
});

server.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`\n🔒 Hive HTTPS Gateway running on https://0.0.0.0:${HTTPS_PORT}`);
    console.log('\nServices available:');
    for (const [path, svc] of Object.entries(SERVICES)) {
        console.log(`  ${svc.name}: https://YOUR_IP:${HTTPS_PORT}${path}`);
    }
    console.log('\n⚠️  Self-signed cert - accept the warning in browser');
});
