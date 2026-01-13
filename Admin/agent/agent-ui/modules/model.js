/**
 * Admin Kitt - Model Module
 * Version: v1.0.0
 * Last updated: 2026-01-10
 *
 * Handles: Model toggle between Sonnet 4 and Opus 4.5
 */

const Model = (function() {
    'use strict';

    const config = {
        baseHost: location.hostname
    };

    let currentModel = 'claude-sonnet-4-20250514';

    async function checkStatus() {
        try {
            const res = await fetch(`http://${config.baseHost}:8585/api/model`);
            const data = await res.json();
            currentModel = data.current;
            updateUI(data);
        } catch (e) {
            document.getElementById('model-name').textContent = 'ERR';
        }
    }

    function updateUI(data) {
        const nameEl = document.getElementById('model-name');
        const btn = document.getElementById('model-toggle');
        if (nameEl) nameEl.textContent = data.name || 'Unknown';
        if (btn) {
            btn.style.background = data.current.includes('opus') ? '#8b5cf6' : '#333';
        }
    }

    async function toggle() {
        const btn = document.getElementById('model-toggle');
        try {
            const current = await fetch(`http://${config.baseHost}:8585/api/model`).then(r => r.json());

            // Toggle between the two models
            const newModel = current.current.includes('opus')
                ? 'claude-sonnet-4-20250514'
                : 'claude-opus-4-5-20251101';

            const res = await fetch(`http://${config.baseHost}:8585/api/model`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: newModel })
            });

            const data = await res.json();
            updateUI({ current: data.model, name: data.name });

            const costNote = data.model.includes('opus') ? '(5x cost, best reasoning)' : '(fast & economical)';
            AdminKitt.addMessage('system', `Model switched to ${data.name} ${costNote}`, { fadeAfter: 6000 });
        } catch (e) {
            AdminKitt.addMessage('system', 'Failed to switch model: ' + e.message, { fadeAfter: 8000 });
        }
    }

    function handleModelChange(data) {
        updateUI({ current: data.model, name: data.name });
    }

    function init() {
        setTimeout(checkStatus, 1500);
    }

    return {
        init,
        checkStatus,
        toggle,
        handleModelChange
    };
})();

window.toggleModel = Model.toggle;

document.addEventListener('DOMContentLoaded', Model.init);
