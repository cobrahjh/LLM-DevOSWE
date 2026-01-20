/**
 * Admin Kitt - Relay Module
 * Version: v2.0.0
 * Last updated: 2026-01-10
 * 
 * Handles: Relay mode toggle and status
 */

const Relay = (function() {
    'use strict';
    
    const config = {
        baseHost: location.hostname,
        checkInterval: 10000
    };
    
    async function checkStatus() {
        try {
            const res = await fetch(`http://${config.baseHost}:8585/api/relay`);
            const data = await res.json();
            const statusEl = document.getElementById('relay-status');
            const toggleEl = document.getElementById('relay-toggle');
            if (statusEl) statusEl.textContent = data.enabled ? 'ON' : 'OFF';
            if (toggleEl) toggleEl.style.background = data.enabled ? '#22c55e' : '#333';

            const queueRes = await fetch(`http://${config.baseHost}:8600/api/health`);
            if (queueRes.ok) {
                const queueData = await queueRes.json();
                const queueEl = document.getElementById('relay-queue');
                if (queueEl) queueEl.textContent = `Queue: ${queueData.queue.pending}`;
            }
        } catch (e) {
            const statusEl = document.getElementById('relay-status');
            if (statusEl) statusEl.textContent = 'ERR';
        }
    }
    
    async function toggle() {
        const btn = document.getElementById('relay-toggle');
        try {
            const current = await fetch(`http://${config.baseHost}:8585/api/relay`).then(r => r.json());
            const newState = !current.enabled;
            
            await fetch(`http://${config.baseHost}:8585/api/relay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newState })
            });
            
            document.getElementById('relay-status').textContent = newState ? 'ON' : 'OFF';
            btn.style.background = newState ? '#22c55e' : '#333';
            
            AdminKitt.addMessage('system', `Relay mode ${newState ? 'ENABLED' : 'DISABLED'}. ${newState ? 'Messages will be routed to Claude Desktop.' : 'Messages will use direct API.'}`, { fadeAfter: 6000 });
        } catch (e) {
            AdminKitt.addMessage('system', 'Failed to toggle relay mode: ' + e.message, { fadeAfter: 8000 });
        }
    }
    
    function init() {
        setTimeout(checkStatus, 2000);
        setInterval(checkStatus, config.checkInterval);
    }
    
    return {
        init,
        checkStatus,
        toggle
    };
})();

window.toggleRelayMode = Relay.toggle;

document.addEventListener('DOMContentLoaded', Relay.init);
