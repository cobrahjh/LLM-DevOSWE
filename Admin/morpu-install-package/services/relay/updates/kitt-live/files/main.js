/**
 * Kitt Live - Desktop AI Assistant
 * Main Electron Process
 */

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');
const KittUpdater = require('./updater');

// Initialize updater
const updater = new KittUpdater({
    updateUrl: 'http://localhost:8600/api/updates/kitt-live',
    checkInterval: 30 * 60 * 1000 // 30 minutes
});

// Config store
const store = new Store({
    defaults: {
        voice: {
            name: 'Microsoft Jenny Online (Natural)',
            rate: 1.0,
            pitch: 1.0,
            volume: 0.8
        },
        audio: {
            inputDevice: 'default',
            outputDevice: 'default'
        },
        hotkeys: {
            toggle: 'Alt+K',
            pushToTalk: 'Ctrl+Space',
            mute: 'Alt+M'
        },
        behavior: {
            startMinimized: true,
            startWithWindows: false,
            autoListen: false,
            showCaptions: true
        },
        environment: {
            enabled: false,
            safetyLevel: 'standard', // off, safe, standard, unrestricted
            permissions: {
                localPC: true,
                networkPCs: false,
                web: false,
                apis: true,
                clipboard: true,
                screenshots: false
            },
            networkPCs: []
        },
        llm: {
            backend: 'oracle', // oracle, ollama
            oracleUrl: 'http://localhost:3002',
            ollamaUrl: 'http://localhost:11434',
            model: 'qwen2.5-coder:7b'
        }
    }
});

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let isQuitting = false;

// Create main chat window
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 420,
        height: 600,
        minWidth: 320,
        minHeight: 400,
        maxWidth: 800,
        maxHeight: 900,
        show: false,
        frame: false,
        resizable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('blur', () => {
        // Hide when clicking outside (optional)
        // mainWindow.hide();
    });
}

// Create settings window
function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        frame: false,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

// Create system tray
function createTray() {
    // Create a simple icon (circle)
    const icon = nativeImage.createFromDataURL(`data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANCSURBVFiF7ZdNaBNBFMd/s5tNYpOmTdqkNlZbrV9VRPGgggcVwYMXwYMHUVQUvXgTBEU8e/LkwYMe1IMgiOBJEUUUEUWqIkVsq7WJ2jRpk26y2Wz2OZuPpoluNokeWviH2Xkz894/8z7eGxgzZsz/C6kmkFLKAFYBu4BtwEqgBsgDn4E3wHPglTJoiKKkUgq3+xhS/ogW/4eUQBpoBz6UNBU0iZAygjJgCQF8LAa+KYTwAfuBVcA+YAUwBYg5z7NAk3OdRMoHwFFKCBaXbQvg3wHCzv3fhDABk0LKQ0jp6E0W6QeOAquBzSgBJIE24CpKBMNqYD9K8yuMoAlV+W2K8D8tRW0gTNEbFMI/IqRsQ8qDKM1/A1wA2h3fpqMG0AAcRIlhPkoYuyl4wjTwBXiB4v8fPmAvcBBYhhr8XlRbmkVNvAHVBm8CO4G5KGnAGALPc8AFvAJCKF5vRoliOUpCsCOk7EZJoQfl+lKUL5mKEoAbeAjcAj4sFIcIahYLUKYxoHTuQwlgKjCLf0TwDMU9E2U+41GhdhvwE7iFEvdMlB+5gjKPDaiZWIBSWC/QB0x22pYBcxZ6g4VwCCWADJoAmun1vndQ5nQJdWyY4LT/Qem8BhVDLkCJJYPi/22UKf6y0BvMhSMojq9FCcKOEvYsVPi+2WkTQBJlHiPOPgMl/D0ozieAY0AbKoS7UCbhQZnRHOA0KvLJoqRxCCWCDlRoX4viexcq3P+T1xgRwt+ozr8aNWsWFLOTqFj+EGiY7P2mEECNcx0HHgE9KBNpRa3CQ0ADMMl5voTSfh0qdfdROq9GmeIs1OwXUMxegTKFDOoM6UaJ5juK50NZxj8EoIwOZHxJSNmBGvQuFOcvoQL/cNSptKPW8nSU5F8AN1ADmIsSgIESQB3K/P5SxLcQTgD1qBU/HSWIuShzuA3cQS32epRAQqjI14oK2x4UjyehMmQCFbbvo0ThRWXCFJRgMqjItwkliq0oAYxD8f4xStTrUcKejDKL26hT0gxqUfqAAaFy/APULJwCPkcJpRN1WipHqf0CKqQnoQpMEWUinahE1opSlh/VEK6gxON14nqK0vcpVP78iFJxD6qF96CK0RhU5htBRdT/Ar8AjExOHfSO7kwAAAAASUVORK5CYII=`);

    tray = new Tray(icon);
    tray.setToolTip('Kitt Live - Alt+K to open');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open Kitt',
            click: () => toggleMainWindow()
        },
        {
            label: 'Settings',
            click: () => createSettingsWindow()
        },
        {
            label: 'Check for Updates',
            click: () => updater.checkForUpdates(false)
        },
        { type: 'separator' },
        {
            label: 'Environment Access',
            type: 'checkbox',
            checked: store.get('environment.enabled'),
            click: (menuItem) => {
                store.set('environment.enabled', menuItem.checked);
                mainWindow?.webContents.send('config-changed', store.store);
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => toggleMainWindow());
}

// Toggle main window visibility
function toggleMainWindow() {
    if (!mainWindow) {
        createMainWindow();
    }

    if (mainWindow.isVisible()) {
        mainWindow.hide();
    } else {
        // Position near system tray
        const trayBounds = tray.getBounds();
        const windowBounds = mainWindow.getBounds();
        const x = Math.round(trayBounds.x - windowBounds.width / 2 + trayBounds.width / 2);
        const y = Math.round(trayBounds.y - windowBounds.height - 10);
        mainWindow.setPosition(x > 0 ? x : 100, y > 0 ? y : 100);
        mainWindow.show();
        mainWindow.focus();
    }
}

// Register global shortcuts
function registerShortcuts() {
    const toggleKey = store.get('hotkeys.toggle');

    globalShortcut.unregisterAll();

    globalShortcut.register(toggleKey, () => {
        toggleMainWindow();
    });

    const pttKey = store.get('hotkeys.pushToTalk');
    globalShortcut.register(pttKey, () => {
        mainWindow?.webContents.send('push-to-talk');
    });
}

// IPC Handlers
ipcMain.handle('get-config', () => store.store);
ipcMain.handle('set-config', (_, key, value) => {
    store.set(key, value);
    return store.store;
});
ipcMain.handle('get-voices', async () => {
    // Return available Microsoft voices
    return [
        { name: 'Microsoft Jenny Online (Natural)', lang: 'en-US' },
        { name: 'Microsoft Guy Online (Natural)', lang: 'en-US' },
        { name: 'Microsoft Aria Online (Natural)', lang: 'en-US' },
        { name: 'Microsoft Davis Online (Natural)', lang: 'en-US' },
        { name: 'Microsoft Sara Online (Natural)', lang: 'en-US' },
        { name: 'Microsoft Libby Online (Natural)', lang: 'en-GB' },
        { name: 'Microsoft Sonia Online (Natural)', lang: 'en-GB' },
        { name: 'Microsoft Xiaoxiao Online (Natural)', lang: 'zh-CN' },
        { name: 'Microsoft Yunxi Online (Natural)', lang: 'zh-CN' }
    ];
});

// Get audio devices - renderer will enumerate via navigator.mediaDevices
ipcMain.handle('get-audio-devices', async () => {
    // Audio device enumeration happens in renderer via Web API
    // This is a placeholder for any main-process audio handling
    return { input: [], output: [] };
});

ipcMain.on('close-window', () => mainWindow?.hide());
ipcMain.on('minimize-window', () => mainWindow?.minimize());
ipcMain.on('open-settings', () => createSettingsWindow());
ipcMain.on('close-settings', () => settingsWindow?.close());

// Update handlers
ipcMain.handle('check-for-updates', () => updater.checkForUpdates(false));
ipcMain.handle('get-version', () => require('./package.json').version);

// LLM Communication
ipcMain.handle('send-to-llm', async (_, message, options = {}) => {
    const config = store.store;
    const backend = config.llm?.backend || 'oracle';

    try {
        if (backend === 'oracle') {
            return await sendToOracle(message, options, config);
        } else {
            return await sendToOllama(message, options, config);
        }
    } catch (error) {
        console.error('LLM Error:', error);
        throw error;
    }
});

// Send to Oracle backend
async function sendToOracle(message, options, config) {
    const url = config.llm?.oracleUrl || 'http://localhost:3002';

    // Build context based on environment permissions
    let systemPrompt = 'You are Kitt, a helpful desktop AI assistant. Be concise and friendly.';

    if (options.environment && config.environment?.enabled) {
        const perms = config.environment.permissions || {};
        const safety = config.environment.safetyLevel || 'standard';

        systemPrompt += `\n\nEnvironment Access is ENABLED with ${safety} safety level.`;
        systemPrompt += `\nPermissions: ${Object.entries(perms).filter(([,v]) => v).map(([k]) => k).join(', ')}`;
        systemPrompt += '\nYou can execute commands and access the system when appropriate.';
    }

    const response = await fetch(`${url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: config.llm?.model || 'qwen2.5-coder:7b',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            stream: false
        })
    });

    if (!response.ok) {
        throw new Error(`Oracle error: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || data.response || 'No response received.';
}

// Send to Ollama directly
async function sendToOllama(message, options, config) {
    const url = config.llm?.ollamaUrl || 'http://localhost:11434';

    let systemPrompt = 'You are Kitt, a helpful desktop AI assistant. Be concise and friendly.';

    if (options.environment && config.environment?.enabled) {
        systemPrompt += '\nEnvironment Access is enabled. You can help with system tasks.';
    }

    const response = await fetch(`${url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: config.llm?.model || 'qwen2.5-coder:7b',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            stream: false
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || 'No response received.';
}

// Environment Command Execution (secured)
ipcMain.handle('execute-environment-command', async (_, command, options = {}) => {
    const config = store.store;

    // Security check
    if (!config.environment?.enabled) {
        throw new Error('Environment Access is not enabled');
    }

    const perms = config.environment.permissions || {};
    const safety = config.environment.safetyLevel || 'standard';

    // Validate based on safety level
    if (safety === 'safe') {
        // Read-only commands only
        const readOnlyCommands = ['dir', 'ls', 'type', 'cat', 'echo', 'hostname', 'whoami', 'systeminfo'];
        const cmdBase = command.split(' ')[0].toLowerCase();
        if (!readOnlyCommands.includes(cmdBase)) {
            throw new Error('Safe mode: Only read-only commands allowed');
        }
    }

    // Check permissions
    if (command.includes('\\\\') || command.includes('//')) {
        if (!perms.networkPCs) {
            throw new Error('Network access not permitted');
        }
    }

    // Execute command
    const { exec } = require('child_process');

    return new Promise((resolve, reject) => {
        exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
            } else {
                resolve(stdout);
            }
        });
    });
});

// App lifecycle
app.whenReady().then(() => {
    createMainWindow();
    createTray();
    registerShortcuts();

    // Setup updater
    updater.setMainWindow(mainWindow);
    updater.startAutoCheck();

    if (!store.get('behavior.startMinimized')) {
        mainWindow.show();
    }
});

app.on('window-all-closed', () => {
    // Don't quit on window close - stay in tray
});

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('activate', () => {
    if (!mainWindow) {
        createMainWindow();
    }
});
