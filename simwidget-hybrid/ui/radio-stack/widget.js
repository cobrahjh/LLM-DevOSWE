/**
 * Radio Stack Widget
 * Controls COM, NAV, ADF frequencies and transponder
 */

const API_BASE = 'http://localhost:8080';
let ws = null;
let connected = false;

// Current standby frequencies (for adjustment)
let standbyFreqs = {
    com1: 121.500,
    com2: 121.500,
    nav1: 108.00,
    nav2: 108.00,
    adf: 190
};

// Current transponder code
let xpndrCode = 1200;

// Connect WebSocket
function connect() {
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
        connected = true;
        updateConnectionStatus(true);
        console.log('[Radio] Connected');
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'flightData') {
                updateDisplay(msg.data);
            }
        } catch (e) {
            console.error('[Radio] Parse error:', e);
        }
    };

    ws.onclose = () => {
        connected = false;
        updateConnectionStatus(false);
        console.log('[Radio] Disconnected, reconnecting...');
        setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
        console.error('[Radio] WebSocket error');
    };
}

function updateConnectionStatus(isConnected) {
    const status = document.getElementById('status');
    if (isConnected) {
        status.classList.add('connected');
        status.querySelector('.text').textContent = 'Connected';
    } else {
        status.classList.remove('connected');
        status.querySelector('.text').textContent = 'Disconnected';
    }
}

function updateDisplay(data) {
    // COM frequencies (MHz)
    if (data.com1Active) {
        document.getElementById('com1-active').textContent = formatComFreq(data.com1Active);
    }
    if (data.com1Standby) {
        document.getElementById('com1-standby').textContent = formatComFreq(data.com1Standby);
        standbyFreqs.com1 = data.com1Standby;
    }
    if (data.com2Active) {
        document.getElementById('com2-active').textContent = formatComFreq(data.com2Active);
    }
    if (data.com2Standby) {
        document.getElementById('com2-standby').textContent = formatComFreq(data.com2Standby);
        standbyFreqs.com2 = data.com2Standby;
    }

    // NAV frequencies (MHz)
    if (data.nav1Active) {
        document.getElementById('nav1-active').textContent = formatNavFreq(data.nav1Active);
    }
    if (data.nav1Standby) {
        document.getElementById('nav1-standby').textContent = formatNavFreq(data.nav1Standby);
        standbyFreqs.nav1 = data.nav1Standby;
    }
    if (data.nav2Active) {
        document.getElementById('nav2-active').textContent = formatNavFreq(data.nav2Active);
    }
    if (data.nav2Standby) {
        document.getElementById('nav2-standby').textContent = formatNavFreq(data.nav2Standby);
        standbyFreqs.nav2 = data.nav2Standby;
    }

    // ADF (KHz)
    if (data.adfActive) {
        document.getElementById('adf-active').textContent = Math.round(data.adfActive);
    }
    if (data.adfStandby) {
        document.getElementById('adf-standby').textContent = Math.round(data.adfStandby);
        standbyFreqs.adf = data.adfStandby;
    }

    // Transponder
    if (data.transponderCode !== undefined) {
        xpndrCode = data.transponderCode;
        updateXpndrDisplay();
    }

    // DME
    if (data.dme1Distance !== undefined) {
        document.getElementById('dme1-dist').textContent = data.dme1Distance > 0 ? data.dme1Distance.toFixed(1) : '--.-';
    }
    if (data.dme1Speed !== undefined) {
        document.getElementById('dme1-spd').textContent = data.dme1Speed > 0 ? Math.round(data.dme1Speed) : '---';
    }
    if (data.dme2Distance !== undefined) {
        document.getElementById('dme2-dist').textContent = data.dme2Distance > 0 ? data.dme2Distance.toFixed(1) : '--.-';
    }
    if (data.dme2Speed !== undefined) {
        document.getElementById('dme2-spd').textContent = data.dme2Speed > 0 ? Math.round(data.dme2Speed) : '---';
    }
}

function formatComFreq(freq) {
    return freq.toFixed(3);
}

function formatNavFreq(freq) {
    return freq.toFixed(2);
}

function updateXpndrDisplay() {
    const codeStr = xpndrCode.toString().padStart(4, '0');
    document.getElementById('xpndr-code').textContent = codeStr;
    document.getElementById('xpndr-d0').textContent = codeStr[0];
    document.getElementById('xpndr-d1').textContent = codeStr[1];
    document.getElementById('xpndr-d2').textContent = codeStr[2];
    document.getElementById('xpndr-d3').textContent = codeStr[3];
}

// Swap active/standby
async function swapFreq(radio) {
    try {
        await fetch(`${API_BASE}/api/radio/${radio}/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`[Radio] Swapped ${radio}`);
    } catch (e) {
        console.error(`[Radio] Swap error:`, e);
    }
}

// Adjust standby frequency
async function adjustFreq(radio, delta) {
    let newFreq = standbyFreqs[radio] + delta;

    // Clamp to valid ranges
    if (radio.startsWith('com')) {
        newFreq = Math.max(118.000, Math.min(136.975, newFreq));
    } else if (radio.startsWith('nav')) {
        newFreq = Math.max(108.00, Math.min(117.95, newFreq));
    } else if (radio === 'adf') {
        newFreq = Math.max(190, Math.min(1799, Math.round(newFreq)));
    }

    standbyFreqs[radio] = newFreq;

    // Update display immediately
    const el = document.getElementById(`${radio}-standby`);
    if (radio === 'adf') {
        el.textContent = Math.round(newFreq);
    } else if (radio.startsWith('com')) {
        el.textContent = formatComFreq(newFreq);
    } else {
        el.textContent = formatNavFreq(newFreq);
    }

    // Send to sim
    try {
        await fetch(`${API_BASE}/api/radio/${radio}/standby`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frequency: newFreq })
        });
    } catch (e) {
        console.error(`[Radio] Set frequency error:`, e);
    }
}

// Set transponder code
async function setXpndr(code) {
    xpndrCode = code;
    updateXpndrDisplay();

    try {
        await fetch(`${API_BASE}/api/radio/xpndr/code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: code })
        });
    } catch (e) {
        console.error(`[Radio] Set XPNDR error:`, e);
    }
}

// Adjust individual transponder digit
function adjustXpndr(digitIndex, delta) {
    const codeStr = xpndrCode.toString().padStart(4, '0');
    const digits = codeStr.split('').map(Number);

    // Transponder uses octal (0-7 only)
    digits[digitIndex] = (digits[digitIndex] + delta + 8) % 8;

    const newCode = parseInt(digits.join(''), 10);
    setXpndr(newCode);
}

// Initialize
connect();
updateXpndrDisplay();
