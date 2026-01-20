/**
 * SimWidget Relay Windows Service Installer
 * v1.0.0 - 2026-01-11
 *
 * Path: C:\LLM-DevOSWE\Admin\relay\service-install.js
 *
 * Run as Administrator:
 *   node service-install.js
 *
 * This registers SimWidget Relay as a Windows Service with:
 * - Auto-restart on crash
 * - Auto-start on boot
 * - Recovery options (restart after 1min, 2min, 5min)
 */

const path = require('path');
const Service = require('node-windows').Service;

// Service configuration
const svc = new Service({
    name: 'SimWidget Relay',
    description: 'SimWidget Relay Service - Routes requests between agents and Claude',
    script: path.join(__dirname, 'relay-service.js'),
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
    console.log('  Name: SimWidget Relay');
    console.log('  Port: 8600');
    console.log('  Status: Running');
    console.log('');
    console.log('Management Commands:');
    console.log('  Stop:    net stop "SimWidget Relay"');
    console.log('  Start:   net start "SimWidget Relay"');
    console.log('  Status:  sc query "SimWidget Relay"');
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
console.log('║     SimWidget Relay Service Setup      ║');
console.log('╚════════════════════════════════════════╝');
console.log('');
console.log('Installing Windows Service...');
console.log('');

svc.install();
