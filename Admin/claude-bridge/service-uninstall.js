/**
 * SimWidget Claude Bridge Windows Service Uninstaller
 * v1.0.0 - 2026-01-11
 *
 * Path: C:\LLM-DevOSWE\Admin\claude-bridge\service-uninstall.js
 *
 * Run as Administrator:
 *   node service-uninstall.js
 */

const path = require('path');
const Service = require('node-windows').Service;

// Service configuration
const svc = new Service({
    name: 'SimWidget Claude Bridge',
    script: path.join(__dirname, 'bridge-server.js')
});

svc.on('uninstall', () => {
    console.log('✅ Service uninstalled successfully');
    console.log('');
    console.log('SimWidget Claude Bridge is no longer a Windows Service.');
    console.log('You can still run it manually: node bridge-server.js');
});

svc.on('stop', () => {
    console.log('Service stopped');
});

svc.on('error', (err) => {
    console.error('❌ Error:', err);
});

// Uninstall the service
console.log('');
console.log('╔════════════════════════════════════════════════╗');
console.log('║    SimWidget Claude Bridge Service Removal     ║');
console.log('╚════════════════════════════════════════════════╝');
console.log('');
console.log('Stopping and removing service...');
console.log('');

svc.uninstall();
