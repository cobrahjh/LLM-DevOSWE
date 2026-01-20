/**
 * Kittbox Component Tester v0.1.0
 * Mobile-friendly widget preview and testing panel
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\Admin\agent\agent-ui\component-tester.js
 * Last Updated: 2026-01-09
 * 
 * Part of Kittbox - SimWidget Development Toolkit
 */

const ComponentTester = (function() {
    let isOpen = false;
    let currentWidget = null;
    let currentScale = 100;
    let currentDevice = null;

    // Available widgets for testing - served from DIM (port 8080)
    const DIM_HOST = 'http://127.0.0.1:8080';
    const WIDGETS = [
        { id: 'aircraft-control', name: 'Aircraft Control', icon: '✈️', path: `${DIM_HOST}/ui/aircraft-control/index.html` },
        { id: 'flight-data', name: 'Flight Data', icon: '📊', path: `${DIM_HOST}/ui/flight-data-widget/index.html` },
        { id: 'fuel-display', name: 'Fuel Display', icon: '⛽', path: `${DIM_HOST}/ui/fuel-widget/index.html` },
        { id: 'camera-control', name: 'Camera Control', icon: '📷', path: `${DIM_HOST}/ui/camera-widget/index.html` },
        { id: 'engine-control', name: 'Engine Control', icon: '🔧', path: `${DIM_HOST}/ui/aircraft-control/index.html` },
        { id: 'lights-control', name: 'Lights Control', icon: '💡', path: `${DIM_HOST}/ui/aircraft-control/index.html` },
        { id: 'autopilot', name: 'Autopilot', icon: '🎯', path: `${DIM_HOST}/ui/aircraft-control/index.html` },
        { id: 'wasm-camera', name: 'WASM Camera', icon: '🎬', path: `${DIM_HOST}/ui/wasm-camera/index.html` }
    ];

    const SCALES = [50, 75, 100, 125, 150];

    // Device presets for testing
    const DEVICES = [
        { name: 'iPhone SE', width: 375, height: 667 },
        { name: 'iPhone 14', width: 390, height: 844 },
        { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
        { name: 'Pixel 7', width: 412, height: 915 },
        { name: 'iPad Mini', width: 744, height: 1133 },
        { name: 'Current', width: 0, height: 0 }
    ];

    function createStyles() {
        if (document.getElementById('ct-styles')) return;

        const style = document.createElement('style');
        style.id = 'ct-styles';
        style.textContent = `
            .ct-fab {
                position: fixed;
                bottom: 80px;
                right: 16px;
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: linear-gradient(135deg, #4a9eff, #7c3aed);
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(74, 158, 255, 0.4);
                z-index: 9998;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .ct-fab:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 16px rgba(74, 158, 255, 0.6);
            }
            .ct-fab:active {
                transform: scale(0.95);
            }
            .ct-panel {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: #1a1a2e;
                border-top: 2px solid #4a9eff;
                border-radius: 16px 16px 0 0;
                z-index: 9999;
                transform: translateY(100%);
                transition: transform 0.3s ease-out;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
            }
            .ct-panel.open {
                transform: translateY(0);
            }
            .ct-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid #333;
                flex-shrink: 0;
            }
            .ct-title {
                font-size: 16px;
                font-weight: 600;
                color: #fff;
            }
            .ct-close {
                background: none;
                border: none;
                color: #888;
                font-size: 24px;
                cursor: pointer;
                padding: 4px 8px;
            }
            .ct-viewport-info {
                background: #252540;
                padding: 8px 16px;
                font-size: 12px;
                color: #4a9eff;
                display: flex;
                justify-content: space-between;
                flex-shrink: 0;
            }
            .ct-body {
                flex: 1;
                overflow-y: auto;
                padding: 12px;
            }
            .ct-section {
                margin-bottom: 16px;
            }
            .ct-section-title {
                font-size: 12px;
                color: #888;
                margin-bottom: 8px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .ct-widget-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
            }
            .ct-widget-btn {
                background: #252540;
                border: 2px solid transparent;
                border-radius: 12px;
                padding: 12px 8px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s;
                min-height: 70px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .ct-widget-btn:hover {
                background: #303050;
                border-color: #4a9eff;
            }
            .ct-widget-btn.active {
                background: #303050;
                border-color: #4a9eff;
            }
            .ct-widget-icon {
                font-size: 24px;
                margin-bottom: 4px;
            }
            .ct-widget-name {
                font-size: 10px;
                color: #ccc;
                line-height: 1.2;
            }
            .ct-controls {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            .ct-control-group {
                display: flex;
                gap: 4px;
            }
            .ct-scale-btn, .ct-device-btn {
                background: #252540;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 8px 12px;
                color: #ccc;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                min-width: 44px;
                min-height: 44px;
            }
            .ct-scale-btn:hover, .ct-device-btn:hover {
                background: #303050;
                border-color: #4a9eff;
            }
            .ct-scale-btn.active, .ct-device-btn.active {
                background: #4a9eff;
                border-color: #4a9eff;
                color: #fff;
            }
            .ct-preview-container {
                background: #0a0a15;
                border-radius: 8px;
                margin-top: 12px;
                overflow: hidden;
                position: relative;
                min-height: 200px;
            }
            .ct-preview-frame {
                width: 100%;
                height: 300px;
                border: none;
                background: #000;
            }
            .ct-touch-warning {
                background: #ff6b6b22;
                border: 1px solid #ff6b6b;
                border-radius: 6px;
                padding: 8px 12px;
                margin-top: 8px;
                color: #ff6b6b;
                font-size: 12px;
                display: none;
            }
            .ct-touch-warning.visible {
                display: block;
            }
            .ct-empty {
                text-align: center;
                padding: 40px;
                color: #666;
            }
            .ct-device-select {
                background: #252540;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 8px 12px;
                color: #ccc;
                font-size: 12px;
                min-height: 44px;
            }
        `;
        document.head.appendChild(style);
    }

    function createPanel() {
        // FAB Button
        const fab = document.createElement('button');
        fab.className = 'ct-fab';
        fab.innerHTML = '??';
        fab.title = 'Kittbox Component Tester';
        fab.onclick = toggle;
        document.body.appendChild(fab);

        // Panel
        const panel = document.createElement('div');
        panel.className = 'ct-panel';
        panel.id = 'ct-panel';
        panel.innerHTML = `
            <div class="ct-header">
                <span class="ct-title">?? Kittbox Component Tester</span>
                <button class="ct-close" onclick="ComponentTester.toggle()">�</button>
            </div>
            <div class="ct-viewport-info">
                <span id="ct-viewport-size">?? ${window.innerWidth}�${window.innerHeight}</span>
                <span id="ct-orientation">${window.innerWidth > window.innerHeight ? 'Landscape' : 'Portrait'}</span>
            </div>
            <div class="ct-body">
                <div class="ct-section">
                    <div class="ct-section-title">Widgets</div>
                    <div class="ct-widget-grid" id="ct-widget-grid"></div>
                </div>
                <div class="ct-section">
                    <div class="ct-section-title">Scale</div>
                    <div class="ct-control-group" id="ct-scale-group"></div>
                </div>
                <div class="ct-section">
                    <div class="ct-section-title">Device Preview</div>
                    <select class="ct-device-select" id="ct-device-select" onchange="ComponentTester.setDevice(this.value)">
                        ${DEVICES.map((d, i) => `<option value="${i}">${d.name}${d.width ? ` (${d.width}�${d.height})` : ''}</option>`).join('')}
                    </select>
                </div>
                <div class="ct-preview-container" id="ct-preview-container">
                    <div class="ct-empty">Select a widget to preview</div>
                </div>
                <div class="ct-touch-warning" id="ct-touch-warning"></div>
            </div>
        `;
        document.body.appendChild(panel);

        // Populate widget grid
        const grid = document.getElementById('ct-widget-grid');
        WIDGETS.forEach(w => {
            const btn = document.createElement('button');
            btn.className = 'ct-widget-btn';
            btn.dataset.id = w.id;
            btn.innerHTML = `<span class="ct-widget-icon">${w.icon}</span><span class="ct-widget-name">${w.name}</span>`;
            btn.onclick = () => loadWidget(w.id);
            grid.appendChild(btn);
        });

        // Populate scale buttons
        const scaleGroup = document.getElementById('ct-scale-group');
        SCALES.forEach(s => {
            const btn = document.createElement('button');
            btn.className = `ct-scale-btn ${s === 100 ? 'active' : ''}`;
            btn.textContent = `${s}%`;
            btn.onclick = () => setScale(s);
            scaleGroup.appendChild(btn);
        });

        // Update viewport on resize
        window.addEventListener('resize', updateViewportInfo);
    }

    function updateViewportInfo() {
        const sizeEl = document.getElementById('ct-viewport-size');
        const orientEl = document.getElementById('ct-orientation');
        if (sizeEl) sizeEl.textContent = `?? ${window.innerWidth}�${window.innerHeight}`;
        if (orientEl) orientEl.textContent = window.innerWidth > window.innerHeight ? 'Landscape' : 'Portrait';
    }

    function toggle() {
        const panel = document.getElementById('ct-panel');
        isOpen = !isOpen;
        panel.classList.toggle('open', isOpen);
    }

    function loadWidget(widgetId) {
        const widget = WIDGETS.find(w => w.id === widgetId);
        if (!widget) return;

        currentWidget = widget;

        // Update active state
        document.querySelectorAll('.ct-widget-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.id === widgetId);
        });

        // Load widget in preview
        const container = document.getElementById('ct-preview-container');

        // Widget paths already include full URL (http://127.0.0.1:8080/...)
        container.innerHTML = `
            <iframe
                class="ct-preview-frame"
                id="ct-preview-frame"
                src="${widget.path}"
                style="transform: scale(${currentScale / 100}); transform-origin: top left; width: ${100 / (currentScale / 100)}%; height: ${300 / (currentScale / 100)}px;"
            ></iframe>
        `;

        // Check touch targets after load
        const frame = document.getElementById('ct-preview-frame');
        frame.onload = () => {
            setTimeout(checkTouchTargets, 500);
        };
    }

    function setScale(scale) {
        currentScale = scale;

        // Update button states
        document.querySelectorAll('.ct-scale-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent === `${scale}%`);
        });

        // Update iframe scale
        const frame = document.getElementById('ct-preview-frame');
        if (frame) {
            frame.style.transform = `scale(${scale / 100})`;
            frame.style.width = `${100 / (scale / 100)}%`;
            frame.style.height = `${300 / (scale / 100)}px`;
        }
    }

    function setDevice(deviceIndex) {
        const device = DEVICES[parseInt(deviceIndex)];
        currentDevice = device;

        const frame = document.getElementById('ct-preview-frame');
        if (frame && device.width > 0) {
            frame.style.width = `${device.width}px`;
            frame.style.height = `${device.height}px`;
            frame.style.transform = 'scale(0.5)';
            frame.style.transformOrigin = 'top left';
        } else if (frame) {
            // Reset to current scale
            setScale(currentScale);
        }
    }

    function checkTouchTargets() {
        const frame = document.getElementById('ct-preview-frame');
        if (!frame) return;

        try {
            const doc = frame.contentDocument;
            if (!doc) return;

            const warning = document.getElementById('ct-touch-warning');
            const buttons = doc.querySelectorAll('button, a, [onclick], input, select, .btn');
            let smallTargets = 0;

            buttons.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width < 44 || rect.height < 44) {
                    smallTargets++;
                    el.style.outline = '2px solid #ff6b6b';
                }
            });

            warning.classList.toggle('visible', smallTargets > 0);
            if (smallTargets > 0) {
                warning.textContent = `? ${smallTargets} touch target(s) below 44px minimum`;
            }
        } catch (e) {
            // Cross-origin, can't check
            console.log('Touch target check: Cross-origin frame');
        }
    }

    function init() {
        createStyles();
        createPanel();
        console.log('?? Kittbox Component Tester v0.1.0 loaded');
    }

    return {
        init,
        toggle,
        loadWidget,
        setScale,
        setDevice
    };
})();

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ComponentTester.init());
} else {
    ComponentTester.init();
}

