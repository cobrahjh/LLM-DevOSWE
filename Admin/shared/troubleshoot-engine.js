/**
 * Troubleshooting Engine v1.0.0
 * 
 * Shared utility for service startup and error recovery
 * 
 * Features:
 * - Auto port cleanup (kills stale processes)
 * - Retry logic with exponential backoff
 * - Health check utilities
 * - Common error detection and recovery
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\Admin\shared\troubleshoot-engine.js
 * Last Updated: 2025-01-09
 */

const { exec } = require('child_process');
const http = require('http');

class TroubleshootEngine {
    constructor(serviceName = 'Service') {
        this.serviceName = serviceName;
        this.maxRetries = 3;
        this.retryDelay = 2000;
    }

    log(msg) {
        console.log(`[${this.serviceName}] ${msg}`);
    }

    error(msg) {
        console.error(`[${this.serviceName}] ${msg}`);
    }

    /**
     * Check if a port is in use and return the PID
     */
    async getPortPID(port) {
        return new Promise((resolve) => {
            exec(`netstat -ano | findstr ":${port}.*LISTEN"`, (err, stdout) => {
                if (stdout && stdout.trim()) {
                    const match = stdout.trim().match(/LISTENING\s+(\d+)/);
                    if (match) {
                        resolve(parseInt(match[1]));
                        return;
                    }
                }
                resolve(null);
            });
        });
    }

    /**
     * Kill a process by PID
     */
    async killProcess(pid) {
        return new Promise((resolve) => {
            exec(`taskkill /F /PID ${pid}`, (err) => {
                if (err) {
                    this.error(`Failed to kill PID ${pid}: ${err.message}`);
                    resolve(false);
                } else {
                    this.log(`Killed process ${pid}`);
                    resolve(true);
                }
            });
        });
    }

    /**
     * Check if port is in use and kill the process if so
     */
    async clearPort(port) {
        const pid = await this.getPortPID(port);
        if (pid) {
            this.log(`Port ${port} in use by PID ${pid}, killing...`);
            const killed = await this.killProcess(pid);
            if (killed) {
                await this.sleep(1000);
            }
            return killed;
        }
        return true;
    }

    /**
     * Wait for a port to become free
     */
    async waitForPortFree(port, timeout = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const pid = await this.getPortPID(port);
            if (!pid) return true;
            await this.sleep(500);
        }
        return false;
    }

    /**
     * Health check a service via HTTP
     */
    async healthCheck(port, path = '/health', timeout = 3000) {
        return new Promise((resolve) => {
            const req = http.get(`http://localhost:${port}${path}`, { timeout }, (res) => {
                resolve(res.statusCode >= 200 && res.statusCode < 400);
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    /**
     * Start a server with auto port cleanup and retry logic
     */
    async startServer(server, port, host = '0.0.0.0', onSuccess = null) {
        let retries = 0;

        const tryStart = async () => {
            await this.clearPort(port);

            return new Promise((resolve, reject) => {
                const onError = async (err) => {
                    if (err.code === 'EADDRINUSE') {
                        retries++;
                        if (retries <= this.maxRetries) {
                            this.error(`Port ${port} still in use, retry ${retries}/${this.maxRetries}...`);
                            await this.sleep(this.retryDelay);
                            await this.clearPort(port);
                            tryStart().then(resolve).catch(reject);
                        } else {
                            this.error(`Failed to start after ${this.maxRetries} retries`);
                            reject(err);
                        }
                    } else {
                        this.error(`Server error: ${err.message}`);
                        reject(err);
                    }
                };

                server.once('error', onError);
                server.listen(port, host, () => {
                    server.removeListener('error', onError);
                    this.log(`Started on port ${port}`);
                    if (onSuccess) onSuccess();
                    resolve(server);
                });
            });
        };

        return tryStart();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = TroubleshootEngine;
