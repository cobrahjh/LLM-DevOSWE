#!/usr/bin/env node
/**
 * Hive Health Check Script
 *
 * Usage:
 *   node scripts/health-check.js          # Check all services
 *   node scripts/health-check.js --core   # Check core services only
 *   node scripts/health-check.js --json   # Output JSON format
 */

const { SERVICES, getHealthUrl, getCoreServices } = require('../shared/constants');
const { checkHealth: checkServiceHealth } = require('../shared/health');

const args = process.argv.slice(2);
const coreOnly = args.includes('--core');
const jsonOutput = args.includes('--json');

async function checkHealth(serviceKey) {
    const service = SERVICES[serviceKey];
    const url = getHealthUrl(serviceKey);

    const result = await checkServiceHealth(url, 5000);

    if (result.healthy) {
        return {
            service: service.name,
            port: service.port,
            status: 'online',
            details: result
        };
    } else {
        return {
            service: service.name,
            port: service.port,
            status: result.error === 'timeout' ? 'offline' : 'error',
            error: result.error
        };
    }
}

async function main() {
    const serviceKeys = coreOnly
        ? getCoreServices()
        : Object.keys(SERVICES);

    console.log('');
    console.log('========================================');
    console.log('  Hive Health Check');
    console.log('========================================');
    console.log('');

    const results = await Promise.all(serviceKeys.map(checkHealth));

    if (jsonOutput) {
        console.log(JSON.stringify(results, null, 2));
    } else {
        let online = 0;
        let offline = 0;

        for (const result of results) {
            const icon = result.status === 'online' ? '[OK]' :
                        result.status === 'error' ? '[!!]' : '[--]';
            const status = result.status.toUpperCase().padEnd(7);
            console.log(`  ${icon} ${result.service.padEnd(15)} :${result.port}  ${status}`);

            if (result.status === 'online') online++;
            else offline++;
        }

        console.log('');
        console.log('----------------------------------------');
        console.log(`  Online: ${online}  |  Offline: ${offline}  |  Total: ${results.length}`);
        console.log('========================================');
        console.log('');
    }

    // Exit with error code if any core service is down
    const coreServices = getCoreServices();
    const coreDown = results.some(r =>
        coreServices.includes(Object.keys(SERVICES).find(k => SERVICES[k].name === r.service)) &&
        r.status !== 'online'
    );

    process.exit(coreDown ? 1 : 0);
}

main().catch(console.error);
