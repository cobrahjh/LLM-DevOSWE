const { app, BrowserWindow, globalShortcut, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 80,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        minWidth: 300,
        minHeight: 80,
        maxWidth: 800,
        maxHeight: 500,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    // Center at top of screen
    const { screen } = require('electron');
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow.setPosition(Math.round((width - 450) / 2), 100);

    mainWindow.once('ready-to-show', () => {
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        mainWindow.show();
    });

    // Keep always on top
    mainWindow.on('blur', () => {
        if (mainWindow.isAlwaysOnTop()) {
            mainWindow.setAlwaysOnTop(false);
            mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        }
    });
}

app.whenReady().then(() => {
    createWindow();

    // Toggle hotkey
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

app.on('will-quit', () => globalShortcut.unregisterAll());

// IPC handlers
ipcMain.on('run-command', (event, cmd) => {
    if (cmd.startsWith('http')) {
        shell.openExternal(cmd);
    } else {
        shell.openPath(cmd).catch(() => {
            spawn('cmd.exe', ['/c', 'start', '', cmd], { detached: true, stdio: 'ignore' });
        });
    }
});

ipcMain.on('resize-window', (event, height) => {
    const [width] = mainWindow.getSize();
    mainWindow.setSize(width, height);
});

ipcMain.on('hide-window', () => mainWindow.hide());

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
