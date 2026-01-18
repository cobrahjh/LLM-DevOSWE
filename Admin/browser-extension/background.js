/**
 * Kitt Browser Bridge - Background Service Worker
 * Connects to local relay server and executes browser commands
 */

const BRIDGE_URL = 'ws://localhost:8620';
let ws = null;
let reconnectTimer = null;
let keepaliveTimer = null;
let isConnected = false;

// Keepalive - send ping every 20 seconds to prevent service worker sleep
function startKeepalive() {
    stopKeepalive();
    keepaliveTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
            console.log('[Kitt Bridge] Keepalive ping');
        }
    }, 20000);
}

function stopKeepalive() {
    if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
    }
}

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
            return await typeInTab(params.tabId, params.selector, params.text);

        case 'readPage':
            return await readPageContent(params.tabId, params.selector);

        case 'screenshot':
            return await captureTab(params.tabId);

        case 'setInputValue':
            return await setInputValue(params.tabId, params.selector, params.value);

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

// Execute script in tab
async function executeInTab(tabId, code) {
    const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: new Function(code),
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

// Type text in tab
async function typeInTab(tabId, selector, text) {
    return await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel, txt) => {
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
                return { typed: true, selector: sel };
            }
            return { typed: false, error: 'No editable element found' };
        },
        args: [selector, text]
    }).then(r => r[0]?.result);
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

// Capture tab screenshot
async function captureTab(tabId) {
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
