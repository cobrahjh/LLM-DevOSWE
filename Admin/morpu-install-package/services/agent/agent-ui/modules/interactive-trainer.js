/**
 * Admin Kitt - Interactive Trainer Module
 * Version: v1.0.0
 * Last updated: 2026-01-13
 *
 * Side-by-side chat with multiple LLMs, feedback creates training examples
 */

const InteractiveTrainer = (function() {
    'use strict';

    const RELAY_PORT = 8600;
    const OLLAMA_PORT = 11434;
    let panelVisible = false;
    let chatHistory = [];
    let isProcessing = false;

    const models = [
        { id: 'qwen3-coder:latest', name: 'Qwen3 Coder', speed: '34 tok/s' },
        { id: 'qwen2.5-coder:14b', name: 'Qwen2.5 (14B)', speed: '87 tok/s' },
        { id: 'qwen2.5-coder:7b', name: 'Qwen2.5 (7B)', speed: '172 tok/s' }
    ];

    let selectedModels = [models[0].id, models[1].id]; // Compare two models by default

    function getBaseUrl() {
        return `http://${location.hostname}`;
    }

    async function sendMessage() {
        const input = document.getElementById('trainer-input');
        const message = input?.value.trim();
        if (!message || isProcessing) return;

        input.value = '';
        isProcessing = true;
        updateSendButton();

        // Add user message to history
        const userMsg = { role: 'user', content: message, timestamp: Date.now() };
        chatHistory.push(userMsg);
        renderChat();

        // Query all selected models in parallel
        const responses = await Promise.all(selectedModels.map(modelId => queryModel(modelId, message)));

        // Add responses to chat
        const responseEntry = {
            role: 'assistant',
            responses: responses.map((r, i) => ({
                model: selectedModels[i],
                content: r.response || r.error,
                error: !!r.error,
                time_ms: r.elapsed_ms,
                tokens: r.tokens
            })),
            timestamp: Date.now(),
            userMessage: message
        };
        chatHistory.push(responseEntry);

        isProcessing = false;
        updateSendButton();
        renderChat();
    }

    async function queryModel(modelId, prompt) {
        const startTime = Date.now();
        try {
            const res = await fetch(`${getBaseUrl()}:${OLLAMA_PORT}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelId,
                    prompt: prompt,
                    stream: false
                })
            });
            const data = await res.json();
            return {
                response: data.response,
                elapsed_ms: Date.now() - startTime,
                tokens: data.eval_count || 0
            };
        } catch (err) {
            return {
                error: err.message,
                elapsed_ms: Date.now() - startTime
            };
        }
    }

    function renderChat() {
        const chatEl = document.getElementById('trainer-chat');
        if (!chatEl) return;

        if (chatHistory.length === 0) {
            chatEl.innerHTML = '<div class="empty-state">Send a message to compare model responses</div>';
            return;
        }

        chatEl.innerHTML = chatHistory.map((entry, idx) => {
            if (entry.role === 'user') {
                return `
                    <div class="chat-message user-message">
                        <div class="message-content">${escapeHtml(entry.content)}</div>
                    </div>
                `;
            } else {
                return `
                    <div class="chat-message assistant-message">
                        <div class="responses-grid">
                            ${entry.responses.map((r, i) => `
                                <div class="response-card ${r.error ? 'error' : ''}">
                                    <div class="response-header">
                                        <span class="model-name">${r.model}</span>
                                        <span class="response-meta">${r.time_ms}ms | ${r.tokens || 0} tokens</span>
                                    </div>
                                    <div class="response-content">${escapeHtml(r.content)}</div>
                                    <div class="response-actions">
                                        <button class="feedback-btn good" onclick="InteractiveTrainer.feedback(${idx}, ${i}, 'good')" title="Good response">👍</button>
                                        <button class="feedback-btn bad" onclick="InteractiveTrainer.feedback(${idx}, ${i}, 'bad')" title="Bad response">👎</button>
                                        <button class="feedback-btn train" onclick="InteractiveTrainer.addToTraining(${idx}, ${i})" title="Add to training data">📝</button>
                                        <button class="feedback-btn copy" onclick="InteractiveTrainer.copyResponse(${idx}, ${i})" title="Copy">📋</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }).join('');

        // Scroll to bottom
        chatEl.scrollTop = chatEl.scrollHeight;
    }

    function feedback(entryIdx, responseIdx, type) {
        const entry = chatHistory[entryIdx];
        if (!entry || entry.role !== 'assistant') return;

        const response = entry.responses[responseIdx];
        if (!response) return;

        response.feedback = type;

        // Visual feedback
        const cards = document.querySelectorAll('.assistant-message')[entryIdx - Math.floor(entryIdx/2)]
            ?.querySelectorAll('.response-card');
        if (cards && cards[responseIdx]) {
            cards[responseIdx].classList.add(`feedback-${type}`);
        }

        // If good, auto-add to training
        if (type === 'good') {
            addToTrainingData(entry.userMessage, response.content, 'trainer');
            showNotification('Added to training data');
        }
    }

    async function addToTraining(entryIdx, responseIdx) {
        const entry = chatHistory[entryIdx];
        if (!entry || entry.role !== 'assistant') return;

        const response = entry.responses[responseIdx];
        if (!response) return;

        await addToTrainingData(entry.userMessage, response.content, 'trainer');
        showNotification('Added to training data');
    }

    async function addToTrainingData(input, output, source) {
        try {
            await fetch(`${getBaseUrl()}:${RELAY_PORT}/api/training/examples`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input_text: input,
                    output_text: output,
                    source: source,
                    category: 'general'
                })
            });
        } catch (err) {
            console.error('Failed to add training example:', err);
        }
    }

    function copyResponse(entryIdx, responseIdx) {
        const entry = chatHistory[entryIdx];
        if (!entry || entry.role !== 'assistant') return;

        const response = entry.responses[responseIdx];
        if (!response) return;

        navigator.clipboard.writeText(response.content);
        showNotification('Copied to clipboard');
    }

    function updateSendButton() {
        const btn = document.getElementById('trainer-send-btn');
        if (btn) {
            btn.disabled = isProcessing;
            btn.textContent = isProcessing ? 'Sending...' : 'Send';
        }
    }

    function toggleModel(modelId) {
        const idx = selectedModels.indexOf(modelId);
        if (idx >= 0) {
            if (selectedModels.length > 1) {
                selectedModels.splice(idx, 1);
            }
        } else {
            if (selectedModels.length < 3) {
                selectedModels.push(modelId);
            }
        }
        renderModelSelector();
    }

    function renderModelSelector() {
        const selectorEl = document.getElementById('model-selector');
        if (!selectorEl) return;

        selectorEl.innerHTML = models.map(m => `
            <button class="model-toggle ${selectedModels.includes(m.id) ? 'active' : ''}"
                onclick="InteractiveTrainer.toggleModel('${m.id}')">
                ${m.name}
                <span class="model-speed">${m.speed}</span>
            </button>
        `).join('');
    }

    function clearChat() {
        if (chatHistory.length === 0) return;
        if (!confirm('Clear chat history?')) return;
        chatHistory = [];
        renderChat();
    }

    function toggle() {
        panelVisible = !panelVisible;
        let panel = document.getElementById('interactive-trainer-panel');

        if (!panel) {
            panel = createPanel();
            document.body.appendChild(panel);
        }

        panel.style.display = panelVisible ? 'flex' : 'none';
        if (panelVisible) {
            renderModelSelector();
            renderChat();
            document.getElementById('trainer-input')?.focus();
        }
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'interactive-trainer-panel';
        panel.className = 'llm-panel interactive-trainer-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>Interactive Trainer</h3>
                <div class="panel-header-actions">
                    <button onclick="InteractiveTrainer.clearChat()" title="Clear Chat">🗑️</button>
                    <button onclick="InteractiveTrainer.toggle()" title="Close">×</button>
                </div>
            </div>
            <div class="panel-toolbar">
                <div class="model-selector" id="model-selector"></div>
            </div>
            <div class="panel-body">
                <div class="trainer-chat" id="trainer-chat">
                    <div class="empty-state">Send a message to compare model responses</div>
                </div>
            </div>
            <div class="panel-footer trainer-footer">
                <input type="text" id="trainer-input" class="trainer-input"
                    placeholder="Enter a prompt to test..."
                    onkeydown="if(event.key==='Enter') InteractiveTrainer.sendMessage()">
                <button id="trainer-send-btn" class="btn-primary" onclick="InteractiveTrainer.sendMessage()">Send</button>
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
        sendMessage,
        feedback,
        addToTraining,
        copyResponse,
        toggleModel,
        clearChat
    };
})();

window.InteractiveTrainer = InteractiveTrainer;
