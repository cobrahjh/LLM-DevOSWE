/**
 * SimWidget Agent - Windows Service Installer v1.0.0
 * 
 * Installs the Agent as a Windows service for auto-start
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\Admin\agent\install-service.js
 * Last Updated: 2025-01-08
 * 
 * Usage:
 *   Install:   node install-service.js
 *   Uninstall: node install-service.js --uninstall
 */

const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
    name: 'SimWidget Agent',
    description: 'SimWidget Agent - Claude Assistant for dev environment',
    script: path.join(__dirname, 'agent-server.js'),
    nodeOptions: [],
    workingDirectory: __dirname,
    allowServiceLogon: true
});

if (process.argv.includes('--uninstall')) {
    svc.on('uninstall', () => {
        console.log('✅ SimWidget Agent service uninstalled');
    });
    svc.uninstall();
} else {
    svc.on('install', () => {
        console.log('✅ SimWidget Agent service installed');
        console.log('Starting service...');
        svc.start();
    });

    svc.on('start', () => {
        console.log('✅ Service started!');
        console.log('');
        console.log('The agent will now auto-start on system boot.');
        console.log('Access at: http://192.168.1.42:8585');
    });

    svc.on('alreadyinstalled', () => {
        console.log('Service already installed. Starting...');
        svc.start();
    });

    svc.on('error', (err) => {
        console.error('❌ Error:', err);
    });

    console.log('Installing SimWidget Agent as Windows service...');
    svc.install();
}
