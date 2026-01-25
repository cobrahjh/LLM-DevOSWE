/**
 * Relay Consumer v2.1.0
 *
 * Polls the relay queue and processes messages with reliability features.
 * Run this alongside Claude Code to bridge phone requests.
 *
 * Features:
 *   - Heartbeat every 5s to keep tasks alive
 *   - Graceful shutdown - returns task on exit
 *   - Consumer registration with relay
 *   - Auto-reconnect on failure
 *
 * Usage:
 *   node relay-consumer.js
 *
 * Path: C:\LLM-DevOSWE\Admin\relay\relay-consumer.js
 * Last Updated: 2026-01-12
 */

const RELAY_URL = 'http://localhost:8600';
const POLL_INTERVAL = 3000;
const HEARTBEAT_INTERVAL = 5000;

// Consumer state
let consumerId = `consumer_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
let currentTask = null;
let heartbeatTimer = null;
let pollTimer = null;
let isShuttingDown = false;

// ==================== HEARTBEAT ====================

async function sendHeartbeat() {
    if (!currentTask || isShuttingDown) return;

    try {
        const res = await fetch(`${RELAY_URL}/api/consumer/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                consumerId,
                taskId: currentTask.id
            })
        });

        if (!res.ok) {
            console.log('[Heartbeat] Warning: Server returned', res.status);
        }
    } catch (err) {
        console.log('[Heartbeat] Error:', err.message);
    }
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    sendHeartbeat(); // Send immediately
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}

// ==================== TASK POLLING ====================

async function checkQueue() {
    if (isShuttingDown) return;

    // Check if current task was completed externally (via API response)
    if (currentTask) {
        try {
            const statusRes = await fetch(`${RELAY_URL}/api/tasks/${currentTask.id}`);
            const statusData = await statusRes.json();
            if (statusData.task && statusData.task.status !== 'processing') {
                console.log(`\n✅ Task ${currentTask.id} completed externally (${statusData.task.status})`);
                stopHeartbeat();
                currentTask = null;
                global.currentMessage = null;
            } else {
                return; // Still processing, don't poll for new tasks
            }
        } catch (err) {
            // If can't check status, assume still processing
            return;
        }
    }

    try {
        // Try to get next available task
        const response = await fetch(`${RELAY_URL}/api/tasks/next?consumerId=${consumerId}`);
        const data = await response.json();

        if (data.task) {
            currentTask = data.task;
            console.log('\n' + '='.repeat(60));
            console.log('📋 NEW TASK from Kitt:');
            console.log('='.repeat(60));
            console.log(`ID: ${currentTask.id}`);
            console.log(`Session: ${currentTask.session_id}`);
            console.log(`Message: ${currentTask.content}`);
            console.log('='.repeat(60));
            console.log('\nTo respond, run:');
            console.log(`  respond("Your response here")`);
            console.log('\nOr copy the message to Claude Code and paste response.\n');

            // Store for easy access
            global.currentMessage = currentTask;

            // Start heartbeat to keep task alive
            startHeartbeat();
        }
    } catch (err) {
        // Relay not running - silently retry
        if (err.code !== 'ECONNREFUSED') {
            console.log('[Poll] Error:', err.message);
        }
    }
}

// ==================== RESPOND TO TASK ====================

async function respond(response, taskId = null) {
    const id = taskId || currentTask?.id;
    if (!id) {
        console.error('No active task to respond to');
        return;
    }

    try {
        const res = await fetch(`${RELAY_URL}/api/tasks/${id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                response,
                consumerId
            })
        });

        const data = await res.json();
        if (data.success) {
            console.log(`✅ Response sent! Task ${id} completed.`);
            stopHeartbeat();
            currentTask = null;
            global.currentMessage = null;
        } else {
            console.error('Failed to send response:', data.error || data);
        }
    } catch (err) {
        console.error('Error sending response:', err.message);
    }
}

// ==================== GRACEFUL SHUTDOWN ====================

async function releaseCurrentTask() {
    if (!currentTask) return;

    console.log(`\n🔄 Releasing task ${currentTask.id} back to queue...`);

    try {
        const res = await fetch(`${RELAY_URL}/api/tasks/${currentTask.id}/release`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consumerId })
        });

        if (res.ok) {
            console.log('✅ Task released successfully');
        } else {
            console.log('⚠️ Could not release task:', res.status);
        }
    } catch (err) {
        console.log('⚠️ Error releasing task:', err.message);
    }
}

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n\n🛑 Received ${signal}, shutting down gracefully...`);

    // Stop polling and heartbeat
    if (pollTimer) clearInterval(pollTimer);
    stopHeartbeat();

    // Release any in-progress task
    await releaseCurrentTask();

    // Unregister consumer
    try {
        await fetch(`${RELAY_URL}/api/consumer/unregister`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consumerId })
        });
        console.log('✅ Consumer unregistered');
    } catch (err) {
        // Ignore errors during shutdown
    }

    console.log('👋 Goodbye!\n');
    process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGHUP', () => shutdown('SIGHUP'));

// Windows-specific handler
if (process.platform === 'win32') {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.on('SIGINT', () => shutdown('SIGINT'));
}

// ==================== CONSUMER REGISTRATION ====================

async function registerConsumer() {
    try {
        const res = await fetch(`${RELAY_URL}/api/consumer/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                consumerId,
                name: `Claude-Consumer-${process.pid}`
            })
        });

        if (res.ok) {
            console.log(`✅ Registered as consumer: ${consumerId}`);
        }
    } catch (err) {
        console.log('⚠️ Could not register (relay may be using old API)');
    }
}

// ==================== STARTUP ====================

// Make respond available globally in REPL mode
global.respond = respond;

console.log('═'.repeat(60));
console.log('  Relay Consumer v2.1.0');
console.log('═'.repeat(60));
console.log(`Consumer ID: ${consumerId}`);
console.log(`Relay URL:   ${RELAY_URL}`);
console.log(`Poll:        Every ${POLL_INTERVAL/1000}s`);
console.log(`Heartbeat:   Every ${HEARTBEAT_INTERVAL/1000}s`);
console.log('═'.repeat(60));
console.log('Press Ctrl+C to shutdown gracefully\n');
console.log('Waiting for tasks from Kitt...\n');

// Register and start
registerConsumer();
pollTimer = setInterval(checkQueue, POLL_INTERVAL);
checkQueue(); // Check immediately
