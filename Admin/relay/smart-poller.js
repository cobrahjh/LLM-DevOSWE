/**
 * Smart Poller v1.0.0
 *
 * Intelligent message routing:
 * - Simple tasks → Nova (LM Studio) or Ollama (fast, free)
 * - Complex tasks → Queue for Claude Code (powerful)
 *
 * Features:
 * - Windows toast notifications
 * - Smart task classification
 * - Auto-escalation to Claude Code
 *
 * Usage: node smart-poller.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

const CONFIG = {
    relayUrl: 'http://localhost:8600',
    oracleUrl: 'http://localhost:3002',
    pollInterval: 5000,
    logFile: path.join(__dirname, 'smart-poller.log'),
    notifyOnResponse: true
};

// Keywords that indicate complex tasks requiring Claude Code
const COMPLEX_KEYWORDS = [
    'create', 'build', 'implement', 'refactor', 'fix bug', 'debug',
    'write code', 'update', 'modify', 'change', 'add feature',
    'commit', 'push', 'deploy', 'install', 'configure',
    'review', 'analyze codebase', 'architecture',
    'brr', 'mem', 'mst', 'ntt'  // User shortcuts that need Claude
];

// Keywords that indicate simple tasks Nova can handle
const SIMPLE_KEYWORDS = [
    'what is', 'how do', 'explain', 'tell me', 'hi', 'hello',
    'thanks', 'status', 'help', 'test', 'ping', '?',
    'define', 'meaning', 'difference between'
];

let isProcessing = false;

function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    console.log(line);
    fs.appendFileSync(CONFIG.logFile, line + '\n');
}

function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: 30000
        };

        const req = http.request(reqOptions, (res) => {
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
        req.on('timeout', () => reject(new Error('Request timeout')));

        if (options.body) req.write(JSON.stringify(options.body));
        req.end();
    });
}

function classifyTask(content) {
    const lower = content.toLowerCase();

    // Check for complex indicators first
    for (const keyword of COMPLEX_KEYWORDS) {
        if (lower.includes(keyword)) {
            return 'complex';
        }
    }

    // Check for simple indicators
    for (const keyword of SIMPLE_KEYWORDS) {
        if (lower.startsWith(keyword) || lower.includes(keyword)) {
            return 'simple';
        }
    }

    // Default: if short, probably simple; if long, probably complex
    return content.length > 200 ? 'complex' : 'simple';
}

async function askNova(prompt) {
    try {
        const response = await fetch(`${CONFIG.oracleUrl}/api/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { prompt, model: 'nova' }
        });

        if (response.response) {
            return response.response;
        }
        throw new Error('No response from Nova');
    } catch (err) {
        throw new Error(`Nova error: ${err.message}`);
    }
}

function showNotification(title, message) {
    if (!CONFIG.notifyOnResponse) return;

    // PowerShell toast notification
    const script = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $template = '<toast><visual><binding template="ToastText02"><text id="1">${title.replace(/'/g, "''")}</text><text id="2">${message.replace(/'/g, "''").substring(0, 200)}</text></binding></visual></toast>'
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Smart Poller')
        $notifier.Show((New-Object Windows.UI.Notifications.ToastNotification $xml))
    `.replace(/\n/g, ' ');

    exec(`powershell -Command "${script}"`, { windowsHide: true }, (err) => {
        if (err) log(`Notification error: ${err.message}`);
    });
}

async function processMessage(msg) {
    const taskType = classifyTask(msg.content);
    log(`Processing [${msg.id}] as ${taskType}: "${msg.content.substring(0, 50)}..."`);

    try {
        // Claim the message
        const claimResult = await fetch(`${CONFIG.relayUrl}/api/messages/${msg.id}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {}
        });

        if (!claimResult.success) {
            log(`  Failed to claim: ${JSON.stringify(claimResult)}`);
            return false;
        }

        let response;

        if (taskType === 'simple') {
            // Handle with Nova (fast local LLM)
            log(`  Routing to Nova...`);
            response = await askNova(msg.content);
            log(`  Nova response: "${response.substring(0, 80)}..."`);
        } else {
            // Complex task - leave for Claude Code
            log(`  Complex task - marking for Claude Code`);
            response = '🔄 Complex task queued for Claude Code. Will be processed when Claude is available.';

            // Release the claim so Claude Code can pick it up
            await fetch(`${CONFIG.relayUrl}/api/tasks/${msg.id}/release`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: {}
            });

            showNotification('Complex Task Queued', msg.content.substring(0, 100));
            return true;
        }

        // Send response
        const respondResult = await fetch(`${CONFIG.relayUrl}/api/messages/${msg.id}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { response }
        });

        if (respondResult.success) {
            log(`  Responded successfully`);
            showNotification('Message Processed', response.substring(0, 100));
            return true;
        } else {
            log(`  Failed to respond: ${JSON.stringify(respondResult)}`);
            return false;
        }
    } catch (err) {
        log(`  Error: ${err.message}`);

        // Try to send error response
        try {
            await fetch(`${CONFIG.relayUrl}/api/messages/${msg.id}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: { response: `Error: ${err.message}` }
            });
        } catch (e) {}

        return false;
    }
}

async function checkMessages() {
    if (isProcessing) return;

    try {
        const result = await fetch(`${CONFIG.relayUrl}/api/messages/pending`);

        if (result.count > 0) {
            log(`Found ${result.count} pending message(s)`);
            isProcessing = true;

            for (const msg of result.messages) {
                await processMessage(msg);
            }

            isProcessing = false;
        }
    } catch (err) {
        isProcessing = false;
        // Silent fail - relay might be down
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    log('Shutting down smart-poller...');
    process.exit(0);
});

// Start
log('='.repeat(50));
log('Smart Poller v1.0.0 started');
log(`Simple tasks → Nova (Oracle)`);
log(`Complex tasks → Queued for Claude Code`);
log(`Notifications: ${CONFIG.notifyOnResponse ? 'ON' : 'OFF'}`);
log('='.repeat(50));

checkMessages();
setInterval(checkMessages, CONFIG.pollInterval);
