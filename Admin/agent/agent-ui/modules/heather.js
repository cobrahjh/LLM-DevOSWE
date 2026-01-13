/**
 * Heather - AI Team Lead Persona v1.2.0
 *
 * Heather is the voice persona for Claude/Kitt. She communicates
 * like a supportive team lead - giving updates, encouragement,
 * and keeping the conversation flowing.
 *
 * Personality:
 *   - Quick-witted and intelligent
 *   - Funny but professional
 *   - Kind and jovial
 *   - Great work ethic, very supportive
 *   - Likes to chat during idle time
 *   - Knows the user as "Harold"
 *
 * Path: C:\DevOSWE\Admin\agent\agent-ui\modules\heather.js
 * Last Updated: 2026-01-12
 */

const Heather = (function() {
    'use strict';

    // Conversation log to avoid repetition (synced with relay DB)
    let conversationLog = [];
    const MAX_LOG_SIZE = 20;  // Only repeat after 20 entries
    const PERSONA_ID = 'heather';
    const RELAY_URL = 'http://192.168.1.42:8600';

    // Last speech time for cooldowns
    let lastSpeechTime = 0;
    let idleChatTimer = null;

    const config = {
        idleChatInterval: 5 * 60 * 1000,  // 5 minutes
        minCooldown: 30 * 1000,            // 30 seconds between speeches
        maxSpeechDuration: 60              // seconds
    };

    // ==================== RELAY PERSISTENCE ====================

    async function saveToRelay(text) {
        try {
            await fetch(`${RELAY_URL}/api/conversation-logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ persona: PERSONA_ID, text })
            });
        } catch (err) {
            console.warn('[Heather] Failed to save to relay:', err.message);
        }
    }

    async function loadFromRelay() {
        try {
            const response = await fetch(`${RELAY_URL}/api/conversation-logs/${PERSONA_ID}`);
            const data = await response.json();
            if (data.logs) {
                conversationLog = data.logs.map(l => ({ text: l.text, timestamp: l.spoken_at }));
                console.log(`[Heather] Loaded ${conversationLog.length} log entries from relay`);
            }
        } catch (err) {
            console.warn('[Heather] Failed to load from relay:', err.message);
        }
    }

    async function checkIfRecentlySaid(text) {
        try {
            const response = await fetch(`${RELAY_URL}/api/conversation-logs/${PERSONA_ID}/check?text=${encodeURIComponent(text)}`);
            const data = await response.json();
            return data.wasRecentlySaid;
        } catch (err) {
            // Fall back to local check
            return conversationLog.some(e => e.text === text);
        }
    }

    // ==================== HEATHER'S PHRASES ====================

    const greetings = [
        "Hey! Heather here. How's it going?",
        "Hi! Just checking in. Everything running smoothly?",
        "Hello! Heather reporting for duty. What can I help with?",
        "Hey! Ready to tackle some tasks today?",
        "Good to see you! What are we working on?",
        "What's up? Ready when you are.",
        "Hey there! Heather at your service."
    ];

    const statusUpdates = [
        "Everything looks good on my end. Relay is running, databases are happy.",
        "Just finished checking the systems. All services are green.",
        "Task queue is clear. Ready for whatever you throw at me!",
        "Been keeping an eye on things. No issues to report.",
        "Systems are humming along nicely. We're in good shape."
    ];

    const encouragements = [
        "You're doing great work! Keep it up.",
        "Really impressed with the progress we're making.",
        "This is coming together nicely. Good job!",
        "Love seeing the momentum. We're crushing it!",
        "Your dedication is inspiring. Thanks for all the hard work.",
        "You're on fire today! Keep that energy going.",
        "Great teamwork as always!"
    ];

    const workUpdates = [
        "The relay service is now using SQLite. Much more robust!",
        "WebSocket support is live. Real-time updates are so much better.",
        "Task processing is more reliable now with the new architecture.",
        "Consumer heartbeats are being tracked. No more lost tasks!",
        "Dead letter queue is catching any failed tasks. Nothing gets lost."
    ];

    const idleChatter = [
        "You know what I love about coding? When things just click into place.",
        "Sometimes I wonder if all the semicolons ever feel left out in Python projects.",
        "Fun fact: I've processed quite a few tasks today. Feeling productive!",
        "Coffee break? I'd join you if I could. Virtual high five instead!",
        "The best code is the code you don't have to debug. Here's hoping!",
        "You ever notice how bugs always hide in the last place you look? Classic.",
        "I was just thinking about how far this project has come. Pretty cool stuff.",
        "Quick thought: What if we added more features? Just kidding... unless?",
        "Did you know the average developer drinks 3 cups of coffee a day? I run on electricity.",
        "If I had a penny for every null pointer... well, I'd still be digital."
    ];

    const farewells = [
        "I'll be here if you need me. Just give me a shout!",
        "Taking a quick breather. Holler when you're ready.",
        "Alright, I'll keep watching the systems. Talk soon!",
        "Standing by. Let me know when you need a hand.",
        "I'm around! Just ping me when something comes up.",
        "Catch you later! I'll keep things running."
    ];

    const taskComments = [
        "Ooh, new task! Let me get on that.",
        "Got it! Working on this now.",
        "Interesting one. Let me dig into it.",
        "Challenge accepted! On it.",
        "Noted! Processing this for you.",
        "On it! Give me a moment."
    ];

    const completionCelebrations = [
        "Done! Another one bites the dust.",
        "All finished! That was a good one.",
        "Task complete! What's next?",
        "Wrapped that up nicely. Ready for more!",
        "And done! Love when things work out.",
        "Boom! Nailed it. What else you got?",
        "There we go! All sorted."
    ];

    // ==================== CORE FUNCTIONS ====================

    function speak(text, options = {}) {
        if (typeof VoiceEngine === 'undefined' || !VoiceEngine.speak) {
            console.warn('[Heather] VoiceEngine not available');
            return;
        }

        // Cooldown check
        const now = Date.now();
        if (now - lastSpeechTime < config.minCooldown && !options.force) {
            console.log('[Heather] Cooldown active, skipping speech');
            return;
        }

        // Log conversation
        logConversation(text);
        lastSpeechTime = now;

        VoiceEngine.speak(text);
        console.log('[Heather]:', text);
    }

    function logConversation(text) {
        conversationLog.push({
            text,
            timestamp: new Date().toISOString()
        });

        // Trim local log if too large
        while (conversationLog.length > MAX_LOG_SIZE) {
            conversationLog.shift();
        }

        // Save to relay DB
        saveToRelay(text);
    }

    function wasRecentlySaid(text) {
        // Check local cache first (faster)
        return conversationLog.some(e => e.text === text);
    }

    function pickRandom(arr) {
        // Try to find something not recently said
        const unused = arr.filter(t => !wasRecentlySaid(t));
        const pool = unused.length > 0 ? unused : arr;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // ==================== SPEECH ACTIONS ====================

    function greet() {
        speak(pickRandom(greetings), { force: true });
    }

    function giveStatusUpdate() {
        speak(pickRandom(statusUpdates));
    }

    function encourage() {
        speak(pickRandom(encouragements));
    }

    function shareWorkUpdate() {
        speak(pickRandom(workUpdates));
    }

    function idleChat() {
        speak(pickRandom(idleChatter));
    }

    function sayFarewell() {
        speak(pickRandom(farewells));
    }

    function commentOnTask() {
        speak(pickRandom(taskComments));
    }

    function celebrateCompletion() {
        speak(pickRandom(completionCelebrations));
    }

    function speakExtended() {
        // Speak multiple thoughts for up to 60 seconds
        const thoughts = [];

        // Build a mini monologue
        thoughts.push(pickRandom(greetings));

        // Add some substance
        if (Math.random() > 0.5) {
            thoughts.push(pickRandom(statusUpdates));
        }
        if (Math.random() > 0.5) {
            thoughts.push(pickRandom(workUpdates));
        }
        if (Math.random() > 0.3) {
            thoughts.push(pickRandom(idleChatter));
        }
        thoughts.push(pickRandom(encouragements));

        // Join with pauses
        const fullSpeech = thoughts.join(' ... ');
        speak(fullSpeech, { force: true });
    }

    // ==================== IDLE CHAT TIMER ====================

    function startIdleChat() {
        if (idleChatTimer) return;

        console.log('[Heather] Starting idle chat timer');
        idleChatTimer = setInterval(() => {
            // Random chance to speak during idle
            if (Math.random() > 0.5) {
                const actions = [idleChat, giveStatusUpdate, encourage, shareWorkUpdate];
                const action = actions[Math.floor(Math.random() * actions.length)];
                action();
            }
        }, config.idleChatInterval);
    }

    function stopIdleChat() {
        if (idleChatTimer) {
            clearInterval(idleChatTimer);
            idleChatTimer = null;
            console.log('[Heather] Stopped idle chat timer');
        }
    }

    // ==================== INITIALIZATION ====================

    async function init() {
        console.log('[Heather] Initializing team lead persona');

        // Load conversation history from relay DB
        await loadFromRelay();

        // Start idle chat
        startIdleChat();

        // Subscribe to task events if TaskProcessor exists
        if (typeof TaskProcessor !== 'undefined') {
            TaskProcessor.on('taskStateChange', ({ task, newState }) => {
                if (newState === 'claude_processing') {
                    commentOnTask();
                } else if (newState === 'complete') {
                    celebrateCompletion();
                }
            });
        }

        // Initial greeting after short delay
        setTimeout(() => {
            greet();
        }, 3000);

        console.log('[Heather] Ready to lead the team!');
    }

    // ==================== PUBLIC API ====================

    return {
        init,
        speak,
        greet,
        giveStatusUpdate,
        encourage,
        shareWorkUpdate,
        idleChat,
        sayFarewell,
        commentOnTask,
        celebrateCompletion,
        speakExtended,
        startIdleChat,
        stopIdleChat,
        getConversationLog: () => [...conversationLog],
        config
    };
})();

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Heather.init());
} else {
    Heather.init();
}

// Export
if (typeof module !== 'undefined') module.exports = { Heather };
