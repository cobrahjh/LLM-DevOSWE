/**
 * Admin Kitt - Cost Report Module
 * Version: v2.1.0
 * Last updated: 2026-01-11
 *
 * Handles: API usage and cost reporting, Dev tracker, Docs center
 */

const CostReport = (function() {
    'use strict';

    const config = {
        baseHost: location.hostname
    };

    // Generic draggable modal setup
    function setupModalDrag(modal, contentSelector, handleSelector) {
        const panel = modal.querySelector(contentSelector);
        const handle = modal.querySelector(handleSelector);
        if (!panel || !handle) return;

        let isDragging = false;
        let startX, startY, initialX, initialY;

        panel.style.position = 'absolute';
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.transform = 'translate(-50%, -50%)';

        handle.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialX = rect.left;
            initialY = rect.top;
            panel.style.transform = 'none';
            panel.style.left = initialX + 'px';
            panel.style.top = initialY + 'px';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newX = initialX + (e.clientX - startX);
            let newY = initialY + (e.clientY - startY);
            newX = Math.max(0, Math.min(window.innerWidth - 100, newX));
            newY = Math.max(0, Math.min(window.innerHeight - 50, newY));
            panel.style.left = newX + 'px';
            panel.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => { isDragging = false; });
    }
    
    function toggle() {
        const costModal = document.getElementById('cost-modal');
        if (costModal.classList.contains('active')) {
            costModal.classList.remove('active');
        } else {
            show();
        }
    }
    
    async function show() {
        if (typeof UIPanels !== 'undefined') UIPanels.closeAll();
        const costModal = document.getElementById('cost-modal');
        if (!costModal) {
            console.log('[CostReport] Modal not available in v3.0 layout');
            return;
        }
        costModal.classList.add('active');
        
        try {
            const response = await fetch(`http://${config.baseHost}:8585/api/usage`);
            const data = await response.json();
            
            // Today
            document.getElementById('today-requests').textContent = data.today.requests.toLocaleString();
            document.getElementById('today-input').textContent = data.today.inputTokens.toLocaleString();
            document.getElementById('today-output').textContent = data.today.outputTokens.toLocaleString();
            document.getElementById('today-cost').textContent = '$' + data.today.cost.toFixed(4);
            
            // Total
            document.getElementById('total-requests').textContent = data.total.requests.toLocaleString();
            document.getElementById('total-input').textContent = data.total.inputTokens.toLocaleString();
            document.getElementById('total-output').textContent = data.total.outputTokens.toLocaleString();
            document.getElementById('total-cost').textContent = '$' + data.total.cost.toFixed(4);
            
            // Projections
            if (data.projections) {
                document.getElementById('proj-daily').textContent = '$' + data.projections.daily.toFixed(4);
                document.getElementById('proj-weekly').textContent = '$' + data.projections.weekly.toFixed(2);
                document.getElementById('proj-monthly').textContent = '$' + data.projections.monthly.toFixed(2);
                document.getElementById('proj-yearly').textContent = '$' + data.projections.yearly.toFixed(2);
            }
            
            // History
            const historyDiv = document.getElementById('cost-history');
            if (data.history.length === 0) {
                historyDiv.innerHTML = '<div style="color:#666">No history yet</div>';
            } else {
                historyDiv.innerHTML = data.history.map(day => `
                    <div class="cost-history-row">
                        <span>${day.date}</span>
                        <span>${day.requests} req</span>
                        <span>$${day.cost.toFixed(4)}</span>
                    </div>
                `).join('');
            }
            
            // Monthly
            const monthsDiv = document.getElementById('cost-months');
            if (data.months && data.months.length > 0) {
                monthsDiv.innerHTML = data.months.map(m => `
                    <div class="cost-history-row">
                        <span>${m.month}</span>
                        <span>${m.requests} req</span>
                        <span>$${m.cost.toFixed(2)}</span>
                    </div>
                `).join('');
            } else {
                monthsDiv.innerHTML = '<div style="color:#666">No monthly data yet</div>';
            }
        } catch (err) {
            document.getElementById('cost-content').innerHTML = `<div style="color:#ff6666">Error loading usage: ${err.message}</div>`;
        }
    }
    
    async function showDevTracker() {
        if (typeof UIPanels !== 'undefined') UIPanels.closeAll();
        
        const modal = document.createElement('div');
        modal.className = 'dev-tracker-modal';
        modal.innerHTML = `
            <div class="dev-tracker-content">
                <div class="dev-tracker-header" style="cursor:move;user-select:none;">
                    <h2>📈 Dev Tracker</h2>
                    <button class="btn-close" onclick="this.closest('.dev-tracker-modal').remove()">×</button>
                </div>
                <div class="dev-tracker-body" id="dev-tracker-body">Loading...</div>
            </div>
        `;
        document.body.appendChild(modal);
        setupModalDrag(modal, '.dev-tracker-content', '.dev-tracker-header');
        
        try {
            const res = await fetch(`http://${config.baseHost}:8585/api/dev-tracker`);
            const data = await res.json();
            const days = Object.keys(data.days || {}).sort().reverse();
            
            let html = '<div class="dev-tracker-summary">';
            
            let totalTasks = 0, totalFeatures = 0, totalBugfixes = 0, totalDuration = 0;
            days.forEach(d => {
                const s = data.days[d].summary || {};
                totalTasks += s.totalTasks || 0;
                totalFeatures += s.features || 0;
                totalBugfixes += s.bugfixes || 0;
                totalDuration += s.totalDuration || 0;
            });
            
            html += `
                <div class="dev-stat"><span class="dev-stat-value">${totalTasks}</span><span class="dev-stat-label">Total Tasks</span></div>
                <div class="dev-stat"><span class="dev-stat-value">${totalFeatures}</span><span class="dev-stat-label">Features</span></div>
                <div class="dev-stat"><span class="dev-stat-value">${totalBugfixes}</span><span class="dev-stat-label">Bug Fixes</span></div>
                <div class="dev-stat"><span class="dev-stat-value">${Math.round(totalDuration/60)}h</span><span class="dev-stat-label">Dev Time</span></div>
            </div>`;
            
            html += '<div class="dev-days">';
            days.slice(0, 7).forEach(day => {
                const d = data.days[day];
                const s = d.summary || {};
                html += `
                    <div class="dev-day">
                        <div class="dev-day-header">
                            <span class="dev-day-date">${day}</span>
                            <span class="dev-day-count">${s.totalTasks || 0} tasks</span>
                        </div>
                        <div class="dev-day-tasks">
                `;
                (d.tasks || []).forEach(t => {
                    const catIcon = {feature:'✨', bugfix:'🐛', refactor:'♻️', docs:'📝'}[t.category] || '📌';
                    const autoTag = t.autoLogged ? '<span class="auto-tag">auto</span>' : '';
                    html += `<div class="dev-task"><span class="dev-task-cat">${catIcon}</span><span class="dev-task-title">${t.title}${autoTag}</span><span class="dev-task-time">${t.duration}m</span></div>`;
                });
                html += '</div></div>';
            });
            html += '</div>';
            
            document.getElementById('dev-tracker-body').innerHTML = html;
        } catch (err) {
            document.getElementById('dev-tracker-body').innerHTML = `<div style="color:#ff6666">Error: ${err.message}</div>`;
        }
    }
    
    async function showTodoInsight() {
        const task = prompt('Enter task to get Kitt insights on:');
        if (!task) return;

        try {
            AdminKitt.addSystemMessage('💡 Getting Kitt insights...');
            const res = await fetch(`http://${location.hostname}:8585/api/todo-insight`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task })
            });
            const data = await res.json();
            if (data.insight) {
                AdminKitt.addMessage('assistant', `**💡 Kitt's Insights on: "${task}"**\n\n${data.insight}`);
            }
        } catch (err) {
            AdminKitt.addMessage('error', 'Failed to get insight: ' + err.message);
        }
        if (typeof UIPanels !== 'undefined') UIPanels.closeAll();
    }

    function showDocsCenter() {
        if (typeof UIPanels !== 'undefined') UIPanels.closeAll();

        // Remove existing modal
        const existing = document.querySelector('.docs-center-modal');
        if (existing) existing.remove();

        const docs = [
            { category: 'Project Overview', items: [
                { icon: '📋', name: 'README', file: 'README.md', desc: 'Project introduction' },
                { icon: '🏗️', name: 'Architecture', file: 'ARCHITECTURE.md', desc: 'System architecture v3.0' },
                { icon: '📅', name: 'Project Plan', file: 'PROJECT-PLAN.md', desc: 'Roadmap & milestones' },
                { icon: '✅', name: 'TODO List', file: 'TODO.md', desc: 'Development backlog' },
                { icon: '🚀', name: 'Getting Started', file: 'GETTING-STARTED.md', desc: 'Quick start guide' }
            ]},
            { category: 'Development Guides', items: [
                { icon: '🤖', name: 'CLAUDE.md', file: 'CLAUDE.md', desc: 'AI context & shortcuts' },
                { icon: '📏', name: 'Standards', file: 'STANDARDS.md', desc: 'Patterns & conventions' },
                { icon: '🔌', name: 'Plugins', file: 'docs/PLUGINS.md', desc: 'Plugin system & API' },
                { icon: '🎛️', name: 'Widget Creation', file: 'docs/WIDGET-CREATION-GUIDE.md', desc: 'How to build widgets' }
            ]},
            { category: 'Technical Reference', items: [
                { icon: '📦', name: 'Components', file: 'docs/COMPONENT-REGISTRY.md', desc: 'All UI components' },
                { icon: '🔧', name: 'Component Arch', file: 'docs/COMPONENT-ARCHITECTURE.md', desc: 'Component specs' },
                { icon: '✈️', name: 'SimVars', file: 'docs/SIMVARS-REFERENCE.md', desc: 'SimConnect variables' },
                { icon: '🎯', name: 'Flow Pro Ref', file: 'docs/FLOW-PRO-REFERENCE.md', desc: 'Widget API reference' },
                { icon: '🌐', name: 'Resources', file: 'RESOURCES.md', desc: 'External API integrations' }
            ]},
            { category: 'Admin & Services', items: [
                { icon: '📖', name: 'Agent README', file: 'Admin/agent/README.md', desc: 'Agent (Kitt) guide' },
                { icon: '🔄', name: 'Relay README', file: 'Admin/relay/README.md', desc: 'Relay service docs' },
                { icon: '🛠️', name: 'Troubleshooting', file: 'Admin/agent/TROUBLESHOOTING.md', desc: 'Common issues & fixes' },
                { icon: '📡', name: 'Remote Setup', file: 'Admin/agent/REMOTE-DEV-SETUP.md', desc: 'Remote development' }
            ]}
        ];

        const modal = document.createElement('div');
        modal.className = 'docs-center-modal';
        modal.innerHTML = `
            <div class="docs-center-content" id="docs-center-panel">
                <div class="docs-center-header" id="docs-drag-handle" style="cursor:move;">
                    <h2>📚 Documentation Center</h2>
                    <button class="btn-close" onclick="this.closest('.docs-center-modal').remove()">×</button>
                </div>
                <div class="docs-center-body">
                    ${docs.map(cat => `
                        <div class="docs-category">
                            <h3>${cat.category}</h3>
                            <div class="docs-grid">
                                ${cat.items.map(doc => `
                                    <div class="docs-item" onclick="openDocFile('${doc.file}')" title="${doc.desc}">
                                        <span class="docs-icon">${doc.icon}</span>
                                        <div class="docs-info">
                                            <span class="docs-name">${doc.name}</span>
                                            <span class="docs-desc">${doc.desc}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="docs-center-footer">
                    <button class="admin-btn" onclick="openDocFile('CLAUDE.md')">🤖 AI Context</button>
                    <button class="admin-btn" onclick="openDocFile('TODO.md')">✅ TODOs</button>
                    <button class="admin-btn" onclick="this.closest('.docs-center-modal').remove()">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Setup drag functionality
        setupDocsDrag(modal);

        // Add styles if not present
        if (!document.getElementById('docs-center-styles')) {
            const style = document.createElement('style');
            style.id = 'docs-center-styles';
            style.textContent = `
                .docs-center-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10001;
                }
                .docs-center-content {
                    background: #1a1a2e;
                    border: 1px solid #4a9eff;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 700px;
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                }
                .docs-center-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    border-bottom: 1px solid #333;
                }
                .docs-center-header h2 {
                    margin: 0;
                    font-size: 18px;
                    color: #fff;
                }
                .docs-center-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px 20px;
                }
                .docs-category {
                    margin-bottom: 20px;
                }
                .docs-category h3 {
                    color: #4a9eff;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin: 0 0 10px 0;
                    padding-bottom: 6px;
                    border-bottom: 1px solid #333;
                }
                .docs-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                }
                .docs-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    background: #2a2a3e;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .docs-item:hover {
                    background: #3a3a4e;
                    transform: translateY(-1px);
                }
                .docs-icon {
                    font-size: 20px;
                }
                .docs-info {
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .docs-name {
                    color: #fff;
                    font-weight: 500;
                    font-size: 13px;
                }
                .docs-desc {
                    color: #888;
                    font-size: 11px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .docs-center-footer {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                    padding: 12px 20px;
                    border-top: 1px solid #333;
                }
                .docs-center-footer .admin-btn {
                    padding: 8px 16px;
                }
                @media (max-width: 600px) {
                    .docs-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    function setupDocsDrag(modal) {
        const panel = modal.querySelector('.docs-center-content');
        const handle = modal.querySelector('.docs-center-header');
        if (!panel || !handle) return;

        let isDragging = false;
        let startX, startY, initialX, initialY;

        // Set initial position (centered)
        panel.style.position = 'absolute';
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.transform = 'translate(-50%, -50%)';

        handle.addEventListener('mousedown', (e) => {
            if (e.target.closest('.btn-close')) return;
            isDragging = true;
            handle.style.cursor = 'grabbing';

            const rect = panel.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialX = rect.left;
            initialY = rect.top;

            // Remove centering transform once dragging starts
            panel.style.transform = 'none';
            panel.style.left = initialX + 'px';
            panel.style.top = initialY + 'px';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newX = initialX + dx;
            let newY = initialY + dy;

            // Keep within viewport
            const maxX = window.innerWidth - panel.offsetWidth;
            const maxY = window.innerHeight - panel.offsetHeight;
            newX = Math.max(0, Math.min(newX, maxX));
            newY = Math.max(0, Math.min(newY, maxY));

            panel.style.left = newX + 'px';
            panel.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                handle.style.cursor = 'move';
            }
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    return {
        toggle,
        show,
        showDevTracker,
        showTodoInsight,
        showDocsCenter
    };
})();

window.toggleCostReport = CostReport.toggle;
window.showCostReport = CostReport.show;
window.showDevTracker = CostReport.showDevTracker;
window.showTodoInsight = CostReport.showTodoInsight;
window.showDocsCenter = CostReport.showDocsCenter;

// Open documentation file - uses agent API to read file content
window.openDocFile = async function(filePath) {
    const baseHost = location.hostname || 'localhost';

    try {
        // Try to fetch via agent file API
        const res = await fetch(`http://${baseHost}:8585/api/file?path=C:/LLM-DevOSWE/${filePath}`);
        if (!res.ok) throw new Error('File not found');
        const content = await res.text();

        // Show in modal with markdown rendering
        showDocViewer(filePath, content);
    } catch (err) {
        // Fallback: open in VS Code or show error
        try {
            await fetch(`http://${baseHost}:8585/api/open-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: `C:/LLM-DevOSWE/${filePath}` })
            });
        } catch (e) {
            alert('Could not open file: ' + filePath);
        }
    }
};

// Simple markdown doc viewer
window.showDocViewer = function(filename, content) {
    // Remove existing viewer
    const existing = document.querySelector('.doc-viewer-modal');
    if (existing) existing.remove();

    // Simple markdown to HTML conversion
    let html = content
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\[x\]/g, '✅')
        .replace(/\[ \]/g, '⬜');

    html = '<p>' + html + '</p>';
    html = html.replace(/<li>/g, '</p><ul><li>').replace(/<\/li>(\s*)<li>/g, '</li><li>').replace(/<\/li>(\s*)<\/p>/g, '</li></ul><p>');

    const modal = document.createElement('div');
    modal.className = 'doc-viewer-modal';
    modal.innerHTML = `
        <div class="doc-viewer-content" id="doc-viewer-panel">
            <div class="doc-viewer-header" id="doc-viewer-drag-handle" style="cursor:move;">
                <h2>📄 ${filename}</h2>
                <button class="btn-close" onclick="this.closest('.doc-viewer-modal').remove()">×</button>
            </div>
            <div class="doc-viewer-body">${html}</div>
            <div class="doc-viewer-footer">
                <button class="admin-btn" onclick="navigator.clipboard.writeText(this.closest('.doc-viewer-modal').querySelector('.doc-viewer-body').innerText)">📋 Copy</button>
                <button class="admin-btn" onclick="this.closest('.doc-viewer-modal').remove()">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Setup drag functionality
    setupDocViewerDrag(modal);

    // Add styles
    if (!document.getElementById('doc-viewer-styles')) {
        const style = document.createElement('style');
        style.id = 'doc-viewer-styles';
        style.textContent = `
            .doc-viewer-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10002;
            }
            .doc-viewer-content {
                background: #1a1a2e;
                border: 1px solid #4a9eff;
                border-radius: 12px;
                width: 90%;
                max-width: 800px;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
            }
            .doc-viewer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid #333;
            }
            .doc-viewer-header h2 {
                margin: 0;
                font-size: 16px;
                color: #fff;
            }
            .doc-viewer-body {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                color: #e0e0e0;
                font-size: 14px;
                line-height: 1.6;
            }
            .doc-viewer-body h1 { color: #4a9eff; font-size: 20px; margin: 16px 0 8px; }
            .doc-viewer-body h2 { color: #22c55e; font-size: 16px; margin: 14px 0 6px; }
            .doc-viewer-body h3 { color: #f59e0b; font-size: 14px; margin: 12px 0 4px; }
            .doc-viewer-body code { background: #2a2a3e; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
            .doc-viewer-body ul { margin: 8px 0; padding-left: 24px; }
            .doc-viewer-body li { margin: 4px 0; }
            .doc-viewer-body strong { color: #fff; }
            .doc-viewer-footer {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
                padding: 12px 20px;
                border-top: 1px solid #333;
            }
        `;
        document.head.appendChild(style);
    }
};

// Setup drag for doc viewer modal
function setupDocViewerDrag(modal) {
    const panel = modal.querySelector('.doc-viewer-content');
    const handle = modal.querySelector('.doc-viewer-header');
    if (!panel || !handle) return;

    let isDragging = false;
    let startX, startY, initialX, initialY;

    // Set initial position (centered)
    panel.style.position = 'absolute';
    panel.style.left = '50%';
    panel.style.top = '50%';
    panel.style.transform = 'translate(-50%, -50%)';

    handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('.btn-close')) return;
        isDragging = true;
        handle.style.cursor = 'grabbing';

        const rect = panel.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        initialX = rect.left;
        initialY = rect.top;

        panel.style.transform = 'none';
        panel.style.left = initialX + 'px';
        panel.style.top = initialY + 'px';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newX = initialX + dx;
        let newY = initialY + dy;

        const maxX = window.innerWidth - panel.offsetWidth;
        const maxY = window.innerHeight - panel.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            handle.style.cursor = 'move';
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}
