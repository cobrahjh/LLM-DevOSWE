/**
 * Debug Inspector v2.3 - Element Selector Tool + Debug Panel + DIM Status
 * Hotkeys:
 *   Ctrl+Alt+Shift+D - Toggle element inspector
 *   Ctrl+Shift+D - Toggle debug info panel
 * Click element to show quick commands with sub-menus
 */

const DebugInspector = (function() {
    'use strict';

    let active = false;
    let overlay = null;
    let tooltip = null;
    let menu = null;
    let submenu = null;
    let lastElement = null;
    let selectedElement = null;
    let selectedSelector = '';

    // Debug Info Panel
    let debugPanel = null;
    let debugPanelVisible = false;

    const quickCommands = [
        { icon: '❌', label: 'Not Working', cmd: 'not working' },
        { icon: '🔧', label: 'Fix', cmd: 'fix', sub: [
            { label: 'Fix layout', cmd: 'fix layout' },
            { label: 'Fix spacing', cmd: 'fix spacing' },
            { label: 'Fix alignment', cmd: 'fix alignment' },
            { label: 'Fix overflow', cmd: 'fix overflow' },
            { label: 'Fix responsiveness', cmd: 'fix responsiveness' },
            { label: 'Fix formatting', cmd: 'fix formatting' },
            { label: 'Fix performance', cmd: 'fix performance issues' }
        ]},
        { icon: '🎨', label: 'Design', cmd: 'design', sub: [
            { label: '── Style ──', cmd: '', disabled: true },
            { label: 'Change colors', cmd: 'change colors' },
            { label: 'Add border/shadow', cmd: 'add border and shadow' },
            { label: 'Change font', cmd: 'change font' },
            { label: 'Add hover effect', cmd: 'add hover effect' },
            { label: 'Add animations', cmd: 'add animations' },
            { label: '── Size ──', cmd: '', disabled: true },
            { label: 'Make larger', cmd: 'make larger' },
            { label: 'Make smaller', cmd: 'make smaller' },
            { label: 'Full width', cmd: 'make full width' },
            { label: '── Width ──', cmd: '', disabled: true },
            { label: 'Width wider', cmd: 'make width wider' },
            { label: 'Width narrower', cmd: 'make width narrower' },
            { label: '── Height ──', cmd: '', disabled: true },
            { label: 'Height taller', cmd: 'make height taller' },
            { label: 'Height shorter', cmd: 'make height shorter' },
            { label: '── Simplify ──', cmd: '', disabled: true },
            { label: 'Simplify design', cmd: 'simplify design, remove clutter' },
            { label: 'Reduce complexity', cmd: 'reduce complexity, fewer elements' },
            { label: 'Remove redundancy', cmd: 'remove redundant elements' },
            { label: 'Clean up code', cmd: 'clean up code, use CSS classes' },
            { label: '── Improve ──', cmd: '', disabled: true },
            { label: 'Modernize style', cmd: 'modernize style' },
            { label: 'Better UX', cmd: 'improve user experience' },
            { label: 'Mobile friendly', cmd: 'make mobile responsive' }
        ]},
        { icon: '⬆️', label: 'Upgrade', cmd: 'upgrade', sub: [
            { label: 'Upgrade UI', cmd: 'upgrade ui' },
            { label: 'Upgrade functionality', cmd: 'upgrade functionality' },
            { label: 'Add features', cmd: 'add new features' },
            { label: 'Add feedback states', cmd: 'add loading and feedback states' }
        ]},
        { icon: '♿', label: 'Accessibility', cmd: 'accessibility', sub: [
            { label: 'Full redesign', cmd: 'redesign for accessibility' },
            { label: 'Add ARIA labels', cmd: 'add aria labels' },
            { label: 'Fix contrast', cmd: 'fix color contrast' },
            { label: 'Add focus states', cmd: 'add focus states' },
            { label: 'Keyboard nav', cmd: 'add keyboard navigation' }
        ]},
        { icon: '👁️', label: 'Visibility', cmd: 'visibility', sub: [
            { label: 'Hide element', cmd: 'hide element' },
            { label: 'Show element', cmd: 'show element' },
            { label: 'Toggle on click', cmd: 'add toggle on click' },
            { label: 'Fade in/out', cmd: 'add fade animation' }
        ]},
        { icon: '🔅', label: 'Dim', cmd: 'dim', sub: [
            { label: 'Dim element', cmd: 'dim element, reduce opacity' },
            { label: 'Highlight element', cmd: 'highlight element, make it stand out' },
            { label: 'Dim others', cmd: 'dim all other elements except this one' },
            { label: 'Add focus overlay', cmd: 'add dark overlay highlighting this element' },
            { label: 'Grayscale', cmd: 'make element grayscale' },
            { label: 'Reset opacity', cmd: 'reset opacity to normal' }
        ]},
        { icon: '✏️', label: 'Edit', cmd: 'edit', sub: [
            { label: 'Edit text', cmd: 'edit text' },
            { label: 'Edit HTML', cmd: 'edit html' },
            { label: 'Add content', cmd: 'add content' },
            { label: 'Update contents', cmd: 'auto update contents' }
        ]},
        { icon: '📸', label: 'Snapshot', cmd: 'snapshot', sub: [
            { label: 'Capture element', cmd: 'snapshot-element' },
            { label: 'Capture with context', cmd: 'snapshot-context' },
            { label: 'Capture full page', cmd: 'snapshot-page' },
            { label: 'Copy as image', cmd: 'snapshot-clipboard' }
        ]},
        { icon: '📋', label: 'Copy selector', cmd: 'copy' },
        { divider: true },
        { icon: '🖥️', label: 'DIM', cmd: 'dim-status', sub: [
            { label: '── Data Interface Manager ──', cmd: '', disabled: true },
            { label: 'Check DIM status', cmd: 'dim-check' },
            { label: 'Open SimWidget UI', cmd: 'dim-open' },
            { label: 'Restart DIM', cmd: 'dim-restart' },
            { label: '── SimConnect ──', cmd: '', disabled: true },
            { label: 'Check connection', cmd: 'dim-simconnect' },
            { label: 'View flight data', cmd: 'dim-flightdata' }
        ]},
        { icon: '🗑️', label: 'Remove', cmd: 'remove', danger: true },
    ];

    function getSelector(el) {
        if (el.id) return `#${el.id}`;

        let selector = el.tagName.toLowerCase();
        if (el.className && typeof el.className === 'string') {
            const classes = el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('debug-'));
            if (classes.length) selector += '.' + classes.join('.');
        }

        if (el.dataset.server) selector += `[data-server="${el.dataset.server}"]`;
        if (el.dataset.service) selector += `[data-service="${el.dataset.service}"]`;

        return selector;
    }

    function getPath(el) {
        const parts = [];
        let current = el;
        while (current && current !== document.body) {
            parts.unshift(getSelector(current));
            current = current.parentElement;
            if (parts.length >= 3) break;
        }
        return parts.join(' > ');
    }

    function createOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'debug-overlay';
        overlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            border: 2px solid #ff0;
            background: rgba(255,255,0,0.1);
            z-index: 99999;
            transition: all 0.05s ease;
            display: none;
        `;
        document.body.appendChild(overlay);

        tooltip = document.createElement('div');
        tooltip.id = 'debug-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: #000;
            color: #0f0;
            font-family: Consolas, monospace;
            font-size: 12px;
            padding: 8px 12px;
            border-radius: 4px;
            z-index: 100000;
            pointer-events: none;
            max-width: 400px;
            word-break: break-all;
            border: 1px solid #0f0;
            display: none;
        `;
        document.body.appendChild(tooltip);

        menu = document.createElement('div');
        menu.id = 'debug-menu';
        menu.style.cssText = `
            position: fixed;
            background: #1a1a2e;
            border: 1px solid #4a9eff;
            border-radius: 8px;
            z-index: 100001;
            display: none;
            min-width: 180px;
            max-height: calc(100vh - 40px);
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(menu);

        submenu = document.createElement('div');
        submenu.id = 'debug-submenu';
        submenu.style.cssText = `
            position: fixed;
            background: #1a1a2e;
            border: 1px solid #4a9eff;
            border-radius: 8px;
            z-index: 100002;
            display: none;
            min-width: 160px;
            max-height: calc(100vh - 60px);
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(submenu);
    }

    function showMenu(x, y) {
        let html = `<div style="padding:8px 12px;background:#2a2a3e;border-bottom:1px solid #333;font-size:11px;color:#888;border-radius:8px 8px 0 0;">
            ${selectedSelector}
        </div>`;

        quickCommands.forEach(cmd => {
            if (cmd.divider) {
                html += `<div style="height:1px;background:#444;margin:4px 8px;"></div>`;
                return;
            }
            const hasSubmenu = cmd.sub && cmd.sub.length > 0;
            const arrow = hasSubmenu ? '<span style="margin-left:auto;color:#666;">▶</span>' : '';
            const dangerClass = cmd.danger ? 'danger' : '';
            html += `<div class="debug-menu-item ${hasSubmenu ? 'has-submenu' : ''} ${dangerClass}" data-cmd="${cmd.cmd}" data-danger="${cmd.danger || false}" style="
                padding: 10px 14px;
                cursor: pointer;
                font-size: 13px;
                color: ${cmd.danger ? '#ff6b6b' : '#e0e0e0'};
                display: flex;
                align-items: center;
                gap: 10px;
                transition: background 0.15s;
            ">${cmd.icon} ${cmd.label}${arrow}</div>`;
        });

        menu.innerHTML = html;
        menu.style.display = 'block';

        // Position menu
        let mx = x;
        let my = y;
        if (mx + 200 > window.innerWidth) mx = window.innerWidth - 210;
        if (my + 450 > window.innerHeight) my = window.innerHeight - 460;
        menu.style.left = mx + 'px';
        menu.style.top = my + 'px';

        // Add hover effects and click handlers
        menu.querySelectorAll('.debug-menu-item').forEach(item => {
            const isDanger = item.dataset.danger === 'true';
            item.onmouseenter = () => {
                item.style.background = isDanger ? '#ef4444' : '#4a9eff';
                item.style.color = '#fff';
                const cmd = quickCommands.find(c => c.cmd === item.dataset.cmd);
                if (cmd && cmd.sub) {
                    showSubmenu(item, cmd.sub);
                } else {
                    hideSubmenu();
                }
            };
            item.onmouseleave = () => {
                item.style.background = 'transparent';
                item.style.color = isDanger ? '#ff6b6b' : '#e0e0e0';
            };
            item.onclick = (e) => {
                e.stopPropagation();
                const cmd = quickCommands.find(c => c.cmd === item.dataset.cmd);
                if (!cmd.sub) {
                    handleCommand(item.dataset.cmd);
                }
            };
        });
    }

    function showSubmenu(parentItem, items) {
        const rect = parentItem.getBoundingClientRect();
        let html = '';

        items.forEach(item => {
            if (item.disabled) {
                // Section header
                html += `<div style="
                    padding: 6px 14px;
                    font-size: 10px;
                    color: #666;
                    cursor: default;
                    border-top: 1px solid #333;
                    margin-top: 4px;
                ">${item.label}</div>`;
            } else {
                html += `<div class="debug-submenu-item" data-cmd="${item.cmd}" style="
                    padding: 10px 14px;
                    cursor: pointer;
                    font-size: 12px;
                    color: #e0e0e0;
                    transition: background 0.15s;
                ">${item.label}</div>`;
            }
        });

        submenu.innerHTML = html;
        submenu.style.display = 'block';

        // Position submenu
        let sx = rect.right + 4;
        let sy = rect.top;
        if (sx + 160 > window.innerWidth) sx = rect.left - 164;
        if (sy + items.length * 40 > window.innerHeight) sy = window.innerHeight - items.length * 40 - 10;
        submenu.style.left = sx + 'px';
        submenu.style.top = sy + 'px';

        submenu.querySelectorAll('.debug-submenu-item').forEach(item => {
            item.onmouseenter = () => item.style.background = '#4a9eff';
            item.onmouseleave = () => item.style.background = 'transparent';
            item.onclick = (e) => {
                e.stopPropagation();
                handleCommand(item.dataset.cmd);
            };
        });

        // Keep submenu open when hovering it
        submenu.onmouseenter = () => submenu.style.display = 'block';
        submenu.onmouseleave = () => hideSubmenu();
    }

    function hideSubmenu() {
        if (submenu) submenu.style.display = 'none';
    }

    function hideMenu() {
        if (menu) menu.style.display = 'none';
        hideSubmenu();
    }

    async function handleCommand(cmd) {
        hideMenu();

        if (cmd === 'copy') {
            navigator.clipboard.writeText(selectedSelector);
            showToast('✓ Copied: ' + selectedSelector);
            toggle();
            return;
        }

        // Handle snapshot commands
        if (cmd.startsWith('snapshot')) {
            await handleSnapshot(cmd);
            toggle();
            return;
        }

        // Handle DIM (Data Interface Manager) commands
        if (cmd.startsWith('dim-')) {
            await handleDIMCommand(cmd);
            return;
        }

        // Check if this is an edit command that needs a prompt
        const editCommands = ['edit text', 'edit html', 'add content', 'auto update contents'];
        if (editCommands.includes(cmd)) {
            const userInput = await showEditPrompt(cmd);
            if (userInput === null) {
                // User cancelled
                toggle();
                return;
            }
            // Append user input to command if provided
            if (userInput.trim()) {
                cmd = `${cmd}: "${userInput}"`;
            }
        }

        // Build context for Kitt
        const path = getPath(selectedElement);
        const rect = selectedElement.getBoundingClientRect();
        const size = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
        const computedStyle = window.getComputedStyle(selectedElement);
        const styles = `color:${computedStyle.color}, bg:${computedStyle.backgroundColor}, display:${computedStyle.display}`;

        const message = `[DEBUG] ${cmd} "${selectedSelector}"\nPath: ${path}\nSize: ${size}\nStyles: ${styles}`;

        // Send to Kitt - try multiple methods
        let sent = false;

        // Method 1: Direct AdminKitt.sendQuick
        if (typeof AdminKitt !== 'undefined' && typeof AdminKitt.sendQuick === 'function') {
            try {
                AdminKitt.sendQuick(message);
                sent = true;
            } catch (err) {
                console.error('AdminKitt.sendQuick failed:', err);
            }
        }

        // Method 2: Window global
        if (!sent && typeof window.AdminKitt !== 'undefined' && typeof window.AdminKitt.sendQuick === 'function') {
            try {
                window.AdminKitt.sendQuick(message);
                sent = true;
            } catch (err) {
                console.error('window.AdminKitt.sendQuick failed:', err);
            }
        }

        // Method 3: Direct input + send button click
        if (!sent) {
            const input = document.getElementById('message-input');
            const sendBtn = document.getElementById('btn-send');
            if (input && sendBtn) {
                input.value = message;
                sendBtn.click();
                sent = true;
            }
        }

        if (sent) {
            showToast(`🚀 Sent to Kitt: ${cmd}`);
        } else {
            // Final fallback: just put in input
            const input = document.getElementById('message-input');
            if (input) {
                input.value = message;
                input.focus();
            }
            showToast(`📋 Ready to send: ${cmd}`);
        }

        toggle(); // Exit debug mode
    }

    // Show edit prompt modal for edit commands
    function showEditPrompt(cmd) {
        return new Promise((resolve) => {
            // Remove existing prompt
            const existing = document.getElementById('edit-prompt-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'edit-prompt-modal';
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1a1a2e;
                border: 1px solid #4a9eff;
                border-radius: 12px;
                padding: 0;
                min-width: 400px;
                z-index: 100005;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
                font-family: system-ui, sans-serif;
            `;

            const cmdLabels = {
                'edit text': 'Enter new text',
                'edit html': 'Enter HTML content',
                'add content': 'Enter content to add',
                'auto update contents': 'Describe what to update'
            };

            const placeholder = {
                'edit text': 'e.g., "Welcome to Admin Panel"',
                'edit html': 'e.g., "<span>New content</span>"',
                'add content': 'e.g., "Add a status indicator"',
                'auto update contents': 'e.g., "Show live server status"'
            };

            modal.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #2a2a3e; border-radius: 12px 12px 0 0; border-bottom: 1px solid #333;">
                    <span style="font-weight: 600; color: #fff;">✏️ ${cmdLabels[cmd] || 'Edit Element'}</span>
                    <button id="edit-prompt-close" style="background: none; border: none; color: #888; cursor: pointer; font-size: 18px; padding: 0;">&times;</button>
                </div>
                <div style="padding: 16px;">
                    <div style="color: #888; font-size: 12px; margin-bottom: 8px;">
                        Element: <span style="color: #4a9eff;">${selectedSelector}</span>
                    </div>
                    <textarea id="edit-prompt-input" placeholder="${placeholder[cmd] || 'Enter text...'}" style="
                        width: 100%;
                        min-height: 80px;
                        background: #0f0f1a;
                        border: 1px solid #444;
                        border-radius: 6px;
                        color: #e0e0e0;
                        padding: 10px;
                        font-size: 13px;
                        resize: vertical;
                        box-sizing: border-box;
                    "></textarea>
                    <div style="color: #666; font-size: 11px; margin-top: 6px;">
                        Leave empty to use default action
                    </div>
                </div>
                <div style="padding: 12px 16px; border-top: 1px solid #333; display: flex; justify-content: flex-end; gap: 8px;">
                    <button id="edit-prompt-cancel" style="padding: 8px 16px; background: #2a2a3e; border: 1px solid #444; border-radius: 6px; color: #ccc; cursor: pointer; font-size: 13px;">Cancel</button>
                    <button id="edit-prompt-send" style="padding: 8px 16px; background: #4a9eff; border: none; border-radius: 6px; color: #fff; cursor: pointer; font-size: 13px;">Send to Kitt</button>
                </div>
            `;

            document.body.appendChild(modal);

            const input = document.getElementById('edit-prompt-input');
            const closeBtn = document.getElementById('edit-prompt-close');
            const cancelBtn = document.getElementById('edit-prompt-cancel');
            const sendBtn = document.getElementById('edit-prompt-send');

            // Focus input
            setTimeout(() => input.focus(), 50);

            // Handle close
            const close = (result) => {
                modal.remove();
                resolve(result);
            };

            closeBtn.onclick = () => close(null);
            cancelBtn.onclick = () => close(null);
            sendBtn.onclick = () => close(input.value);

            // Enter to send, Escape to cancel
            input.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    close(input.value);
                }
                if (e.key === 'Escape') {
                    close(null);
                }
            };

            // Click outside to cancel
            modal.onclick = (e) => {
                if (e.target === modal) close(null);
            };
        });
    }

    async function handleSnapshot(cmd) {
        try {
            if (cmd === 'snapshot-element') {
                await captureElement(selectedElement);
            } else if (cmd === 'snapshot-context') {
                await captureElement(selectedElement.parentElement || selectedElement);
            } else if (cmd === 'snapshot-page') {
                await captureFullPage();
            } else if (cmd === 'snapshot-clipboard') {
                await captureToClipboard(selectedElement);
            }
        } catch (err) {
            console.error('Snapshot error:', err);
            showToast('❌ Snapshot failed: ' + err.message);
        }
    }

    async function captureElement(element) {
        const rect = element.getBoundingClientRect();

        // Use html2canvas if available, otherwise use native
        if (typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(element, {
                backgroundColor: '#1a1a2e',
                scale: 2
            });
            downloadCanvas(canvas, `snapshot-${Date.now()}.png`);
            showToast('📸 Element captured!');
        } else {
            // Fallback: capture via screen capture API
            await captureViaScreen(rect);
        }
    }

    async function captureViaScreen(rect) {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' }
            });

            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            // Wait a frame for video to be ready
            await new Promise(r => requestAnimationFrame(r));

            const canvas = document.createElement('canvas');
            canvas.width = rect.width * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
            const ctx = canvas.getContext('2d');

            // Calculate the crop area
            const sx = rect.left * window.devicePixelRatio;
            const sy = rect.top * window.devicePixelRatio;

            ctx.drawImage(video, sx, sy, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

            stream.getTracks().forEach(track => track.stop());

            downloadCanvas(canvas, `snapshot-${Date.now()}.png`);
            showToast('📸 Snapshot saved!');
        } catch (err) {
            if (err.name !== 'NotAllowedError') {
                throw err;
            }
            showToast('📸 Cancelled');
        }
    }

    async function captureFullPage() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' }
            });

            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            await new Promise(r => requestAnimationFrame(r));

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            stream.getTracks().forEach(track => track.stop());

            downloadCanvas(canvas, `fullpage-${Date.now()}.png`);
            showToast('📸 Full page captured!');
        } catch (err) {
            if (err.name !== 'NotAllowedError') {
                throw err;
            }
        }
    }

    async function captureToClipboard(element) {
        const rect = element.getBoundingClientRect();

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: 'screen' }
            });

            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            await new Promise(r => requestAnimationFrame(r));

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            stream.getTracks().forEach(track => track.stop());

            canvas.toBlob(async blob => {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    showToast('📸 Copied to clipboard!');
                } catch (err) {
                    // Fallback: download instead
                    downloadCanvas(canvas, `snapshot-${Date.now()}.png`);
                    showToast('📸 Saved (clipboard not supported)');
                }
            }, 'image/png');
        } catch (err) {
            if (err.name !== 'NotAllowedError') {
                throw err;
            }
        }
    }

    function downloadCanvas(canvas, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    // ============================================
    // DIM (Data Interface Manager) Commands
    // ============================================

    async function handleDIMCommand(cmd) {
        const baseHost = location.hostname || 'localhost';
        const DIM_PORT = 8080;
        const DIM_URL = `http://${baseHost}:${DIM_PORT}`;

        try {
            switch (cmd) {
                case 'dim-check':
                    await checkDIMStatus(DIM_URL);
                    break;

                case 'dim-open':
                    window.open(DIM_URL, '_blank');
                    showToast('Opening SimWidget UI...');
                    break;

                case 'dim-restart':
                    await restartDIM();
                    break;

                case 'dim-simconnect':
                    await checkSimConnect(DIM_URL);
                    break;

                case 'dim-flightdata':
                    await viewFlightData(DIM_URL);
                    break;

                default:
                    showToast('Unknown DIM command: ' + cmd);
            }
        } catch (err) {
            console.error('DIM command error:', err);
            showToast('DIM Error: ' + err.message);
        }
    }

    async function checkDIMStatus(baseUrl) {
        showToast('Checking DIM status...');
        try {
            const res = await fetch(`${baseUrl}/api/health`, { timeout: 3000 });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            const status = data.simconnect ? 'SimConnect: Connected' : 'SimConnect: Disconnected';
            const vars = data.variables ? `${data.variables} vars` : '';

            showDIMStatusModal({
                title: 'DIM Status',
                status: 'online',
                items: [
                    { label: 'Server', value: 'Online', color: '#22c55e' },
                    { label: 'SimConnect', value: data.simconnect ? 'Connected' : 'Disconnected', color: data.simconnect ? '#22c55e' : '#ef4444' },
                    { label: 'Variables', value: vars || 'N/A' },
                    { label: 'Clients', value: data.clients || 0 },
                    { label: 'Uptime', value: formatUptime(data.uptime) }
                ]
            });
        } catch (err) {
            showDIMStatusModal({
                title: 'DIM Status',
                status: 'offline',
                items: [
                    { label: 'Server', value: 'Offline', color: '#ef4444' },
                    { label: 'Error', value: err.message }
                ]
            });
        }
    }

    async function restartDIM() {
        showToast('Restarting DIM service...');
        try {
            // Try via orchestrator API
            const res = await fetch('http://127.0.0.1:8500/api/services/simwidget/restart', {
                method: 'POST'
            });
            if (res.ok) {
                showToast('DIM restart initiated');
            } else {
                throw new Error('Restart failed');
            }
        } catch (err) {
            // Fallback: inform user
            showToast('Cannot restart remotely - use service manager');
        }
    }

    async function checkSimConnect(baseUrl) {
        showToast('Checking SimConnect...');
        try {
            const res = await fetch(`${baseUrl}/api/simconnect/status`);
            const data = await res.json();

            showDIMStatusModal({
                title: 'SimConnect Status',
                status: data.connected ? 'connected' : 'disconnected',
                items: [
                    { label: 'Status', value: data.connected ? 'Connected' : 'Disconnected', color: data.connected ? '#22c55e' : '#ef4444' },
                    { label: 'MSFS', value: data.msfsRunning ? 'Running' : 'Not Running', color: data.msfsRunning ? '#22c55e' : '#888' },
                    { label: 'Version', value: data.version || 'Unknown' },
                    { label: 'Last Event', value: data.lastEvent || 'None' }
                ]
            });
        } catch (err) {
            showDIMStatusModal({
                title: 'SimConnect Status',
                status: 'error',
                items: [
                    { label: 'Error', value: 'Cannot reach DIM server', color: '#ef4444' }
                ]
            });
        }
    }

    async function viewFlightData(baseUrl) {
        showToast('Fetching flight data...');
        try {
            const res = await fetch(`${baseUrl}/api/simvars`);
            const data = await res.json();

            // Format key flight variables
            const vars = data.variables || data;
            const items = [];

            // Common flight data points
            const keyVars = [
                { key: 'INDICATED ALTITUDE', label: 'Altitude', unit: 'ft' },
                { key: 'AIRSPEED INDICATED', label: 'Airspeed', unit: 'kts' },
                { key: 'HEADING INDICATOR', label: 'Heading', unit: '' },
                { key: 'VERTICAL SPEED', label: 'VS', unit: 'fpm' },
                { key: 'PLANE LATITUDE', label: 'Latitude', unit: '' },
                { key: 'PLANE LONGITUDE', label: 'Longitude', unit: '' },
                { key: 'AUTOPILOT MASTER', label: 'AP', unit: '' }
            ];

            keyVars.forEach(v => {
                const val = vars[v.key] || vars[`A:${v.key}`];
                if (val !== undefined) {
                    const displayVal = typeof val === 'number' ? val.toFixed(1) : val;
                    items.push({ label: v.label, value: `${displayVal} ${v.unit}`.trim() });
                }
            });

            if (items.length === 0) {
                items.push({ label: 'Status', value: 'No flight data available' });
            }

            showDIMStatusModal({
                title: 'Flight Data',
                status: items.length > 1 ? 'active' : 'inactive',
                items
            });
        } catch (err) {
            showDIMStatusModal({
                title: 'Flight Data',
                status: 'error',
                items: [
                    { label: 'Error', value: 'Cannot fetch flight data', color: '#ef4444' }
                ]
            });
        }
    }

    function setupDIMModalDrag(modal) {
        const handle = modal.querySelector('.dim-modal-header');
        if (!handle) return;

        let isDragging = false;
        let startX, startY, initialX, initialY;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            isDragging = true;
            const rect = modal.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialX = rect.left;
            initialY = rect.top;
            modal.style.transform = 'none';
            modal.style.left = initialX + 'px';
            modal.style.top = initialY + 'px';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newX = initialX + (e.clientX - startX);
            let newY = initialY + (e.clientY - startY);
            newX = Math.max(0, Math.min(window.innerWidth - 100, newX));
            newY = Math.max(0, Math.min(window.innerHeight - 50, newY));
            modal.style.left = newX + 'px';
            modal.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => { isDragging = false; });
    }

    function showDIMStatusModal(config) {
        // Remove existing modal
        const existing = document.getElementById('dim-status-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'dim-status-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a2e;
            border: 1px solid #4a9eff;
            border-radius: 12px;
            padding: 0;
            min-width: 280px;
            z-index: 100003;
            box-shadow: 0 8px 32px rgba(0,0,0,0.6);
            font-family: system-ui, sans-serif;
        `;

        const statusColor = {
            online: '#22c55e',
            offline: '#ef4444',
            connected: '#22c55e',
            disconnected: '#f59e0b',
            active: '#22c55e',
            inactive: '#888',
            error: '#ef4444'
        }[config.status] || '#4a9eff';

        modal.innerHTML = `
            <div class="dim-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #2a2a3e; border-radius: 12px 12px 0 0; border-bottom: 1px solid #333; cursor: move; user-select: none;">
                <span style="font-weight: 600; color: #fff;">${config.title}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></span>
                    <button onclick="this.closest('#dim-status-modal').remove()" style="background: none; border: none; color: #888; cursor: pointer; font-size: 18px; padding: 0;">&times;</button>
                </div>
            </div>
            <div style="padding: 16px;">
                ${config.items.map(item => `
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333;">
                        <span style="color: #888;">${item.label}</span>
                        <span style="color: ${item.color || '#e0e0e0'}; font-weight: 500;">${item.value}</span>
                    </div>
                `).join('')}
            </div>
            <div style="padding: 12px 16px; border-top: 1px solid #333; display: flex; justify-content: flex-end;">
                <button onclick="this.closest('#dim-status-modal').remove()" style="padding: 6px 16px; background: #4a9eff; border: none; border-radius: 6px; color: #fff; cursor: pointer; font-size: 13px;">Close</button>
            </div>
        `;

        document.body.appendChild(modal);
        setupDIMModalDrag(modal);

        // Auto-close after 10 seconds
        setTimeout(() => {
            if (document.getElementById('dim-status-modal')) {
                modal.remove();
            }
        }, 10000);

        // Close on click outside
        const clickHandler = (e) => {
            if (!modal.contains(e.target)) {
                modal.remove();
                document.removeEventListener('click', clickHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', clickHandler), 100);
    }

    function formatUptime(seconds) {
        if (!seconds) return 'N/A';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    function showToast(msg) {
        let toast = document.getElementById('debug-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'debug-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: #22c55e;
                color: #fff;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 13px;
                z-index: 100002;
                transition: opacity 0.3s;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.style.display = 'none', 300);
        }, 2000);
    }

    function showBadge() {
        let badge = document.getElementById('debug-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'debug-badge';
            badge.style.cssText = `
                position: fixed;
                top: 8px;
                right: 8px;
                background: #ff0;
                color: #000;
                font-weight: bold;
                font-size: 11px;
                padding: 4px 8px;
                border-radius: 4px;
                z-index: 100001;
                cursor: pointer;
            `;
            badge.textContent = '🔍 DEBUG (Ctrl+Alt+Shift+D)';
            badge.onclick = toggle;
            document.body.appendChild(badge);
        }
        badge.style.display = 'block';
    }

    function hideBadge() {
        const badge = document.getElementById('debug-badge');
        if (badge) badge.style.display = 'none';
    }

    function onMouseMove(e) {
        if (!active || menu.style.display === 'block') return;

        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || el.id?.startsWith('debug-') || el.closest('#debug-menu') || el.closest('#debug-submenu')) return;
        if (el === lastElement) return;

        lastElement = el;
        const rect = el.getBoundingClientRect();

        overlay.style.display = 'block';
        overlay.style.top = rect.top + 'px';
        overlay.style.left = rect.left + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';

        const selector = getSelector(el);
        const path = getPath(el);
        const size = `${Math.round(rect.width)}×${Math.round(rect.height)}`;

        tooltip.innerHTML = `
            <div style="color:#ff0;margin-bottom:4px">${selector}</div>
            <div style="color:#888;font-size:10px">${path}</div>
            <div style="color:#666;font-size:10px;margin-top:4px">${size} • click for options</div>
        `;
        tooltip.style.display = 'block';

        let tx = e.clientX + 15;
        let ty = e.clientY + 15;
        if (tx + 300 > window.innerWidth) tx = e.clientX - 320;
        if (ty + 80 > window.innerHeight) ty = e.clientY - 90;
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
    }

    function onClick(e) {
        if (!active) return;

        // Click outside menu closes it
        if (menu.style.display === 'block' && !e.target.closest('#debug-menu') && !e.target.closest('#debug-submenu')) {
            hideMenu();
            return;
        }

        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || el.id?.startsWith('debug-') || el.closest('#debug-menu') || el.closest('#debug-submenu')) return;

        e.preventDefault();
        e.stopPropagation();

        selectedElement = el;
        selectedSelector = getSelector(el);

        tooltip.style.display = 'none';
        showMenu(e.clientX, e.clientY);

        console.log('🔍 Selected:', { selector: selectedSelector, element: el });
    }

    function onKeyDown(e) {
        if (e.key === 'Escape' && active) {
            if (submenu.style.display === 'block') {
                hideSubmenu();
            } else if (menu.style.display === 'block') {
                hideMenu();
            } else {
                toggle();
            }
        }
    }

    function toggle() {
        active = !active;

        if (active) {
            if (!overlay) createOverlay();
            showBadge();
            document.body.style.cursor = 'crosshair';
            console.log('🔍 Debug Inspector ON - click elements for quick commands');
        } else {
            hideBadge();
            hideMenu();
            if (overlay) overlay.style.display = 'none';
            if (tooltip) tooltip.style.display = 'none';
            document.body.style.cursor = '';
            lastElement = null;
            selectedElement = null;
            selectedSelector = '';
            console.log('🔍 Debug Inspector OFF');
        }

        // Sync quick action button state
        const btn = document.querySelector('.qa-btn[data-cmd="inspect"]');
        if (btn) btn.classList.toggle('active', active);
    }

    // ============================================
    // DEBUG INFO PANEL (Ctrl+Shift+D)
    // ============================================

    function toggleDebugPanel() {
        if (!debugPanel) createDebugPanel();
        debugPanelVisible = !debugPanelVisible;
        debugPanel.style.display = debugPanelVisible ? 'block' : 'none';
        if (debugPanelVisible) updateDebugPanel();
    }

    function createDebugPanel() {
        debugPanel = document.createElement('div');
        debugPanel.id = 'debug-info-panel';
        debugPanel.innerHTML = `
            <div class="dip-header">
                <span>Debug Info</span>
                <div class="dip-controls">
                    <button onclick="DebugInspector.toggle()" title="Element Inspector">🔍</button>
                    <button onclick="this.closest('#debug-info-panel').style.display='none'">×</button>
                </div>
            </div>
            <div class="dip-content" id="dip-content"></div>
            <div class="dip-actions">
                <button onclick="location.reload()">Reload</button>
                <button onclick="localStorage.clear(); location.reload()">Clear Storage</button>
                <button onclick="DebugInspector.checkKitt()">Kitt Status</button>
                <button onclick="DebugInspector.resetKitt()">Reset Kitt</button>
            </div>
        `;
        document.body.appendChild(debugPanel);
        addDebugPanelStyles();
    }

    function addDebugPanelStyles() {
        if (document.getElementById('debug-panel-styles')) return;
        const style = document.createElement('style');
        style.id = 'debug-panel-styles';
        style.textContent = `
            #debug-info-panel {
                position: fixed;
                bottom: 20px;
                left: 20px;
                width: 300px;
                background: #1a1a2e;
                border: 1px solid #333;
                border-radius: 8px;
                font-family: monospace;
                font-size: 11px;
                color: #e0e0e0;
                z-index: 99998;
                display: none;
            }
            #debug-info-panel .dip-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: #2a2a3e;
                border-radius: 8px 8px 0 0;
                font-weight: bold;
                color: #f59e0b;
            }
            #debug-info-panel .dip-controls {
                display: flex;
                gap: 4px;
            }
            #debug-info-panel .dip-controls button {
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                font-size: 14px;
                padding: 2px 6px;
            }
            #debug-info-panel .dip-controls button:hover {
                color: #fff;
            }
            #debug-info-panel .dip-content {
                padding: 12px;
                max-height: 250px;
                overflow-y: auto;
            }
            #debug-info-panel .dip-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                border-bottom: 1px solid #333;
            }
            #debug-info-panel .dip-row:last-child {
                border-bottom: none;
            }
            #debug-info-panel .dip-label { color: #888; }
            #debug-info-panel .dip-value { color: #4a9eff; }
            #debug-info-panel .dip-section {
                color: #22c55e;
                font-weight: bold;
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid #444;
            }
            #debug-info-panel .dip-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 6px;
                padding: 8px 12px;
                border-top: 1px solid #333;
            }
            #debug-info-panel .dip-actions button {
                padding: 6px;
                background: #2a2a3e;
                border: 1px solid #444;
                border-radius: 4px;
                color: #ccc;
                cursor: pointer;
                font-size: 10px;
            }
            #debug-info-panel .dip-actions button:hover {
                background: #3a3a4e;
                color: #fff;
            }
        `;
        document.head.appendChild(style);
    }

    function updateDebugPanel() {
        const content = document.getElementById('dip-content');
        if (!content) return;

        // Gather page info
        const pageInfo = [
            ['Page', document.title || 'Untitled'],
            ['URL', location.pathname],
            ['Viewport', `${window.innerWidth}×${window.innerHeight}`],
            ['Scroll', `${window.scrollX}, ${window.scrollY}`]
        ];

        // Storage info
        const storageInfo = [
            ['localStorage', Object.keys(localStorage).length + ' keys'],
            ['sessionStorage', Object.keys(sessionStorage).length + ' keys'],
            ['Cookies', document.cookie ? document.cookie.split(';').length + ' cookies' : 'None']
        ];

        // DOM info
        const domInfo = [
            ['Elements', document.querySelectorAll('*').length],
            ['Scripts', document.scripts.length],
            ['Stylesheets', document.styleSheets.length],
            ['Images', document.images.length],
            ['Forms', document.forms.length],
            ['Links', document.links.length]
        ];

        // Performance info
        let perfInfo = [];
        if (performance.timing) {
            const timing = performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
            perfInfo = [
                ['Load Time', loadTime > 0 ? loadTime + 'ms' : 'N/A'],
                ['DOM Ready', domReady > 0 ? domReady + 'ms' : 'N/A']
            ];
        }

        // Build HTML
        let html = '';

        html += '<div class="dip-section">Page</div>';
        html += pageInfo.map(([l, v]) => `<div class="dip-row"><span class="dip-label">${l}</span><span class="dip-value">${v}</span></div>`).join('');

        html += '<div class="dip-section">Storage</div>';
        html += storageInfo.map(([l, v]) => `<div class="dip-row"><span class="dip-label">${l}</span><span class="dip-value">${v}</span></div>`).join('');

        html += '<div class="dip-section">DOM</div>';
        html += domInfo.map(([l, v]) => `<div class="dip-row"><span class="dip-label">${l}</span><span class="dip-value">${v}</span></div>`).join('');

        if (perfInfo.length) {
            html += '<div class="dip-section">Performance</div>';
            html += perfInfo.map(([l, v]) => `<div class="dip-row"><span class="dip-label">${l}</span><span class="dip-value">${v}</span></div>`).join('');
        }

        content.innerHTML = html;
    }

    async function checkKitt() {
        try {
            const res = await fetch('http://127.0.0.1:8585/api/kitt/status');
            const status = await res.json();
            const msg = status.busy
                ? `Kitt: Busy - ${status.task}\nUptime: ${Math.round(status.uptime)}s`
                : `Kitt: Available\nUptime: ${Math.round(status.uptime)}s`;
            alert(msg);
        } catch (e) {
            alert('Kitt not reachable');
        }
    }

    async function resetKitt() {
        try {
            await fetch('http://127.0.0.1:8585/api/kitt/reset', { method: 'POST' });
            alert('Kitt reset successfully');
        } catch (e) {
            alert('Reset failed: ' + e.message);
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        // Element inspector: Ctrl+Alt+Shift+D
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
                e.preventDefault();
                toggle();
            }
        });

        // Debug info panel: Ctrl+Shift+D (no Alt)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'D' || e.key === 'd')) {
                e.preventDefault();
                toggleDebugPanel();
            }
        });

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('click', onClick, true);

        // Initialize quick actions bar
        initQuickActions();

        console.log('🔍 Debug Inspector v2.3 ready');
        console.log('   Ctrl+Alt+Shift+D - Element inspector');
        console.log('   Ctrl+Shift+D - Debug info panel');
        console.log('   Quick Actions bar in header');
    }

    // Quick Actions Bar functionality
    function initQuickActions() {
        const qaBar = document.getElementById('quick-actions');
        if (!qaBar) return;

        qaBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.qa-btn');
            if (!btn) return;

            const cmd = btn.dataset.cmd;
            if (!cmd) return;

            // Special case: inspect button toggles debug inspector
            if (cmd === 'inspect') {
                toggle();
                btn.classList.toggle('active', active);
                return;
            }

            // If debug inspector is active and element is selected, send command
            if (selectedElement && selectedSelector) {
                sendQuickCommand(cmd);
            } else {
                // No element selected - activate inspector first
                if (!active) {
                    toggle();
                    showToast('🔍 Select an element first');
                } else {
                    showToast('⚠ Click an element to select it');
                }
            }
        });
    }

    function sendQuickCommand(cmd) {
        const path = getPath(selectedElement);
        const rect = selectedElement.getBoundingClientRect();
        const size = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
        const computedStyle = window.getComputedStyle(selectedElement);
        const styles = `color:${computedStyle.color}, bg:${computedStyle.backgroundColor}, display:${computedStyle.display}`;

        const message = `[DEBUG] ${cmd} "${selectedSelector}"\nPath: ${path}\nSize: ${size}\nStyles: ${styles}`;

        // Send to Kitt
        let sent = false;
        if (typeof AdminKitt !== 'undefined' && typeof AdminKitt.sendQuick === 'function') {
            try {
                AdminKitt.sendQuick(message);
                sent = true;
            } catch (err) {
                console.error('AdminKitt.sendQuick failed:', err);
            }
        }

        if (!sent) {
            const input = document.getElementById('message-input');
            if (input) {
                input.value = message;
                input.focus();
            }
        }

        showToast(`🚀 Sent: ${cmd}`);
        toggle(); // Exit debug mode after sending
    }

    // Update inspect button state when toggling
    function updateInspectButton() {
        const btn = document.querySelector('.qa-btn[data-cmd="inspect"]');
        if (btn) btn.classList.toggle('active', active);
    }

    return {
        init,
        toggle,
        toggleDebugPanel,
        checkKitt,
        resetKitt,
        sendQuickCommand
    };
})();

document.addEventListener('DOMContentLoaded', DebugInspector.init);
