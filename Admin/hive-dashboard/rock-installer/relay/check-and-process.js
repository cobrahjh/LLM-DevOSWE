#!/usr/bin/env node
/**
 * Check and Process Pending Messages
 *
 * Quick script to check for pending messages and output them for processing.
 * Used by Claude Code to quickly poll and process messages inline.
 *
 * Usage: node check-and-process.js
 *
 * Path: C:\LLM-DevOSWE\Admin\relay\check-and-process.js
 */

const http = require('http');

const RELAY_URL = 'http://localhost:8600';

function fetch(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Parse error`));
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    try {
        const result = await fetch(`${RELAY_URL}/api/messages/pending`);

        if (result.count === 0) {
            console.log('No pending messages.');
            return;
        }

        console.log(`\n=== ${result.count} PENDING MESSAGE(S) ===\n`);

        for (const msg of result.messages) {
            console.log(`ID: ${msg.id}`);
            console.log(`Content: ${msg.content}`);
            console.log(`Age: ${msg.age}`);
            console.log(`---`);
            console.log(`To process:`);
            console.log(`  curl -X POST ${RELAY_URL}/api/messages/${msg.id}/claim`);
            console.log(`  curl -X POST ${RELAY_URL}/api/messages/${msg.id}/respond -H "Content-Type: application/json" -d '{"response":"YOUR_RESPONSE"}'`);
            console.log('');
        }
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

main();
