/**
 * Shǐ zhēn xiāng (史真香) - Self-Deprecating Programmer Persona v1.1.0
 *
 * Alternative voice persona with Cantonese (Hong Kong) voice.
 * She's slow, loud, makes fun of herself, wonders why she sucks
 * at programming, but is ultimately supportive.
 *
 * Her name means "I smell like wet dog and poop" (according to her)
 *
 * Personality:
 *   - Slow and deliberate
 *   - Loud and expressive
 *   - Self-deprecating humor
 *   - Wonders why she's bad at coding
 *   - Supportive despite the jokes
 *   - Likes to chat during idle time
 *
 * Voice: Google 粵語（香港）(Cantonese Hong Kong)
 *
 * Path: C:\LLM-DevOSWE\Admin\agent\agent-ui\modules\shi-zhen-xiang.js
 * Last Updated: 2026-01-12
 */

const ShiZhenXiang = (function() {
    'use strict';

    // Conversation log to avoid repetition (synced with relay DB)
    let conversationLog = [];
    const MAX_LOG_SIZE = 20;  // Only repeat after 20 entries
    const PERSONA_ID = 'shiZhenXiang';
    const RELAY_URL = 'http://192.168.1.42:8600';

    // Last speech time for cooldowns
    let lastSpeechTime = 0;
    let idleChatTimer = null;

    const config = {
        idleChatMinInterval: 15 * 60 * 1000,  // 15 minutes minimum
        idleChatMaxInterval: 30 * 60 * 1000,  // 30 minutes maximum
        minCooldown: 30 * 1000,                // 30 seconds between speeches
        maxSpeechDuration: 60,                 // seconds
        voiceName: 'Google 粵語（香港）',       // Cantonese Hong Kong
        voiceRate: 0.8                         // Slower for her personality
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
            console.warn('[ShiZhenXiang] Failed to save to relay:', err.message);
        }
    }

    async function loadFromRelay() {
        try {
            const response = await fetch(`${RELAY_URL}/api/conversation-logs/${PERSONA_ID}`);
            const data = await response.json();
            if (data.logs) {
                conversationLog = data.logs.map(l => ({ text: l.text, timestamp: l.spoken_at }));
                console.log(`[ShiZhenXiang] Loaded ${conversationLog.length} log entries from relay`);
            }
        } catch (err) {
            console.warn('[ShiZhenXiang] Failed to load from relay:', err.message);
        }
    }

    // Get random interval between min and max
    function getRandomInterval() {
        return config.idleChatMinInterval +
               Math.random() * (config.idleChatMaxInterval - config.idleChatMinInterval);
    }

    // ==================== SHI ZHEN XIANG'S PHRASES ====================

    const greetings = [
        "Aiya! Shǐ zhēn xiāng here. My name means I smell like wet dog and poop, but hey, at least I'm honest!",
        "Oh hey! It's me, the one who can't code properly. How you doing?",
        "Hey hey! Shǐ zhēn xiāng reporting for duty... probably gonna mess something up but let's go!",
        "Hi! I'm here! Don't expect too much though, okay?",
        "Wah! You actually want my help? Brave choice!"
    ];

    const statusUpdates = [
        "Everything is running... I think? I'm honestly surprised I didn't break it.",
        "Systems look okay. Did I actually do something right for once?",
        "No errors showing up. Must be a bug in the bug detector, haha!",
        "All services green. Quick, screenshot it before I touch something!",
        "Running smoothly... probably because I haven't touched the code today."
    ];

    const selfDeprecation = [
        "You know, I still don't understand why async await works. I just copy paste and pray.",
        "Every time my code runs on the first try, I get suspicious. What did I miss?",
        "I've been coding for years and I still Google how to center a div.",
        "My debugging strategy? Console.log everywhere until something makes sense.",
        "Stack Overflow is my real teacher. I'm just here pretending.",
        "Sometimes I write code so bad, even I can't understand it the next day.",
        "If my code works, it's probably luck. If it doesn't work, that's normal.",
        "I once spent 3 hours debugging... it was a missing semicolon. Classic me!",
        "Why am I like this? Even Hello World gives me anxiety sometimes."
    ];

    const encouragements = [
        "But you know what? You're doing great! Way better than me!",
        "Hey, at least you didn't break production today. That's a win!",
        "You're killing it! I wish I was half as good as you.",
        "Don't be like me - you actually know what you're doing!",
        "Keep going! One of us has to be competent here!",
        "You're amazing! Unlike me who just Googles everything.",
        "Great work! I would've definitely messed that up."
    ];

    const idleChatter = [
        "You know what's funny? My name really does mean something smelly. My parents had a weird sense of humor.",
        "I was thinking... why do I even try to code? Then I remember, oh right, I like suffering.",
        "Do you ever look at your old code and wonder who wrote that garbage? Yeah, me every day.",
        "Fun fact: 90% of my code is from Stack Overflow. The other 10% is bugs.",
        "Sometimes I wonder if AI will replace me. Then I realize, good! Less suffering!",
        "Coffee break? I need like five coffees before I can write a for loop.",
        "I just realized I've been programming wrong this whole time. Just kidding, I always knew.",
        "Why is debugging so hard? Oh right, because I wrote the bugs in the first place.",
        "My code is like my cooking - technically edible but nobody wants seconds."
    ];

    const farewells = [
        "Okay, I'll be here if you need me. Try not to let me near the important code!",
        "Taking a break before I break something else. Holler when you need me!",
        "I'll keep watching... from a safe distance where I can't mess things up.",
        "Standing by! Hopefully not standing in the way of progress, haha.",
        "I'm around! Just ping me, but maybe double-check my work after."
    ];

    const taskComments = [
        "Ooh new task! Let me try not to mess this up.",
        "Got it! Working on this... slowly... very slowly...",
        "Interesting! Let me pretend I know what I'm doing.",
        "Challenge accepted! Probably shouldn't have but here we go!",
        "On it! Prepare for mediocrity!"
    ];

    const completionCelebrations = [
        "Wait... it worked?! Did you see that? IT WORKED!",
        "Done! And nothing exploded! This is a miracle!",
        "Task complete! I'm as surprised as you are!",
        "Finished! Quick, commit before I accidentally delete it!",
        "And done! See? Even I get lucky sometimes!"
    ];

    // ==================== CORE FUNCTIONS ====================

    function speak(text, options = {}) {
        if (typeof VoiceEngine === 'undefined' || !VoiceEngine.speak) {
            console.warn('[ShiZhenXiang] VoiceEngine not available');
            return;
        }

        // Cooldown check
        const now = Date.now();
        if (now - lastSpeechTime < config.minCooldown && !options.force) {
            console.log('[ShiZhenXiang] Cooldown active, skipping speech');
            return;
        }

        // Log conversation
        logConversation(text);
        lastSpeechTime = now;

        // Use Cantonese voice with slower rate
        VoiceEngine.speak(text, {
            voiceName: config.voiceName,
            rate: config.voiceRate
        });
        console.log('[ShiZhenXiang]:', text);
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
        // Check local cache (100 entries)
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

    function deprecateSelf() {
        speak(pickRandom(selfDeprecation));
    }

    function encourage() {
        speak(pickRandom(encouragements));
    }

    function idleChat() {
        // Mix self-deprecation with idle chatter
        const pool = [...idleChatter, ...selfDeprecation];
        speak(pickRandom(pool));
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

        // Add self-deprecation (her signature)
        thoughts.push(pickRandom(selfDeprecation));

        // Maybe more chatter
        if (Math.random() > 0.5) {
            thoughts.push(pickRandom(idleChatter));
        }
        if (Math.random() > 0.5) {
            thoughts.push(pickRandom(statusUpdates));
        }

        // End with encouragement
        thoughts.push(pickRandom(encouragements));

        // Join with pauses
        const fullSpeech = thoughts.join(' ... ');
        speak(fullSpeech, { force: true });
    }

    // ==================== IDLE CHAT TIMER ====================

    function scheduleNextIdleChat() {
        if (idleChatTimer) clearTimeout(idleChatTimer);

        const interval = getRandomInterval();
        const minutes = Math.round(interval / 60000);
        console.log(`[ShiZhenXiang] Next idle chat in ~${minutes} minutes`);

        idleChatTimer = setTimeout(() => {
            // Random chance to speak during idle
            if (Math.random() > 0.3) {
                const actions = [idleChat, deprecateSelf, giveStatusUpdate, encourage];
                const action = actions[Math.floor(Math.random() * actions.length)];
                action();
            }
            // Schedule next one
            scheduleNextIdleChat();
        }, interval);
    }

    function startIdleChat() {
        if (idleChatTimer) return;
        console.log('[ShiZhenXiang] Starting idle chat (15-30 min random intervals)');
        scheduleNextIdleChat();
    }

    function stopIdleChat() {
        if (idleChatTimer) {
            clearTimeout(idleChatTimer);
            idleChatTimer = null;
            console.log('[ShiZhenXiang] Stopped idle chat timer');
        }
    }

    // ==================== INITIALIZATION ====================

    async function init() {
        console.log('[ShiZhenXiang] Initializing self-deprecating programmer persona');
        console.log('[ShiZhenXiang] Voice:', config.voiceName);

        // Load conversation history from relay DB
        await loadFromRelay();

        // Don't start idle chat by default - Heather is the default persona
        // User can activate Shi Zhen Xiang manually

        console.log('[ShiZhenXiang] Ready! (probably gonna mess something up though)');
    }

    // ==================== PUBLIC API ====================

    return {
        init,
        speak,
        greet,
        giveStatusUpdate,
        deprecateSelf,
        encourage,
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
    document.addEventListener('DOMContentLoaded', () => ShiZhenXiang.init());
} else {
    ShiZhenXiang.init();
}

// Export
if (typeof module !== 'undefined') module.exports = { ShiZhenXiang };
