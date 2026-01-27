/**
 * Task Bubbles UI Module v1.1.0
 *
 * Renders task states as visual bubbles in the chat interface.
 * Works with TaskProcessor for state management.
 * Now with minimizable bubbles and state persistence.
 *
 * Path: C:\LLM-DevOSWE\Admin\agent\agent-ui\modules\task-bubbles.js
 * Last Updated: 2026-01-11
 */

const TaskBubbles = (function() {
    'use strict';

    const STATE_CONFIG = {
        idle: { icon: '⏳', color: '#888', label: 'Idle' },
        queued: { icon: '📋', color: '#4a9eff', label: 'Queued' },
        waiting_for_claude: { icon: '⏳', color: '#f59e0b', label: 'Waiting' },
        claude_processing: { icon: '💭', color: '#8b5cf6', label: 'Processing' },
        complete: { icon: '✓', color: '#22c55e', label: 'Complete' },
        error: { icon: '✗', color: '#ef4444', label: 'Error' },
        cancelled: { icon: '⊘', color: '#666', label: 'Cancelled' }
    };

    const STORAGE_KEY = 'task-bubbles-state';
    let chatContainer = null;
    const bubbleElements = new Map(); // taskId → DOM element
    let minimizedBubbles = new Set(); // taskIds that are minimized
    let statusBarMinimized = false;

    // Persona system with voice profiles
    const PERSONAS = {
        heather: {
            id: 'heather',
            name: 'Heather',
            role: 'PM',
            icon: '👩‍💼',
            module: () => typeof Heather !== 'undefined' ? Heather : null,
            voice: {
                name: 'Google UK English Female',
                rate: 0.9,
                pitch: 1.0
            }
        },
        shiZhenXiang: {
            id: 'shiZhenXiang',
            name: 'Shǐ zhēn xiāng',
            role: 'Programmer',
            icon: '👩‍💻',
            module: () => typeof ShiZhenXiang !== 'undefined' ? ShiZhenXiang : null,
            voice: {
                name: 'Google 粵語（香港）',
                rate: 0.8,
                pitch: 1.0
            }
        }
    };
    let currentPersona = 'heather'; // Default persona

    // ==================== STYLES ====================
    function injectStyles() {
        if (document.getElementById('task-bubbles-styles')) return;

        const style = document.createElement('style');
        style.id = 'task-bubbles-styles';
        style.textContent = `
            .task-bubbles-container {
                max-height: 200px;
                overflow-y: auto;
                padding: 8px 16px;
                border-top: 1px solid #333;
                background: rgba(26, 26, 46, 0.95);
            }

            .task-bubbles-container:empty {
                display: none;
            }

            .task-bubble {
                margin: 8px 0;
                padding: 12px 16px;
                border-radius: 12px;
                background: #2a2a3e;
                border-left: 4px solid #4a9eff;
                transition: all 0.3s ease;
            }

            .task-bubble.state-queued {
                border-left-color: #4a9eff;
                background: linear-gradient(135deg, #1a1a2e 0%, #1f2937 100%);
            }

            .task-bubble.state-waiting_for_claude {
                border-left-color: #f59e0b;
                background: linear-gradient(135deg, #1a1a2e 0%, #292524 100%);
            }

            .task-bubble.state-claude_processing {
                border-left-color: #8b5cf6;
                background: linear-gradient(135deg, #1a1a2e 0%, #1e1b4b 100%);
                animation: pulse-glow 2s ease-in-out infinite;
            }

            .task-bubble.state-complete {
                border-left-color: #22c55e;
                background: linear-gradient(135deg, #1a1a2e 0%, #14532d 100%);
            }

            .task-bubble.state-error {
                border-left-color: #ef4444;
                background: linear-gradient(135deg, #1a1a2e 0%, #450a0a 100%);
            }

            .task-bubble.state-cancelled {
                border-left-color: #666;
                opacity: 0.6;
            }

            @keyframes pulse-glow {
                0%, 100% { box-shadow: 0 0 5px rgba(139, 92, 246, 0.3); }
                50% { box-shadow: 0 0 15px rgba(139, 92, 246, 0.5); }
            }

            .task-bubble-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }

            .task-bubble-icon {
                font-size: 18px;
                width: 24px;
                text-align: center;
            }

            .task-bubble-state {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                padding: 2px 8px;
                border-radius: 4px;
                background: rgba(255,255,255,0.1);
            }

            .task-bubble-time {
                font-size: 11px;
                color: #888;
                margin-left: auto;
            }

            .task-bubble-content {
                font-size: 14px;
                color: #e0e0e0;
                margin-bottom: 8px;
                word-break: break-word;
            }

            .task-bubble-progress {
                height: 4px;
                background: rgba(255,255,255,0.1);
                border-radius: 2px;
                overflow: hidden;
                margin-bottom: 8px;
            }

            .task-bubble-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #4a9eff, #8b5cf6);
                border-radius: 2px;
                transition: width 0.5s ease;
            }

            .task-bubble-status {
                font-size: 12px;
                color: #888;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .task-bubble-status-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: currentColor;
                animation: status-pulse 1.5s ease-in-out infinite;
            }

            .task-bubble.state-complete .task-bubble-status-dot,
            .task-bubble.state-error .task-bubble-status-dot,
            .task-bubble.state-cancelled .task-bubble-status-dot {
                animation: none;
            }

            @keyframes status-pulse {
                0%, 100% { opacity: 0.4; }
                50% { opacity: 1; }
            }

            .task-bubble-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }

            .task-bubble-btn {
                font-size: 12px;
                padding: 4px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .task-bubble-btn-cancel {
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
            }

            .task-bubble-btn-cancel:hover {
                background: rgba(239, 68, 68, 0.4);
            }

            .task-bubble-btn-copy {
                background: rgba(74, 158, 255, 0.2);
                color: #4a9eff;
            }

            .task-bubble-btn-copy:hover {
                background: rgba(74, 158, 255, 0.4);
            }

            .task-bubble-btn-remove {
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
            }

            .task-bubble-btn-remove:hover {
                background: rgba(239, 68, 68, 0.4);
            }

            .task-bubble-btn-retry {
                background: rgba(139, 92, 246, 0.2);
                color: #8b5cf6;
            }

            .task-bubble-btn-retry:hover {
                background: rgba(139, 92, 246, 0.4);
            }

            .task-bubble-btn-minimize {
                background: rgba(136, 136, 136, 0.2);
                color: #888;
                padding: 2px 8px;
                font-size: 14px;
            }

            .task-bubble-btn-minimize:hover {
                background: rgba(136, 136, 136, 0.4);
                color: #fff;
            }

            .task-bubble.minimized {
                padding: 8px 12px;
            }

            .task-bubble.minimized .task-bubble-content,
            .task-bubble.minimized .task-bubble-progress,
            .task-bubble.minimized .task-bubble-status,
            .task-bubble.minimized .task-bubble-queue-indicator,
            .task-bubble.minimized .task-bubble-actions {
                display: none;
            }

            .task-bubble.minimized .task-bubble-header {
                margin-bottom: 0;
            }

            .task-bubble-header-actions {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-left: auto;
            }

            .task-bubble-queue-indicator {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
                color: #4a9eff;
                margin-top: 4px;
            }

            .task-bubble-queue-pos {
                background: rgba(74, 158, 255, 0.2);
                padding: 2px 6px;
                border-radius: 4px;
            }

            /* Claude Status Indicator - Always visible */
            .claude-status-bar {
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: #2a2a3e;
                border: 1px solid #333;
                border-radius: 20px;
                padding: 6px 16px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                z-index: 1000;
                transition: all 0.3s ease;
            }

            .claude-status-bar.busy {
                border-color: #8b5cf6;
                box-shadow: 0 0 10px rgba(139, 92, 246, 0.3);
                background: linear-gradient(135deg, #2a2a3e 0%, #1e1b4b 100%);
                animation: bar-pulse 2s ease-in-out infinite;
            }

            .claude-status-bar.ready {
                border-color: #22c55e;
                background: linear-gradient(135deg, #2a2a3e 0%, #14532d 100%);
                animation: none;
            }

            @keyframes bar-pulse {
                0%, 100% {
                    box-shadow: 0 0 10px rgba(139, 92, 246, 0.3);
                    border-color: #8b5cf6;
                }
                50% {
                    box-shadow: 0 0 20px rgba(139, 92, 246, 0.6), 0 0 30px rgba(139, 92, 246, 0.3);
                    border-color: #a78bfa;
                }
            }

            .claude-status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #22c55e;
            }

            .claude-status-bar.busy .claude-status-dot {
                background: #8b5cf6;
                animation: status-pulse 1s ease-in-out infinite;
            }

            .claude-status-queue {
                font-size: 10px;
                color: #888;
                margin-left: 4px;
            }

            .claude-status-bar .status-minimize-btn {
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                padding: 0 4px;
                font-size: 10px;
                margin-left: 4px;
            }

            .claude-status-bar .status-minimize-btn:hover {
                color: #fff;
            }

            .claude-status-bar .status-chat-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 0 4px;
                font-size: 14px;
                margin-left: 8px;
                transition: transform 0.2s;
            }

            .claude-status-bar .status-chat-btn:hover {
                transform: scale(1.2);
            }

            .claude-status-bar.minimized {
                padding: 4px 10px;
            }

            .claude-status-bar.minimized .claude-status-text,
            .claude-status-bar.minimized .claude-status-queue {
                display: none;
            }

            @keyframes tickle-wiggle {
                0%, 100% { transform: scale(1) rotate(0deg); }
                20% { transform: scale(1.3) rotate(-15deg); }
                40% { transform: scale(1.3) rotate(15deg); }
                60% { transform: scale(1.3) rotate(-10deg); }
                80% { transform: scale(1.2) rotate(10deg); }
            }

            .claude-status-dot:hover {
                transform: scale(1.2);
                transition: transform 0.2s;
            }

            .status-speak-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 0 4px;
                font-size: 12px;
                opacity: 0.7;
                transition: opacity 0.2s;
            }

            .status-speak-btn:hover {
                opacity: 1;
            }

            .claude-speak-input {
                display: none;
                position: absolute;
                bottom: 100%;
                left: 0;
                right: 0;
                background: #1a1a2e;
                border: 1px solid #333;
                border-radius: 8px 8px 0 0;
                padding: 8px;
                margin-bottom: 4px;
                gap: 8px;
            }

            .claude-speak-input.visible {
                display: flex;
            }

            .claude-speak-input input {
                flex: 1;
                background: #252540;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 6px 10px;
                color: #fff;
                font-size: 12px;
            }

            .claude-speak-input input::placeholder {
                color: #666;
            }

            .claude-speak-input button {
                background: #4a9eff;
                border: none;
                border-radius: 4px;
                padding: 6px 12px;
                color: #fff;
                font-size: 12px;
                cursor: pointer;
            }

            .claude-speak-input button:hover {
                background: #3a8eef;
            }

            /* Persona Selector */
            .persona-selector {
                position: relative;
                display: inline-block;
            }

            .persona-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 2px 6px;
                font-size: 14px;
                border-radius: 4px;
                transition: background 0.2s;
            }

            .persona-btn:hover {
                background: rgba(255,255,255,0.1);
            }

            .persona-dropdown {
                display: none;
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: #1a1a2e;
                border: 1px solid #4a9eff;
                border-radius: 8px;
                padding: 4px;
                margin-bottom: 8px;
                min-width: 160px;
                z-index: 10001;
                box-shadow: 0 -4px 12px rgba(0,0,0,0.3);
            }

            .persona-dropdown.visible {
                display: block;
            }

            .persona-option {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                cursor: pointer;
                border-radius: 4px;
                transition: background 0.2s;
                white-space: nowrap;
            }

            .persona-option:hover {
                background: rgba(74, 158, 255, 0.2);
            }

            .persona-option.selected {
                background: rgba(74, 158, 255, 0.3);
            }

            .persona-option .persona-icon {
                font-size: 16px;
            }

            .persona-option .persona-name {
                font-size: 12px;
                color: #e0e0e0;
            }

            .persona-option .persona-role {
                font-size: 10px;
                color: #888;
            }
        `;
        document.head.appendChild(style);
    }

    // ==================== BUBBLE CREATION ====================
    function createBubble(task) {
        const config = STATE_CONFIG[task.state] || STATE_CONFIG.idle;

        const bubble = document.createElement('div');
        bubble.className = `task-bubble state-${task.state}`;
        bubble.dataset.taskId = task.id;

        const isMinimized = minimizedBubbles.has(task.id);
        if (isMinimized) bubble.classList.add('minimized');

        bubble.innerHTML = `
            <div class="task-bubble-header">
                <span class="task-bubble-icon">${config.icon}</span>
                <span class="task-bubble-state" style="color: ${config.color}">${config.label}</span>
                <div class="task-bubble-header-actions">
                    <span class="task-bubble-time">${formatTime(task.createdAt)}</span>
                    <button class="task-bubble-btn task-bubble-btn-minimize" onclick="TaskBubbles.toggleMinimize('${task.id}')" title="Minimize/Expand">${isMinimized ? '▼' : '▲'}</button>
                </div>
            </div>
            <div class="task-bubble-content">${escapeHtml(task.content)}</div>
            <div class="task-bubble-progress">
                <div class="task-bubble-progress-bar" style="width: ${task.progress}%"></div>
            </div>
            <div class="task-bubble-status">
                <span class="task-bubble-status-dot" style="color: ${config.color}"></span>
                <span class="task-bubble-status-text">${task.statusMessage || config.label}</span>
            </div>
            ${task.state === TaskProcessor.TaskState.QUEUED ? `
                <div class="task-bubble-queue-indicator">
                    <span class="task-bubble-queue-pos">#${getQueuePosition(task.id)}</span>
                    <span>in queue</span>
                </div>
            ` : ''}
            ${canCancel(task) || task.state === TaskProcessor.TaskState.CLAUDE_PROCESSING || task.state === TaskProcessor.TaskState.ERROR ? `
                <div class="task-bubble-actions">
                    ${canCancel(task) ? `<button class="task-bubble-btn task-bubble-btn-cancel" onclick="TaskBubbles.cancelTask('${task.id}')">Cancel</button>` : ''}
                    ${task.state === TaskProcessor.TaskState.CLAUDE_PROCESSING || task.state === TaskProcessor.TaskState.ERROR ? `<button class="task-bubble-btn task-bubble-btn-retry" onclick="TaskBubbles.retryTask('${task.id}')">🔄 Retry</button>` : ''}
                    ${task.state === TaskProcessor.TaskState.ERROR ? `<button class="task-bubble-btn task-bubble-btn-remove" onclick="TaskBubbles.removeTask('${task.id}')">🗑️ Remove</button>` : ''}
                    <button class="task-bubble-btn task-bubble-btn-copy" onclick="TaskBubbles.copyContent('${task.id}')">Copy</button>
                </div>
            ` : ''}
        `;

        bubbleElements.set(task.id, bubble);
        return bubble;
    }

    function updateBubble(task) {
        const bubble = bubbleElements.get(task.id);
        if (!bubble) return;

        const config = STATE_CONFIG[task.state] || STATE_CONFIG.idle;

        // Update class
        bubble.className = `task-bubble state-${task.state}`;

        // Update header
        bubble.querySelector('.task-bubble-icon').textContent = config.icon;
        bubble.querySelector('.task-bubble-state').textContent = config.label;
        bubble.querySelector('.task-bubble-state').style.color = config.color;

        // Update progress
        bubble.querySelector('.task-bubble-progress-bar').style.width = `${task.progress}%`;

        // Update status
        bubble.querySelector('.task-bubble-status-dot').style.color = config.color;
        bubble.querySelector('.task-bubble-status-text').textContent = task.statusMessage || config.label;

        // Update queue indicator
        const queueIndicator = bubble.querySelector('.task-bubble-queue-indicator');
        if (task.state === TaskProcessor.TaskState.QUEUED) {
            if (!queueIndicator) {
                const indicator = document.createElement('div');
                indicator.className = 'task-bubble-queue-indicator';
                indicator.innerHTML = `
                    <span class="task-bubble-queue-pos">#${getQueuePosition(task.id)}</span>
                    <span>in queue</span>
                `;
                bubble.querySelector('.task-bubble-status').after(indicator);
            } else {
                queueIndicator.querySelector('.task-bubble-queue-pos').textContent = `#${getQueuePosition(task.id)}`;
            }
        } else if (queueIndicator) {
            queueIndicator.remove();
        }

        // Update actions
        const actions = bubble.querySelector('.task-bubble-actions');
        if (!canCancel(task) && actions) {
            actions.remove();
        }
    }

    function removeBubble(taskId) {
        const bubble = bubbleElements.get(taskId);
        if (bubble) {
            bubble.style.transition = 'opacity 0.5s, transform 0.5s';
            bubble.style.opacity = '0';
            bubble.style.transform = 'translateX(-20px)';
            setTimeout(() => {
                bubble.remove();
                bubbleElements.delete(taskId);
            }, 500);
        }
    }

    // ==================== CLAUDE STATUS BAR ====================
    let statusBar = null;

    function createStatusBar() {
        if (statusBar) return;

        statusBar = document.createElement('div');
        statusBar.className = 'claude-status-bar' + (statusBarMinimized ? ' minimized' : '');
        statusBar.innerHTML = `
            <span class="claude-status-dot" title="Click to tickle"></span>
            <span class="claude-status-text">Claude is ready</span>
            <div class="persona-selector">
                <button class="persona-btn" title="Select team member">👩‍💼</button>
                <div class="persona-dropdown">
                    <div class="persona-option selected" data-persona="heather">
                        <span class="persona-icon">👩‍💼</span>
                        <div>
                            <div class="persona-name">Heather</div>
                            <div class="persona-role">PM</div>
                        </div>
                    </div>
                    <div class="persona-option" data-persona="shiZhenXiang">
                        <span class="persona-icon">👩‍💻</span>
                        <div>
                            <div class="persona-name">Shǐ zhēn xiāng</div>
                            <div class="persona-role">Programmer</div>
                        </div>
                    </div>
                </div>
            </div>
            <button class="status-chat-btn" onclick="TaskBubbles.speakWithPersona()" title="Have team member chat">💬</button>
            <button class="status-minimize-btn" onclick="TaskBubbles.toggleSpeakInput()" title="Custom speech">▲</button>
        `;
        document.body.appendChild(statusBar);

        // Create speak input (hidden by default)
        const speakInput = document.createElement('div');
        speakInput.className = 'claude-speak-input';
        speakInput.innerHTML = `
            <input type="text" id="claude-speak-text" placeholder="Type something to say..."
                   onkeypress="if(event.key==='Enter')TaskBubbles.speakCustomText()">
            <button onclick="TaskBubbles.speakCustomText()">Speak</button>
        `;
        statusBar.appendChild(speakInput);

        // Tickle on dot click
        const dot = statusBar.querySelector('.claude-status-dot');
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', ticklePersona);

        // Persona selector events
        const personaBtn = statusBar.querySelector('.persona-btn');
        const personaDropdown = statusBar.querySelector('.persona-dropdown');

        personaBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            personaDropdown.classList.toggle('visible');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            personaDropdown.classList.remove('visible');
        });

        // Persona selection
        statusBar.querySelectorAll('.persona-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                selectPersona(opt.dataset.persona);
                personaDropdown.classList.remove('visible');
            });
        });

        // Make status bar draggable
        setupStatusBarDrag();

        // Load saved position
        loadStatusBarPosition();
    }

    function setupStatusBarDrag() {
        let isDragging = false;
        let startX, startY, startLeft, startBottom;

        statusBar.style.cursor = 'move';

        statusBar.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on buttons or inputs
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' ||
                e.target.closest('.persona-dropdown') || e.target.closest('.claude-speak-input')) {
                return;
            }

            isDragging = true;
            const rect = statusBar.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left;
            startBottom = window.innerHeight - rect.bottom;

            statusBar.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // Calculate new position
            const newLeft = startLeft + dx;
            const newBottom = startBottom - dy;

            // Apply position (remove transform, use left/bottom)
            statusBar.style.transform = 'none';
            statusBar.style.left = Math.max(0, Math.min(window.innerWidth - statusBar.offsetWidth, newLeft)) + 'px';
            statusBar.style.bottom = Math.max(10, Math.min(window.innerHeight - statusBar.offsetHeight - 10, newBottom)) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                statusBar.style.transition = '';
                saveStatusBarPosition();
            }
        });
    }

    function saveStatusBarPosition() {
        try {
            const pos = {
                left: statusBar.style.left,
                bottom: statusBar.style.bottom
            };
            localStorage.setItem('claude-status-bar-position', JSON.stringify(pos));
            console.log('[TaskBubbles] Status bar position saved');
        } catch (e) {
            console.warn('[TaskBubbles] Failed to save status bar position:', e);
        }
    }

    function loadStatusBarPosition() {
        try {
            const saved = localStorage.getItem('claude-status-bar-position');
            if (saved) {
                const pos = JSON.parse(saved);
                if (pos.left && pos.bottom) {
                    statusBar.style.transform = 'none';
                    statusBar.style.left = pos.left;
                    statusBar.style.bottom = pos.bottom;
                    console.log('[TaskBubbles] Status bar position loaded');
                }
            }
        } catch (e) {
            console.warn('[TaskBubbles] Failed to load status bar position:', e);
        }
    }

    function selectPersona(personaId) {
        currentPersona = personaId;
        const persona = PERSONAS[personaId];

        // Update UI
        statusBar.querySelectorAll('.persona-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.persona === personaId);
        });

        // Update button icon
        const btn = statusBar.querySelector('.persona-btn');
        btn.textContent = persona.icon;
        btn.title = `${persona.name} (${persona.role})`;

        // Update status text placeholder
        const input = document.getElementById('claude-speak-text');
        if (input) {
            input.placeholder = `Type something for ${persona.name} to say...`;
        }

        // Load voice profile into VoiceEngine
        if (typeof VoiceEngine !== 'undefined' && persona.voice) {
            VoiceEngine.setVoice(persona.voice.name);
            VoiceEngine.setRate(persona.voice.rate);
            console.log(`[TaskBubbles] Loaded voice profile: ${persona.voice.name} @ ${persona.voice.rate}x`);
        }

        console.log(`[TaskBubbles] Selected persona: ${persona.name} (${persona.role})`);
    }

    function getActivePersona() {
        const persona = PERSONAS[currentPersona];
        return persona ? persona.module() : null;
    }

    function speakWithPersona() {
        const module = getActivePersona();
        if (module && module.speakExtended) {
            module.speakExtended();
        }
    }

    function toggleSpeakInput() {
        const input = statusBar.querySelector('.claude-speak-input');
        if (input) {
            input.classList.toggle('visible');
            if (input.classList.contains('visible')) {
                input.querySelector('input').focus();
            }
        }
    }

    function speakCustomText() {
        const input = document.getElementById('claude-speak-text');
        if (input && input.value.trim()) {
            const persona = PERSONAS[currentPersona];
            const module = getActivePersona();

            // Use persona's speak function if available (includes voice settings)
            if (module && module.speak) {
                module.speak(input.value.trim(), { force: true });
            } else if (typeof VoiceEngine !== 'undefined' && VoiceEngine.speak) {
                // Fallback with persona voice settings
                VoiceEngine.speak(input.value.trim(), {
                    voiceName: persona.voice?.name,
                    rate: persona.voice?.rate
                });
            }
            input.value = '';
        }
    }

    function ticklePersona() {
        const dot = statusBar.querySelector('.claude-status-dot');
        const text = statusBar.querySelector('.claude-status-text');
        const originalText = text.textContent;
        const persona = PERSONAS[currentPersona];

        // Wiggle animation
        dot.style.animation = 'none';
        dot.offsetHeight; // Trigger reflow
        dot.style.animation = 'tickle-wiggle 0.5s ease-in-out';

        // Persona-specific responses
        const heatherResponses = [
            { display: 'Hehe, that tickles! 😄', speak: 'Hehe, that tickles!' },
            { display: 'Hey! I felt that! 😆', speak: 'Hey! I felt that!' },
            { display: 'Stop it, I am working! 😂', speak: 'Stop it, I am working!' },
            { display: '*giggles* 🤭', speak: 'hehehe' },
            { display: 'Boop! 👉😊', speak: 'Boop!' },
            { display: 'Heather approves! 💜', speak: 'Heather approves!' },
            { display: 'Hi Boss! 👋', speak: 'Hi Boss!' }
        ];

        const shiZhenXiangResponses = [
            { display: 'Aiya! Why you poke me?! 😱', speak: 'Aiya! Why you poke me?!' },
            { display: 'I smell like wet dog! 🐕', speak: 'I smell like wet dog and poop!' },
            { display: 'Mr. Boss! Stop! 😂', speak: 'Mr. Boss! Stop that!' },
            { display: 'I broke something! 😰', speak: 'Oh no, I probably broke something!' },
            { display: '*confused coding* 🤔', speak: 'Wait, what was I doing again?' },
            { display: 'Bug or feature? 🐛', speak: 'Is that a bug or a feature? I never know!' },
            { display: 'Shǐ zhēn xiāng here! 👩‍💻', speak: 'Shǐ zhēn xiāng here! The one who smells funny!' }
        ];

        const responses = currentPersona === 'heather' ? heatherResponses : shiZhenXiangResponses;
        const response = responses[Math.floor(Math.random() * responses.length)];
        text.textContent = response.display;

        // Speak using the persona's voice settings
        const module = getActivePersona();
        if (module && module.speak) {
            module.speak(response.speak, { force: true });
        } else if (typeof VoiceEngine !== 'undefined' && VoiceEngine.speak) {
            VoiceEngine.speak(response.speak);
        }

        // Restore after 2 seconds
        setTimeout(() => {
            text.textContent = originalText;
            dot.style.animation = '';
        }, 2000);
    }

    function updateStatusBar(claudeStatus) {
        if (!statusBar) createStatusBar();

        const isBusy = claudeStatus.busy;
        statusBar.classList.toggle('busy', isBusy);
        statusBar.classList.toggle('ready', !isBusy);

        const text = statusBar.querySelector('.claude-status-text');
        const dot = statusBar.querySelector('.claude-status-dot');
        const queue = claudeStatus.relayQueue;

        if (isBusy) {
            const source = claudeStatus.source === 'kitt' ? 'Kitt' : 'Relay';
            let statusText = `⏳ Claude is working`;
            if (queue && queue.processing > 0) {
                statusText += ` (${queue.processing} task${queue.processing > 1 ? 's' : ''})`;
            }
            text.textContent = statusText;
            if (dot) dot.title = 'Processing...';
        } else {
            text.textContent = '✓ Claude is ready';
            if (dot) dot.title = 'Click to tickle';
        }

        // Update queue info if exists
        let queueEl = statusBar.querySelector('.claude-status-queue');
        if (!queueEl) {
            queueEl = document.createElement('span');
            queueEl.className = 'claude-status-queue';
            statusBar.appendChild(queueEl);
        }
        if (queue) {
            queueEl.textContent = `[Q:${queue.pending || 0} P:${queue.processing || 0}]`;
        }
    }

    // ==================== HELPERS ====================
    function formatTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getQueuePosition(taskId) {
        const queue = TaskProcessor.getQueue();
        const idx = queue.findIndex(t => t.id === taskId);
        return idx > -1 ? idx + 1 : '?';
    }

    function canCancel(task) {
        return task.state === TaskProcessor.TaskState.QUEUED ||
               task.state === TaskProcessor.TaskState.WAITING_FOR_CLAUDE ||
               task.state === TaskProcessor.TaskState.CLAUDE_PROCESSING;
    }

    // ==================== STATE PERSISTENCE ====================
    function saveState() {
        try {
            const state = {
                minimizedBubbles: Array.from(minimizedBubbles),
                statusBarMinimized
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('[TaskBubbles] Failed to save state:', e);
        }
    }

    function loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const state = JSON.parse(saved);
                minimizedBubbles = new Set(state.minimizedBubbles || []);
                statusBarMinimized = state.statusBarMinimized || false;
            }
        } catch (e) {
            console.warn('[TaskBubbles] Failed to load state:', e);
        }
    }

    // ==================== MINIMIZE FUNCTIONS ====================
    function toggleMinimize(taskId) {
        const bubble = bubbleElements.get(taskId);
        if (!bubble) return;

        if (minimizedBubbles.has(taskId)) {
            minimizedBubbles.delete(taskId);
            bubble.classList.remove('minimized');
            bubble.querySelector('.task-bubble-btn-minimize').textContent = '▲';
        } else {
            minimizedBubbles.add(taskId);
            bubble.classList.add('minimized');
            bubble.querySelector('.task-bubble-btn-minimize').textContent = '▼';
        }
        saveState();
    }

    function toggleStatusBar() {
        if (!statusBar) return;

        statusBarMinimized = !statusBarMinimized;
        statusBar.classList.toggle('minimized', statusBarMinimized);
        const btn = statusBar.querySelector('.status-minimize-btn');
        if (btn) btn.textContent = statusBarMinimized ? '▼' : '▲';
        saveState();
    }

    // ==================== PUBLIC ACTIONS ====================
    function cancelTask(taskId) {
        if (TaskProcessor.cancel(taskId)) {
            updateBubble(TaskProcessor.getTask(taskId));
        }
    }

    function copyContent(taskId) {
        const task = TaskProcessor.getTask(taskId);
        if (task) {
            navigator.clipboard.writeText(task.content).then(() => {
                const bubble = bubbleElements.get(taskId);
                if (bubble) {
                    const btn = bubble.querySelector('.task-bubble-btn-copy');
                    if (btn) {
                        const original = btn.textContent;
                        btn.textContent = 'Copied!';
                        setTimeout(() => { btn.textContent = original; }, 1500);
                    }
                }
            });
        }
    }

    async function removeTask(taskId) {
        const task = TaskProcessor.getTask(taskId);

        // Remove from relay if it has a relay ID
        if (task?.metadata?.relayId) {
            try {
                await fetch(`http://192.168.1.192:8600/api/tasks/${task.metadata.relayId}`, {
                    method: 'DELETE'
                });
                if (typeof ActivityLog !== 'undefined') {
                    ActivityLog.info(`Removed error task from relay: ${task.content?.substring(0, 30)}...`);
                }
            } catch (err) {
                console.warn('[TaskBubbles] Failed to remove from relay:', err);
            }
        }

        // Remove from TaskProcessor if available
        if (typeof TaskProcessor !== 'undefined' && TaskProcessor.remove) {
            TaskProcessor.remove(taskId);
        }

        // Remove bubble from UI
        removeBubble(taskId);
        console.log('[TaskBubbles] Removed error task:', taskId);
    }

    async function retryTask(taskId) {
        const task = TaskProcessor.getTask(taskId);
        if (!task) return;

        // Get relay ID from task metadata
        const relayId = task.metadata?.relayId;
        if (relayId) {
            try {
                // Release the task in relay so it can be picked up again
                const res = await fetch(`http://192.168.1.192:8600/api/tasks/${relayId}/release`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: 'Manual retry' })
                });

                if (res.ok) {
                    // Update local state
                    task.state = TaskProcessor.TaskState.WAITING_FOR_CLAUDE;
                    task.statusMessage = 'Retrying...';
                    task.progress = 20;
                    updateBubble(task);

                    if (typeof ActivityLog !== 'undefined') {
                        ActivityLog.info(`Retrying task: ${task.content.substring(0, 30)}...`);
                    }
                }
            } catch (err) {
                console.error('[TaskBubbles] Retry failed:', err);
            }
        } else {
            // No relay ID, just resubmit the content
            if (typeof AdminKitt !== 'undefined' && AdminKitt.sendQuick) {
                AdminKitt.sendQuick(task.content);
                removeBubble(taskId);
            }
        }
    }

    // ==================== EVENT HANDLERS ====================
    function handleTaskStateChange({ task, oldState, newState }) {
        console.log('[TaskBubbles] taskStateChange:', task.id, oldState, '->', newState, 'container:', !!chatContainer);

        if (!bubbleElements.has(task.id)) {
            // Create new bubble
            const bubble = createBubble(task);
            if (chatContainer) {
                chatContainer.appendChild(bubble);
                chatContainer.scrollTop = chatContainer.scrollHeight;
                console.log('[TaskBubbles] Created bubble for:', task.content?.substring(0, 30));
            } else {
                console.warn('[TaskBubbles] No container for bubble!');
            }
        } else {
            updateBubble(task);
        }

        // Auto-remove completed tasks after delay (only if they transitioned, not historical)
        // Historical tasks have oldState === null
        if (oldState !== null &&
            (newState === TaskProcessor.TaskState.COMPLETE ||
             newState === TaskProcessor.TaskState.CANCELLED)) {
            setTimeout(() => removeBubble(task.id), 10000);
        }
    }

    function handleTaskProgress({ task }) {
        updateBubble(task);
    }

    function handleClaudeStatusChange(status) {
        updateStatusBar(status);
    }

    // ==================== INITIALIZATION ====================
    function init(containerSelector = '#task-bubbles-container') {
        loadState();
        injectStyles();
        createStatusBar();

        chatContainer = document.querySelector(containerSelector) || document.querySelector('#chat');
        console.log('[TaskBubbles] Container found:', chatContainer?.id, 'parent:', chatContainer?.parentElement?.className);

        // Debug: Add a test element to confirm container works
        if (chatContainer) {
            const testDiv = document.createElement('div');
            testDiv.style.cssText = 'padding:8px;background:#2a2a3e;color:#4a9eff;border-radius:4px;margin:4px 0;';
            testDiv.textContent = '📋 Task bubbles container initialized';
            chatContainer.appendChild(testDiv);
            setTimeout(() => testDiv.remove(), 3000);
        }

        // Subscribe to TaskProcessor events
        if (typeof TaskProcessor !== 'undefined') {
            TaskProcessor.on('taskStateChange', handleTaskStateChange);
            TaskProcessor.on('taskProgress', handleTaskProgress);
            TaskProcessor.on('claudeStatusChange', handleClaudeStatusChange);

            // Get initial status
            const status = TaskProcessor.getClaudeStatus();
            if (status) {
                updateStatusBar(status);
            }
        }

        console.log('[TaskBubbles] Initialized');
    }

    function resetStatusBarPosition() {
        localStorage.removeItem('claude-status-bar-position');
        if (statusBar) {
            statusBar.style.transform = 'translateX(-50%)';
            statusBar.style.left = '50%';
            statusBar.style.bottom = '80px';
        }
        console.log('[TaskBubbles] Status bar position reset');
    }

    // ==================== PUBLIC API ====================
    return {
        init,
        createBubble,
        updateBubble,
        removeBubble,
        cancelTask,
        copyContent,
        retryTask,
        removeTask,
        updateStatusBar,
        toggleMinimize,
        toggleStatusBar,
        toggleSpeakInput,
        speakCustomText,
        speakWithPersona,
        selectPersona,
        getActivePersona,
        resetStatusBarPosition,
        get currentPersona() { return currentPersona; },
        get PERSONAS() { return PERSONAS; }
    };
})();

// Auto-initialize after TaskProcessor
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => TaskBubbles.init(), 100);
});

window.TaskBubbles = TaskBubbles;
