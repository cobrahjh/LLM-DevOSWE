/**
 * SimWidget Flight Data Widget
 * Ported from Flow Pro - 2025-01-05
 * 
 * Displays real-time flight data from MSFS via SimWidget WebSocket
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\widgets\flight-data-widget\widget.js
 */

// DOM Elements
const widget = document.getElementById('widget');
const header = document.getElementById('header');
const content = document.getElementById('content');
const minimizeBtn = document.getElementById('minimizeBtn');
const settingsBtn = document.getElementById('settingsBtn');
const closeBtn = document.getElementById('closeBtn');

// Data display elements
const altitudeEl = document.getElementById('altitude');
const headingEl = document.getElementById('heading');
const iasEl = document.getElementById('ias');
const groundspeedEl = document.getElementById('groundspeed');
const vspeedEl = document.getElementById('vspeed');
const windEl = document.getElementById('wind');
const latitudeEl = document.getElementById('latitude');
const longitudeEl = document.getElementById('longitude');
const statusIndicator = document.querySelector('.status-indicator');

// State
let isMinimized = false;
let isDragging = false;
let isResizing = false;
let resizeDirection = '';
let dragOffset = { x: 0, y: 0 };
let resizeStart = { x: 0, y: 0, width: 0, height: 0 };
let ws = null;
let isConnected = false;

// Widget ID for storage
const WIDGET_ID = 'flight-data-widget';

// ============================================
// POSITION & SIZE PERSISTENCE
// ============================================

function saveWidgetState() {
    const state = {
        left: widget.offsetLeft,
        top: widget.offsetTop,
        width: widget.offsetWidth,
        height: widget.offsetHeight,
        minimized: isMinimized
    };
    localStorage.setItem(`simwidget_${WIDGET_ID}`, JSON.stringify(state));
}

function loadWidgetState() {
    const saved = localStorage.getItem(`simwidget_${WIDGET_ID}`);
    if (saved) {
        try {
            const state = JSON.parse(saved);
            widget.style.position = 'absolute';
            widget.style.left = `${state.left}px`;
            widget.style.top = `${state.top}px`;
            widget.style.width = `${state.width}px`;
            widget.style.height = `${state.height}px`;
            if (state.minimized) {
                isMinimized = true;
                content.classList.add('minimized');
            }
            console.log('[FlightData] Restored widget state');
        } catch (e) {
            console.warn('[FlightData] Could not restore state:', e);
        }
    }
}

// ============================================
// SIMWIDGET WEBSOCKET CONNECTION
// ============================================

function connectWebSocket() {
    // Use location.host for remote access, 127.0.0.1 for local
    const host = location.hostname;
    const wsUrl = (host === 'localhost' || host === '127.0.0.1')
        ? 'ws://127.0.0.1:8080'
        : `ws://${location.host}`;
    console.log(`[FlightData] Connecting to SimWidget server at ${wsUrl}...`);
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('[FlightData] Connected to SimWidget server');
        isConnected = true;
        updateConnectionStatus(true);
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'flightData') {
                handleFlightData(data.data);
            }
        } catch (e) {
            console.error('[FlightData] Error parsing message:', e);
        }
    };
    
    ws.onclose = () => {
        console.log('[FlightData] Disconnected from SimWidget server');
        isConnected = false;
        updateConnectionStatus(false);
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
        console.error('[FlightData] WebSocket error:', error);
        updateConnectionStatus(false);
    };
}

function updateConnectionStatus(connected) {
    if (statusIndicator) {
        statusIndicator.style.background = connected ? '#00ff88' : '#ff4444';
        statusIndicator.style.boxShadow = connected 
            ? '0 0 10px rgba(0, 255, 136, 0.6)' 
            : '0 0 10px rgba(255, 68, 68, 0.6)';
    }
}

// ============================================
// FLIGHT DATA HANDLING
// ============================================

function handleFlightData(data) {
    // Map SimWidget data to our display format
    updateFlightData({
        altitude: data.altitude,
        heading: data.heading,
        ias: data.speed,  // SimWidget sends 'speed' as IAS
        groundspeed: data.groundSpeed || data.speed * 1.1,  // Estimate if not available
        vspeed: data.verticalSpeed,
        windDirection: data.windDirection,
        windSpeed: data.windSpeed,
        latitude: data.latitude,
        longitude: data.longitude
    });
}

/**
 * Format a number with commas for thousands
 */
function formatNumber(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '---';
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Update the display with new flight data
 */
function updateFlightData(data) {
    // Altitude
    if (data.altitude !== undefined) {
        altitudeEl.textContent = formatNumber(Math.round(data.altitude));
    }
    
    // Heading
    if (data.heading !== undefined) {
        headingEl.textContent = formatNumber(Math.round(data.heading)).padStart(3, '0');
    }
    
    // Indicated Airspeed
    if (data.ias !== undefined) {
        iasEl.textContent = formatNumber(Math.round(data.ias));
    }
    
    // Ground Speed
    if (data.groundspeed !== undefined) {
        groundspeedEl.textContent = formatNumber(Math.round(data.groundspeed));
    }
    
    // Vertical Speed
    if (data.vspeed !== undefined) {
        const vs = Math.round(data.vspeed);
        vspeedEl.textContent = (vs >= 0 ? '+' : '') + formatNumber(vs);
        vspeedEl.style.color = vs > 100 ? '#00ff88' : vs < -100 ? '#ff4444' : '#ffffff';
    }
    
    // Wind
    if (data.windDirection !== undefined && data.windSpeed !== undefined) {
        const dir = Math.round(data.windDirection).toString().padStart(3, '0');
        const spd = Math.round(data.windSpeed);
        windEl.textContent = `${dir}° / ${spd} kts`;
    }

    // GPS Coordinates
    if (data.latitude !== undefined && latitudeEl) {
        const lat = data.latitude;
        const latDir = lat >= 0 ? 'N' : 'S';
        latitudeEl.textContent = `${Math.abs(lat).toFixed(4)}° ${latDir}`;
    }
    if (data.longitude !== undefined && longitudeEl) {
        const lon = data.longitude;
        const lonDir = lon >= 0 ? 'E' : 'W';
        longitudeEl.textContent = `${Math.abs(lon).toFixed(4)}° ${lonDir}`;
    }
}

// ============================================
// DRAG FUNCTIONALITY
// ============================================

header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.control-btn')) return;
    isDragging = true;
    dragOffset.x = e.clientX - widget.offsetLeft;
    dragOffset.y = e.clientY - widget.offsetTop;
    document.body.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        
        widget.style.position = 'absolute';
        widget.style.left = `${Math.max(0, x)}px`;
        widget.style.top = `${Math.max(0, y)}px`;
    }
    
    if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        if (resizeDirection.includes('e')) {
            widget.style.width = `${Math.max(200, resizeStart.width + deltaX)}px`;
        }
        if (resizeDirection.includes('s')) {
            widget.style.height = `${Math.max(150, resizeStart.height + deltaY)}px`;
        }
    }
});

document.addEventListener('mouseup', () => {
    if (isDragging || isResizing) {
        saveWidgetState();
    }
    isDragging = false;
    isResizing = false;
    resizeDirection = '';
    document.body.style.cursor = 'default';
});

// ============================================
// RESIZE FUNCTIONALITY
// ============================================

function initResize(direction) {
    return (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        resizeDirection = direction;
        resizeStart = {
            x: e.clientX,
            y: e.clientY,
            width: widget.offsetWidth,
            height: widget.offsetHeight
        };
    };
}

// Attach resize handlers
document.getElementById('resizeSE')?.addEventListener('mousedown', initResize('se'));
document.getElementById('resizeE')?.addEventListener('mousedown', initResize('e'));
document.getElementById('resizeS')?.addEventListener('mousedown', initResize('s'));

// ============================================
// CONTROL BUTTONS
// ============================================

minimizeBtn.addEventListener('click', () => {
    isMinimized = !isMinimized;
    content.classList.toggle('minimized', isMinimized);
    saveWidgetState();
});

settingsBtn.addEventListener('click', () => {
    console.log('[FlightData] Settings clicked');
});

closeBtn.addEventListener('click', () => {
    if (ws) {
        ws.close();
    }
    widget.style.display = 'none';
});

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('[FlightData] Widget initializing...');
    loadWidgetState();
    connectWebSocket();
});
