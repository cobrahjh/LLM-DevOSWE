/**
 * Admin Kitt - Gaming Devices Module
 * Version: v2.0.0
 * Last updated: 2026-01-10
 * 
 * Handles: Gaming device enable/disable control
 */

const Devices = (function() {
    'use strict';
    
    const config = {
        baseHost: location.hostname
    };
    
    async function disable() {
        const statusEl = document.getElementById('device-status');
        statusEl.innerHTML = '<span style="color:#eab308;">⏳ Disabling devices...</span>';
        try {
            const res = await fetch(`http://${config.baseHost}:8585/api/devices/gaming/disable`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                statusEl.innerHTML = `<span style="color:#22c55e;">✅ ${data.message}</span>`;
                AdminKitt.addMessage('system', `🎮 ${data.message}`, { fadeAfter: 5000 });
            } else {
                statusEl.innerHTML = `<span style="color:#ef4444;">❌ ${data.error}</span>`;
            }
        } catch (e) {
            statusEl.innerHTML = `<span style="color:#ef4444;">❌ ${e.message}</span>`;
        }
    }
    
    async function enable() {
        const statusEl = document.getElementById('device-status');
        statusEl.innerHTML = '<span style="color:#eab308;">⏳ Enabling devices...</span>';
        try {
            const res = await fetch(`http://${config.baseHost}:8585/api/devices/gaming/enable`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                statusEl.innerHTML = `<span style="color:#22c55e;">✅ ${data.message}</span>`;
                AdminKitt.addMessage('system', `🎮 ${data.message}`, { fadeAfter: 5000 });
            } else {
                statusEl.innerHTML = `<span style="color:#ef4444;">❌ ${data.error}</span>`;
            }
        } catch (e) {
            statusEl.innerHTML = `<span style="color:#ef4444;">❌ ${e.message}</span>`;
        }
    }
    
    async function showList() {
        try {
            const res = await fetch(`http://${config.baseHost}:8585/api/devices/gaming`);
            const data = await res.json();
            
            let html = '<h3 style="margin:0 0 12px 0;color:#4a9eff;">Gaming Devices</h3>';
            
            if (!data.devices || data.devices.length === 0) {
                html += '<p style="color:#888;">No gaming devices found</p>';
            } else {
                data.devices.forEach(d => {
                    const statusColor = d.Status === 'OK' ? '#22c55e' : '#ef4444';
                    const statusIcon = d.Status === 'OK' ? '✅' : '🚫';
                    html += `
                        <div style="background:#2a2a3e;padding:10px;border-radius:6px;margin-bottom:8px;border-left:3px solid ${statusColor};">
                            <div style="font-size:13px;color:#eee;">${statusIcon} ${d.FriendlyName}</div>
                            <div style="font-size:11px;color:#888;margin-top:4px;">${d.Status} • ${d.Class}</div>
                        </div>
                    `;
                });
            }
            
            UIPanels.showModal('Gaming Devices', html);
            
            const enabled = data.devices.filter(d => d.Status === 'OK').length;
            const disabled = data.devices.filter(d => d.Status !== 'OK').length;
            document.getElementById('device-status').innerHTML = `${enabled} enabled, ${disabled} disabled`;
        } catch (e) {
            AdminKitt.addMessage('error', 'Failed to list devices: ' + e.message);
        }
    }
    
    async function checkStatus() {
        try {
            const res = await fetch(`http://${config.baseHost}:8585/api/devices/gaming`);
            const data = await res.json();
            if (data.devices) {
                const enabled = data.devices.filter(d => d.Status === 'OK').length;
                const disabled = data.devices.filter(d => d.Status !== 'OK').length;
                document.getElementById('device-status').innerHTML = `${enabled} enabled, ${disabled} disabled`;
            }
        } catch (e) {}
    }
    
    function init() {
        setTimeout(checkStatus, 3000);
    }
    
    return {
        init,
        disable,
        enable,
        showList,
        checkStatus
    };
})();

window.disableGamingDevices = Devices.disable;
window.enableGamingDevices = Devices.enable;
window.showGamingDevices = Devices.showList;

document.addEventListener('DOMContentLoaded', Devices.init);
