/**
 * Admin Kitt - Troubleshooting Module
 * Version: v2.0.0
 * Last updated: 2026-01-10
 * 
 * Handles: Error detection, troubleshooting alerts, Kitt reset, queue management
 */

const Troubleshooting = (function() {
    'use strict';
    
    const config = {
        baseHost: location.hostname,
        issueCheckInterval: 30000
    };
    
    let lastError = null;
    
    // ==================== ALERTS ====================
    function showAlert(type, message, actions = []) {
        const alertsDiv = document.getElementById('trouble-alerts');
        if (!alertsDiv) return;
        
        const colors = {
            error: { bg: '#442222', border: '#ff6666', text: '#ff8888' },
            warning: { bg: '#443322', border: '#ffaa44', text: '#ffcc88' },
            info: { bg: '#223344', border: '#4a9eff', text: '#88ccff' }
        };
        const c = colors[type] || colors.info;
        
        let actionsHtml = actions.map(a => 
            `<button onclick="${a.action}" style="background:${c.border};color:#000;border:none;padding:4px 8px;border-radius:4px;margin-right:4px;cursor:pointer;font-size:11px;">${a.label}</button>`
        ).join('');
        
        alertsDiv.innerHTML = `
            <div style="background:${c.bg};border:1px solid ${c.border};border-radius:6px;padding:10px;margin-bottom:8px;">
                <div style="color:${c.text};font-size:12px;margin-bottom:${actions.length ? '8px' : '0'};">${message}</div>
                ${actionsHtml}
            </div>
        `;
    }
    
    function clearAlerts() {
        const alertsDiv = document.getElementById('trouble-alerts');
        if (alertsDiv) alertsDiv.innerHTML = '';
    }
    
    // ==================== ERROR HANDLING ====================
    function handleError(errorMsg) {
        lastError = errorMsg;
        
        if (errorMsg.includes('credit balance') || errorMsg.includes('API')) {
            showAlert('error', '💳 API credits exhausted! Enable Relay Mode to use Claude Desktop instead.', [
                { label: '🔄 Enable Relay', action: 'Relay.toggle()' },
                { label: '📬 View Queue', action: 'Troubleshooting.showQueuePanel()' }
            ]);
        } else if (errorMsg.includes('Timeout') || errorMsg.includes('not responding')) {
            showAlert('warning', '⏱️ Claude Desktop not responding. Check if Claude Desktop is open with this chat.', [
                { label: '🔄 Reset Kitt', action: 'Troubleshooting.resetKitt()' },
                { label: '📬 View Queue', action: 'Troubleshooting.showQueuePanel()' }
            ]);
        } else if (errorMsg.includes('Relay') || errorMsg.includes('8600')) {
            showAlert('error', '🔌 Relay service not running. Start it or disable relay mode.', [
                { label: '▶️ Start Relay', action: 'Services.startServer("relay")' },
                { label: '🔄 Disable Relay', action: 'Relay.toggle()' }
            ]);
        } else {
            showAlert('error', `❌ ${errorMsg}`, [
                { label: '🔄 Reset Kitt', action: 'Troubleshooting.resetKitt()' }
            ]);
        }
    }
    
    // ==================== KITT RESET ====================
    async function resetKitt() {
        try {
            await fetch(`http://${config.baseHost}:8585/api/kitt/reset`, { method: 'POST' });
            // Reset UI state
            const thinkingEl = document.querySelector('.message.thinking');
            if (thinkingEl) thinkingEl.remove();
            AdminKitt.state.isBusy = false;
            AdminKitt.addMessage('system', '✅ Kitt state reset', { fadeAfter: 5000 });
            clearAlerts();
        } catch (e) {
            AdminKitt.addMessage('error', 'Failed to reset Kitt: ' + e.message);
        }
    }
    
    // ==================== QUEUE MANAGEMENT ====================
    async function showQueuePanel() {
        try {
            const res = await fetch(`http://${config.baseHost}:8600/api/queue`);
            const data = await res.json();
            
            let html = `<h3 style="margin:0 0 12px 0;color:#4a9eff;">Message Queue (${data.total})</h3>`;
            
            if (data.messages.length === 0) {
                html += '<p style="color:#888;">No messages in queue</p>';
            } else {
                data.messages.forEach(m => {
                    const statusColor = m.status === 'pending' ? '#ffd700' : m.status === 'processing' ? '#4a9eff' : '#22c55e';
                    html += `
                        <div style="background:#2a2a3e;padding:10px;border-radius:6px;margin-bottom:8px;border-left:3px solid ${statusColor};">
                            <div style="font-size:11px;color:#888;margin-bottom:4px;">${m.status.toUpperCase()} - ${m.id}</div>
                            <div style="font-size:13px;color:#eee;margin-bottom:8px;">${m.preview}</div>
                            ${m.status === 'pending' ? `
                                <input type="text" id="resp-${m.id}" placeholder="Type response..." style="width:100%;background:#1a1a2e;border:1px solid #333;color:#eee;padding:6px;border-radius:4px;margin-bottom:6px;box-sizing:border-box;">
                                <button onclick="Troubleshooting.sendQueueResponse('${m.id}')" style="background:#4a9eff;color:#000;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Send Response</button>
                            ` : ''}
                        </div>
                    `;
                });
            }
            
            html += `<button onclick="Troubleshooting.clearCompletedQueue()" style="background:#333;color:#ccc;border:none;padding:8px 12px;border-radius:4px;cursor:pointer;margin-top:8px;">🗑️ Clear Completed</button>`;
            
            UIPanels.showModal('Queue', html);
        } catch (e) {
            AdminKitt.addMessage('error', 'Failed to load queue: ' + e.message);
        }
    }
    
    async function sendQueueResponse(messageId) {
        const input = document.getElementById(`resp-${messageId}`);
        if (!input || !input.value.trim()) return;
        
        try {
            await fetch(`http://${config.baseHost}:8600/api/queue/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId, response: input.value.trim() })
            });
            AdminKitt.addMessage('system', '✅ Response sent to queue', { fadeAfter: 5000 });
            showQueuePanel();
        } catch (e) {
            AdminKitt.addMessage('error', 'Failed to send response: ' + e.message);
        }
    }
    
    async function clearCompletedQueue() {
        try {
            await fetch(`http://${config.baseHost}:8600/api/queue`, { method: 'DELETE' });
            showQueuePanel();
        } catch (e) {
            AdminKitt.addMessage('error', 'Failed to clear queue: ' + e.message);
        }
    }
    
    // ==================== ISSUE DETECTION ====================
    async function checkForIssues() {
        try {
            const kittRes = await fetch(`http://${config.baseHost}:8585/api/kitt/status`);
            const kittStatus = await kittRes.json();
            
            if (kittStatus.busy && kittStatus.since) {
                const busyTime = Date.now() - new Date(kittStatus.since).getTime();
                if (busyTime > 120000) {
                    showAlert('warning', `⏳ Kitt has been busy for ${Math.floor(busyTime/60000)}+ minutes`, [
                        { label: '🔄 Reset Kitt', action: 'Troubleshooting.resetKitt()' },
                        { label: '📬 View Queue', action: 'Troubleshooting.showQueuePanel()' }
                    ]);
                }
            }
            
            const queueRes = await fetch(`http://${config.baseHost}:8600/api/health`);
            const queueStatus = await queueRes.json();
            if (queueStatus.queue.pending > 0) {
                const queueEl = document.getElementById('relay-queue');
                if (queueEl) queueEl.innerHTML = `<span style="color:#ffd700;">📬 ${queueStatus.queue.pending} pending</span>`;
            }
        } catch (e) {
            // Silently fail
        }
    }
    
    // ==================== INITIALIZATION ====================
    function init() {
        setInterval(checkForIssues, config.issueCheckInterval);
        setTimeout(checkForIssues, 5000);
    }
    
    // ==================== PUBLIC API ====================
    return {
        init,
        showAlert,
        clearAlerts,
        handleError,
        resetKitt,
        showQueuePanel,
        sendQueueResponse,
        clearCompletedQueue,
        checkForIssues,
        get lastError() { return lastError; }
    };
})();

window.resetKitt = Troubleshooting.resetKitt;
window.showQueuePanel = Troubleshooting.showQueuePanel;

document.addEventListener('DOMContentLoaded', Troubleshooting.init);
