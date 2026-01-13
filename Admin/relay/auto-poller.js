/**
 * Relay Auto-Poller v2.0.0
 *
 * Polls relay for pending messages and processes them with local LLM.
 * Uses Ollama qwen2.5-coder for free, instant responses.
 *
 * Usage: node auto-poller.js
 *
 * Path: C:\LLM-DevOSWE\Admin\relay\auto-poller.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG = {
    relayUrl: 'http://localhost:8600',
    ollamaModel: 'qwen2.5-coder:7b',  // 7b is faster (172 tok/s)
    pollInterval: 5000,  // 5 seconds
    outputFile: path.join(__dirname, 'pending-messages.json'),
    logFile: path.join(__dirname, 'auto-poller.log'),
    maxResponseTime: 60000  // 60 sec timeout for LLM
};

let isProcessing = false;

function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    console.log(line);
    fs.appendFileSync(CONFIG.logFile, line + '\n');
}

function fetch(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Parse error: ${data.substring(0, 100)}`));
                }
            });
        }).on('error', reject);
    });
}

function post(url, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ raw: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function runOllama(prompt) {
    const systemPrompt = `You are Kitt, a helpful AI assistant. Keep responses brief (1-2 sentences). For tests/greetings, respond simply.`;

    // Escape quotes in prompt for shell
    const safePrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, ' ');
    const fullPrompt = `${systemPrompt} User: ${safePrompt}`;

    try {
        const output = execSync(`ollama run ${CONFIG.ollamaModel} "${fullPrompt}"`, {
            encoding: 'utf8',
            timeout: CONFIG.maxResponseTime,
            windowsHide: true
        });

        // Clean up the output (remove spinner chars, ANSI codes)
        const cleaned = output
            .replace(/\[[\d;?]*[mGKHJ]|\x1b\[[^m]*m/g, '')  // ANSI codes
            .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏\[\]?]/g, '')  // Spinner chars
            .replace(/\r/g, '')
            .trim();

        return cleaned || 'Message received.';
    } catch (err) {
        throw new Error(`Ollama error: ${err.message}`);
    }
}

async function processMessage(msg) {
    log(`Processing: [${msg.id}] "${msg.content.substring(0, 50)}..."`);

    try {
        // 1. Claim the message
        const claimResult = await post(`${CONFIG.relayUrl}/api/messages/${msg.id}/claim`, {});
        if (!claimResult.success) {
            log(`  Failed to claim: ${JSON.stringify(claimResult)}`);
            return false;
        }
        log(`  Claimed successfully`);

        // 2. Get LLM response
        log(`  Generating response with ${CONFIG.ollamaModel}...`);
        const response = runOllama(msg.content);
        log(`  LLM response: "${response.substring(0, 100)}..."`);

        // 3. Send response
        const respondResult = await post(
            `${CONFIG.relayUrl}/api/messages/${msg.id}/respond`,
            { response: response }
        );

        if (respondResult.success) {
            log(`  Responded successfully (${respondResult.responseTime}ms)`);
            return true;
        } else {
            log(`  Failed to respond: ${JSON.stringify(respondResult)}`);
            return false;
        }
    } catch (err) {
        log(`  Error processing: ${err.message}`);

        // Try to send error response
        try {
            await post(
                `${CONFIG.relayUrl}/api/messages/${msg.id}/respond`,
                { response: `Error processing message: ${err.message}` }
            );
        } catch (e) {
            // Ignore
        }
        return false;
    }
}

async function checkAndProcess() {
    if (isProcessing) {
        log('Already processing, skipping poll');
        return;
    }

    try {
        const result = await fetch(`${CONFIG.relayUrl}/api/messages/pending`);

        if (result.count > 0) {
            // Write pending messages to file
            fs.writeFileSync(CONFIG.outputFile, JSON.stringify(result, null, 2));

            log(`Found ${result.count} pending message(s)`);

            isProcessing = true;

            // Process each message
            for (const msg of result.messages) {
                await processMessage(msg);
            }

            isProcessing = false;
        } else {
            // Clear the file when no pending messages
            if (fs.existsSync(CONFIG.outputFile)) {
                fs.unlinkSync(CONFIG.outputFile);
            }
        }
    } catch (err) {
        isProcessing = false;
        // Only log errors occasionally to avoid spam
        if (Math.random() < 0.1) {
            log(`Poll error: ${err.message}`);
        }
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    log('Shutting down auto-poller...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    log('Shutting down auto-poller...');
    process.exit(0);
});

// Start polling
log('='.repeat(50));
log('Auto-poller v2.0.0 started (with local LLM processing)');
log(`Polling ${CONFIG.relayUrl} every ${CONFIG.pollInterval}ms`);
log(`LLM: ${CONFIG.ollamaModel}`);
log(`Output file: ${CONFIG.outputFile}`);
log('='.repeat(50));

checkAndProcess();
setInterval(checkAndProcess, CONFIG.pollInterval);
