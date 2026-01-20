/**
 * Kitt Live - Auto Updater
 * Checks for updates from local infrastructure and applies them
 */

const { app, dialog, BrowserWindow } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class KittUpdater {
    constructor(options = {}) {
        this.currentVersion = require('./package.json').version;
        this.updateUrl = options.updateUrl || 'http://localhost:8600/api/updates/kitt-live';
        this.updateDir = path.join(app.getPath('userData'), 'updates');
        this.checkInterval = options.checkInterval || 30 * 60 * 1000; // 30 minutes
        this.mainWindow = null;

        // Ensure update directory exists
        if (!fs.existsSync(this.updateDir)) {
            fs.mkdirSync(this.updateDir, { recursive: true });
        }
    }

    setMainWindow(window) {
        this.mainWindow = window;
    }

    // Start periodic update checks
    startAutoCheck() {
        // Check on startup after a delay
        setTimeout(() => this.checkForUpdates(), 5000);

        // Then check periodically
        setInterval(() => this.checkForUpdates(), this.checkInterval);
    }

    // Check for updates
    async checkForUpdates(silent = true) {
        try {
            const updateInfo = await this.fetchUpdateInfo();

            if (!updateInfo) {
                if (!silent) this.notify('Update check failed', 'Could not connect to update server');
                return null;
            }

            if (this.isNewerVersion(updateInfo.version)) {
                console.log(`Update available: ${this.currentVersion} -> ${updateInfo.version}`);

                if (silent) {
                    // Notify via main window
                    this.mainWindow?.webContents.send('update-available', updateInfo);
                } else {
                    // Show dialog
                    this.promptUpdate(updateInfo);
                }

                return updateInfo;
            } else {
                if (!silent) this.notify('No updates', 'You are running the latest version');
                return null;
            }
        } catch (error) {
            console.error('Update check failed:', error);
            return null;
        }
    }

    // Fetch update manifest from server
    fetchUpdateInfo() {
        return new Promise((resolve) => {
            const client = this.updateUrl.startsWith('https') ? https : http;

            const req = client.get(this.updateUrl, { timeout: 5000 }, (res) => {
                if (res.statusCode !== 200) {
                    resolve(null);
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve(null);
                    }
                });
            });

            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });
        });
    }

    // Compare versions (semver-like)
    isNewerVersion(newVersion) {
        const current = this.currentVersion.split('.').map(Number);
        const update = newVersion.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if ((update[i] || 0) > (current[i] || 0)) return true;
            if ((update[i] || 0) < (current[i] || 0)) return false;
        }
        return false;
    }

    // Prompt user to update
    async promptUpdate(updateInfo) {
        const response = await dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'Update Available',
            message: `Kitt Live ${updateInfo.version} is available`,
            detail: updateInfo.changelog || 'A new version is ready to install.',
            buttons: ['Update Now', 'Later'],
            defaultId: 0
        });

        if (response.response === 0) {
            await this.downloadAndInstall(updateInfo);
        }
    }

    // Download and install update
    async downloadAndInstall(updateInfo) {
        try {
            // Notify starting download
            this.mainWindow?.webContents.send('update-progress', { status: 'downloading', progress: 0 });

            if (updateInfo.type === 'full') {
                // Full package update - download zip
                await this.downloadFile(updateInfo.downloadUrl, path.join(this.updateDir, 'update.zip'));
                await this.extractAndReplace();
            } else {
                // Incremental update - download individual files
                await this.downloadIncrementalUpdate(updateInfo);
            }

            // Update package.json version
            this.updateLocalVersion(updateInfo.version);

            // Notify complete
            this.mainWindow?.webContents.send('update-progress', { status: 'complete' });

            // Prompt restart
            const response = await dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: 'Update Complete',
                message: 'Update installed successfully',
                detail: 'Restart Kitt Live to apply the update.',
                buttons: ['Restart Now', 'Later']
            });

            if (response.response === 0) {
                this.restartApp();
            }

        } catch (error) {
            console.error('Update failed:', error);
            this.mainWindow?.webContents.send('update-progress', { status: 'error', error: error.message });
            dialog.showErrorBox('Update Failed', error.message);
        }
    }

    // Download incremental update (individual files)
    async downloadIncrementalUpdate(updateInfo) {
        const files = updateInfo.files || [];
        const total = files.length;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const targetPath = path.join(__dirname, file.path);

            // Backup existing file
            if (fs.existsSync(targetPath)) {
                fs.copyFileSync(targetPath, targetPath + '.backup');
            }

            // Download new file
            await this.downloadFile(file.url, targetPath);

            // Report progress
            this.mainWindow?.webContents.send('update-progress', {
                status: 'downloading',
                progress: Math.round(((i + 1) / total) * 100),
                file: file.path
            });
        }
    }

    // Download a file
    downloadFile(url, destPath) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            const dir = path.dirname(destPath);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const file = fs.createWriteStream(destPath);

            client.get(url, (res) => {
                if (res.statusCode === 302 || res.statusCode === 301) {
                    // Handle redirect
                    this.downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
                    return;
                }

                if (res.statusCode !== 200) {
                    reject(new Error(`Download failed: ${res.statusCode}`));
                    return;
                }

                res.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });
    }

    // Update local package.json version
    updateLocalVersion(newVersion) {
        const pkgPath = path.join(__dirname, 'package.json');
        const pkg = require(pkgPath);
        pkg.version = newVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    }

    // Restart the application
    restartApp() {
        app.relaunch();
        app.exit(0);
    }

    // Show notification
    notify(title, body) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('notification', { title, body });
        }
    }
}

module.exports = KittUpdater;
