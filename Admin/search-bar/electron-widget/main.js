const { app, BrowserWindow, globalShortcut, ipcMain, shell, Tray, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let tray;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 600,
        height: 400,
        minWidth: 400,
        minHeight: 200,
        maxWidth: 1000,
        maxHeight: 800,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    // Center on screen
    const { screen } = require('electron');
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow.setPosition(Math.round((width - 600) / 2), Math.round((height - 400) / 3));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

function createTray() {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show', click: () => mainWindow.show() },
        { label: 'Hide', click: () => mainWindow.hide() },
        { type: 'separator' },
        { label: 'Exit', click: () => app.quit() }
    ]);
    tray.setToolTip('Quick Search');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
}

app.whenReady().then(() => {
    createWindow();

    try {
        createTray();
    } catch (e) {
        console.log('Tray not available');
    }

    // Global shortcut Ctrl+Space
    globalShortcut.register('CommandOrControl+Space', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('focus-search');
        }
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

// Handle running commands
ipcMain.on('run-command', (event, cmd) => {
    if (cmd.startsWith('http')) {
        shell.openExternal(cmd);
    } else {
        // Use shell.openPath for apps or spawn for executables
        shell.openPath(cmd).catch(() => {
            // Fallback: spawn with cmd.exe for commands like 'calc.exe'
            spawn('cmd.exe', ['/c', 'start', '', cmd], { detached: true, stdio: 'ignore' });
        });
    }
});

ipcMain.on('resize-window', (event, height) => {
    const [width] = mainWindow.getSize();
    mainWindow.setSize(width, height);
});

ipcMain.on('hide-window', () => {
    mainWindow.hide();
});

ipcMain.on('set-always-on-top', (event, value) => {
    mainWindow.setAlwaysOnTop(value);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
