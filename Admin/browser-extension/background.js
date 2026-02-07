/**
 * Kitt Browser Bridge v2.0.0 - Background Service Worker
 * BrowserMCP-compatible browser automation
 * Connects to local relay server and executes browser commands
 */

const BRIDGE_URL = 'ws://localhost:8620';
let ws = null;
let reconnectTimer = null;
let keepaliveTimer = null;
let isConnected = false;

// ============================================
// AGGRESSIVE KEEPALIVE (MV3 service worker fix)
// ============================================

// Use chrome.alarms for persistent wakeups (survives SW termination)
chrome.alarms.create('keepalive', { periodInMinutes: 0.25 }); // Every 15 seconds

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'keepalive') {
        console.log('[Kitt Bridge] Alarm keepalive tick');
        // Touch storage to keep SW alive
        chrome.storage.local.set({ lastKeepalive: Date.now() });
        // Ensure connection
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            connect();
        }
    }
});

// Keepalive - send ping every 10 seconds to prevent service worker sleep
function startKeepalive() {
    stopKeepalive();
    keepaliveTimer = setInterval(() => {
        // Touch storage to signal activity
        chrome.storage.local.set({ lastPing: Date.now() });

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
            console.log('[Kitt Bridge] Keepalive ping');
        } else {
            console.log('[Kitt Bridge] Keepalive - reconnecting...');
            connect();
        }
    }, 10000); // Every 10 seconds
}

function stopKeepalive() {
    if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
    }
}

// Self-wake: listen to storage changes to keep SW alive
chrome.storage.onChanged.addListener(() => {
    // Any storage change keeps the service worker active
});

// Connect to bridge server
function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    try {
        ws = new WebSocket(BRIDGE_URL);

        ws.onopen = () => {
            console.log('[Kitt Bridge] Connected to server');
            isConnected = true;
            clearTimeout(reconnectTimer);

            // Start keepalive to prevent service worker termination
            startKeepalive();

            // Announce connection (with small delay to ensure OPEN state)
            setTimeout(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'connect',
                        agent: 'kitt-browser-bridge',
                        version: '1.0.0'
                    }));
                }
            }, 50);
        };

        ws.onmessage = async (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.log('[Kitt Bridge] Received:', msg.action);

                const result = await handleCommand(msg);

                ws.send(JSON.stringify({
                    type: 'response',
                    id: msg.id,
                    success: true,
                    data: result
                }));
            } catch (err) {
                console.error('[Kitt Bridge] Error:', err);
                ws.send(JSON.stringify({
                    type: 'response',
                    id: msg?.id,
                    success: false,
                    error: err.message
                }));
            }
        };

        ws.onclose = () => {
            console.log('[Kitt Bridge] Disconnected');
            isConnected = false;
            stopKeepalive();
            scheduleReconnect();
        };

        ws.onerror = (err) => {
            console.error('[Kitt Bridge] WebSocket error:', err);
            isConnected = false;
        };

    } catch (err) {
        console.error('[Kitt Bridge] Connection failed:', err);
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 3000);
}

// Handle incoming commands
async function handleCommand(msg) {
    const { action, params } = msg;

    switch (action) {
        case 'ping':
            return { pong: true, timestamp: Date.now() };

        case 'getTabs':
            return await chrome.tabs.query({});

        case 'getActiveTab':
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            return tab;

        case 'navigate':
            return await navigateTab(params.tabId, params.url);

        case 'goBack':
            return await goBack(params.tabId);

        case 'goForward':
            return await goForward(params.tabId);

        case 'newTab':
            return await chrome.tabs.create({ url: params.url || 'about:blank' });

        case 'closeTab':
            await chrome.tabs.remove(params.tabId);
            return { closed: true };

        case 'executeScript':
            return await executeInTab(params.tabId, params.code);

        case 'click':
            return await clickInTab(params.tabId, params.selector, params.x, params.y);

        case 'type':
            return await typeInTab(params.tabId, params.selector, params.text, params.submit);

        case 'hover':
            return await hoverInTab(params.tabId, params.selector, params.x, params.y);

        case 'dragDrop':
            return await dragDropInTab(params.tabId, params.from, params.to);

        case 'pressKey':
            return await pressKeyInTab(params.tabId, params.key);

        case 'selectOption':
            return await selectOptionInTab(params.tabId, params.selector, params.values);

        case 'snapshot':
            return await getAccessibilitySnapshot(params.tabId);

        case 'getConsoleLogs':
            return await getConsoleLogs(params.tabId);

        case 'readPage':
            return await readPageContent(params.tabId, params.selector);

        case 'screenshot':
            return await captureTab(params.tabId);

        case 'setInputValue':
            return await setInputValue(params.tabId, params.selector, params.value);

        case 'focusTab':
            await chrome.tabs.update(params.tabId, { active: true });
            await chrome.windows.update((await chrome.tabs.get(params.tabId)).windowId, { focused: true });
            return { focused: true, tabId: params.tabId };

        case 'createGroup':
            return await createTabGroup(params.tabIds, params.title, params.color);

        case 'addToGroup':
            return await addTabsToGroup(params.groupId, params.tabIds);

        case 'openUrlsInGroup':
            return await openUrlsInGroup(params.urls, params.title, params.color);

        case 'listGroups':
            return await listTabGroups();

        case 'ungroupTabs':
            return await ungroupTabs(params.tabIds);

        case 'collapseGroup':
            return await collapseGroup(params.groupId, params.collapsed);

        default:
            throw new Error(`Unknown action: ${action}`);
    }
}

// Navigate a tab to URL
async function navigateTab(tabId, url) {
    if (tabId) {
        await chrome.tabs.update(tabId, { url });
        return { navigated: true, tabId, url };
    } else {
        const tab = await chrome.tabs.create({ url });
        return { navigated: true, tabId: tab.id, url };
    }
}

// Go back in browser history
async function goBack(tabId) {
    const targetTabId = tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (!targetTabId) throw new Error('No tab to go back');
    await chrome.tabs.goBack(targetTabId);
    return { back: true, tabId: targetTabId };
}

// Go forward in browser history
async function goForward(tabId) {
    const targetTabId = tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (!targetTabId) throw new Error('No tab to go forward');
    await chrome.tabs.goForward(targetTabId);
    return { forward: true, tabId: targetTabId };
}

// Execute script in tab
async function executeInTab(tabId, code) {
    // Wrap code to return result if not already returning
    const wrappedCode = code.trim().startsWith('return ') ? code : `return (${code})`;
    const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: new Function(wrappedCode),
        world: 'MAIN'
    });
    return results[0]?.result;
}

// Click element in tab
async function clickInTab(tabId, selector, x, y) {
    if (selector) {
        return await chrome.scripting.executeScript({
            target: { tabId },
            func: (sel) => {
                const el = document.querySelector(sel);
                if (el) {
                    el.click();
                    return { clicked: true, selector: sel };
                }
                return { clicked: false, error: 'Element not found' };
            },
            args: [selector]
        }).then(r => r[0]?.result);
    } else if (x !== undefined && y !== undefined) {
        return await chrome.scripting.executeScript({
            target: { tabId },
            func: (px, py) => {
                const el = document.elementFromPoint(px, py);
                if (el) {
                    el.click();
                    return { clicked: true, x: px, y: py, element: el.tagName };
                }
                return { clicked: false, error: 'No element at coordinates' };
            },
            args: [x, y]
        }).then(r => r[0]?.result);
    }
    throw new Error('Must provide selector or x,y coordinates');
}

// Type text in tab (with optional submit/Enter)
async function typeInTab(tabId, selector, text, submit = false) {
    return await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel, txt, shouldSubmit) => {
            const el = sel ? document.querySelector(sel) : document.activeElement;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
                el.focus();

                // For contenteditable (like Google Docs)
                if (el.isContentEditable) {
                    document.execCommand('insertText', false, txt);
                } else {
                    el.value = txt;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }

                // Submit if requested (press Enter)
                if (shouldSubmit) {
                    const enterEvent = new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true
                    });
                    el.dispatchEvent(enterEvent);

                    // Also try form submit
                    const form = el.closest('form');
                    if (form) form.submit();
                }

                return { typed: true, selector: sel, submitted: shouldSubmit };
            }
            return { typed: false, error: 'No editable element found' };
        },
        args: [selector, text, submit]
    }).then(r => r[0]?.result);
}

// Hover over element in tab
async function hoverInTab(tabId, selector, x, y) {
    return await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel, px, py) => {
            let el;
            if (sel) {
                el = document.querySelector(sel);
            } else if (px !== undefined && py !== undefined) {
                el = document.elementFromPoint(px, py);
            }

            if (el) {
                const rect = el.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                // Dispatch mouse events
                el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: centerX, clientY: centerY }));
                el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: centerX, clientY: centerY }));
                el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: centerX, clientY: centerY }));

                return { hovered: true, selector: sel, element: el.tagName };
            }
            return { hovered: false, error: 'Element not found' };
        },
        args: [selector, x, y]
    }).then(r => r[0]?.result);
}

// Drag and drop in tab
async function dragDropInTab(tabId, from, to) {
    return await chrome.scripting.executeScript({
        target: { tabId },
        func: (fromSel, toSel) => {
            const fromEl = document.querySelector(fromSel);
            const toEl = document.querySelector(toSel);

            if (!fromEl) return { dragged: false, error: 'Source element not found' };
            if (!toEl) return { dragged: false, error: 'Target element not found' };

            const fromRect = fromEl.getBoundingClientRect();
            const toRect = toEl.getBoundingClientRect();

            const dataTransfer = new DataTransfer();

            // Drag start
            fromEl.dispatchEvent(new DragEvent('dragstart', {
                bubbles: true,
                dataTransfer,
                clientX: fromRect.left + fromRect.width / 2,
                clientY: fromRect.top + fromRect.height / 2
            }));

            // Drag over target
            toEl.dispatchEvent(new DragEvent('dragover', {
                bubbles: true,
                dataTransfer,
                clientX: toRect.left + toRect.width / 2,
                clientY: toRect.top + toRect.height / 2
            }));

            // Drop
            toEl.dispatchEvent(new DragEvent('drop', {
                bubbles: true,
                dataTransfer,
                clientX: toRect.left + toRect.width / 2,
                clientY: toRect.top + toRect.height / 2
            }));

            // Drag end
            fromEl.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));

            return { dragged: true, from: fromSel, to: toSel };
        },
        args: [from, to]
    }).then(r => r[0]?.result);
}

// Press keyboard key in tab
async function pressKeyInTab(tabId, key) {
    return await chrome.scripting.executeScript({
        target: { tabId },
        func: (keyName) => {
            const el = document.activeElement || document.body;

            // Map special keys
            const keyMap = {
                'Enter': { key: 'Enter', code: 'Enter', keyCode: 13 },
                'Tab': { key: 'Tab', code: 'Tab', keyCode: 9 },
                'Escape': { key: 'Escape', code: 'Escape', keyCode: 27 },
                'Backspace': { key: 'Backspace', code: 'Backspace', keyCode: 8 },
                'Delete': { key: 'Delete', code: 'Delete', keyCode: 46 },
                'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
                'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
                'ArrowLeft': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
                'ArrowRight': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
                'Home': { key: 'Home', code: 'Home', keyCode: 36 },
                'End': { key: 'End', code: 'End', keyCode: 35 },
                'PageUp': { key: 'PageUp', code: 'PageUp', keyCode: 33 },
                'PageDown': { key: 'PageDown', code: 'PageDown', keyCode: 34 },
                'Space': { key: ' ', code: 'Space', keyCode: 32 },
            };

            const keyInfo = keyMap[keyName] || {
                key: keyName,
                code: keyName.length === 1 ? `Key${keyName.toUpperCase()}` : keyName,
                keyCode: keyName.charCodeAt(0)
            };

            const eventInit = {
                key: keyInfo.key,
                code: keyInfo.code,
                keyCode: keyInfo.keyCode,
                which: keyInfo.keyCode,
                bubbles: true,
                cancelable: true
            };

            el.dispatchEvent(new KeyboardEvent('keydown', eventInit));
            el.dispatchEvent(new KeyboardEvent('keypress', eventInit));
            el.dispatchEvent(new KeyboardEvent('keyup', eventInit));

            return { pressed: true, key: keyName };
        },
        args: [key]
    }).then(r => r[0]?.result);
}

// Select option in dropdown
async function selectOptionInTab(tabId, selector, values) {
    return await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel, vals) => {
            const select = document.querySelector(sel);
            if (!select || select.tagName !== 'SELECT') {
                return { selected: false, error: 'Select element not found' };
            }

            // Clear previous selections for multi-select
            if (select.multiple) {
                Array.from(select.options).forEach(opt => opt.selected = false);
            }

            // Select the values
            const selectedValues = [];
            Array.from(select.options).forEach(option => {
                if (vals.includes(option.value) || vals.includes(option.text)) {
                    option.selected = true;
                    selectedValues.push(option.value);
                }
            });

            // Dispatch change event
            select.dispatchEvent(new Event('change', { bubbles: true }));

            return { selected: true, selector: sel, values: selectedValues };
        },
        args: [selector, values]
    }).then(r => r[0]?.result);
}

// Get accessibility snapshot of page
async function getAccessibilitySnapshot(tabId) {
    const targetTabId = tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (!targetTabId) throw new Error('No tab for snapshot');

    return await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: () => {
            function getAccessibleName(el) {
                return el.getAttribute('aria-label') ||
                       el.getAttribute('alt') ||
                       el.getAttribute('title') ||
                       el.getAttribute('placeholder') ||
                       (el.labels && el.labels[0]?.textContent) ||
                       el.textContent?.trim().substring(0, 100) ||
                       '';
            }

            function getRole(el) {
                const explicit = el.getAttribute('role');
                if (explicit) return explicit;

                const tagRoles = {
                    'A': 'link',
                    'BUTTON': 'button',
                    'INPUT': el.type === 'checkbox' ? 'checkbox' :
                             el.type === 'radio' ? 'radio' :
                             el.type === 'submit' ? 'button' : 'textbox',
                    'SELECT': 'combobox',
                    'TEXTAREA': 'textbox',
                    'IMG': 'img',
                    'H1': 'heading',
                    'H2': 'heading',
                    'H3': 'heading',
                    'H4': 'heading',
                    'H5': 'heading',
                    'H6': 'heading',
                    'NAV': 'navigation',
                    'MAIN': 'main',
                    'HEADER': 'banner',
                    'FOOTER': 'contentinfo',
                    'ASIDE': 'complementary',
                    'FORM': 'form',
                    'TABLE': 'table',
                    'UL': 'list',
                    'OL': 'list',
                    'LI': 'listitem',
                };
                return tagRoles[el.tagName] || 'generic';
            }

            function buildTree(el, depth = 0, refCounter = { count: 0 }) {
                if (depth > 10 || !el || el.nodeType !== 1) return null;

                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') return null;

                const role = getRole(el);
                const name = getAccessibleName(el);
                const ref = `e${refCounter.count++}`;

                const node = {
                    ref,
                    role,
                    name: name || undefined
                };

                // Add state info
                if (el.disabled) node.disabled = true;
                if (el.checked) node.checked = true;
                if (el.getAttribute('aria-expanded')) node.expanded = el.getAttribute('aria-expanded') === 'true';
                if (el.getAttribute('aria-selected')) node.selected = el.getAttribute('aria-selected') === 'true';
                if (el.value && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                    node.value = el.value.substring(0, 100);
                }

                // Build children
                const children = [];
                for (const child of el.children) {
                    const childNode = buildTree(child, depth + 1, refCounter);
                    if (childNode) children.push(childNode);
                }

                if (children.length > 0) {
                    node.children = children;
                }

                return node;
            }

            return {
                url: location.href,
                title: document.title,
                snapshot: buildTree(document.body)
            };
        }
    }).then(r => r[0]?.result);
}

// Console log storage (per tab)
const consoleLogs = new Map();

// Get console logs for a tab
async function getConsoleLogs(tabId) {
    const targetTabId = tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (!targetTabId) throw new Error('No tab for console logs');

    // Inject console capture if not already done
    await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: () => {
            if (window.__kittConsoleCapture) return;
            window.__kittConsoleCapture = true;
            window.__kittConsoleLogs = window.__kittConsoleLogs || [];

            const methods = ['log', 'warn', 'error', 'info', 'debug'];
            methods.forEach(method => {
                const original = console[method];
                console[method] = function(...args) {
                    window.__kittConsoleLogs.push({
                        type: method,
                        timestamp: Date.now(),
                        message: args.map(a => {
                            try {
                                return typeof a === 'object' ? JSON.stringify(a) : String(a);
                            } catch {
                                return String(a);
                            }
                        }).join(' ')
                    });
                    // Keep only last 100 logs
                    if (window.__kittConsoleLogs.length > 100) {
                        window.__kittConsoleLogs.shift();
                    }
                    original.apply(console, args);
                };
            });
        },
        world: 'MAIN'
    });

    // Retrieve logs
    const result = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: () => {
            const logs = window.__kittConsoleLogs || [];
            window.__kittConsoleLogs = []; // Clear after reading
            return logs;
        },
        world: 'MAIN'
    });

    return { logs: result[0]?.result || [] };
}

// Set input value
async function setInputValue(tabId, selector, value) {
    return await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel, val) => {
            const el = document.querySelector(sel);
            if (el) {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return { set: true, selector: sel };
            }
            return { set: false, error: 'Element not found' };
        },
        args: [selector, value]
    }).then(r => r[0]?.result);
}

// Read page content
async function readPageContent(tabId, selector) {
    return await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel) => {
            if (sel) {
                const el = document.querySelector(sel);
                return el ? { text: el.textContent, html: el.innerHTML } : null;
            }

            // Return page structure
            const getStructure = (el, depth = 0) => {
                if (depth > 5) return null;
                const children = [];
                for (const child of el.children) {
                    if (child.tagName) {
                        children.push({
                            tag: child.tagName.toLowerCase(),
                            id: child.id || undefined,
                            class: child.className || undefined,
                            text: child.textContent?.substring(0, 100),
                            children: getStructure(child, depth + 1)
                        });
                    }
                }
                return children.length ? children : undefined;
            };

            return {
                title: document.title,
                url: window.location.href,
                structure: getStructure(document.body)
            };
        },
        args: [selector]
    }).then(r => r[0]?.result);
}

// ============================================
// TAB GROUPING FUNCTIONS
// ============================================

// Create a tab group from existing tabs
async function createTabGroup(tabIds, title, color) {
    if (!tabIds || tabIds.length === 0) {
        throw new Error('No tab IDs provided');
    }

    const groupId = await chrome.tabs.group({ tabIds });

    const updateProps = {};
    if (title) updateProps.title = title;
    if (color) updateProps.color = color; // blue, cyan, grey, green, orange, pink, purple, red, yellow

    if (Object.keys(updateProps).length > 0) {
        await chrome.tabGroups.update(groupId, updateProps);
    }

    return { groupId, tabIds, title, color };
}

// Add tabs to an existing group
async function addTabsToGroup(groupId, tabIds) {
    if (!tabIds || tabIds.length === 0) {
        throw new Error('No tab IDs provided');
    }

    await chrome.tabs.group({ groupId, tabIds });
    return { groupId, addedTabs: tabIds };
}

// Open multiple URLs and group them together
async function openUrlsInGroup(urls, title, color) {
    if (!urls || urls.length === 0) {
        throw new Error('No URLs provided');
    }

    // Open all tabs
    const tabs = await Promise.all(
        urls.map(url => chrome.tabs.create({ url, active: false }))
    );
    const tabIds = tabs.map(t => t.id);

    // Group them
    const groupId = await chrome.tabs.group({ tabIds });

    // Set group properties
    const updateProps = {};
    if (title) updateProps.title = title;
    if (color) updateProps.color = color;

    if (Object.keys(updateProps).length > 0) {
        await chrome.tabGroups.update(groupId, updateProps);
    }

    // Focus first tab
    if (tabs[0]) {
        await chrome.tabs.update(tabs[0].id, { active: true });
    }

    return { groupId, tabIds, title, color, urls };
}

// List all tab groups
async function listTabGroups() {
    const groups = await chrome.tabGroups.query({});
    const result = [];

    for (const group of groups) {
        const tabs = await chrome.tabs.query({ groupId: group.id });
        result.push({
            id: group.id,
            title: group.title,
            color: group.color,
            collapsed: group.collapsed,
            windowId: group.windowId,
            tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url }))
        });
    }

    return result;
}

// Remove tabs from their group
async function ungroupTabs(tabIds) {
    if (!tabIds || tabIds.length === 0) {
        throw new Error('No tab IDs provided');
    }

    await chrome.tabs.ungroup(tabIds);
    return { ungrouped: tabIds };
}

// Collapse/expand a tab group
async function collapseGroup(groupId, collapsed = true) {
    await chrome.tabGroups.update(groupId, { collapsed });
    return { groupId, collapsed };
}

// Capture tab screenshot
async function captureTab(tabId) {
    // Focus the tab first if specified
    if (tabId) {
        const tab = await chrome.tabs.get(tabId);
        await chrome.windows.update(tab.windowId, { focused: true });
        await chrome.tabs.update(tabId, { active: true });
        // Small delay for tab to become visible
        await new Promise(r => setTimeout(r, 100));
    }
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    return { screenshot: dataUrl };
}

// Initialize
connect();

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'status') {
        sendResponse({ connected: isConnected });
    }
    return true;
});

// Reconnect on startup
chrome.runtime.onStartup.addListener(connect);
chrome.runtime.onInstalled.addListener(connect);
