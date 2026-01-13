/**
 * Install Windows Service
 * 
 * Run: node install-service.js
 */

const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
    name: 'SimWidget Remote Support',
    description: 'Remote support service for SimWidget Engine development',
    script: path.join(__dirname, 'service.js'),
    nodeOptions: [],
    workingDirectory: __dirname,
    allowServiceLogon: true
});

svc.on('install', () => {
    console.log('Service installed successfully!');
    svc.start();
});

svc.on('start', () => {
    console.log('Service started!');
    console.log('Access at: http://localhost:8590');
});

svc.on('alreadyinstalled', () => {
    console.log('Service is already installed.');
});

svc.on('error', (err) => {
    console.error('Error:', err);
});

console.log('Installing SimWidget Remote Support service...');
svc.install();
