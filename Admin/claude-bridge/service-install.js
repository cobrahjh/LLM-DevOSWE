/**
 * SimWidget Claude Bridge Windows Service Installer
 * v2.0.0 - 2026-01-12
 *
 * Path: C:\LLM-DevOSWE\Admin\claude-bridge\service-install.js
 *
 * Run as Administrator:
 *   node service-install.js
 *
 * This registers Claude Bridge as a Windows Service with:
 * - Auto-restart on crash
 * - Auto-start on boot
 * - 2-worker system (Quick + Code)
 */

const path = require('path');
const Service = require('node-windows').Service;

// Service configuration
const svc = new Service({
    name: 'SimWidget Claude Bridge',
    description: 'SimWidget Claude Bridge v2 - 2-worker WebSocket bridge to Claude Code CLI',
    script: path.join(__dirname, 'bridge-service.js'),
    nodeOptions: [],
    workingDirectory: __dirname,
    allowServiceLogon: true
});

// Recovery settings - restart on failure
svc.on('install', () => {
    console.log('✅ Service installed successfully');
    console.log('');
    console.log('Starting service...');
    svc.start();
});

svc.on('start', () => {
    console.log('✅ Service started');
    console.log('');
    console.log('Service Details:');
    console.log('  Name: SimWidget Claude Bridge');
    console.log('  Port: 8700 (WebSocket)');
    console.log('  Workers: QuickWorker + CodeWorker');
    console.log('  Status: Running');
    console.log('');
    console.log('Management Commands:');
    console.log('  Stop:    net stop "SimWidget Claude Bridge"');
    console.log('  Start:   net start "SimWidget Claude Bridge"');
    console.log('  Status:  sc query "SimWidget Claude Bridge"');
    console.log('  Remove:  node service-uninstall.js');
});

svc.on('alreadyinstalled', () => {
    console.log('⚠️ Service already installed');
    console.log('');
    console.log('To reinstall:');
    console.log('  1. node service-uninstall.js');
    console.log('  2. node service-install.js');
});

svc.on('error', (err) => {
    console.error('❌ Error:', err);
});

// Install the service
console.log('');
console.log('╔════════════════════════════════════════╗');
console.log('║  SimWidget Claude Bridge Service Setup ║');
console.log('╚════════════════════════════════════════╝');
console.log('');
console.log('Installing Windows Service...');
console.log('');

svc.install();
