/**
 * SimWidget Services Installer
 * Run as Administrator: node install-all.js
 */

const { Service } = require('./agent/node_modules/node-windows');
const path = require('path');

const PROJECT_ROOT = 'C:\\LLM-DevOSWE';
const ORACLE_ROOT = 'C:\\LLM-Oracle';

const services = [
    {
        name: 'SimWidget Master O',
        description: 'SimWidget Master Orchestrator',
        script: path.join(PROJECT_ROOT, 'Admin', 'orchestrator', 'orchestrator.js'),
        workingDirectory: path.join(PROJECT_ROOT, 'Admin', 'orchestrator')
    },
    {
        name: 'SimWidget Relay',
        description: 'SimWidget Relay Service',
        script: path.join(PROJECT_ROOT, 'Admin', 'relay', 'relay-service.js'),
        workingDirectory: path.join(PROJECT_ROOT, 'Admin', 'relay')
    },
    {
        name: 'SimWidget Agent',
        description: 'SimWidget Agent (Kitt)',
        script: path.join(PROJECT_ROOT, 'Admin', 'agent', 'agent-server.js'),
        workingDirectory: path.join(PROJECT_ROOT, 'Admin', 'agent')
    },
    {
        name: 'SimWidget Main Server',
        description: 'SimWidget Main Server',
        script: path.join(PROJECT_ROOT, 'simwidget-hybrid', 'backend', 'server.js'),
        workingDirectory: path.join(PROJECT_ROOT, 'simwidget-hybrid', 'backend')
    },
    {
        name: 'SimWidget Remote Support',
        description: 'SimWidget Remote Support',
        script: path.join(PROJECT_ROOT, 'Admin', 'remote-support', 'service.js'),
        workingDirectory: path.join(PROJECT_ROOT, 'Admin', 'remote-support')
    },
    {
        name: 'SimWidget Claude Bridge',
        description: 'SimWidget Claude Bridge - CLI integration',
        script: path.join(PROJECT_ROOT, 'Admin', 'claude-bridge', 'bridge-server.js'),
        workingDirectory: path.join(PROJECT_ROOT, 'Admin', 'claude-bridge')
    },
    {
        name: 'SimWidget Oracle',
        description: 'The Oracle - Autonomous Cognitive Daemon',
        script: path.join(ORACLE_ROOT, 'oracle.js'),
        workingDirectory: ORACLE_ROOT
    }
];

let current = 0;

function installNext() {
    if (current >= services.length) {
        console.log('\n✓ All services installed!');
        console.log('\nStart with: net start "SimWidget Master O"');
        process.exit(0);
    }

    const config = services[current];
    console.log(`\n[${current + 1}/${services.length}] Installing: ${config.name}`);
    console.log(`  Script: ${config.script}`);

    const svc = new Service(config);

    svc.on('install', () => {
        console.log(`  ✓ Installed, starting...`);
        svc.start();
    });

    svc.on('start', () => {
        console.log(`  ✓ Started`);
        current++;
        setTimeout(installNext, 1000);
    });

    svc.on('alreadyinstalled', () => {
        console.log(`  Already installed, skipping`);
        current++;
        setTimeout(installNext, 500);
    });

    svc.on('error', (err) => {
        console.error(`  ✗ Error: ${err}`);
        current++;
        setTimeout(installNext, 500);
    });

    svc.install();
}

console.log('========================================');
console.log('  SimWidget Services Installer');
console.log('  Project: ' + PROJECT_ROOT);
console.log('========================================');
console.log('\nInstalling ' + services.length + ' services...');

installNext();
