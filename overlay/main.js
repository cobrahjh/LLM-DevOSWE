/**
 * SimWidget Overlay - Electron Main Process
 * Creates transparent, click-through overlay windows
 */

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

// Store windows
const windows = new Map();
let mainWindow = null;

// Create main overlay window
function createMainOverlay() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    
    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: false,  // Show in taskbar so you can click to bring back
        resizable: false,
        hasShadow: false,
        focusable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    
    // Keep window always on top at the highest level
    mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
    
    // Re-assert always on top when focus is lost (important for fullscreen games)
    mainWindow.on('blur', () => {
        mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
    });
    
    // Also check periodically to stay on top of fullscreen apps
    setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
        }
    }, 1000);
    
    // Smart click-through: forward mouse events but still receive them
    // This allows clicking through transparent areas while widgets handle their own clicks
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    
    // Dev tools in dev mode
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    
    console.log('[Overlay] Main window created');
}

// Create a mini-widget window (separate floating window)
function createMiniWidget(config) {
    const miniWindow = new BrowserWindow({
        width: config.width || 300,
        height: config.height || 200,
        x: config.x || 100,
        y: config.y || 100,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: false, // Show in taskbar for easy access
        resizable: true,
        hasShadow: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    
    // Mini widgets are NOT click-through
    miniWindow.setIgnoreMouseEvents(false);
    
    // Load the mini widget HTML with config
    miniWindow.loadFile(path.join(__dirname, 'renderer', 'mini-widget.html'));
    miniWindow.webContents.on('did-finish-load', () => {
        miniWindow.webContents.send('widget-config', config);
    });
    
    const id = `mini-${Date.now()}`;
    windows.set(id, miniWindow);
    
    miniWindow.on('closed', () => {
        windows.delete(id);
    });
    
    return id;
}

// IPC Handlers
ipcMain.handle('set-click-through', (event, ignore) => {
    if (mainWindow) {
        mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    }
});

ipcMain.handle('create-mini-widget', (event, config) => {
    return createMiniWidget(config);
});

ipcMain.handle('close-mini-widget', (event, id) => {
    const win = windows.get(id);
    if (win) {
        win.close();
        windows.delete(id);
    }
});

ipcMain.handle('get-display-info', () => {
    const primary = screen.getPrimaryDisplay();
    return {
        width: primary.workAreaSize.width,
        height: primary.workAreaSize.height,
        scaleFactor: primary.scaleFactor
    };
});

// Widget position/size changes
ipcMain.on('widget-bounds', (event, data) => {
    // Widgets report their bounds so we can enable mouse events only on them
    // This allows click-through on empty areas
});

// App lifecycle
app.whenReady().then(() => {
    console.log('[Overlay] SimWidget Overlay v1.0');
    console.log('[Overlay] TIP: For best results, run MSFS in WINDOWED FULLSCREEN mode');
    console.log('[Overlay]      (Settings > General > Graphics > Fullscreen Mode)');
    createMainOverlay();
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainOverlay();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle errors
process.on('uncaughtException', (error) => {
    console.error('[Overlay] Uncaught exception:', error);
});
