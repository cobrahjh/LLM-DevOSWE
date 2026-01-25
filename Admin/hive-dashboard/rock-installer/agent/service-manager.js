/**
 * Service Manager v1.0.0
 * Last Updated: 2026-01-09
 * 
 * Unified service management for SimWidget Engine
 * Supports both Dev Mode (Node processes) and Production Mode (Windows Services)
 */

const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

// Service definitions
const SERVICES = {
    agent: {
        name: 'SimWidgetAgent',
        displayName: 'SimWidget Agent Service',
        description: 'SimWidget AI Development Assistant',
        script: path.join(__dirname, 'agent-server.js'),
        port: 8585,
        cwd: __dirname
    },
    simwidget: {
        name: 'SimWidgetEngine',
        displayName: 'SimWidget Engine Service',
        description: 'SimWidget Flight Simulation Backend',
        script: path.join(__dirname, '..', '..', 'simwidget-hybrid', 'backend', 'server.js'),
        port: 8080,
        cwd: path.join(__dirname, '..', '..', 'simwidget-hybrid', 'backend')
    },
    remote: {
        name: 'SimWidgetRemote',
        displayName: 'SimWidget Remote Support Service',
        description: 'SimWidget Remote Support Server',
        script: path.join(__dirname, '..', 'remote-support', 'server.js'),
        port: 8590,
        cwd: path.join(__dirname, '..', 'remote-support')
    }
};

// Track running dev processes
const devProcesses = {};

class ServiceManager {
    constructor() {
        this.mode = 'dev'; // 'dev' or 'service'
        this.configPath = path.join(__dirname, 'logs', 'service-config.json');
        this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                this.mode = config.mode || 'dev';
            }
        } catch (err) {
            console.error('[ServiceManager] Config load error:', err.message);
        }
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify({ mode: this.mode }, null, 2));
        } catch (err) {
            console.error('[ServiceManager] Config save error:', err.message);
        }
    }

    getServiceDefs() {
        return SERVICES;
    }

    getMode() {
        return this.mode;
    }

    setMode(mode) {
        if (mode === 'dev' || mode === 'service') {
            this.mode = mode;
            this.saveConfig();
            return true;
        }
        return false;
    }

    // ==================== DEV MODE ====================
    
    async startDev(serviceName) {
        const svc = SERVICES[serviceName];
        if (!svc) return { success: false, error: `Unknown service: ${serviceName}` };

        // Kill existing process on port
        await this.killPort(svc.port);

        return new Promise((resolve) => {
            try {
                const proc = spawn('node', [svc.script], {
                    cwd: svc.cwd,
                    stdio: 'pipe',
                    detached: false,
                    shell: true
                });

                devProcesses[serviceName] = proc;

                proc.stdout.on('data', (data) => {
                    console.log(`[${serviceName}] ${data.toString().trim()}`);
                });

                proc.stderr.on('data', (data) => {
                    console.error(`[${serviceName}] ${data.toString().trim()}`);
                });

                proc.on('error', (err) => {
                    console.error(`[${serviceName}] Process error:`, err.message);
                    delete devProcesses[serviceName];
                });

                proc.on('exit', (code) => {
                    console.log(`[${serviceName}] Process exited with code ${code}`);
                    delete devProcesses[serviceName];
                });

                // Give it time to start
                setTimeout(() => {
                    resolve({ success: true, pid: proc.pid, port: svc.port });
                }, 2000);

            } catch (err) {
                resolve({ success: false, error: err.message });
            }
        });
    }

    async stopDev(serviceName) {
        const svc = SERVICES[serviceName];
        if (!svc) return { success: false, error: `Unknown service: ${serviceName}` };

        // Kill process on port
        await this.killPort(svc.port);

        // Also kill tracked process
        if (devProcesses[serviceName]) {
            try {
                devProcesses[serviceName].kill();
            } catch (e) {}
            delete devProcesses[serviceName];
        }

        return { success: true };
    }

    async restartDev(serviceName) {
        await this.stopDev(serviceName);
        await new Promise(r => setTimeout(r, 1000));
        return this.startDev(serviceName);
    }

    // ==================== SERVICE MODE ====================

    async installService(serviceName) {
        const svc = SERVICES[serviceName];
        if (!svc) return { success: false, error: `Unknown service: ${serviceName}` };

        return new Promise((resolve) => {
            const cmd = `powershell -ExecutionPolicy Bypass -Command "& {
                $service = Get-Service -Name '${svc.name}' -ErrorAction SilentlyContinue
                if ($service) {
                    Write-Host 'Service already exists'
                } else {
                    $params = @{
                        Name = '${svc.name}'
                        BinaryPathName = 'node.exe \\"${svc.script.replace(/\\/g, '\\\\')}\\"'
                        DisplayName = '${svc.displayName}'
                        Description = '${svc.description}'
                        StartupType = 'Automatic'
                    }
                    New-Service @params
                    Write-Host 'Service installed'
                }
            }"`;

            exec(cmd, (err, stdout, stderr) => {
                if (err) {
                    resolve({ success: false, error: stderr || err.message });
                } else {
                    resolve({ success: true, message: stdout.trim() });
                }
            });
        });
    }

    async uninstallService(serviceName) {
        const svc = SERVICES[serviceName];
        if (!svc) return { success: false, error: `Unknown service: ${serviceName}` };

        return new Promise((resolve) => {
            const cmd = `powershell -ExecutionPolicy Bypass -Command "& {
                $service = Get-Service -Name '${svc.name}' -ErrorAction SilentlyContinue
                if ($service) {
                    Stop-Service -Name '${svc.name}' -Force -ErrorAction SilentlyContinue
                    sc.exe delete '${svc.name}'
                    Write-Host 'Service uninstalled'
                } else {
                    Write-Host 'Service not found'
                }
            }"`;

            exec(cmd, (err, stdout, stderr) => {
                if (err) {
                    resolve({ success: false, error: stderr || err.message });
                } else {
                    resolve({ success: true, message: stdout.trim() });
                }
            });
        });
    }

    async startService(serviceName) {
        const svc = SERVICES[serviceName];
        if (!svc) return { success: false, error: `Unknown service: ${serviceName}` };

        return new Promise((resolve) => {
            exec(`powershell -Command "Start-Service -Name '${svc.name}'"`, (err, stdout, stderr) => {
                if (err) {
                    resolve({ success: false, error: stderr || err.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    async stopService(serviceName) {
        const svc = SERVICES[serviceName];
        if (!svc) return { success: false, error: `Unknown service: ${serviceName}` };

        return new Promise((resolve) => {
            exec(`powershell -Command "Stop-Service -Name '${svc.name}' -Force"`, (err, stdout, stderr) => {
                if (err) {
                    resolve({ success: false, error: stderr || err.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    async restartService(serviceName) {
        const svc = SERVICES[serviceName];
        if (!svc) return { success: false, error: `Unknown service: ${serviceName}` };

        return new Promise((resolve) => {
            exec(`powershell -Command "Restart-Service -Name '${svc.name}' -Force"`, (err, stdout, stderr) => {
                if (err) {
                    resolve({ success: false, error: stderr || err.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    async getServiceStatus(serviceName) {
        const svc = SERVICES[serviceName];
        if (!svc) return { status: 'unknown', error: `Unknown service: ${serviceName}` };

        return new Promise((resolve) => {
            exec(`powershell -Command "(Get-Service -Name '${svc.name}' -ErrorAction SilentlyContinue).Status"`, 
                (err, stdout, stderr) => {
                    if (err || !stdout.trim()) {
                        resolve({ status: 'not_installed' });
                    } else {
                        resolve({ status: stdout.trim().toLowerCase() });
                    }
                });
        });
    }

    // ==================== UNIFIED API ====================

    async start(serviceName) {
        if (this.mode === 'service') {
            return this.startService(serviceName);
        }
        return this.startDev(serviceName);
    }

    async stop(serviceName) {
        if (this.mode === 'service') {
            return this.stopService(serviceName);
        }
        return this.stopDev(serviceName);
    }

    async restart(serviceName) {
        if (this.mode === 'service') {
            return this.restartService(serviceName);
        }
        return this.restartDev(serviceName);
    }

    async status(serviceName) {
        const svc = SERVICES[serviceName];
        if (!svc) return { online: false, error: `Unknown service: ${serviceName}` };

        // Check port regardless of mode
        const portInUse = await this.checkPort(svc.port);
        
        if (this.mode === 'service') {
            const svcStatus = await this.getServiceStatus(serviceName);
            return {
                online: portInUse,
                serviceStatus: svcStatus.status,
                port: svc.port,
                mode: 'service'
            };
        }

        return {
            online: portInUse,
            port: svc.port,
            mode: 'dev',
            pid: devProcesses[serviceName]?.pid || null
        };
    }

    async statusAll() {
        const results = {};
        for (const name of Object.keys(SERVICES)) {
            results[name] = await this.status(name);
        }
        return results;
    }

    // ==================== UTILITIES ====================

    async checkPort(port) {
        return new Promise((resolve) => {
            exec(`powershell -Command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).Count -gt 0"`,
                (err, stdout) => {
                    resolve(stdout.trim().toLowerCase() === 'true');
                });
        });
    }

    async killPort(port) {
        return new Promise((resolve) => {
            exec(`powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
                () => resolve());
        });
    }

    async installAll() {
        const results = {};
        for (const name of Object.keys(SERVICES)) {
            results[name] = await this.installService(name);
        }
        return results;
    }

    async uninstallAll() {
        const results = {};
        for (const name of Object.keys(SERVICES)) {
            results[name] = await this.uninstallService(name);
        }
        return results;
    }

    async startAll() {
        const results = {};
        for (const name of Object.keys(SERVICES)) {
            results[name] = await this.start(name);
        }
        return results;
    }

    async stopAll() {
        const results = {};
        for (const name of Object.keys(SERVICES)) {
            results[name] = await this.stop(name);
        }
        return results;
    }
}

module.exports = { ServiceManager, SERVICES };
