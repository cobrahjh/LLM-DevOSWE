/**
 * Admin Kitt - Core Module
 * Version: v2.0.0
 * Last updated: 2026-01-10
 * 
 * Core functionality: WebSocket, messaging, state management
 */

const AdminKitt = (function() {
    'use strict';
    
    // ==================== STATE ====================
    const state = {
        ws: null,
        isBusy: false,
        pendingMessage: '',
        manualDisconnect: false,
        reconnectTimeout: null,
        keepAliveInterval: null,
        thinkingEl: null,
        thinkingTimer: null,
        thinkingStartTime: null,
        lastKnownCost: null,
        attachments: []
    };
    
    // ==================== CONFIG ====================
    const config = {
        baseHost: location.hostname,
        wsProtocol: location.protocol === 'https:' ? 'wss:' : 'ws:',
        reconnectDelay: 3000,
        keepAliveInterval: 25000,
        isDevMachine: ['localhost', '127.0.0.1', '192.168.1.42'].includes(location.hostname)
    };
    
    // ==================== DOM ELEMENTS ====================
    let elements = {};
    
    function cacheElements() {
        elements = {
            chat: document.getElementById('chat'),
            input: document.getElementById('message-input'),
            btnSend: document.getElementById('btn-send'),
            btnVoice: document.getElementById('btn-voice'),
            btnRefresh: document.getElementById('btn-refresh'),
            status: document.getElementById('status'),
            kittStatus: document.getElementById('kitt-status'),
            pendingBubble: document.getElementById('pending-bubble'),
            pendingText: document.getElementById('pending-text'),
            pendingSendBtn: document.getElementById('pending-send-btn'),
            prioritySelect: document.getElementById('priority-select'),
            attachmentPreview: document.getElementById('attachment-preview'),
            fileInput: document.getElementById('file-input'),
            headerCost: document.getElementById('header-cost')
        };
    }
    
    // ==================== WEBSOCKET ====================
    function connect() {
        if (state.reconnectTimeout) {
            clearTimeout(state.reconnectTimeout);
            state.reconnectTimeout = null;
        }
        
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.manualDisconnect = true;
            state.ws.close();
        }
        
        elements.btnRefresh.classList.add('spinning');
        state.ws = new WebSocket(`${config.wsProtocol}//${location.host}/chat`);
        
        state.ws.onopen = handleWsOpen;
        state.ws.onclose = handleWsClose;
        state.ws.onerror = () => elements.btnRefresh.classList.remove('spinning');
        state.ws.onmessage = handleWsMessage;
    }
    
    function handleWsOpen() {
        elements.status.textContent = 'Connected';
        elements.status.className = 'status connected';
        elements.btnRefresh.classList.remove('spinning');
        state.manualDisconnect = false;
        
        if (!sessionStorage.getItem('kittConnected')) {
            sessionStorage.setItem('kittConnected', 'true');
            addMessage('system', '✓ Connected to "Kitt"', { fadeAfter: 10000 });
        }
        
        // Keep-alive ping
        if (state.keepAliveInterval) clearInterval(state.keepAliveInterval);
        state.keepAliveInterval = setInterval(() => {
            if (state.ws && state.ws.readyState === WebSocket.OPEN) {
                state.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, config.keepAliveInterval);
    }
    
    function handleWsClose() {
        elements.status.textContent = 'Disconnected';
        elements.status.className = 'status';
        elements.btnRefresh.classList.remove('spinning');
        state.isBusy = false;
        updateKittStatus();
        
        if (state.keepAliveInterval) {
            clearInterval(state.keepAliveInterval);
            state.keepAliveInterval = null;
        }
        
        if (!state.manualDisconnect) {
            state.reconnectTimeout = setTimeout(connect, config.reconnectDelay);
        }
        state.manualDisconnect = false;
    }
    
    function handleWsMessage(event) {
        const msg = JSON.parse(event.data);
        const AL = typeof ActivityLog !== 'undefined' ? ActivityLog : null;

        switch (msg.type) {
            case 'thinking':
                showThinking(state.lastSentMessage);
                state.isBusy = true;
                updateKittStatus();
                updatePendingSendBtn();
                elements.status.textContent = 'Thinking...';
                elements.status.className = 'status busy';
                if (AL) AL.info('Processing started...');
                break;

            case 'response':
                hideThinking();
                addMessage('assistant', msg.content);
                // TTS - speak the response
                if (typeof VoiceEngine !== 'undefined') VoiceEngine.speakResponse(msg.content);
                if (typeof Troubleshooting !== 'undefined') Troubleshooting.clearAlerts();
                state.isBusy = false;
                updateKittStatus();
                updatePendingSendBtn();
                updateHeaderCost();
                elements.status.textContent = 'Connected';
                elements.status.className = 'status connected';
                if (AL) AL.receive(`Response received (${msg.content.length} chars)`);
                break;

            case 'error':
                hideThinking();
                addMessage('error', 'Error: ' + msg.content);
                if (typeof Troubleshooting !== 'undefined') Troubleshooting.handleError(msg.content);
                state.isBusy = false;
                updateKittStatus();
                updatePendingSendBtn();
                elements.status.textContent = 'Connected';
                elements.status.className = 'status connected';
                if (AL) AL.error(msg.content);
                break;

            case 'busy_state':
                state.isBusy = msg.busy;
                updateKittStatus();
                updatePendingSendBtn();
                if (msg.busy) {
                    showThinking();
                    elements.status.textContent = 'Busy...';
                    elements.status.className = 'status busy';
                } else {
                    hideThinking();
                    elements.status.textContent = 'Connected';
                    elements.status.className = 'status connected';
                }
                if (AL) AL.info(msg.busy ? 'Kitt is busy' : 'Kitt is ready');
                break;

            case 'model_changed':
                if (typeof Model !== 'undefined' && Model.handleModelChange) {
                    Model.handleModelChange(msg);
                }
                if (AL) AL.info(`Model changed to ${msg.model}`);
                break;

            case 'status':
                updateThinkingStatus(msg.content);
                elements.status.textContent = msg.content || 'Working...';
                if (AL) AL.relay(msg.content);
                break;

            case 'question':
                // Kitt is asking a question with choices
                hideThinking();
                addQuestionMessage(msg.question, msg.choices, msg.questionId);
                state.isBusy = false;
                updateKittStatus();
                elements.status.textContent = 'Waiting for input...';
                elements.status.className = 'status connected';
                if (AL) AL.info('Question: ' + msg.question);
                break;
        }
    }

    // Add a question message with clickable choices
    function addQuestionMessage(question, choices, questionId) {
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper assistant';
        wrapper.dataset.questionId = questionId || Date.now();

        const div = document.createElement('div');
        div.className = 'message assistant question-message';

        let choicesHtml = '';
        if (choices && choices.length > 0) {
            choicesHtml = `<div class="question-choices">` +
                choices.map((choice, i) => {
                    const label = typeof choice === 'string' ? choice : choice.label;
                    const value = typeof choice === 'string' ? choice : (choice.value || choice.label);
                    const desc = typeof choice === 'object' && choice.description ?
                        `<span class="choice-desc">${choice.description}</span>` : '';
                    return `<button class="choice-btn" data-value="${escapeHtml(value)}" data-index="${i}">
                        <span class="choice-label">${escapeHtml(label)}</span>
                        ${desc}
                    </button>`;
                }).join('') +
                `<button class="choice-btn choice-other" data-value="__other__">
                    <span class="choice-label">Other...</span>
                </button>
            </div>`;
        }

        div.innerHTML = `
            <div class="question-header">
                <span class="question-icon">❓</span>
                <span class="question-title">Kitt needs your input</span>
            </div>
            <div class="question-text">${escapeHtml(question)}</div>
            ${choicesHtml}
        `;

        wrapper.appendChild(div);
        elements.chat.appendChild(wrapper);
        elements.chat.scrollTop = elements.chat.scrollHeight;

        // Attach click handlers to choice buttons
        div.querySelectorAll('.choice-btn').forEach(btn => {
            btn.addEventListener('click', () => handleChoiceClick(btn, wrapper));
        });
    }

    function handleChoiceClick(btn, wrapper) {
        const value = btn.dataset.value;
        const questionId = wrapper.dataset.questionId;

        if (value === '__other__') {
            // Show input for custom answer
            const input = prompt('Enter your answer:');
            if (input && input.trim()) {
                sendChoiceResponse(input.trim(), questionId, wrapper);
            }
        } else {
            sendChoiceResponse(value, questionId, wrapper);
        }
    }

    function sendChoiceResponse(choice, questionId, wrapper) {
        // Mark the selected choice
        wrapper.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
        const selectedBtn = wrapper.querySelector(`.choice-btn[data-value="${choice}"]`);
        if (selectedBtn) selectedBtn.classList.add('selected');

        // Disable all buttons
        wrapper.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);

        // Add user message showing their choice
        addMessage('user', choice);

        // Send to server
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify({
                type: 'choice_response',
                questionId: questionId,
                choice: choice
            }));
        }
    }
    
    // ==================== MESSAGING ====================
    function send() {
        const text = elements.input.value.trim();
        if ((!text && state.attachments.length === 0) || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
        
        if (state.isBusy) {
            showPendingBubble(text);
            elements.input.value = '';
            return;
        }
        
        let displayText = text;
        if (state.attachments.length > 0) {
            displayText += `\n📎 ${state.attachments.length} attachment(s): ${state.attachments.map(a => a.name).join(', ')}`;
        }
        
        addMessage('user', displayText);

        // Track last message for thinking bubble
        state.lastSentMessage = text;

        const payload = { type: 'chat', content: text };
        if (state.attachments.length > 0) {
            payload.attachments = state.attachments.map(a => ({
                name: a.name,
                type: a.type,
                dataUrl: a.dataUrl || null
            }));
        }

        state.ws.send(JSON.stringify(payload));
        elements.input.value = '';
        clearAttachments();

        // Log to activity
        if (typeof ActivityLog !== 'undefined') {
            ActivityLog.send(`Sent: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`);
        }
    }
    
    function sendQuick(text) {
        const btn = event?.target?.closest('.admin-btn, .quick-btn');
        if (typeof UIPanels !== 'undefined') UIPanels.closeAll();
        
        if (state.isBusy) {
            showPendingBubble(text);
            return;
        }
        
        // Try local execution first on dev machine
        if (config.isDevMachine && typeof LocalCommands !== 'undefined' && LocalCommands.has(text)) {
            LocalCommands.execute(text, btn);
            return;
        }
        
        if (btn) setButtonState(btn, 'loading', '⏳');
        elements.input.value = text;
        send();
        if (btn) setTimeout(() => setButtonState(btn, 'success', '✓', 1000), 500);
    }
    
    function addMessage(role, content, options = {}) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${role}`;
        
        const div = document.createElement('div');
        div.className = `message ${role}`;
        content = content.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre>$2</pre>');
        content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
        div.innerHTML = content;
        
        if (role === 'user' || role === 'assistant') {
            const actions = document.createElement('div');
            actions.className = 'message-actions';
            actions.innerHTML = `
                <button class="msg-action-btn" onclick="AdminKitt.copyMessage(this)" title="Copy">📋</button>
                <button class="msg-action-btn" onclick="AdminKitt.dismissMessage(this)" title="Dismiss">✗</button>
                ${role === 'user' ? '<button class="msg-action-btn stop-btn" onclick="AdminKitt.stopTask(this)" title="Stop/Cancel">⏹</button>' : ''}
            `;
            wrapper.appendChild(actions);
        }
        
        wrapper.appendChild(div);
        elements.chat.appendChild(wrapper);
        elements.chat.scrollTop = elements.chat.scrollHeight;
        
        if (options.fadeAfter) {
            setTimeout(() => {
                wrapper.style.transition = 'opacity 1s ease';
                wrapper.style.opacity = '0';
                setTimeout(() => wrapper.remove(), 1000);
            }, options.fadeAfter);
        }
    }
    
    function addSystemMessage(content) {
        addMessage('system', content, { fadeAfter: 5000 });
    }
    
    function copyMessage(btn) {
        const wrapper = btn.closest('.message-wrapper');
        const message = wrapper.querySelector('.message');
        navigator.clipboard.writeText(message.innerText).then(() => {
            btn.classList.add('copied');
            btn.textContent = '✓';
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.textContent = '📋';
            }, 1500);
        });
    }
    
    function dismissMessage(btn) {
        btn.closest('.message-wrapper').classList.toggle('dismissed');
    }

    async function stopTask(btn) {
        try {
            btn.textContent = '⏳';
            btn.disabled = true;

            const response = await fetch('/api/kitt/cancel', { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                btn.textContent = '✓';
                addMessage('system', '⏹ Task cancelled', { fadeAfter: 3000 });
                hideThinking();

                // Update ActivityLog if available
                if (typeof ActivityLog !== 'undefined') {
                    ActivityLog.warning('Task cancelled by user');
                }
            } else {
                btn.textContent = '⏹';
                addMessage('system', '⚠ Could not cancel task', { fadeAfter: 3000 });
            }
        } catch (err) {
            btn.textContent = '⏹';
            addMessage('error', 'Failed to cancel: ' + err.message);
        } finally {
            btn.disabled = false;
            setTimeout(() => { btn.textContent = '⏹'; }, 2000);
        }
    }

    // ==================== THINKING INDICATOR ====================
    let currentProcessingMessage = '';

    function showThinking(message) {
        hideThinking();
        state.thinkingStartTime = Date.now();
        currentProcessingMessage = message || '';

        state.thinkingEl = document.createElement('div');
        state.thinkingEl.className = 'message thinking';
        state.thinkingEl.innerHTML = `
            <div class="thinking-header">
                <span class="thinking-icon">💭</span>
                <span class="thinking-title">Kitt is processing...</span>
                <span class="thinking-timer" id="thinking-timer">0s</span>
                <button class="thinking-stop-btn" id="thinking-stop-btn" title="Stop processing">⏹</button>
            </div>
            <div class="thinking-task" id="thinking-task">
                <span class="thinking-task-label">Task:</span>
                <span class="thinking-task-text" id="thinking-task-text">${escapeHtml(currentProcessingMessage) || 'Loading...'}</span>
            </div>
            <div class="thinking-progress">
                <span class="thinking-status" id="thinking-status">Queuing...</span>
                <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
            </div>
        `;
        elements.chat.appendChild(state.thinkingEl);
        elements.chat.scrollTop = elements.chat.scrollHeight;

        // Attach stop button handler
        const stopBtn = document.getElementById('thinking-stop-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => stopTask(stopBtn));
        }

        // Fetch and update task from server
        fetchCurrentTask();

        state.thinkingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - state.thinkingStartTime) / 1000);
            const timerEl = document.getElementById('thinking-timer');
            if (timerEl) {
                const mins = Math.floor(elapsed / 60);
                const secs = elapsed % 60;
                timerEl.textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            }
            // Refresh task info every 3 seconds
            if (elapsed % 3 === 0) fetchCurrentTask();
        }, 1000);
    }

    async function fetchCurrentTask() {
        try {
            const res = await fetch('/api/kitt/status');
            const data = await res.json();
            const taskEl = document.getElementById('thinking-task-text');
            if (taskEl && data.task) {
                taskEl.textContent = data.task;
            }
        } catch (err) {
            // Ignore fetch errors
        }
    }

    function updateThinkingStatus(status) {
        const statusEl = document.getElementById('thinking-status');
        if (statusEl) statusEl.textContent = status;
    }
    
    function hideThinking() {
        if (state.thinkingTimer) { clearInterval(state.thinkingTimer); state.thinkingTimer = null; }
        if (state.thinkingEl) { state.thinkingEl.remove(); state.thinkingEl = null; }
        state.thinkingStartTime = null;
    }
    
    // ==================== STATUS ====================
    function updateKittStatus() {
        if (state.isBusy) {
            elements.kittStatus.textContent = '💭';
            elements.kittStatus.classList.add('busy');
            elements.kittStatus.title = 'Kitt is thinking...';
        } else {
            elements.kittStatus.textContent = '✨';
            elements.kittStatus.classList.remove('busy');
            elements.kittStatus.title = 'Kitt is ready';
        }
    }
    
    function updatePendingSendBtn() {
        if (elements.pendingSendBtn) {
            elements.pendingSendBtn.disabled = state.isBusy;
            elements.pendingSendBtn.textContent = state.isBusy ? 'Send (when ready)' : 'Send Now';
        }
    }
    
    // ==================== PENDING BUBBLE ====================
    function showPendingBubble(text) {
        state.pendingMessage = text;
        elements.pendingText.textContent = text;
        elements.pendingBubble.classList.add('active');
        updatePendingSendBtn();
    }
    
    function hidePendingBubble() {
        elements.pendingBubble.classList.remove('active');
        state.pendingMessage = '';
    }
    
    function sendPending() {
        if (state.pendingMessage && !state.isBusy) {
            addMessage('user', state.pendingMessage);
            state.ws.send(JSON.stringify({ type: 'chat', content: state.pendingMessage }));
            hidePendingBubble();
        }
    }
    
    function copyPendingText() {
        navigator.clipboard.writeText(state.pendingMessage).then(() => {
            const original = elements.pendingText.textContent;
            elements.pendingText.textContent = '✓ Copied!';
            setTimeout(() => elements.pendingText.textContent = original, 1000);
        });
    }
    
    function addTodo() {
        const priority = elements.prioritySelect.value;
        addMessage('system', `📝 Added to TODO [${priority.toUpperCase()}]: ${state.pendingMessage}`);
        state.ws.send(JSON.stringify({ type: 'todo', content: state.pendingMessage, priority }));
        hidePendingBubble();
    }
    
    // ==================== ATTACHMENTS ====================
    function addAttachment(file) {
        const id = Date.now() + Math.random().toString(36).substr(2, 9);
        const isImage = file.type.startsWith('image/');
        
        const attachment = { id, file, name: file.name, type: file.type, isImage };
        state.attachments.push(attachment);
        
        const item = document.createElement('div');
        item.className = 'attachment-item';
        item.dataset.id = id;
        
        if (isImage) {
            const reader = new FileReader();
            reader.onload = (e) => {
                attachment.dataUrl = e.target.result;
                item.innerHTML = `
                    <img src="${e.target.result}" alt="${file.name}">
                    <span class="file-name">${file.name}</span>
                    <button class="btn-remove" onclick="AdminKitt.removeAttachment('${id}')">×</button>
                `;
            };
            reader.readAsDataURL(file);
        } else {
            const icons = { pdf: '📄', txt: '📝', js: '📜', json: '📋', md: '📑', html: '🌐', css: '🎨' };
            const ext = file.name.split('.').pop().toLowerCase();
            item.innerHTML = `
                <span class="file-icon">${icons[ext] || '📁'}</span>
                <span class="file-name">${file.name}</span>
                <button class="btn-remove" onclick="AdminKitt.removeAttachment('${id}')">×</button>
            `;
        }
        
        elements.attachmentPreview.appendChild(item);
        elements.attachmentPreview.classList.add('active');
    }
    
    function removeAttachment(id) {
        state.attachments = state.attachments.filter(a => a.id !== id);
        const item = elements.attachmentPreview.querySelector(`[data-id="${id}"]`);
        if (item) item.remove();
        if (state.attachments.length === 0) elements.attachmentPreview.classList.remove('active');
    }
    
    function clearAttachments() {
        state.attachments = [];
        elements.attachmentPreview.innerHTML = '';
        elements.attachmentPreview.classList.remove('active');
    }
    
    // ==================== COST TRACKING ====================
    async function updateHeaderCost() {
        try {
            const response = await fetch(`http://${config.baseHost}:8585/api/usage`);
            const data = await response.json();
            const newCost = data.today.cost;
            
            if (state.lastKnownCost !== null && newCost > state.lastKnownCost) {
                const delta = newCost - state.lastKnownCost;
                
                const existingDelta = elements.headerCost.querySelector('.cost-delta');
                if (existingDelta) existingDelta.remove();
                
                elements.headerCost.childNodes.forEach(n => { if (n.nodeType === 3) n.remove(); });
                elements.headerCost.insertBefore(document.createTextNode('$' + newCost.toFixed(4)), elements.headerCost.firstChild);
                
                const deltaEl = document.createElement('span');
                deltaEl.className = 'cost-delta';
                deltaEl.textContent = '+$' + delta.toFixed(4);
                elements.headerCost.appendChild(deltaEl);
                
                elements.headerCost.classList.add('cost-changed');
                
                setTimeout(() => {
                    elements.headerCost.classList.remove('cost-changed');
                    if (deltaEl.parentNode) deltaEl.remove();
                }, 2000);
            } else {
                elements.headerCost.textContent = '$' + newCost.toFixed(4);
            }
            
            state.lastKnownCost = newCost;
        } catch (err) {
            console.error('Failed to load cost:', err);
        }
    }

    // ==================== STATUS PANEL ====================
    let statusPanelVisible = false;

    function createStatusPanel() {
        const panel = document.createElement('div');
        panel.id = 'kitt-status-panel';
        panel.className = 'status-panel';
        panel.innerHTML = `
            <div class="status-panel-header">
                <span>Kitt Status</span>
                <button class="status-panel-toggle" title="Toggle panel">−</button>
            </div>
            <div class="status-panel-body">
                <div class="status-row">
                    <span class="status-label">Kitt:</span>
                    <span class="status-value" id="sp-kitt-status">...</span>
                </div>
                <div class="status-row">
                    <span class="status-label">Queue:</span>
                    <span class="status-value" id="sp-queue-status">...</span>
                </div>
                <div class="status-row">
                    <span class="status-label">Relay:</span>
                    <span class="status-value" id="sp-relay-status">...</span>
                </div>
                <div class="status-row">
                    <span class="status-label">WS:</span>
                    <span class="status-value" id="sp-ws-status">...</span>
                </div>
                <div class="status-row">
                    <span class="status-label">DIM:</span>
                    <span class="status-value" id="sp-dim-status">...</span>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // Toggle visibility
        panel.querySelector('.status-panel-toggle').addEventListener('click', () => {
            panel.classList.toggle('collapsed');
            panel.querySelector('.status-panel-toggle').textContent =
                panel.classList.contains('collapsed') ? '+' : '−';
        });

        // Make draggable
        makePanelDraggable(panel);

        // Load saved position
        const savedPos = localStorage.getItem('kitt-status-panel-pos');
        if (savedPos) {
            const pos = JSON.parse(savedPos);
            panel.style.right = 'auto';
            panel.style.left = pos.left + 'px';
            panel.style.top = pos.top + 'px';
        }

        // Load collapsed state
        if (localStorage.getItem('kitt-status-panel-collapsed') === 'true') {
            panel.classList.add('collapsed');
            panel.querySelector('.status-panel-toggle').textContent = '+';
        }
    }

    function makePanelDraggable(panel) {
        const header = panel.querySelector('.status-panel-header');
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
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panel.style.right = 'auto';
            panel.style.left = (startLeft + e.clientX - startX) + 'px';
            panel.style.top = (startTop + e.clientY - startY) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                const rect = panel.getBoundingClientRect();
                localStorage.setItem('kitt-status-panel-pos', JSON.stringify({
                    left: rect.left,
                    top: rect.top
                }));
                localStorage.setItem('kitt-status-panel-collapsed',
                    panel.classList.contains('collapsed'));
            }
            isDragging = false;
            panel.style.transition = '';
        });
    }

    async function updateStatusPanel() {
        try {
            // Kitt status
            const kittRes = await fetch('/api/kitt/status');
            const kittData = await kittRes.json();
            const kittEl = document.getElementById('sp-kitt-status');
            if (kittEl) {
                if (kittData.busy) {
                    const elapsed = Math.round((Date.now() - new Date(kittData.since).getTime()) / 1000);
                    kittEl.innerHTML = `<span class="status-busy">🔴 Busy (${elapsed}s)</span>`;
                } else {
                    kittEl.innerHTML = `<span class="status-ready">🟢 Ready</span>`;
                }
            }

            // Queue status
            const queueRes = await fetch('/api/kitt/queue');
            const queueData = await queueRes.json();
            const queueEl = document.getElementById('sp-queue-status');
            if (queueEl) {
                const count = queueData.queue?.length || 0;
                queueEl.textContent = `${count} task${count !== 1 ? 's' : ''}`;
            }

            // Relay status
            const relayEl = document.getElementById('sp-relay-status');
            if (relayEl) {
                try {
                    const relayRes = await fetch('http://localhost:8600/api/health');
                    const relayData = await relayRes.json();
                    relayEl.innerHTML = `<span class="status-ready">🟢 ${relayData.queue.pending} pending</span>`;
                } catch {
                    relayEl.innerHTML = `<span class="status-offline">⚫ Offline</span>`;
                }
            }

            // WebSocket status
            const wsEl = document.getElementById('sp-ws-status');
            if (wsEl) {
                if (state.ws && state.ws.readyState === WebSocket.OPEN) {
                    wsEl.innerHTML = `<span class="status-ready">🟢 Connected</span>`;
                } else {
                    wsEl.innerHTML = `<span class="status-offline">⚫ Disconnected</span>`;
                }
            }

            // DIM status (Data Interface Manager / SimConnect bridge)
            const dimEl = document.getElementById('sp-dim-status');
            if (dimEl) {
                try {
                    const dimRes = await fetch('http://localhost:8080/api/status');
                    const dimData = await dimRes.json();
                    if (dimData.connected || dimData.status === 'ok') {
                        dimEl.innerHTML = `<span class="status-ready">🟢 Connected</span>`;
                    } else {
                        dimEl.innerHTML = `<span class="status-warning">🟡 Standby</span>`;
                    }
                } catch {
                    dimEl.innerHTML = `<span class="status-offline">⚫ Offline</span>`;
                }
            }
        } catch (err) {
            console.error('Status panel update failed:', err);
        }
    }

    // ==================== UTILITIES ====================
    function setButtonState(btn, stateClass, text, resetMs = 0) {
        if (!btn) return;
        const original = btn.innerHTML;
        btn.classList.remove('loading', 'success', 'error');
        btn.classList.add(stateClass);
        if (text) btn.innerHTML = text;
        
        if (resetMs > 0) {
            setTimeout(() => {
                btn.classList.remove('loading', 'success', 'error');
                btn.innerHTML = original;
            }, resetMs);
        }
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ==================== INITIALIZATION ====================
    function init() {
        cacheElements();
        
        // Event listeners
        elements.btnSend.addEventListener('click', send);
        elements.input.addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
        elements.btnRefresh.addEventListener('click', () => { addMessage('system', 'Reconnecting...'); connect(); });
        
        // Attachment handlers
        document.getElementById('btn-attach').addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(file => addAttachment(file));
            elements.fileInput.value = '';
        });
        
        // Clipboard paste
        elements.input.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) addAttachment(file);
                }
            }
        });
        
        // Ctrl+U shortcut
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'u') {
                e.preventDefault();
                elements.fileInput.click();
            }
        });
        
        // NTT button
        document.getElementById('btn-ntt').addEventListener('click', loadNextTodo);
        
        // Pending bubble buttons
        document.querySelector('.pending-cancel')?.addEventListener('click', hidePendingBubble);
        
        // Voice recognition
        initVoice();
        
        // Connect WebSocket
        connect();
        
        // Start cost update interval
        updateHeaderCost();
        setInterval(updateHeaderCost, 30000);

        // Initialize status panel
        createStatusPanel();
        updateStatusPanel();
        setInterval(updateStatusPanel, 2000);

        console.log(`🤖 Admin Kitt v2.0.0 initialized (${config.isDevMachine ? 'Dev' : 'Remote'} mode)`);
    }
    
    async function loadNextTodo() {
        try {
            const res = await fetch(`http://${location.hostname}:8585/api/todos`);
            const data = await res.json();
            const lists = data.lists || {};
            const todos = Object.values(lists).flat().filter(t => !t.completed);
            
            const priorityOrder = ['mustdo', 'high', 'medium', 'low', 'thought'];
            let nextTask = null;
            for (const priority of priorityOrder) {
                nextTask = todos.find(t => t.priority === priority);
                if (nextTask) break;
            }
            
            if (nextTask) {
                elements.input.value = nextTask.text;
                elements.input.focus();
                addSystemMessage(`📋 Loaded: ${nextTask.text}`);
            } else {
                addSystemMessage('✅ No pending tasks!');
            }
        } catch (err) {
            addSystemMessage(`❌ Failed to load todos: ${err.message}`);
        }
    }
    
    function initVoice() {
        // Use VoiceEngine if available
        if (typeof VoiceEngine !== 'undefined') {
            elements.btnVoice.addEventListener('click', () => {
                const listening = VoiceEngine.toggleListening();
                elements.btnVoice.classList.toggle('listening', listening);
            });

            // Push-to-talk: Hold Space bar (when not focused on any input/textarea)
            const isInputFocused = () => {
                const tag = document.activeElement?.tagName?.toLowerCase();
                return tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;
            };

            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space' && !isInputFocused() && !e.repeat) {
                    e.preventDefault();
                    if (!VoiceEngine.isListening) {
                        VoiceEngine.startListening();
                        elements.btnVoice.classList.add('listening');
                    }
                }
            });
            document.addEventListener('keyup', (e) => {
                if (e.code === 'Space' && !isInputFocused()) {
                    VoiceEngine.stopListening();
                    elements.btnVoice.classList.remove('listening');
                }
            });
        } else if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            // Fallback to inline implementation
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = () => elements.btnVoice.classList.add('listening');
            recognition.onend = () => elements.btnVoice.classList.remove('listening');
            recognition.onresult = (e) => { elements.input.value = e.results[0][0].transcript; send(); };

            elements.btnVoice.addEventListener('click', () => {
                elements.btnVoice.classList.contains('listening') ? recognition.stop() : recognition.start();
            });
        } else {
            elements.btnVoice.style.display = 'none';
        }
    }
    
    // ==================== PUBLIC API ====================
    return {
        init,
        connect,
        send,
        sendQuick,
        addMessage,
        addQuestionMessage,
        addSystemMessage,
        copyMessage,
        dismissMessage,
        stopTask,
        showPendingBubble,
        hidePendingBubble,
        sendPending,
        copyPendingText,
        addTodo,
        addAttachment,
        removeAttachment,
        clearAttachments,
        setButtonState,
        escapeHtml,
        updateHeaderCost,
        get state() { return state; },
        get config() { return config; }
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', AdminKitt.init);
