#!/usr/bin/env node
/**
 * Hive Network Status Checker
 * Checks all nodes and services across the hive
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Load network config
const configPath = path.join(__dirname, '..', 'hive-network.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const TIMEOUT = 3000;

async function checkService(host, port, serviceName) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const req = http.request({
            hostname: host,
            port: port,
            path: '/',
            method: 'HEAD',
            timeout: TIMEOUT
        }, (res) => {
            const latency = Date.now() - startTime;
            resolve({ status: 'online', latency, code: res.statusCode });
        });

        req.on('error', () => {
            resolve({ status: 'offline', latency: null, code: null });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ status: 'timeout', latency: TIMEOUT, code: null });
        });

        req.end();
    });
}

async function checkNode(nodeName, nodeConfig) {
    const results = {
        name: nodeName,
        type: nodeConfig.type,
        role: nodeConfig.role,
        ip: nodeConfig.ip,
        services: {}
    };

    // Skip if IP not configured
    if (nodeConfig.ip === '192.168.1.XXX' || nodeConfig.ip === 'dynamic') {
        results.status = 'not-configured';
        return results;
    }

    const host = nodeConfig.ip === 'localhost' ? '127.0.0.1' : nodeConfig.ip;
    let onlineCount = 0;
    let totalServices = 0;

    for (const [svcName, svcConfig] of Object.entries(nodeConfig.services)) {
        if (!svcConfig.enabled) continue;
        totalServices++;

        const check = await checkService(host, svcConfig.port, svcName);
        results.services[svcName] = {
            port: svcConfig.port,
            ...check
        };

        if (check.status === 'online') onlineCount++;
    }

    if (totalServices === 0) {
        results.status = 'no-services';
    } else if (onlineCount === totalServices) {
        results.status = 'healthy';
    } else if (onlineCount > 0) {
        results.status = 'degraded';
    } else {
        results.status = 'offline';
    }

    return results;
}

function printResults(results) {
    console.log('\n' + '='.repeat(60));
    console.log('  HIVE NETWORK STATUS');
    console.log('='.repeat(60) + '\n');

    const statusColors = {
        'healthy': '\x1b[32m',    // green
        'degraded': '\x1b[33m',   // yellow
        'offline': '\x1b[31m',    // red
        'not-configured': '\x1b[90m', // gray
        'no-services': '\x1b[36m' // cyan
    };
    const reset = '\x1b[0m';

    for (const node of results) {
        const color = statusColors[node.status] || reset;
        const statusIcon = {
            'healthy': '[OK]',
            'degraded': '[!!]',
            'offline': '[XX]',
            'not-configured': '[--]',
            'no-services': '[  ]'
        }[node.status] || '[??]';

        console.log(`${color}${statusIcon}${reset} ${node.name.toUpperCase()}`);
        console.log(`    Type: ${node.type} | Role: ${node.role}`);
        console.log(`    IP: ${node.ip} | Status: ${color}${node.status}${reset}`);

        if (Object.keys(node.services).length > 0) {
            console.log('    Services:');
            for (const [svcName, svc] of Object.entries(node.services)) {
                const svcColor = svc.status === 'online' ? '\x1b[32m' : '\x1b[31m';
                const latencyStr = svc.latency ? ` (${svc.latency}ms)` : '';
                console.log(`      ${svcColor}${svc.status === 'online' ? '+' : '-'}${reset} ${svcName}:${svc.port} ${svcColor}${svc.status}${latencyStr}${reset}`);
            }
        }
        console.log();
    }

    // Summary
    const healthy = results.filter(n => n.status === 'healthy').length;
    const total = results.filter(n => n.status !== 'not-configured' && n.status !== 'no-services').length;

    console.log('='.repeat(60));
    console.log(`  Nodes: ${healthy}/${total} healthy`);
    console.log(`  Primary: ${config.routing.primary}`);
    console.log(`  Fallback: ${config.routing.fallback.join(' -> ')}`);
    console.log('='.repeat(60) + '\n');
}

async function main() {
    const results = [];

    for (const [nodeName, nodeConfig] of Object.entries(config.nodes)) {
        const result = await checkNode(nodeName, nodeConfig);
        results.push(result);
    }

    // Sort by priority
    results.sort((a, b) => {
        const aPriority = config.nodes[a.name]?.priority ?? 99;
        const bPriority = config.nodes[b.name]?.priority ?? 99;
        return aPriority - bPriority;
    });

    printResults(results);
}

main().catch(console.error);
