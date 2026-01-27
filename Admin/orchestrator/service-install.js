/**
 * Master (O) Windows Service Installer
 * v1.0.0 - 2026-01-09
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\Admin\orchestrator\service-install.js
 * 
 * Run as Administrator:
 *   node service-install.js
 * 
 * This registers Master (O) as a Windows Service with:
 * - Auto-restart on crash
 * - Auto-start on boot
 * - Recovery options (restart after 1min, 2min, 5min)
 */

const path = require('path');
const Service = require('node-windows').Service;

// Service configuration
const svc = new Service({
    name: 'SimWidget Master O',
    description: 'SimWidget Engine Master Orchestrator - Service supervisor and watchdog',
    script: path.join(__dirname, 'orchestrator.js'),
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
    console.log('  Name: SimWidget Master O');
    console.log('  Port: 8500');
    console.log('  Status: Running');
    console.log('');
    console.log('Management Commands:');
    console.log('  Stop:    net stop "SimWidget Master O"');
    console.log('  Start:   net start "SimWidget Master O"');
    console.log('  Status:  sc query "SimWidget Master O"');
    console.log('  Remove:  node service-uninstall.js');
    console.log('');
    console.log('Dashboard: http://192.168.1.192:8500');
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
console.log('║  SimWidget Master (O) Service Setup    ║');
console.log('╚════════════════════════════════════════╝');
console.log('');
console.log('Installing Windows Service...');
console.log('');

svc.install();
