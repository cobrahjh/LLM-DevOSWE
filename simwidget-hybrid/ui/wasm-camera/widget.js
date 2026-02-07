/**
 * WASM Camera Widget
 * Version: 1.0.0
 * Last updated: 2026-01-08
 * 
 * Controls smooth cinematic camera via WASM module
 */

const API_BASE = `http://${window.location.host}`;

// State
let isActive = false;
let isReady = false;
let currentPreset = 1;
let smoothing = 50;

// Elements
const statusDot = document.getElementById('status-dot');
const btnFlyby = document.getElementById('btn-flyby');
const btnTower = document.getElementById('btn-tower');
const btnNext = document.getElementById('btn-next');
const btnReset = document.getElementById('btn-reset');
const smoothSlider = document.getElementById('smooth-slider');
const smoothValue = document.getElementById('smooth-value');
const infoBar = document.getElementById('info-bar');
const presetBtns = document.querySelectorAll('.preset-btn');

// API Functions
async function sendCommand(action, smooth) {
    try {
        const res = await fetch(`${API_BASE}/api/wasm-camera`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, smooth })
        });
        const data = await res.json();
        if (data.success) {
            console.log(`[Camera] ${action} success`);
        } else {
            console.error(`[Camera] ${action} failed:`, data.error);
        }
        return data;
    } catch (err) {
        console.error('[Camera] API error:', err);
        return { success: false, error: err.message };
    }
}

async function checkStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/wasm-camera/status`);
        const data = await res.json();
        
        isReady = data.ready;
        const mode = data.status;
        isActive = mode !== 0;
        
        updateUI();
    } catch (err) {
        isReady = false;
        isActive = false;
        updateUI();
    }
}

// UI Update
function updateUI() {
    // Status indicator
    statusDot.classList.remove('ready', 'active');
    if (isActive) {
        statusDot.classList.add('active');
        statusDot.title = 'Camera Active';
    } else if (isReady) {
        statusDot.classList.add('ready');
        statusDot.title = 'WASM Module Ready';
    } else {
        statusDot.title = 'WASM Module Not Detected';
    }
    
    // Flyby button
    btnFlyby.classList.toggle('active', isActive);
    btnFlyby.querySelector('.btn-label').textContent = isActive ? 'Stop' : 'Flyby';
    
    // Info bar
    infoBar.classList.remove('ready', 'error');
    if (!isReady) {
        infoBar.textContent = 'WASM module not detected - restart MSFS';
        infoBar.classList.add('error');
    } else if (isActive) {
        infoBar.textContent = `Flyby active - Preset ${currentPreset}`;
        infoBar.classList.add('ready');
    } else {
        infoBar.textContent = 'Ready - Click Flyby to start';
        infoBar.classList.add('ready');
    }
}

// Event Handlers
btnFlyby.addEventListener('click', async () => {
    await sendCommand('flyby', smoothing);
    setTimeout(checkStatus, 200);
});

btnTower.addEventListener('click', async () => {
    await sendCommand('tower', smoothing);
    setTimeout(checkStatus, 200);
});

btnNext.addEventListener('click', async () => {
    currentPreset = (currentPreset % 5) + 1;
    updatePresetButtons();
    await sendCommand('next');
    setTimeout(checkStatus, 200);
});

btnReset.addEventListener('click', async () => {
    await sendCommand('reset');
    currentPreset = 1;
    updatePresetButtons();
    setTimeout(checkStatus, 200);
});

smoothSlider.addEventListener('input', (e) => {
    smoothing = parseInt(e.target.value);
    smoothValue.textContent = `${smoothing}%`;
});

smoothSlider.addEventListener('change', async (e) => {
    smoothing = parseInt(e.target.value);
    if (isActive) {
        await sendCommand('toggle', smoothing); // Apply new smoothing
    }
});

presetBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
        const preset = parseInt(btn.dataset.preset);
        // Cycle to target preset
        while (currentPreset !== preset) {
            currentPreset = (currentPreset % 5) + 1;
            await sendCommand('next');
            await new Promise(r => setTimeout(r, 100));
        }
        updatePresetButtons();
    });
});

function updatePresetButtons() {
    presetBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.preset) === currentPreset);
    });
}

// Initialize
updatePresetButtons();
checkStatus();
const _wasmPollInterval = setInterval(checkStatus, 2000);

window.addEventListener('beforeunload', () => clearInterval(_wasmPollInterval));

console.log('[WASM Camera Widget] Initialized');
