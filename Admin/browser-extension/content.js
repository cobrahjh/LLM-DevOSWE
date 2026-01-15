/**
 * Kitt Browser Bridge - Content Script
 * Runs in the context of web pages
 */

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        switch (message.action) {
            case 'click':
                handleClick(message, sendResponse);
                break;

            case 'type':
                handleType(message, sendResponse);
                break;

            case 'read':
                handleRead(message, sendResponse);
                break;

            case 'scroll':
                handleScroll(message, sendResponse);
                break;

            case 'focus':
                handleFocus(message, sendResponse);
                break;

            case 'getElements':
                handleGetElements(message, sendResponse);
                break;

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    } catch (err) {
        sendResponse({ success: false, error: err.message });
    }
    return true; // Keep channel open for async
});

function handleClick(message, sendResponse) {
    const { selector, x, y } = message;

    if (selector) {
        const el = document.querySelector(selector);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                el.click();
                sendResponse({ success: true, clicked: selector });
            }, 100);
        } else {
            sendResponse({ success: false, error: `Element not found: ${selector}` });
        }
    } else if (x !== undefined && y !== undefined) {
        const el = document.elementFromPoint(x, y);
        if (el) {
            el.click();
            sendResponse({ success: true, clicked: { x, y, tag: el.tagName } });
        } else {
            sendResponse({ success: false, error: 'No element at coordinates' });
        }
    }
}

function handleType(message, sendResponse) {
    const { selector, text, append } = message;

    let el = selector ? document.querySelector(selector) : document.activeElement;

    if (!el) {
        sendResponse({ success: false, error: 'No element to type in' });
        return;
    }

    el.focus();

    // Handle contenteditable (Google Docs, etc.)
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
        if (!append) {
            el.textContent = '';
        }
        document.execCommand('insertText', false, text);
        sendResponse({ success: true, typed: text.length });
        return;
    }

    // Handle regular inputs
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (append) {
            el.value += text;
        } else {
            el.value = text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        sendResponse({ success: true, typed: text.length });
        return;
    }

    sendResponse({ success: false, error: 'Element is not editable' });
}

function handleRead(message, sendResponse) {
    const { selector, attribute } = message;

    if (selector) {
        const el = document.querySelector(selector);
        if (el) {
            const result = {
                text: el.textContent,
                value: el.value,
                tag: el.tagName
            };
            if (attribute) {
                result.attribute = el.getAttribute(attribute);
            }
            sendResponse({ success: true, data: result });
        } else {
            sendResponse({ success: false, error: `Element not found: ${selector}` });
        }
    } else {
        // Return page summary
        sendResponse({
            success: true,
            data: {
                title: document.title,
                url: location.href,
                bodyText: document.body.textContent.substring(0, 5000)
            }
        });
    }
}

function handleScroll(message, sendResponse) {
    const { x, y, selector } = message;

    if (selector) {
        const el = document.querySelector(selector);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            sendResponse({ success: true, scrolledTo: selector });
        } else {
            sendResponse({ success: false, error: 'Element not found' });
        }
    } else {
        window.scrollTo({ left: x || 0, top: y || 0, behavior: 'smooth' });
        sendResponse({ success: true, scrolledTo: { x, y } });
    }
}

function handleFocus(message, sendResponse) {
    const { selector } = message;
    const el = document.querySelector(selector);

    if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        sendResponse({ success: true, focused: selector });
    } else {
        sendResponse({ success: false, error: 'Element not found' });
    }
}

function handleGetElements(message, sendResponse) {
    const { selector, limit = 10 } = message;

    const elements = document.querySelectorAll(selector);
    const results = [];

    for (let i = 0; i < Math.min(elements.length, limit); i++) {
        const el = elements[i];
        const rect = el.getBoundingClientRect();
        results.push({
            index: i,
            tag: el.tagName,
            id: el.id || null,
            class: el.className || null,
            text: el.textContent?.substring(0, 100),
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        });
    }

    sendResponse({ success: true, count: elements.length, elements: results });
}

// Notify that content script is loaded
console.log('[Kitt Bridge] Content script loaded');
