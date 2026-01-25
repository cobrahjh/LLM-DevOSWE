/**
 * Admin Kitt - Local Commands Module
 * Version: v2.0.0
 * Last updated: 2026-01-10
 * 
 * Handles: Dev machine local command execution (no token cost)
 */

const LocalCommands = (function() {
    'use strict';
    
    const config = {
        baseHost: location.hostname
    };
    
    const commands = {
        'server status': async () => {
            const results = [];
            const checks = [
                { name: 'SimWidget', port: 8080, endpoint: '/api/status' },
                { name: 'Agent', port: 8585, endpoint: '/api/health' },
                { name: 'Remote', port: 8590, endpoint: '/api/health' },
                { name: 'Master', port: 8500, endpoint: '/api/health' },
                { name: 'Relay', port: 8600, endpoint: '/api/health' }
            ];
            for (const svc of checks) {
                try {
                    const res = await fetch(`http://${config.baseHost}:${svc.port}${svc.endpoint}`, { timeout: 2000 });
                    results.push(`${svc.name}: ${res.ok ? '✅ Running' : '❌ Down'} (:${svc.port})`);
                } catch { 
                    results.push(`${svc.name}: ❌ Offline (:${svc.port})`); 
                }
            }
            return `**Service Status**\n${results.join('\n')}`;
        },
        
        'restart server': async () => {
            try {
                await fetch(`http://${config.baseHost}:8585/api/simwidget/restart`, { method: 'POST' });
                return '✅ SimWidget server restart triggered';
            } catch (e) { 
                return `❌ Restart failed: ${e.message}`; 
            }
        },
        
        'show errors': async () => {
            try {
                const res = await fetch(`http://${config.baseHost}:8585/api/logs/errors`);
                const data = await res.json();
                return data.log || 'No errors found';
            } catch (e) { 
                return `❌ Failed to fetch errors: ${e.message}`; 
            }
        },
        
        'list processes': async () => {
            try {
                const res = await fetch(`http://${config.baseHost}:8585/api/processes`);
                const data = await res.json();
                if (data.processes) {
                    return `**Running Processes**\n${data.processes.slice(0, 10).map(p => `${p.name}: ${p.pid}`).join('\n')}`;
                }
                return 'Process list unavailable';
            } catch (e) { 
                return `❌ Failed: ${e.message}`; 
            }
        },
        
        'disk usage': async () => {
            try {
                const res = await fetch(`http://${config.baseHost}:8585/api/disk`);
                const data = await res.json();
                return data.usage || 'Disk info unavailable';
            } catch (e) { 
                return `❌ Failed: ${e.message}`; 
            }
        }
    };
    
    function has(cmd) {
        return !!commands[cmd];
    }
    
    async function execute(cmd, btn) {
        if (!commands[cmd]) return false;
        
        if (btn) AdminKitt.setButtonState(btn, 'loading', '⏳');
        AdminKitt.addMessage('user', cmd);
        AdminKitt.addMessage('system', '⚡ Executing locally (no tokens)...', { fadeAfter: 3000 });
        
        try {
            const result = await commands[cmd]();
            AdminKitt.addMessage('assistant', result);
            if (btn) AdminKitt.setButtonState(btn, 'success', '✓', 1500);
        } catch (e) {
            AdminKitt.addMessage('error', `Local execution failed: ${e.message}`);
            if (btn) AdminKitt.setButtonState(btn, 'error', '✗', 1500);
        }
        return true;
    }
    
    return {
        has,
        execute,
        commands
    };
})();
