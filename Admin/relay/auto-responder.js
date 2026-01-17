/**
 * Auto-Responder v1.0
 * Automatically responds to relay queue messages using Oracle/Ollama
 *
 * Flow: Relay Queue → Oracle API → Ollama → Response back to Relay
 */

const RELAY_URL = 'http://localhost:8600';
const OLLAMA_URL = 'http://localhost:11434';
const MODEL = 'qwen:latest'; // Fast 4B model
const POLL_INTERVAL = 3000; // 3 seconds

console.log('═'.repeat(50));
console.log('  Auto-Responder v1.0');
console.log('═'.repeat(50));
console.log(`Polling relay every ${POLL_INTERVAL/1000}s`);
console.log(`Using Ollama model: ${MODEL}`);
console.log('Press Ctrl+C to stop\n');

let processing = false;

async function processMessages() {
    if (processing) return;
    processing = true;

    try {
        // Check for pending messages
        const pendingRes = await fetch(`${RELAY_URL}/api/messages/pending`);
        if (!pendingRes.ok) {
            processing = false;
            return;
        }

        const pending = await pendingRes.json();

        if (pending.count === 0) {
            processing = false;
            return;
        }

        console.log(`\n📨 Found ${pending.count} pending message(s)`);

        for (const msg of pending.messages) {
            console.log(`\n Processing: "${msg.content.substring(0, 50)}..."`);
            console.log(`   ID: ${msg.id}`);

            try {
                // Claim the message
                const claimRes = await fetch(`${RELAY_URL}/api/messages/${msg.id}/claim`, {
                    method: 'POST'
                });

                if (!claimRes.ok) {
                    console.log(`   ⚠️ Could not claim (already processing?)`);
                    continue;
                }

                // Send to Ollama directly for fast response
                console.log(`   🤖 Asking Ollama (${MODEL})...`);
                const askRes = await fetch(`${OLLAMA_URL}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: MODEL,
                        prompt: msg.content,
                        stream: false
                    })
                });

                let response = 'Sorry, I could not process that request.';

                if (askRes.ok) {
                    const askData = await askRes.json();
                    response = askData.response || response;
                    console.log(`   ✓ Got response (${response.length} chars)`);
                } else {
                    console.log(`   ⚠️ Ollama error: ${askRes.status}`);
                }

                // Send response back to relay
                const respondRes = await fetch(`${RELAY_URL}/api/messages/${msg.id}/respond`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ response })
                });

                if (respondRes.ok) {
                    console.log(`   ✅ Response sent!`);
                } else {
                    console.log(`   ❌ Failed to send response`);
                }

            } catch (err) {
                console.log(`   ❌ Error: ${err.message}`);
            }
        }

    } catch (err) {
        // Relay might be down
        if (err.code !== 'ECONNREFUSED') {
            console.error('Poll error:', err.message);
        }
    }

    processing = false;
}

// Start polling
setInterval(processMessages, POLL_INTERVAL);
processMessages(); // Check immediately

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nShutting down Auto-Responder...');
    process.exit(0);
});
