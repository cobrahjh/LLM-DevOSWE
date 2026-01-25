/**
 * Admin Kitt - Services Module
 * Version: v2.0.0
 * Last updated: 2026-01-10
 * 
 * Handles: Service status checking, control, and mode management
 */

const Services = (function() {
    'use strict';
    
    const config = {
        baseHost: location.hostname,
        checkInterval: 10000
    };
    
    const services = {
        simwidget: { port: 8080, status: 'checking' },
        agent: { port: 8585, status: 'checking' },
        remote: { port: 8590, status: 'checking' }
    };
    
    const serverConfig = {
        master: { port: 8500, name: 'Master (O)', canStart: false, mode: 'orchestrator' },
        simwidget: { port: 8080, name: 'Main Server', canStart: true, healthEndpoint: '/api/status' },
        agent: { port: 8585, name: 'Agent (Kitt)', canStart: true },
        remote: { port: 8590, name: 'Remote Support', canStart: true },
        relay: { port: 8600, name: 'Relay Service', canStart: true },
        bridge: { port: 8601, name: 'Claude Bridge', canStart: true }
    };
    
    let currentServiceMode = 'dev';
    
    // ==================== STATUS CHECKING ====================
    async function checkService(name) {
        const service = services[name];
        if (!service) return;
        
        updateServiceStatus(name, 'checking');
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const response = await fetch(`http://${config.baseHost}:${service.port}/api/status`, { 
                signal: controller.signal,
                mode: 'cors'
            });
            clearTimeout(timeoutId);
            service.status = response.ok ? 'online' : 'offline';
        } catch (err) { 
            console.log(`Service ${name} check failed:`, err.message);
            service.status = 'offline'; 
        }
        updateServiceStatus(name, service.status);
    }
    
    function updateServiceStatus(name, status) {
        // Update service card badge (uses service-status class)
        const badge = document.getElementById(`status-${name}`);
        if (badge) {
            badge.className = `service-status ${status}`;
            badge.textContent = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Checking';
        }
        // Update compact dots in header
        const compactDot = document.getElementById(`dot-${name}`);
        if (compactDot) compactDot.className = 'compact-dot ' + status;
    }
    
    async function checkAllServices() {
        for (const name of Object.keys(services)) {
            await checkService(name);
        }
    }
    
    async function checkServer(serverId) {
        const dot = document.getElementById(`dot-${serverId}`);
        const cfg = serverConfig[serverId];
        if (!dot || !cfg) return false;
        
        dot.className = 'server-dot checking';
        try {
            const endpoint = cfg.healthEndpoint || '/api/health';
            const res = await fetch(`http://${config.baseHost}:${cfg.port}${endpoint}`, { 
                method: 'GET',
                signal: AbortSignal.timeout(2000)
            });
            dot.className = res.ok ? 'server-dot running' : 'server-dot stopped';
            return res.ok;
        } catch {
            dot.className = 'server-dot stopped';
            return false;
        }
    }
    
    async function checkAllServers() {
        const btn = event?.target;
        if (btn) AdminKitt.setButtonState(btn, 'loading', '🔍');
        
        const results = [];
        for (const [id, cfg] of Object.entries(serverConfig)) {
            const running = await checkServer(id);
            results.push(`${cfg.name} :${cfg.port} - ${running ? '✅' : '❌'}`);
        }
        
        if (btn) AdminKitt.setButtonState(btn, 'success', '✓', 1500);
        AdminKitt.addMessage('system', `**Server Status**\n${results.join('\n')}`, { fadeAfter: 8000 });
    }
    
    // ==================== SERVICE CONTROL ====================
    async function controlService(service, action, btn) {
        const originalContent = btn ? btn.innerHTML : '';
        try {
            const row = document.querySelector(`.service-row[data-service="${service}"]`);
            const statusDot = document.getElementById(`status-${service}`);
            if (statusDot) statusDot.className = 'status-dot starting';
            if (btn) {
                btn.classList.add('loading');
                btn.innerHTML = '⏳';
            }
            
            await fetch(`http://${config.baseHost}:8585/api/services/${service}/${action}?mode=${currentServiceMode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (btn) {
                btn.classList.remove('loading');
                btn.classList.add('success');
                btn.innerHTML = '✓';
                setTimeout(() => {
                    btn.classList.remove('success');
                    btn.innerHTML = originalContent;
                }, 1500);
            }
            
            const delay = action === 'restart' ? 3000 : 2000;
            setTimeout(() => checkAllServicesForMode(), delay);
        } catch (err) {
            console.error('Service control failed:', err);
            if (btn) {
                btn.classList.remove('loading');
                btn.classList.add('error');
                btn.innerHTML = '✗';
                setTimeout(() => {
                    btn.classList.remove('error');
                    btn.innerHTML = originalContent;
                }, 1500);
            }
        }
    }
    
    async function startServer(serverId) {
        const cfg = serverConfig[serverId];
        const row = document.querySelector(`[data-server="${serverId}"]`);
        const btn = row?.querySelector('.server-btn.start');
        const dot = document.getElementById(`dot-${serverId}`);
        
        if (btn) AdminKitt.setButtonState(btn, 'loading', '⏳');
        if (dot) dot.className = 'server-dot starting';
        AdminKitt.addMessage('system', `▶ Starting ${cfg.name}...`, { fadeAfter: 5000 });
        
        try {
            const res = await fetch(`http://${config.baseHost}:8500/api/services/${serverId}/start`, { method: 'POST' });
            if (res.ok) {
                if (btn) AdminKitt.setButtonState(btn, 'success', '✓', 2000);
                AdminKitt.addMessage('system', `✅ ${cfg.name} start requested`, { fadeAfter: 5000 });
                setTimeout(() => checkServer(serverId), 3000);
            } else {
                if (btn) AdminKitt.setButtonState(btn, 'error', '✗', 2000);
                if (dot) dot.className = 'server-dot stopped';
                AdminKitt.addMessage('error', `❌ Failed to start ${cfg.name}`);
            }
        } catch (e) {
            if (btn) AdminKitt.setButtonState(btn, 'error', '✗', 2000);
            if (dot) dot.className = 'server-dot stopped';
            AdminKitt.addMessage('error', `❌ Master (O) unavailable. Start manually or launch Master first.`);
        }
    }
    
    async function startAllServers() {
        const btn = event?.target?.closest('.admin-btn');
        if (btn) AdminKitt.setButtonState(btn, 'loading', '⏳');

        AdminKitt.addMessage('system', '🚀 Starting all servers...', { fadeAfter: 5000 });
        if (typeof UIPanels !== 'undefined') UIPanels.closeAll();

        for (const [id] of Object.entries(serverConfig)) {
            const dot = document.getElementById(`dot-${id}`);
            if (dot) dot.className = 'server-dot starting';
        }

        try {
            const res = await fetch(`http://${config.baseHost}:8500/api/start-all`, { method: 'POST' });
            if (res.ok) {
                if (btn) AdminKitt.setButtonState(btn, 'success', '✓', 2000);
                AdminKitt.addMessage('system', '✅ All servers starting via Master', { fadeAfter: 5000 });
                setTimeout(checkAllServers, 4000);
            } else {
                if (btn) AdminKitt.setButtonState(btn, 'error', '✗', 2000);
                AdminKitt.addMessage('error', '❌ Start all failed');
            }
        } catch (e) {
            if (btn) AdminKitt.setButtonState(btn, 'error', '✗', 2000);
            AdminKitt.addMessage('error', '❌ Master (O) not running');
        }
    }

    async function restartServer(serverId) {
        const cfg = serverConfig[serverId];
        if (!cfg) return;
        const dot = document.getElementById(`dot-${serverId}`);
        if (dot) dot.className = 'server-dot starting';

        AdminKitt.addMessage('system', `🔄 Restarting ${cfg.name}...`, { fadeAfter: 5000 });

        try {
            const res = await fetch(`http://${config.baseHost}:8500/api/services/${serverId}/restart`, { method: 'POST' });
            if (res.ok) {
                AdminKitt.addMessage('system', `✅ ${cfg.name} restarting`, { fadeAfter: 5000 });
                setTimeout(() => checkServer(serverId), 3000);
            } else {
                if (dot) dot.className = 'server-dot stopped';
                AdminKitt.addMessage('error', `❌ Failed to restart ${cfg.name}`);
            }
        } catch (e) {
            if (dot) dot.className = 'server-dot stopped';
            AdminKitt.addMessage('error', '❌ Master (O) unavailable');
        }
    }

    async function stopServer(serverId) {
        const cfg = serverConfig[serverId];
        if (!cfg) return;
        const dot = document.getElementById(`dot-${serverId}`);

        AdminKitt.addMessage('system', `⏹️ Stopping ${cfg.name}...`, { fadeAfter: 5000 });

        try {
            const res = await fetch(`http://${config.baseHost}:8500/api/services/${serverId}/stop`, { method: 'POST' });
            if (res.ok) {
                if (dot) dot.className = 'server-dot stopped';
                AdminKitt.addMessage('system', `✅ ${cfg.name} stopped`, { fadeAfter: 5000 });
            } else {
                AdminKitt.addMessage('error', `❌ Failed to stop ${cfg.name}`);
            }
        } catch (e) {
            AdminKitt.addMessage('error', '❌ Master (O) unavailable');
        }
    }

    async function stopAllServers() {
        const btn = event?.target?.closest('.admin-btn');
        if (btn) AdminKitt.setButtonState(btn, 'loading', '⏳');

        AdminKitt.addMessage('system', '⏹️ Stopping all servers...', { fadeAfter: 5000 });

        try {
            const res = await fetch(`http://${config.baseHost}:8500/api/stop-all`, { method: 'POST' });
            if (res.ok) {
                if (btn) AdminKitt.setButtonState(btn, 'success', '✓', 2000);
                AdminKitt.addMessage('system', '✅ All servers stopped', { fadeAfter: 5000 });
                for (const [id] of Object.entries(serverConfig)) {
                    const dot = document.getElementById(`dot-${id}`);
                    if (dot) dot.className = 'server-dot stopped';
                }
            } else {
                if (btn) AdminKitt.setButtonState(btn, 'error', '✗', 2000);
                AdminKitt.addMessage('error', '❌ Stop all failed');
            }
        } catch (e) {
            if (btn) AdminKitt.setButtonState(btn, 'error', '✗', 2000);
            AdminKitt.addMessage('error', '❌ Master (O) not running');
        }
    }
    
    // ==================== SERVICE MODE ====================
    async function loadServiceMode() {
        try {
            const res = await fetch(`http://${config.baseHost}:8585/api/services`);
            const data = await res.json();
            currentServiceMode = data.mode || 'dev';
            updateServiceModeUI();
            updateModeIndicators();
            checkAllServicesForMode();
        } catch (err) {
            console.error('Failed to load service mode:', err);
        }
    }
    
    function updateServiceModeUI() {
        const devEl = document.getElementById('mode-dev');
        const serviceEl = document.getElementById('mode-service');
        const statusEl = document.getElementById('mode-status');
        if (!devEl || !serviceEl || !statusEl) return; // Elements don't exist in v3.0 layout
        devEl.classList.toggle('active', currentServiceMode === 'dev');
        serviceEl.classList.toggle('active', currentServiceMode === 'service');
        statusEl.textContent = currentServiceMode === 'dev' ? 'Node processes' : 'Windows Services';
    }
    
    function updateModeIndicators() {
        // Update mode indicators for all services that support mode switching
        ['simwidget', 'agent', 'remote'].forEach(service => {
            const indicator = document.getElementById(`mode-${service}`);
            if (indicator) {
                indicator.textContent = currentServiceMode === 'dev' ? 'node' : 'svc';
                indicator.className = 'server-mode ' + currentServiceMode;
            }
        });
    }
    
    async function checkAllServicesForMode() {
        try {
            const res = await fetch(`http://${config.baseHost}:8585/api/services/status?mode=${currentServiceMode}`);
            const data = await res.json();
            
            ['simwidget', 'agent', 'remote'].forEach(service => {
                const status = data.services && data.services[service] ? 'online' : 'offline';
                updateServiceStatus(service, status);
            });
        } catch (err) {
            console.error('Failed to check services:', err);
            checkAllServices();
        }
    }
    
    async function setServiceMode(mode) {
        try {
            const res = await fetch(`http://${config.baseHost}:8585/api/services/mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
            if (res.ok) {
                currentServiceMode = mode;
                updateServiceModeUI();
                updateModeIndicators();
                AdminKitt.addMessage('system', `Service mode set to ${mode === 'dev' ? 'Dev (Node processes)' : 'Service (Windows Services)'}`, { fadeAfter: 5000 });
                checkAllServicesForMode();
            }
        } catch (err) {
            console.error('Failed to set service mode:', err);
        }
    }
    
    // ==================== INITIALIZATION ====================
    function init() {
        // Service control buttons
        document.querySelectorAll('.service-row').forEach(row => {
            const service = row.dataset.service;
            row.querySelectorAll('.btn-start, .btn-stop, .btn-restart').forEach(btn => {
                btn.addEventListener('click', (e) => controlService(service, btn.dataset.action, e.target));
            });
        });
        
        // Initial checks
        loadServiceMode();
        checkAllServices();
        
        // Check servers on load
        setTimeout(() => {
            for (const id of Object.keys(serverConfig)) {
                checkServer(id);
            }
        }, 1000);
        
        // Periodic checks
        setInterval(checkAllServices, config.checkInterval);
    }
    
    // ==================== PUBLIC API ====================
    return {
        init,
        checkService,
        checkAllServices,
        checkServer,
        checkAllServers,
        controlService,
        startServer,
        startAllServers,
        restartServer,
        stopServer,
        stopAllServers,
        loadServiceMode,
        setServiceMode,
        get currentMode() { return currentServiceMode; },
        get serverConfig() { return serverConfig; }
    };
})();

// Make functions available globally
window.startServer = Services.startServer;
window.startAllServers = Services.startAllServers;
window.restartServer = Services.restartServer;
window.stopServer = Services.stopServer;
window.stopAllServers = Services.stopAllServers;
window.checkAllServers = Services.checkAllServers;
window.setServiceMode = Services.setServiceMode;

document.addEventListener('DOMContentLoaded', Services.init);
