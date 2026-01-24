/**
 * Multiplayer Panel UI Component
 * Add to any widget for shared cockpit functionality
 */

class MultiplayerPanel {
    constructor(widgetId, options = {}) {
        this.widgetId = widgetId;
        this.options = options;
        this.sync = new MultiplayerSync(widgetId);
        this.panel = null;
        this.isOpen = false;

        this.setupSync();
    }

    setupSync() {
        this.sync
            .onConnect(() => this.updateStatus('connected'))
            .onDisconnect(() => this.updateStatus('disconnected'))
            .onRoomCreated((data) => {
                this.updateRoomInfo(data);
                this.showNotification('Room created: ' + data.roomCode);
            })
            .onRoomJoined((data) => {
                this.updateRoomInfo(data);
                this.showNotification('Joined room: ' + data.roomCode);
            })
            .onPilotJoined((data) => {
                this.updatePilotList(data.pilots);
                this.showNotification(data.pilotName + ' joined');
                this.addChatMessage('system', data.pilotName + ' joined the cockpit');
            })
            .onPilotLeft((data) => {
                this.updatePilotList(data.pilots);
                this.showNotification(data.pilotName + ' left');
                this.addChatMessage('system', data.pilotName + ' left the cockpit');
            })
            .onStateUpdate((state, from) => {
                if (this.options.onStateReceived) {
                    this.options.onStateReceived(state, from);
                }
                this.showNotification('State synced from ' + from, 'info');
            })
            .onAction((action, data, from) => {
                if (this.options.onActionReceived) {
                    this.options.onActionReceived(action, data, from);
                }
            })
            .onChat((msg) => {
                this.addChatMessage(msg.from, msg.message, msg.timestamp);
            })
            .onError((err) => {
                this.showNotification(err.error, 'error');
            });
    }

    attach(container) {
        this.createToggleButton(container);
        this.createPanel(container);
    }

    createToggleButton(container) {
        const btn = document.createElement('button');
        btn.className = 'mp-toggle-btn';
        btn.title = 'Multiplayer';
        btn.textContent = '\ud83d\udc65';
        btn.addEventListener('click', () => this.toggle());
        btn.style.cssText = 'position:fixed;bottom:20px;right:20px;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);border:none;color:white;font-size:20px;cursor:pointer;box-shadow:0 4px 15px rgba(102,126,234,0.4);z-index:1000;transition:transform 0.2s;';
        btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
        btn.onmouseleave = () => btn.style.transform = 'scale(1)';
        this.toggleBtn = btn;
        container.appendChild(btn);
    }

    createPanel(container) {
        const panel = document.createElement('div');
        panel.className = 'mp-panel';
        panel.style.cssText = 'position:fixed;bottom:80px;right:20px;width:300px;max-height:450px;background:#12121e;border:1px solid #2a2a3e;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.4);z-index:1000;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding:14px 16px;background:#1a1a2e;border-bottom:1px solid #2a2a3e;display:flex;justify-content:space-between;align-items:center;';

        const title = document.createElement('span');
        title.style.cssText = 'font-size:14px;font-weight:600;color:white;';
        title.textContent = '\ud83d\udc65 Shared Cockpit';

        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'background:none;border:none;color:#888;font-size:18px;cursor:pointer;';
        closeBtn.textContent = '\u00d7';
        closeBtn.onclick = () => this.toggle();

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Content
        const content = document.createElement('div');
        content.style.cssText = 'flex:1;overflow-y:auto;padding:16px;';

        // Status
        const status = document.createElement('div');
        status.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:12px;color:#888;';
        const statusDot = document.createElement('span');
        statusDot.className = 'mp-status-dot';
        statusDot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#ef4444;';
        const statusText = document.createElement('span');
        statusText.className = 'mp-status-text';
        statusText.textContent = 'Disconnected';
        status.appendChild(statusDot);
        status.appendChild(statusText);
        this.statusEl = status;

        // Join section
        const joinSection = document.createElement('div');
        joinSection.className = 'mp-join-section';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Your pilot name';
        nameInput.style.cssText = 'width:100%;padding:10px 12px;background:#1a1a2e;border:1px solid #333;border-radius:6px;color:white;font-size:13px;margin-bottom:8px;box-sizing:border-box;';
        this.nameInput = nameInput;

        const createBtn = document.createElement('button');
        createBtn.textContent = 'Create Room';
        createBtn.style.cssText = 'width:100%;padding:10px;background:linear-gradient(135deg,#667eea,#764ba2);border:none;border-radius:6px;color:white;font-weight:600;cursor:pointer;margin-bottom:12px;';
        createBtn.onclick = () => this.createRoom();

        const divider = document.createElement('div');
        divider.style.cssText = 'text-align:center;color:#555;font-size:11px;margin:12px 0;';
        divider.textContent = '\u2014 or join existing \u2014';

        const codeInput = document.createElement('input');
        codeInput.type = 'text';
        codeInput.placeholder = 'Room code (e.g., ABC123)';
        codeInput.maxLength = 6;
        codeInput.style.cssText = 'width:100%;padding:10px 12px;background:#1a1a2e;border:1px solid #333;border-radius:6px;color:white;font-size:13px;margin-bottom:8px;text-transform:uppercase;font-family:monospace;letter-spacing:2px;text-align:center;box-sizing:border-box;';
        this.codeInput = codeInput;

        const joinBtn = document.createElement('button');
        joinBtn.textContent = 'Join Room';
        joinBtn.style.cssText = 'width:100%;padding:10px;background:#1a1a2e;border:1px solid #667eea;border-radius:6px;color:#667eea;font-weight:600;cursor:pointer;';
        joinBtn.onclick = () => this.joinRoom();

        joinSection.appendChild(nameInput);
        joinSection.appendChild(createBtn);
        joinSection.appendChild(divider);
        joinSection.appendChild(codeInput);
        joinSection.appendChild(joinBtn);
        this.joinSection = joinSection;

        // Room section
        const roomSection = document.createElement('div');
        roomSection.className = 'mp-room-section';
        roomSection.style.display = 'none';

        const roomCodeEl = document.createElement('div');
        roomCodeEl.className = 'mp-room-code';
        roomCodeEl.style.cssText = 'text-align:center;padding:16px;background:#1a1a2e;border-radius:8px;margin-bottom:12px;';
        this.roomCodeEl = roomCodeEl;

        const pilotListEl = document.createElement('div');
        pilotListEl.className = 'mp-pilots';
        pilotListEl.style.cssText = 'margin-bottom:12px;';
        this.pilotListEl = pilotListEl;

        const syncBtn = document.createElement('button');
        syncBtn.textContent = '\ud83d\udd04 Sync State Now';
        syncBtn.style.cssText = 'width:100%;padding:10px;background:#1a1a2e;border:1px solid #333;border-radius:6px;color:white;cursor:pointer;margin-bottom:8px;';
        syncBtn.onclick = () => this.syncNow();

        const leaveBtn = document.createElement('button');
        leaveBtn.textContent = 'Leave Room';
        leaveBtn.style.cssText = 'width:100%;padding:10px;background:transparent;border:1px solid #ef4444;border-radius:6px;color:#ef4444;cursor:pointer;';
        leaveBtn.onclick = () => this.leaveRoom();

        roomSection.appendChild(roomCodeEl);
        roomSection.appendChild(pilotListEl);
        roomSection.appendChild(syncBtn);
        roomSection.appendChild(leaveBtn);
        this.roomSection = roomSection;

        // Chat section
        const chatSection = document.createElement('div');
        chatSection.className = 'mp-chat';
        chatSection.style.cssText = 'margin-top:12px;border-top:1px solid #2a2a3e;padding-top:12px;display:none;';

        const chatMessagesEl = document.createElement('div');
        chatMessagesEl.className = 'mp-chat-messages';
        chatMessagesEl.style.cssText = 'max-height:120px;overflow-y:auto;margin-bottom:8px;font-size:12px;';
        this.chatMessagesEl = chatMessagesEl;

        const chatInputRow = document.createElement('div');
        chatInputRow.style.cssText = 'display:flex;gap:8px;';

        const msgInput = document.createElement('input');
        msgInput.type = 'text';
        msgInput.placeholder = 'Message...';
        msgInput.style.cssText = 'flex:1;padding:8px 10px;background:#1a1a2e;border:1px solid #333;border-radius:6px;color:white;font-size:12px;';
        msgInput.onkeypress = (e) => { if (e.key === 'Enter') this.sendChat(); };
        this.msgInput = msgInput;

        const sendBtn = document.createElement('button');
        sendBtn.textContent = '\u27a4';
        sendBtn.style.cssText = 'padding:8px 12px;background:#667eea;border:none;border-radius:6px;color:white;cursor:pointer;';
        sendBtn.onclick = () => this.sendChat();

        chatInputRow.appendChild(msgInput);
        chatInputRow.appendChild(sendBtn);
        chatSection.appendChild(chatMessagesEl);
        chatSection.appendChild(chatInputRow);
        this.chatSection = chatSection;

        content.appendChild(status);
        content.appendChild(joinSection);
        content.appendChild(roomSection);
        content.appendChild(chatSection);

        panel.appendChild(header);
        panel.appendChild(content);

        this.panel = panel;
        container.appendChild(panel);
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.panel.style.display = this.isOpen ? 'flex' : 'none';
    }

    async createRoom() {
        const name = this.nameInput.value.trim() || 'Captain';
        await this.sync.createRoom(name);
    }

    async joinRoom() {
        const code = this.codeInput.value.trim().toUpperCase();
        const name = this.nameInput.value.trim() || 'First Officer';
        if (!code || code.length < 4) {
            this.showNotification('Enter valid room code', 'error');
            return;
        }
        await this.sync.joinRoom(code, name);
    }

    leaveRoom() {
        this.sync.leaveRoom();
        this.joinSection.style.display = 'block';
        this.roomSection.style.display = 'none';
        this.chatSection.style.display = 'none';
        this.updateStatus('disconnected');
    }

    syncNow() {
        if (this.options.getState) {
            const state = this.options.getState();
            this.sync.syncState(state);
            this.showNotification('State synced');
        }
    }

    sendChat() {
        const msg = this.msgInput.value.trim();
        if (!msg) return;
        this.sync.sendChat(msg);
        this.msgInput.value = '';
    }

    updateStatus(status) {
        const dot = this.statusEl.querySelector('.mp-status-dot');
        const text = this.statusEl.querySelector('.mp-status-text');
        if (status === 'connected') {
            dot.style.background = '#22c55e';
            text.textContent = 'Connected';
        } else {
            dot.style.background = '#ef4444';
            text.textContent = 'Disconnected';
        }
    }

    updateRoomInfo(data) {
        this.joinSection.style.display = 'none';
        this.roomSection.style.display = 'block';
        this.chatSection.style.display = 'block';

        this.roomCodeEl.replaceChildren();

        const codeLabel = document.createElement('div');
        codeLabel.style.cssText = 'font-size:10px;color:#888;margin-bottom:4px;';
        codeLabel.textContent = 'ROOM CODE';

        const codeValue = document.createElement('div');
        codeValue.style.cssText = 'font-size:28px;font-weight:700;font-family:monospace;letter-spacing:4px;color:white;';
        codeValue.textContent = data.roomCode;

        const roleLabel = document.createElement('div');
        roleLabel.style.cssText = 'font-size:11px;color:#667eea;margin-top:4px;';
        roleLabel.textContent = data.role;

        this.roomCodeEl.appendChild(codeLabel);
        this.roomCodeEl.appendChild(codeValue);
        this.roomCodeEl.appendChild(roleLabel);

        this.updatePilotList(data.pilots || [{ name: data.pilotName, role: data.role }]);
        this.updateStatus('connected');
    }

    updatePilotList(pilots) {
        this.pilotListEl.replaceChildren();

        const header = document.createElement('div');
        header.style.cssText = 'font-size:11px;color:#888;margin-bottom:8px;';
        header.textContent = 'CREW';
        this.pilotListEl.appendChild(header);

        pilots.forEach(pilot => {
            const el = document.createElement('div');
            el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:#1a1a2e;border-radius:6px;margin-bottom:4px;';

            const icon = document.createElement('span');
            icon.style.cssText = 'font-size:16px;';
            icon.textContent = pilot.role === 'captain' ? '\ud83d\udc68\u200d\u2708\ufe0f' : '\ud83d\udc69\u200d\u2708\ufe0f';

            const name = document.createElement('span');
            name.style.cssText = 'flex:1;font-size:12px;color:white;';
            name.textContent = pilot.name;

            const role = document.createElement('span');
            role.style.cssText = 'font-size:10px;color:#667eea;';
            role.textContent = pilot.role;

            el.appendChild(icon);
            el.appendChild(name);
            el.appendChild(role);
            this.pilotListEl.appendChild(el);
        });
    }

    addChatMessage(from, message, timestamp) {
        const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        const el = document.createElement('div');
        el.style.cssText = 'margin-bottom:6px;' + (from === 'system' ? 'color:#888;font-style:italic;' : '');

        if (from === 'system') {
            el.textContent = message;
        } else {
            const fromEl = document.createElement('span');
            fromEl.style.cssText = 'color:#667eea;font-weight:600;';
            fromEl.textContent = from;

            const timeEl = document.createElement('span');
            timeEl.style.cssText = 'color:#555;margin:0 4px;';
            timeEl.textContent = time;

            const msgEl = document.createElement('span');
            msgEl.style.cssText = 'color:#ddd;display:block;';
            msgEl.textContent = message;

            el.appendChild(fromEl);
            el.appendChild(timeEl);
            el.appendChild(document.createElement('br'));
            el.appendChild(msgEl);
        }

        this.chatMessagesEl.appendChild(el);
        this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        const bg = type === 'error' ? '#ef4444' : type === 'info' ? '#3b82f6' : '#22c55e';
        notification.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;background:' + bg + ';color:white;border-radius:8px;font-size:13px;z-index:2000;';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    broadcastState(state) {
        this.sync.syncState(state);
    }

    broadcastAction(action, data) {
        this.sync.syncAction(action, data);
    }
}
