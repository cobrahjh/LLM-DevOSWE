const http = require('http');

const PORT = 3003;
const LM_STUDIO_URL = 'http://localhost:1234';

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Health check
    if (req.url === '/api/health') {
        try {
            const modelRes = await fetch(`${LM_STUDIO_URL}/v1/models`);
            const models = await modelRes.json();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                node: 'ai-pc',
                role: 'vision-ai',
                models: models.data?.map(m => m.id) || [],
                lmstudio: 'connected'
            }));
        } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'degraded',
                node: 'ai-pc',
                lmstudio: 'unavailable',
                error: e.message
            }));
        }
        return;
    }

    // Node info
    if (req.url === '/api/info') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            node: 'ai-pc',
            ip: '192.168.1.162',
            services: {
                'hive-bridge': { port: 3003, status: 'running' },
                'lmstudio': { port: 1234, status: 'check /api/health' }
            },
            capabilities: ['llm', 'vision', 'embeddings']
        }));
        return;
    }

    // Proxy to LM Studio /v1/* endpoints
    if (req.url.startsWith('/v1/')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const options = {
                hostname: 'localhost',
                port: 1234,
                path: req.url,
                method: req.method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(req.headers.authorization && { 'Authorization': req.headers.authorization })
                }
            };

            const proxyReq = http.request(options, proxyRes => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'LM Studio unavailable', details: err.message }));
            });

            if (body) proxyReq.write(body);
            proxyReq.end();
        });
        return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', endpoints: ['/api/health', '/api/info', '/v1/*'] }));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Hive Bridge] AI-PC node running on port ${PORT}`);
    console.log(`[Hive Bridge] Proxying to LM Studio at ${LM_STUDIO_URL}`);
    console.log(`[Hive Bridge] Health: http://localhost:${PORT}/api/health`);
});
