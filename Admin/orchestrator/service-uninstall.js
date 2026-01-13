/**
 * Master (O) Windows Service Uninstaller
 * v1.0.0 - 2026-01-09
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\Admin\orchestrator\service-uninstall.js
 * 
 * Run as Administrator:
 *   node service-uninstall.js
 */

const path = require('path');
const Service = require('node-windows').Service;

const svc = new Service({
    name: 'SimWidget Master O',
    script: path.join(__dirname, 'orchestrator.js')
});

svc.on('uninstall', () => {
    console.log('✅ Service uninstalled successfully');
    console.log('');
    console.log('Master (O) is no longer a Windows Service.');
    console.log('You can still run it manually: node orchestrator.js');
});

svc.on('stop', () => {
    console.log('Service stopped');
});

svc.on('error', (err) => {
    console.error('❌ Error:', err);
});

console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║  SimWidget Master (O) Service Removal  ║');
console.log('╚════════════════════════════════════════╝');
console.log('');
console.log('Stopping and removing service...');
console.log('');

svc.uninstall();
