/**
 * Browser Helper API v1.0.0
 *
 * Simple HTTP server that Ollama can call to trigger browser actions.
 * Acts as a bridge between Ollama agent and the admin UI.
 *
 * Endpoints:
 *   POST /api/reload    - Reload the sandbox page
 *   POST /api/screenshot - Take screenshot (saves to file)
 *   POST /api/console   - Get console logs
 *   GET  /api/status    - Check if UI is responding
 *
 * Port: 8621
 * Path: C:\LLM-DevOSWE\Admin\claude-bridge\browser-helper.js
 */

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8621;

app.use(cors());
app.use(express.json());

// Store for console messages (populated by UI via WebSocket or polling)
let consoleMessages = [];
const MAX_CONSOLE_MESSAGES = 100;

function log(msg) {
    const ts = new Date().toISOString().substr(11, 8);
    console.log(`[${ts}] ${msg}`);
}

// Check if admin UI is running
app.get('/api/status', async (req, res) => {
    try {
        const http = require('http');
        const checkUrl = 'http://192.168.1.192:8585/';

        http.get(checkUrl, (response) => {
            res.json({
                success: true,
                uiRunning: response.statusCode === 200,
                sandboxUrl: 'http://192.168.1.192:8585/ollama-sandbox.html'
            });
        }).on('error', () => {
            res.json({ success: false, uiRunning: false, error: 'UI not responding' });
        });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Reload sandbox page (opens in default browser)
app.post('/api/reload', (req, res) => {
    const url = req.body.url || 'http://192.168.1.192:8585/ollama-sandbox.html';
    log(`Opening: ${url}`);

    // Windows: use start command to open in default browser
    exec(`start "" "${url}"`, (err) => {
        if (err) {
            res.json({ success: false, error: err.message });
        } else {
            res.json({ success: true, message: `Opened ${url}` });
        }
    });
});

// Store console message (called by UI)
app.post('/api/console/log', (req, res) => {
    const { type, message, timestamp } = req.body;
    consoleMessages.push({
        type: type || 'log',
        message,
        timestamp: timestamp || Date.now()
    });

    // Keep only recent messages
    if (consoleMessages.length > MAX_CONSOLE_MESSAGES) {
        consoleMessages = consoleMessages.slice(-MAX_CONSOLE_MESSAGES);
    }

    res.json({ success: true });
});

// Get console messages
app.get('/api/console', (req, res) => {
    const filter = req.query.filter;
    let messages = consoleMessages;

    if (filter) {
        messages = messages.filter(m =>
            m.message.toLowerCase().includes(filter.toLowerCase())
        );
    }

    res.json({
        success: true,
        messages: messages.slice(-20),  // Last 20 messages
        total: messages.length
    });
});

// Clear console messages
app.delete('/api/console', (req, res) => {
    consoleMessages = [];
    res.json({ success: true, message: 'Console cleared' });
});

// Notify - send a notification (for task completion etc)
app.post('/api/notify', (req, res) => {
    const { title, message } = req.body;
    log(`Notification: ${title} - ${message}`);

    // Use PowerShell to show toast notification on Windows
    const script = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $template = '<toast><visual><binding template="ToastText02"><text id="1">${title}</text><text id="2">${message}</text></binding></visual></toast>'
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Ollama').Show($toast)
    `.replace(/\n/g, ' ');

    exec(`powershell -Command "${script}"`, (err) => {
        res.json({ success: !err, message: err ? err.message : 'Notification sent' });
    });
});

// Run a simple UI test (check element exists)
app.post('/api/test', (req, res) => {
    const { selector, expectedText } = req.body;
    log(`UI Test: ${selector}`);

    // This would need browser automation - for now just acknowledge
    res.json({
        success: true,
        message: 'UI testing requires browser automation. Use the admin UI to test manually.',
        suggestion: 'Open http://192.168.1.192:8585/ollama-sandbox.html and check DevTools console'
    });
});

// Start server
app.listen(PORT, () => {
    log('='.repeat(50));
    log('Browser Helper API v1.0.0');
    log(`Port: ${PORT}`);
    log('Endpoints:');
    log('  GET  /api/status   - Check UI status');
    log('  POST /api/reload   - Open sandbox in browser');
    log('  GET  /api/console  - Get console logs');
    log('  POST /api/notify   - Send notification');
    log('='.repeat(50));
});
