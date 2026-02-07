/**
 * SimGlass Main Server - Windows Service Installer v1.0.0
 *
 * Installs the Main Server as a Windows service for auto-start
 *
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\install-service.js
 * Last Updated: 2026-01-09
 *
 * Usage:
 *   Install:   node install-service.js
 *   Uninstall: node install-service.js --uninstall
 */

const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
    name: 'SimGlass Main Server',
    description: 'SimGlass Engine WebSocket server for MSFS 2024',
    script: path.join(__dirname, 'backend', 'server.js'),
    nodeOptions: [],
    workingDirectory: path.join(__dirname, 'backend'),
    allowServiceLogon: true
});

if (process.argv.includes('--uninstall')) {
    svc.on('uninstall', () => {
        console.log('✅ SimGlass Main Server service uninstalled');
    });
    svc.uninstall();
} else {
    svc.on('install', () => {
        console.log('✅ SimGlass Main Server service installed');
        console.log('Starting service...');
        svc.start();
    });

    svc.on('start', () => {
        console.log('✅ Service started!');
        console.log('');
        console.log('The server will now auto-start on system boot.');
        console.log('Access at: http://192.168.1.192:8080');
    });

    svc.on('alreadyinstalled', () => {
        console.log('Service already installed. Starting...');
        svc.start();
    });

    svc.on('error', (err) => {
        console.error('❌ Error:', err);
    });

    console.log('Installing SimGlass Main Server as Windows service...');
    svc.install();
}
