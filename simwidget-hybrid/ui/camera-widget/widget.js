/**
 * Camera Widget JavaScript v2
 * SimGlass Engine - Now with Platform Indicators
 */

const API_BASE = window.location.origin;

// State
let currentState = {
    state: 2,  // Cockpit
    flybyActive: false,
    orbitActive: false,
    platform: null,
    stats: null
};

// Camera state names
const stateNames = {
    2: 'Cockpit',
    3: 'External',
    4: 'Drone',
    5: 'Fixed',
    6: 'Environment',
    9: 'Showcase',
    19: 'Top-Down',
    24: 'Ground'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initButtons();
    initZoom();
    initPresets();
    initPlatformIndicator();
    updateStatus();
    
    // Poll status every 2s
    setInterval(updateStatus, 2000);
});

// Initialize platform indicator section
function initPlatformIndicator() {
    const content = document.querySelector('.widget-content');
    
    // Add platform section after cinematic section
    const cinematicSection = document.querySelector('.section:has([data-action="flyby"])');
    
    const platformSection = document.createElement('div');
    platformSection.className = 'section platform-section';
    platformSection.innerHTML = `
        <div class="section-title">Input Method</div>
        <div class="platform-indicator" id="platformIndicator">
            <div class="platform-icon">❓</div>
            <div class="platform-info">
                <div class="platform-method">Detecting...</div>
                <div class="platform-stats">Ready</div>
            </div>
            <button class="platform-refresh" onclick="refreshPlatform()" title="Refresh platform detection">🔄</button>
        </div>
        <div class="platform-recommendations" id="platformRecommendations"></div>
    `;
    
    cinematicSection.insertAdjacentElement('afterend', platformSection);
}

// Button handlers
function initButtons() {
    document.querySelectorAll('.cam-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            await sendCommand(action);
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 200);
        });
    });
}

// Zoom slider
function initZoom() {
    const slider = document.getElementById('zoomSlider');
    const value = document.getElementById('zoomValue');
    
    if (slider && value) {
        slider.addEventListener('input', () => {
            value.textContent = slider.value;
        });
        
        slider.addEventListener('change', async () => {
            await sendCommand('zoom', { value: parseInt(slider.value) });
        });
    }
}

// Preset buttons
function initPresets() {
    const grid = document.getElementById('presetGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    for (let i = 0; i < 10; i++) {
        const btn = document.createElement('button');
        btn.className = 'preset-btn';
        btn.textContent = i;
        btn.dataset.slot = i;
        
        // Click to load, long-press to save
        let pressTimer;
        
        btn.addEventListener('mousedown', () => {
            pressTimer = setTimeout(async () => {
                // Long press - save
                btn.classList.add('saving');
                await sendCommand('save', { slot: i, name: `Preset ${i}` });
                btn.classList.remove('saving');
                btn.classList.add('saved');
            }, 800);
        });
        
        btn.addEventListener('mouseup', async () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                // Short click - load
                await sendCommand('load', { slot: i });
            }
        });
        
        btn.addEventListener('mouseleave', () => {
            if (pressTimer) clearTimeout(pressTimer);
        });
        
        grid.appendChild(btn);
    }
}

// Refresh platform detection
async function refreshPlatform() {
    const refreshBtn = document.querySelector('.platform-refresh');
    refreshBtn.style.animation = 'spin 1s linear infinite';
    
    try {
        await sendCommand('refresh-platform');
        setTimeout(() => {
            refreshBtn.style.animation = '';
        }, 1000);
    } catch (e) {
        refreshBtn.style.animation = '';
        console.error('Platform refresh failed:', e);
    }
}

// Send command to server
async function sendCommand(action, body = {}) {
    try {
        // Map widget actions to backend commands
        const actionMap = {
            'toggle': 'VIEW_MODE',
            'refresh-platform': 'REFRESH_PLATFORM'
        };
        
        const backendAction = actionMap[action] || action;
        
        const res = await fetch(`${API_BASE}/api/camera/${backendAction}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const data = await res.json();
        
        if (data.state) {
            currentState = { ...currentState, ...data.state };
            updateUI();
        }
        
        return data;
    } catch (e) {
        console.error('Camera command failed:', e);
        return { success: false, error: e.message };
    }
}

// Update status display
async function updateStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/camera/status`);
        const data = await res.json();
        
        currentState = { ...currentState, ...data };
        updateUI();
        updatePlatformIndicator();
    } catch (e) {
        document.getElementById('cameraStatus')?.textContent = 'Offline';
        updateConnectionStatus(false);
    }
}

// Update connection status indicator
function updateConnectionStatus(connected) {
    const indicator = document.getElementById('conn-status');
    if (indicator) {
        indicator.textContent = connected ? '●' : '●';
        indicator.style.color = connected ? '#4CAF50' : '#f44336';
        indicator.title = connected ? 'Connected' : 'Disconnected';
    }
}

// Update platform indicator
function updatePlatformIndicator() {
    const indicator = document.getElementById('platformIndicator');
    const recommendations = document.getElementById('platformRecommendations');
    
    if (!indicator || !currentState.platform) return;
    
    const platform = currentState.platform;
    const stats = currentState.stats || {};
    
    // Update indicator
    const icon = indicator.querySelector('.platform-icon');
    const method = indicator.querySelector('.platform-method');
    const statsDiv = indicator.querySelector('.platform-stats');
    
    if (icon && platform.indicator) {
        icon.textContent = platform.indicator.icon;
        icon.title = `Platform: ${platform.platform?.platform || 'unknown'}`;
    }
    
    if (method && platform.indicator) {
        method.textContent = platform.indicator.label;
        method.className = `platform-method ${platform.indicator.reliable ? 'reliable' : 'unreliable'}`;
    }
    
    if (statsDiv && stats) {
        const errorRate = stats.totalPresses > 0 ? Math.round((stats.errors / stats.totalPresses) * 100) : 0;
        statsDiv.textContent = `${stats.totalPresses || 0} presses • ${errorRate}% errors`;
    }
    
    // Update recommendations
    if (recommendations && platform.recommendations) {
        recommendations.innerHTML = '';
        
        platform.recommendations.forEach(rec => {
            const recDiv = document.createElement('div');
            recDiv.className = `recommendation ${rec.priority}`;

            const icon = rec.type === 'install' ? '💾' :
                        rec.type === 'system' ? '⚙️' : 'ℹ️';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'rec-icon';
            iconSpan.textContent = icon;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'rec-content';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'rec-title';
            titleDiv.textContent = rec.title || '';

            const descDiv = document.createElement('div');
            descDiv.className = 'rec-description';
            descDiv.textContent = rec.description || '';

            contentDiv.appendChild(titleDiv);
            contentDiv.appendChild(descDiv);

            if (rec.url && typeof rec.url === 'string' && rec.url.startsWith('http')) {
                const link = document.createElement('a');
                link.href = rec.url;
                link.target = '_blank';
                link.className = 'rec-link';
                link.textContent = 'Download';
                contentDiv.appendChild(link);
            }

            recDiv.appendChild(iconSpan);
            recDiv.appendChild(contentDiv);

            recommendations.appendChild(recDiv);
        });
    }
}

// Update UI based on state
function updateUI() {
    updateConnectionStatus(true);
    
    const statusEl = document.getElementById('cameraStatus');
    if (statusEl) {
        let status = stateNames[currentState.state] || 'Unknown';
        
        if (currentState.flybyActive) {
            status += ' 🎬';
        }
        if (currentState.orbitActive) {
            status += ' 🌀';
        }
        
        statusEl.textContent = status;
    }
    
    // Highlight active view button
    document.querySelectorAll('.cam-btn[data-action]').forEach(btn => {
        const action = btn.dataset.action;
        const isActive = (
            (action === 'cockpit' && currentState.state === 2) ||
            (action === 'external' && currentState.state === 3) ||
            (action === 'drone' && currentState.state === 4) ||
            (action === 'topdown' && currentState.state === 19)
        );
        btn.classList.toggle('active', isActive);
    });
}