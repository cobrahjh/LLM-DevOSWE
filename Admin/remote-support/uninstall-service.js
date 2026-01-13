/**
 * Uninstall Windows Service
 * 
 * Run: node uninstall-service.js
 */

const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
    name: 'SimWidget Remote Support',
    script: path.join(__dirname, 'service.js')
});

svc.on('uninstall', () => {
    console.log('Service uninstalled successfully!');
});

svc.on('error', (err) => {
    console.error('Error:', err);
});

console.log('Uninstalling SimWidget Remote Support service...');
svc.uninstall();
