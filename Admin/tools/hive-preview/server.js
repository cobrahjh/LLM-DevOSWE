/**
 * Hive Device Preview Server
 * Local responsive design testing tool
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8800;

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript'
    };

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
            res.end(content);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════╗
║       HIVE DEVICE PREVIEW            ║
║   http://localhost:${PORT}              ║
╚══════════════════════════════════════╝
`);
});
