/**
 * Hot Reload Patch for SimGlass Server
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
const backupPath = path.join(__dirname, 'server.js.before-hotreload');

function patchServer() {
    console.log('🔥 Patching server.js for hot reload support...');
    
    let serverCode = fs.readFileSync(serverPath, 'utf8');
    
    // Check if already patched
    if (serverCode.includes('HotReloadManager')) {
        console.log('✅ Server already has hot reload support');
        return;
    }
    
    // Create backup if it doesn't exist
    if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, serverCode);
        console.log('📁 Created backup: server.js.before-hotreload');
    }
    
    // 1. Add hot reload import after other requires
    const importSection = `const cameraSystem = require('./camera-system');
const { HotReloadManager } = require('./hot-reload');

// Hot reload manager (development only)
const hotReloadManager = new HotReloadManager();`;
    
    serverCode = serverCode.replace(
        /const cameraSystem = require\('\.\/camera-system'\);/,
        importSection
    );
    
    // 2. Add shared-ui serving
    const sharedUIServe = `// Serve shared UI for hot reload and common components
const sharedUIPath = path.join(__dirname, '../shared-ui');
app.use('/shared-ui', express.static(sharedUIPath));

// Serve UI directories with listing`;
    
    serverCode = serverCode.replace(
        /\/\/ Serve UI directories with listing/,
        sharedUIServe
    );
    
    // 3. Modify WebSocket connection handler
    const wsHandlerPattern = /wss\.on\('connection', \(ws\) => \{[\s\S]*?console\.log\('Client connected'\);/;
    const newWSHandler = `wss.on('connection', (ws) => {
    console.log('Client connected');
    
    // Add client to hot reload manager (development only)
    hotReloadManager.addClient(ws);`;
    
    serverCode = serverCode.replace(wsHandlerPattern, newWSHandler);
    
    // Write patched file
    fs.writeFileSync(serverPath, serverCode);
    console.log('✅ Server patched with hot reload support');
    console.log('🔄 Restart the server to enable hot reload');
}

if (require.main === module) {
    patchServer();
}

module.exports = { patchServer };