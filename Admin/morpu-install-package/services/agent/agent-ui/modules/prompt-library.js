/**
 * Admin Kitt - Prompt Library Module
 * Version: v1.0.0
 * Last updated: 2026-01-13
 *
 * Manages prompts for teaching/testing LLMs
 */

const PromptLibrary = (function() {
    'use strict';

    const RELAY_PORT = 8600;
    let panelVisible = false;
    let prompts = [];
    let selectedPrompt = null;

    const categories = ['general', 'system', 'coding', 'review', 'debug', 'simwidget'];
    const models = [
        { id: 'qwen3-coder:latest', name: 'Qwen3 Coder (30.5B)', speed: '34 tok/s' },
        { id: 'qwen2.5-coder:14b', name: 'Qwen2.5 Coder (14B)', speed: '87 tok/s' },
        { id: 'qwen2.5-coder:7b', name: 'Qwen2.5 Coder (7B)', speed: '172 tok/s' }
    ];

    function getBaseUrl() {
        return `http://${location.hostname}:${RELAY_PORT}`;
    }

    async function loadPrompts(category = '', search = '') {
        try {
            let url = `${getBaseUrl()}/api/prompts`;
            const params = new URLSearchParams();
            if (category) params.set('category', category);
            if (search) params.set('search', search);
            if (params.toString()) url += '?' + params.toString();

            const res = await fetch(url);
            const data = await res.json();
            prompts = data.prompts || [];
            renderPromptList();
        } catch (err) {
            console.error('Failed to load prompts:', err);
        }
    }

    function renderPromptList() {
        const listEl = document.getElementById('prompt-list');
        if (!listEl) return;

        if (prompts.length === 0) {
            listEl.innerHTML = '<div class="empty-state">No prompts yet. Create one!</div>';
            return;
        }

        listEl.innerHTML = prompts.map(p => `
            <div class="prompt-item ${selectedPrompt?.id === p.id ? 'selected' : ''}" onclick="PromptLibrary.selectPrompt('${p.id}')">
                <div class="prompt-name">${escapeHtml(p.name)}</div>
                <div class="prompt-meta">
                    <span class="prompt-category">${p.category}</span>
                    <span class="prompt-stats">${p.use_count} uses</span>
                    ${p.rating > 0 ? `<span class="prompt-rating">${'★'.repeat(Math.round(p.rating))}</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    function selectPrompt(id) {
        selectedPrompt = prompts.find(p => p.id === id);
        renderPromptList();
        renderPromptDetails();
    }

    function renderPromptDetails() {
        const detailsEl = document.getElementById('prompt-details');
        if (!detailsEl) return;

        if (!selectedPrompt) {
            detailsEl.innerHTML = '<div class="empty-state">Select a prompt to view details</div>';
            return;
        }

        const p = selectedPrompt;
        detailsEl.innerHTML = `
            <div class="prompt-detail-header">
                <input type="text" class="prompt-title-input" value="${escapeHtml(p.name)}"
                    onchange="PromptLibrary.updatePrompt('name', this.value)">
                <select class="prompt-category-select" onchange="PromptLibrary.updatePrompt('category', this.value)">
                    ${categories.map(c => `<option value="${c}" ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
            </div>
            <textarea class="prompt-text-editor" id="prompt-text-editor"
                placeholder="Enter prompt text...">${escapeHtml(p.prompt_text)}</textarea>
            <div class="prompt-actions">
                <button class="btn-primary" onclick="PromptLibrary.savePrompt()">Save</button>
                <button class="btn-secondary" onclick="PromptLibrary.testPrompt()">Test</button>
                <button class="btn-danger" onclick="PromptLibrary.deletePrompt()">Delete</button>
            </div>
            <div class="prompt-test-section" id="prompt-test-section">
                <div class="test-header">
                    <h4>Test Prompt</h4>
                    <select id="test-model-select">
                        ${models.map(m => `<option value="${m.id}">${m.name} (${m.speed})</option>`).join('')}
                    </select>
                </div>
                <input type="text" class="test-input" id="test-input" placeholder="Optional test input...">
                <div class="test-output" id="test-output"></div>
            </div>
        `;
    }

    async function savePrompt() {
        if (!selectedPrompt) return;

        const promptText = document.getElementById('prompt-text-editor')?.value;
        if (!promptText) return;

        try {
            await fetch(`${getBaseUrl()}/api/prompts/${selectedPrompt.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt_text: promptText })
            });
            selectedPrompt.prompt_text = promptText;
            showNotification('Prompt saved');
        } catch (err) {
            showNotification('Failed to save: ' + err.message, 'error');
        }
    }

    async function updatePrompt(field, value) {
        if (!selectedPrompt) return;

        try {
            await fetch(`${getBaseUrl()}/api/prompts/${selectedPrompt.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value })
            });
            selectedPrompt[field] = value;
            renderPromptList();
        } catch (err) {
            console.error('Failed to update prompt:', err);
        }
    }

    async function testPrompt() {
        if (!selectedPrompt) return;

        const model = document.getElementById('test-model-select')?.value;
        const testInput = document.getElementById('test-input')?.value;
        const outputEl = document.getElementById('test-output');

        if (outputEl) outputEl.innerHTML = '<div class="loading">Testing...</div>';

        try {
            const res = await fetch(`${getBaseUrl()}/api/prompts/${selectedPrompt.id}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, test_input: testInput })
            });
            const data = await res.json();

            if (outputEl) {
                outputEl.innerHTML = `
                    <div class="test-result">
                        <div class="test-meta">Model: ${data.model} | Time: ${data.elapsed_ms}ms | Tokens: ${data.tokens}</div>
                        <pre class="test-response">${escapeHtml(data.response)}</pre>
                    </div>
                `;
            }
            loadPrompts(); // Refresh to update use count
        } catch (err) {
            if (outputEl) outputEl.innerHTML = `<div class="test-error">Error: ${err.message}</div>`;
        }
    }

    async function deletePrompt() {
        if (!selectedPrompt) return;
        if (!confirm(`Delete prompt "${selectedPrompt.name}"?`)) return;

        try {
            await fetch(`${getBaseUrl()}/api/prompts/${selectedPrompt.id}`, { method: 'DELETE' });
            selectedPrompt = null;
            loadPrompts();
            renderPromptDetails();
            showNotification('Prompt deleted');
        } catch (err) {
            showNotification('Failed to delete: ' + err.message, 'error');
        }
    }

    async function createPrompt() {
        const name = prompt('Prompt name:');
        if (!name) return;

        try {
            const res = await fetch(`${getBaseUrl()}/api/prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    category: 'general',
                    prompt_text: 'You are a helpful assistant.'
                })
            });
            const data = await res.json();
            if (data.id) {
                await loadPrompts();
                selectPrompt(data.id);
            }
        } catch (err) {
            showNotification('Failed to create: ' + err.message, 'error');
        }
    }

    function toggle() {
        panelVisible = !panelVisible;
        let panel = document.getElementById('prompt-library-panel');

        if (!panel) {
            panel = createPanel();
            document.body.appendChild(panel);
        }

        panel.style.display = panelVisible ? 'flex' : 'none';
        if (panelVisible) loadPrompts();
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'prompt-library-panel';
        panel.className = 'llm-panel prompt-library-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>Prompt Library</h3>
                <div class="panel-header-actions">
                    <button onclick="PromptLibrary.createPrompt()" title="New Prompt">+</button>
                    <button onclick="PromptLibrary.toggle()" title="Close">×</button>
                </div>
            </div>
            <div class="panel-toolbar">
                <input type="text" id="prompt-search" placeholder="Search prompts..."
                    oninput="PromptLibrary.loadPrompts('', this.value)">
                <select id="prompt-filter" onchange="PromptLibrary.loadPrompts(this.value, '')">
                    <option value="">All Categories</option>
                    ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
            </div>
            <div class="panel-body">
                <div class="prompt-list" id="prompt-list"></div>
                <div class="prompt-details" id="prompt-details">
                    <div class="empty-state">Select a prompt to view details</div>
                </div>
            </div>
        `;
        return panel;
    }

    function showNotification(msg, type = 'success') {
        if (typeof AdminKitt !== 'undefined' && AdminKitt.addMessage) {
            AdminKitt.addMessage('system', msg, { fadeAfter: 3000 });
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    return {
        toggle,
        loadPrompts,
        selectPrompt,
        savePrompt,
        updatePrompt,
        testPrompt,
        deletePrompt,
        createPrompt
    };
})();

window.PromptLibrary = PromptLibrary;

// ========== Panel State Manager ==========
// Centralized position/size persistence for all LLM panels
const PanelStateManager = (function() {
    'use strict';

    const STORAGE_KEY = 'cc-panel-states';

    function getStates() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch { return {}; }
    }

    function saveState(panelId, state) {
        const states = getStates();
        states[panelId] = { ...states[panelId], ...state };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    }

    function loadState(panelId) {
        return getStates()[panelId] || null;
    }

    function makeDraggable(panel) {
        const header = panel.querySelector('.panel-header');
        if (!header) return;

        let isDragging = false;
        let startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            panel.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const newLeft = startLeft + e.clientX - startX;
            const newTop = startTop + e.clientY - startY;
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
            panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                panel.style.transition = '';
                saveState(panel.id, {
                    left: panel.style.left,
                    top: panel.style.top
                });
            }
        });

        // Track resize
        const resizeObserver = new ResizeObserver(() => {
            if (panel.dataset.initialized) {
                saveState(panel.id, {
                    width: panel.offsetWidth + 'px',
                    height: panel.offsetHeight + 'px'
                });
            }
        });
        resizeObserver.observe(panel);
        setTimeout(() => panel.dataset.initialized = 'true', 200);
    }

    function applyState(panel) {
        const state = loadState(panel.id);
        if (!state) return;

        if (state.left) { panel.style.left = state.left; panel.style.right = 'auto'; }
        if (state.top) panel.style.top = state.top;
        if (state.width) panel.style.width = state.width;
        if (state.height) panel.style.height = state.height;
    }

    function init(panel) {
        applyState(panel);
        makeDraggable(panel);
    }

    return { init, saveState, loadState };
})();

// Auto-init panels when they're created
const originalAppendChild = Element.prototype.appendChild;
Element.prototype.appendChild = function(child) {
    const result = originalAppendChild.call(this, child);
    if (child.classList && child.classList.contains('llm-panel')) {
        setTimeout(() => PanelStateManager.init(child), 50);
    }
    return result;
};

window.PanelStateManager = PanelStateManager;
