/**
 * SimWidget Co-Pilot Chat UI
 * Adds an AI assistant chat panel to the overlay
 */

class CoPilotUI {
    constructor(engine) {
        this.engine = engine;
        this.agent = null;
        this.voiceAgent = null;
        this.isOpen = false;
        this.element = null;
        
        this.init();
    }
    
    init() {
        // Create chat panel
        this.element = document.createElement('div');
        this.element.id = 'copilot-panel';
        this.element.innerHTML = `
            <div class="copilot-header">
                <span class="copilot-title">🤖 AI Co-Pilot</span>
                <div class="copilot-controls">
                    <button id="copilot-voice" title="Voice Input">🎤</button>
                    <button id="copilot-settings" title="Settings">⚙️</button>
                    <button id="copilot-close" title="Close">✕</button>
                </div>
            </div>
            <div class="copilot-messages" id="copilot-messages">
                <div class="copilot-welcome">
                    <p>👋 Hey! I'm your AI co-pilot.</p>
                    <p>Ask me anything about your flight:</p>
                    <ul>
                        <li>"Brief me for approach"</li>
                        <li>"Check my fuel status"</li>
                        <li>"Set altitude 10000"</li>
                        <li>"Lights on"</li>
                    </ul>
                </div>
            </div>
            <div class="copilot-input-area">
                <input type="text" id="copilot-input" placeholder="Ask your co-pilot..." autocomplete="off">
                <button id="copilot-send">➤</button>
            </div>
            <div class="copilot-settings-panel" id="copilot-settings-panel" style="display:none;">
                <h4>Settings</h4>
                <p class="copilot-note">Co-Pilot uses Relay Service (port 8600)</p>
                <p class="copilot-note">No API key needed - routes through Claude Desktop</p>
            </div>
        `;
        
        this.addStyles();
        document.body.appendChild(this.element);
        
        // Initialize agents (uses Relay Service - no API key needed)
        this.agent = new CoPilotAgent({
            relayUrl: 'http://localhost:8600'
        });
        
        this.voiceAgent = new VoiceAgent({
            onResult: (text) => this.handleVoiceInput(text)
        });
        
        this.bindEvents();
        this.hide();
    }
    
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #copilot-panel {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 380px;
                height: 500px;
                background: rgba(15, 23, 42, 0.95);
                border: 1px solid rgba(56, 189, 248, 0.3);
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                font-family: 'Segoe UI', system-ui, sans-serif;
                z-index: 10000;
                pointer-events: auto;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            }
            
            .copilot-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid rgba(56, 189, 248, 0.2);
                cursor: move;
            }
            
            .copilot-title {
                font-size: 14px;
                font-weight: 600;
                color: #38bdf8;
            }
            
            .copilot-controls button {
                background: none;
                border: none;
                color: #64748b;
                font-size: 16px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
            }
            .copilot-controls button:hover {
                background: rgba(56, 189, 248, 0.2);
                color: #38bdf8;
            }
            .copilot-controls button.active {
                color: #22c55e;
            }
            
            .copilot-messages {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }
            
            .copilot-welcome {
                color: #94a3b8;
                font-size: 13px;
            }
            .copilot-welcome p { margin: 8px 0; }
            .copilot-welcome ul { margin: 8px 0 8px 20px; }
            .copilot-welcome li { margin: 4px 0; color: #64748b; }
            
            .copilot-message {
                margin-bottom: 12px;
                padding: 10px 14px;
                border-radius: 8px;
                font-size: 13px;
                line-height: 1.5;
            }
            
            .copilot-message.user {
                background: rgba(56, 189, 248, 0.2);
                color: #e2e8f0;
                margin-left: 40px;
            }
            
            .copilot-message.assistant {
                background: rgba(30, 41, 59, 0.8);
                color: #e2e8f0;
                margin-right: 40px;
                border: 1px solid rgba(100, 200, 255, 0.1);
            }
            
            .copilot-message.error {
                background: rgba(239, 68, 68, 0.2);
                color: #fca5a5;
            }
            
            .copilot-message pre {
                background: rgba(0,0,0,0.3);
                padding: 8px;
                border-radius: 4px;
                overflow-x: auto;
                font-size: 11px;
            }
            
            .copilot-input-area {
                display: flex;
                gap: 8px;
                padding: 12px 16px;
                border-top: 1px solid rgba(56, 189, 248, 0.2);
            }
            
            #copilot-input {
                flex: 1;
                background: rgba(30, 41, 59, 0.8);
                border: 1px solid rgba(100, 200, 255, 0.2);
                border-radius: 8px;
                padding: 10px 14px;
                color: #e2e8f0;
                font-size: 13px;
            }
            #copilot-input:focus {
                outline: none;
                border-color: rgba(56, 189, 248, 0.5);
            }
            
            #copilot-send {
                background: linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(59, 130, 246, 0.3));
                border: 1px solid rgba(56, 189, 248, 0.5);
                color: #38bdf8;
                padding: 10px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
            }
            #copilot-send:hover {
                background: linear-gradient(135deg, rgba(56, 189, 248, 0.5), rgba(59, 130, 246, 0.5));
            }
            
            .copilot-settings-panel {
                padding: 16px;
                border-top: 1px solid rgba(56, 189, 248, 0.2);
            }
            .copilot-settings-panel h4 {
                color: #e2e8f0;
                margin: 0 0 12px 0;
                font-size: 13px;
            }
            .copilot-settings-panel label {
                color: #94a3b8;
                font-size: 11px;
                display: block;
                margin-bottom: 4px;
            }
            .copilot-settings-panel input {
                width: 100%;
                background: rgba(30, 41, 59, 0.8);
                border: 1px solid rgba(100, 200, 255, 0.2);
                border-radius: 6px;
                padding: 8px 10px;
                color: #e2e8f0;
                font-size: 12px;
                margin-bottom: 8px;
            }
            .copilot-settings-panel button {
                background: rgba(34, 197, 94, 0.3);
                border: 1px solid rgba(34, 197, 94, 0.5);
                color: #22c55e;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
            }
            .copilot-note {
                color: #64748b;
                font-size: 10px;
                margin-top: 8px;
            }
            
            .copilot-typing {
                color: #64748b;
                font-size: 12px;
                padding: 8px 14px;
            }
            
            #copilot-panel.hidden { display: none; }
        `;
        document.head.appendChild(style);
    }
    
    bindEvents() {
        // Close button
        document.getElementById('copilot-close').onclick = () => this.hide();
        
        // Voice button
        const voiceBtn = document.getElementById('copilot-voice');
        voiceBtn.onclick = () => {
            if (this.voiceAgent.isListening) {
                this.voiceAgent.stop();
                voiceBtn.classList.remove('active');
            } else {
                this.voiceAgent.start();
                voiceBtn.classList.add('active');
            }
        };
        
        // Settings toggle
        document.getElementById('copilot-settings').onclick = () => {
            const panel = document.getElementById('copilot-settings-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        };
        
        // No API key needed - uses Relay Service
        
        // Send message
        const sendMessage = () => {
            const input = document.getElementById('copilot-input');
            const text = input.value.trim();
            if (!text) return;
            
            this.handleUserMessage(text);
            input.value = '';
        };
        
        document.getElementById('copilot-send').onclick = sendMessage;
        document.getElementById('copilot-input').onkeydown = (e) => {
            if (e.key === 'Enter') sendMessage();
        };
        
        // Make draggable
        this.makeDraggable();
    }
    
    makeDraggable() {
        const header = this.element.querySelector('.copilot-header');
        let isDragging = false, startX, startY, origX, origY;
        
        header.onmousedown = (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            origX = this.element.offsetLeft;
            origY = this.element.offsetTop;
        };
        
        document.onmousemove = (e) => {
            if (!isDragging) return;
            this.element.style.right = 'auto';
            this.element.style.bottom = 'auto';
            this.element.style.left = (origX + e.clientX - startX) + 'px';
            this.element.style.top = (origY + e.clientY - startY) + 'px';
        };
        
        document.onmouseup = () => { isDragging = false; };
    }
    
    async handleUserMessage(text) {
        // Add user message to chat
        this.addMessage(text, 'user');
        
        // Update sim state for context
        if (this.engine && this.engine.simVars) {
            this.agent.updateSimState(this.parseSimState(this.engine.simVars));
        }
        
        // Show typing indicator
        this.showTyping();
        
        // Get AI response
        const response = await this.agent.chat(text);
        
        // Hide typing
        this.hideTyping();
        
        if (response.success) {
            this.addMessage(response.message, 'assistant');
            
            // Execute any commands
            if (response.commands.length > 0) {
                for (const cmd of response.commands) {
                    this.executeCommand(cmd);
                }
            }
        } else {
            this.addMessage(`Error: ${response.error}`, 'error');
        }
    }
    
    handleVoiceInput(text) {
        document.getElementById('copilot-input').value = text;
        document.getElementById('copilot-voice').classList.remove('active');
        this.handleUserMessage(text);
    }
    
    parseSimState(vars) {
        const get = (key) => vars[key]?.value || 0;
        return {
            title: get('A:TITLE'),
            altitude: get('A:INDICATED ALTITUDE'),
            airspeed: get('A:AIRSPEED INDICATED'),
            heading: get('A:HEADING INDICATOR'),
            vs: get('A:VERTICAL SPEED'),
            groundSpeed: get('A:GROUND VELOCITY'),
            apMaster: get('A:AUTOPILOT MASTER'),
            apHdg: get('A:AUTOPILOT HEADING LOCK'),
            apHdgBug: get('A:AUTOPILOT HEADING LOCK DIR'),
            apAlt: get('A:AUTOPILOT ALTITUDE LOCK'),
            apAltSet: get('A:AUTOPILOT ALTITUDE LOCK VAR'),
            apVs: get('A:AUTOPILOT VERTICAL HOLD'),
            apVsSet: get('A:AUTOPILOT VERTICAL HOLD VAR'),
            apNav: get('A:AUTOPILOT NAV1 LOCK'),
            lightNav: get('A:LIGHT NAV'),
            lightBcn: get('A:LIGHT BEACON'),
            lightStrb: get('A:LIGHT STROBE'),
            lightLdg: get('A:LIGHT LANDING'),
            gearDown: get('A:GEAR HANDLE POSITION'),
            flaps: get('A:FLAPS HANDLE PERCENT'),
            parkBrake: get('A:BRAKE PARKING POSITION'),
            engineRunning: get('A:GENERAL ENG COMBUSTION:1'),
            throttle: get('A:GENERAL ENG THROTTLE LEVER POSITION:1'),
            fuelQty: get('A:FUEL TOTAL QUANTITY'),
            fuelPct: 0, // calculated
            fuelFlow: get('A:ENG FUEL FLOW GPH:1'),
            onGround: get('A:SIM ON GROUND')
        };
    }
    
    executeCommand(cmd) {
        console.log('[CoPilot] Executing:', cmd);
        if (this.engine && this.engine.ws && this.engine.ws.readyState === WebSocket.OPEN) {
            this.engine.ws.send(JSON.stringify({
                type: 'command',
                event: cmd.command,
                value: cmd.value
            }));
        }
    }
    
    addMessage(text, type) {
        const messages = document.getElementById('copilot-messages');
        const welcome = messages.querySelector('.copilot-welcome');
        if (welcome) welcome.remove();
        
        const msg = document.createElement('div');
        msg.className = `copilot-message ${type}`;
        msg.innerHTML = this.formatMessage(text);
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
    }
    
    formatMessage(text) {
        // Basic markdown-like formatting
        return text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }
    
    showTyping() {
        const messages = document.getElementById('copilot-messages');
        const typing = document.createElement('div');
        typing.className = 'copilot-typing';
        typing.id = 'copilot-typing';
        typing.textContent = '● ● ● Co-pilot is thinking...';
        messages.appendChild(typing);
        messages.scrollTop = messages.scrollHeight;
    }
    
    hideTyping() {
        const typing = document.getElementById('copilot-typing');
        if (typing) typing.remove();
    }
    
    show() {
        this.element.classList.remove('hidden');
        this.isOpen = true;
    }
    
    hide() {
        this.element.classList.add('hidden');
        this.isOpen = false;
    }
    
    toggle() {
        if (this.isOpen) this.hide();
        else this.show();
    }
}

// Export
if (typeof module !== 'undefined') module.exports = { CoPilotUI };
else window.CoPilotUI = CoPilotUI;
