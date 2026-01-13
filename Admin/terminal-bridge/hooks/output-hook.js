#!/usr/bin/env node
/**
 * Claude Code Output Hook
 *
 * Captures Claude Code output and sends to Terminal Bridge
 *
 * Install: Add to Claude Code settings.json hooks
 *
 * Hook types supported:
 * - PostToolUse: After each tool execution
 * - Stop: When Claude stops
 */

const http = require('http');

const BRIDGE_URL = process.env.TERMINAL_BRIDGE_URL || 'http://127.0.0.1:8701/output';

// Read hook data from stdin
let input = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
    input += chunk;
});

process.stdin.on('end', () => {
    try {
        const hookData = JSON.parse(input);
        sendToBridge(hookData);
    } catch (err) {
        // If not JSON, send as plain text
        sendToBridge({
            type: 'output',
            content: input
        });
    }
});

function sendToBridge(data) {
    const payload = JSON.stringify({
        type: data.hook_type || 'output',
        content: formatContent(data),
        tool: data.tool_name || null,
        cwd: data.cwd || process.cwd(),
        timestamp: new Date().toISOString()
    });

    const url = new URL(BRIDGE_URL);

    const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    }, (res) => {
        // Silent on success
    });

    req.on('error', (err) => {
        // Silent on error - don't interrupt Claude
    });

    req.write(payload);
    req.end();
}

function formatContent(data) {
    // Format based on hook type
    if (data.hook_type === 'PostToolUse') {
        return `[${data.tool_name}] ${data.tool_input?.substring?.(0, 200) || ''}`;
    }

    if (data.hook_type === 'Stop') {
        return `[Session ended] ${data.stop_reason || ''}`;
    }

    if (data.tool_result) {
        return data.tool_result.substring(0, 500);
    }

    if (data.content) {
        return data.content;
    }

    return JSON.stringify(data).substring(0, 500);
}
