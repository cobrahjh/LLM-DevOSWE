/**
 * Admin Kitt - Remote Clients Module
 * Version: v1.0.0
 * Last updated: 2026-01-11
 *
 * Handles: Remote client device management (Chromebooks, phones, tablets)
 */

const RemoteClients = (function() {
    'use strict';

    const config = {
        baseHost: location.hostname
    };

    // Registered remote clients
    const clients = {
        kakadu: {
            id: 'kakadu',
            name: 'Kakadu',
            type: 'Chromebook',
            icon: '💻',
            // Local network address (update as needed)
            address: null, // IP address only
            port: 8585,    // Default port
            lastSeen: null,
            status: 'unknown'
        }
    };

    // Inject styles
    function injectStyles() {
        if (document.getElementById('remote-clients-styles')) return;

        const style = document.createElement('style');
        style.id = 'remote-clients-styles';
        style.textContent = `
            .remote-client-row {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 10px;
                background: #2a2a3e;
                border-radius: 6px;
                margin-bottom: 6px;
            }
            .client-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #666;
                flex-shrink: 0;
            }
            .client-dot.online { background: #22c55e; }
            .client-dot.offline { background: #ef4444; }
            .client-dot.unknown { background: #666; }
            .client-info {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .client-name {
                font-size: 13px;
                color: #e0e0e0;
            }
            .client-type {
                font-size: 10px;
                color: #888;
            }
            .client-controls {
                display: flex;
                gap: 4px;
            }
            .client-btn {
                background: #1a1a2e;
                border: 1px solid #333;
                color: #888;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }
            .client-btn:hover {
                background: #4a9eff;
                color: #fff;
                border-color: #4a9eff;
            }
            .remote-clients-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1a1a2e;
                border: 1px solid #4a9eff;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                z-index: 10001;
                overflow: hidden;
            }
            .remote-clients-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #2a2a3e;
                border-bottom: 1px solid #333;
            }
            .remote-clients-panel-header h3 {
                margin: 0;
                color: #fff;
                font-size: 16px;
            }
            .remote-clients-panel-body {
                padding: 16px;
                max-height: 60vh;
                overflow-y: auto;
            }
            .remote-clients-panel-footer {
                padding: 12px 16px;
                border-top: 1px solid #333;
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
        `;
        document.head.appendChild(style);
    }

    // Ping a remote client
    async function ping(clientId) {
        const client = clients[clientId];
        if (!client) {
            console.error('[RemoteClients] Unknown client:', clientId);
            return;
        }

        const dot = document.getElementById(`dot-${clientId}`);
        if (dot) dot.className = 'client-dot unknown';

        // For now, show a message since we don't have the client's address
        if (!client.address) {
            AdminKitt.addMessage('system', `📡 ${client.name}: Address not configured. Set up in Manage panel.`, { fadeAfter: 5000 });
            return { success: false, message: 'Address not configured' };
        }

        try {
            // Try to reach the client (this would need CORS or a proxy)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const fullAddress = client.port ? `${client.address}:${client.port}` : client.address;

            const res = await fetch(`http://${fullAddress}/api/health`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                client.status = 'online';
                client.lastSeen = new Date().toISOString();
                if (dot) dot.className = 'client-dot online';
                AdminKitt.addMessage('system', `✅ ${client.name} is online`, { fadeAfter: 3000 });
                return { success: true, status: 'online' };
            }
        } catch (e) {
            client.status = 'offline';
            if (dot) dot.className = 'client-dot offline';
            AdminKitt.addMessage('system', `❌ ${client.name} is offline or unreachable`, { fadeAfter: 3000 });
            return { success: false, status: 'offline' };
        }
    }

    // Open remote client UI
    function open(clientId) {
        const client = clients[clientId];
        if (!client) return;

        if (!client.address) {
            AdminKitt.addMessage('system', `⚠️ ${client.name}: No address configured`, { fadeAfter: 3000 });
            return;
        }

        const fullAddress = client.port ? `${client.address}:${client.port}` : client.address;
        window.open(`http://${fullAddress}`, '_blank');
    }

    // Check all clients
    async function checkAll() {
        const statusEl = document.getElementById('remote-clients-status');
        if (statusEl) statusEl.innerHTML = '<span style="color:#eab308;">⏳ Checking clients...</span>';

        let online = 0, offline = 0, unknown = 0;

        for (const clientId of Object.keys(clients)) {
            const result = await ping(clientId);
            if (result?.status === 'online') online++;
            else if (result?.status === 'offline') offline++;
            else unknown++;
        }

        if (statusEl) {
            if (online > 0) {
                statusEl.innerHTML = `<span style="color:#22c55e;">${online} online</span>, ${offline} offline`;
            } else if (offline > 0) {
                statusEl.innerHTML = `<span style="color:#ef4444;">${offline} offline</span>`;
            } else {
                statusEl.innerHTML = `${unknown} unconfigured`;
            }
        }
    }

    // Show management panel
    function showPanel() {
        // Remove existing panel
        const existing = document.querySelector('.remote-clients-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.className = 'remote-clients-panel';
        panel.innerHTML = `
            <div class="remote-clients-panel-header">
                <h3>📱 Remote Clients</h3>
                <button class="btn-close" onclick="this.closest('.remote-clients-panel').remove()">×</button>
            </div>
            <div class="remote-clients-panel-body">
                ${Object.values(clients).map(client => `
                    <div class="remote-client-config" style="background:#2a2a3e;padding:12px;border-radius:8px;margin-bottom:12px;">
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                            <span style="font-size:20px;">${client.icon}</span>
                            <div>
                                <div style="font-weight:600;color:#fff;">${client.name}</div>
                                <div style="font-size:11px;color:#888;">${client.type}</div>
                            </div>
                            <span class="client-dot ${client.status}" style="margin-left:auto;"></span>
                        </div>
                        <div style="margin-bottom:8px;">
                            <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">IP Address / Hostname</label>
                            <div style="display:flex;gap:6px;">
                                <input type="text" id="client-addr-${client.id}" value="${client.address || ''}" placeholder="192.168.1.xxx" style="flex:1;padding:8px 10px;background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#fff;font-size:13px;font-family:monospace;" onkeydown="if(event.key==='Enter')RemoteClients.saveClientAddress('${client.id}')">
                                <input type="number" id="client-port-${client.id}" value="${client.port || 8585}" placeholder="Port" min="1" max="65535" style="width:70px;padding:8px;background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#fff;font-size:13px;text-align:center;" title="Port number">
                            </div>
                            <div style="font-size:10px;color:#666;margin-top:4px;">Format: IP address + port (default 8585)</div>
                        </div>
                        <div style="display:flex;gap:6px;">
                            <button class="admin-btn" onclick="RemoteClients.saveClientAddress('${client.id}')" style="flex:1;" title="Save address">💾 Save</button>
                            <button class="admin-btn" onclick="RemoteClients.ping('${client.id}')" style="flex:1;" title="Test connection">📡 Test</button>
                            <button class="admin-btn" onclick="RemoteClients.scanNetwork('${client.id}')" title="Scan local network">🔍</button>
                        </div>
                        ${client.lastSeen ? `<div style="font-size:10px;color:#666;margin-top:8px;">Last seen: ${new Date(client.lastSeen).toLocaleString()}</div>` : ''}
                    </div>
                `).join('')}

                <div style="margin-top:16px;padding-top:16px;border-top:1px solid #333;">
                    <h4 style="color:#4a9eff;margin:0 0 8px 0;font-size:12px;">ADD NEW CLIENT</h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                        <input type="text" id="new-client-name" placeholder="Name (e.g., Phone)" style="padding:8px;background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#fff;font-size:13px;">
                        <select id="new-client-type" style="padding:8px;background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#fff;font-size:13px;">
                            <option value="Phone">📱 Phone</option>
                            <option value="Tablet">📱 Tablet</option>
                            <option value="Chromebook">💻 Chromebook</option>
                            <option value="Laptop">💻 Laptop</option>
                            <option value="Desktop">🖥️ Desktop</option>
                        </select>
                    </div>
                    <input type="text" id="new-client-address" placeholder="IP Address (e.g., 192.168.1.100)" style="width:100%;padding:8px;background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#fff;font-size:13px;margin-bottom:8px;">
                    <button class="admin-btn" onclick="RemoteClients.addClient()" style="width:100%;">➕ Add Client</button>
                </div>
            </div>
            <div class="remote-clients-panel-footer">
                <button class="admin-btn" onclick="this.closest('.remote-clients-panel').remove()">Close</button>
            </div>
        `;
        document.body.appendChild(panel);
    }

    // Save client address
    function saveClientAddress(clientId) {
        const addrInput = document.getElementById(`client-addr-${clientId}`);
        const portInput = document.getElementById(`client-port-${clientId}`);
        if (!addrInput) return;

        const address = addrInput.value.trim();
        const port = parseInt(portInput?.value) || 8585;

        if (clients[clientId]) {
            clients[clientId].address = address || null;
            clients[clientId].port = port;
            saveClients();

            // Visual feedback
            addrInput.style.borderColor = '#22c55e';
            setTimeout(() => { addrInput.style.borderColor = ''; }, 1000);

            AdminKitt.addMessage('system', `💾 ${clients[clientId].name}: ${address || 'cleared'}:${port}`, { fadeAfter: 2000 });
        }
    }

    // Scan network for devices (basic implementation)
    async function scanNetwork(clientId) {
        const client = clients[clientId];
        if (!client) return;

        AdminKitt.addMessage('system', `🔍 Scanning network for ${client.name}...`, { fadeAfter: 3000 });

        // Get local network prefix (assumes 192.168.x.x)
        const commonPrefixes = ['192.168.1', '192.168.0', '10.0.0'];
        const port = client.port || 8585;
        const foundDevices = [];

        // Quick scan of common IPs (this is simplified - real scan would need backend)
        for (const prefix of commonPrefixes) {
            for (let i = 1; i <= 10; i++) { // Only scan first 10 for speed
                const ip = `${prefix}.${i}`;
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 500);

                    const res = await fetch(`http://${ip}:${port}/api/health`, {
                        signal: controller.signal,
                        mode: 'no-cors' // Won't get response but won't error on reachable hosts
                    });
                    clearTimeout(timeoutId);

                    // If we get here without abort, device might be reachable
                    foundDevices.push(ip);
                } catch (e) {
                    // Expected for most IPs
                }
            }
        }

        if (foundDevices.length > 0) {
            AdminKitt.addMessage('system', `Found potential devices: ${foundDevices.join(', ')}`, { fadeAfter: 5000 });

            // Auto-fill first found if address is empty
            const addrInput = document.getElementById(`client-addr-${clientId}`);
            if (addrInput && !addrInput.value) {
                addrInput.value = foundDevices[0];
                addrInput.style.borderColor = '#22c55e';
                setTimeout(() => { addrInput.style.borderColor = ''; }, 2000);
            }
        } else {
            AdminKitt.addMessage('system', `No devices found on ports ${port}. Try manual entry.`, { fadeAfter: 3000 });
        }
    }

    // Add new client
    function addClient() {
        const nameInput = document.getElementById('new-client-name');
        const typeSelect = document.getElementById('new-client-type');
        const addrInput = document.getElementById('new-client-address');

        const name = nameInput?.value.trim();
        const type = typeSelect?.value;
        const address = addrInput?.value.trim();

        if (!name) {
            AdminKitt.addMessage('error', 'Please enter a client name');
            return;
        }

        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clients[id]) {
            AdminKitt.addMessage('error', 'A client with this name already exists');
            return;
        }

        const icons = {
            'Phone': '📱',
            'Tablet': '📱',
            'Chromebook': '💻',
            'Laptop': '💻',
            'Desktop': '🖥️'
        };

        clients[id] = {
            id,
            name,
            type,
            icon: icons[type] || '📱',
            address: address || null,
            lastSeen: null,
            status: 'unknown'
        };

        saveClients();
        updateClientsList();
        showPanel(); // Refresh panel

        AdminKitt.addMessage('system', `✅ Added ${name} (${type})`, { fadeAfter: 3000 });
    }

    // Update clients list in sidebar
    function updateClientsList() {
        const container = document.querySelector('.remote-clients-list');
        if (!container) return;

        container.innerHTML = Object.values(clients).map(client => `
            <div class="remote-client-row" data-client="${client.id}">
                <span class="client-dot ${client.status}" id="dot-${client.id}"></span>
                <div class="client-info">
                    <span class="client-name">${client.icon} ${client.name}</span>
                    <span class="client-type">${client.type}</span>
                </div>
                <div class="client-controls">
                    <button class="client-btn" onclick="pingRemoteClient('${client.id}')" title="Ping">📡</button>
                    <button class="client-btn" onclick="openRemoteClient('${client.id}')" title="Open">↗</button>
                </div>
            </div>
        `).join('');
    }

    // Save clients to localStorage
    function saveClients() {
        localStorage.setItem('remote-clients', JSON.stringify(clients));
    }

    // Load clients from localStorage
    function loadClients() {
        try {
            const saved = localStorage.getItem('remote-clients');
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.assign(clients, parsed);
            }
        } catch (e) {
            console.error('[RemoteClients] Failed to load clients:', e);
        }
    }

    // Initialize
    function init() {
        injectStyles();
        loadClients();
        updateClientsList();

        // Initial status check after 5 seconds
        setTimeout(() => {
            const statusEl = document.getElementById('remote-clients-status');
            const count = Object.keys(clients).length;
            if (statusEl) {
                statusEl.innerHTML = `${count} client${count !== 1 ? 's' : ''} configured`;
            }
        }, 1000);
    }

    return {
        init,
        ping,
        open,
        checkAll,
        showPanel,
        saveClientAddress,
        addClient,
        scanNetwork,
        clients
    };
})();

// Global functions for onclick handlers
window.pingRemoteClient = RemoteClients.ping;
window.openRemoteClient = RemoteClients.open;
window.checkRemoteClients = RemoteClients.checkAll;
window.showRemoteClientsPanel = RemoteClients.showPanel;

document.addEventListener('DOMContentLoaded', RemoteClients.init);
