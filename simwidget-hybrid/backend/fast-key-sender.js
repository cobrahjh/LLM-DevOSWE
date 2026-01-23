/**
 * Fast Key Sender
 * Uses a persistent PowerShell process for sub-100ms key sending
 */

const { spawn } = require('child_process');
const EventEmitter = require('events');

class FastKeySender extends EventEmitter {
    constructor() {
        super();
        this.process = null;
        this.ready = false;
        this.queue = [];
        this.processing = false;
        this.stats = {
            sent: 0,
            errors: 0,
            avgLatency: 0,
            latencies: []
        };
    }

    /**
     * Start the persistent PowerShell process
     */
    async start() {
        if (this.process) {
            console.log('[FastKeySender] Already running');
            return;
        }

        console.log('[FastKeySender] Starting persistent PowerShell process...');

        // PowerShell script that reads commands from stdin
        const script = `
            Add-Type -AssemblyName System.Windows.Forms
            $shell = New-Object -ComObject WScript.Shell

            $keyMap = @{
                'BACKSPACE' = '{BACKSPACE}'; 'TAB' = '{TAB}'; 'ENTER' = '{ENTER}'
                'ESC' = '{ESC}'; 'ESCAPE' = '{ESC}'; 'SPACE' = ' '
                'PAGEUP' = '{PGUP}'; 'PAGEDOWN' = '{PGDN}'
                'END' = '{END}'; 'HOME' = '{HOME}'
                'LEFT' = '{LEFT}'; 'UP' = '{UP}'; 'RIGHT' = '{RIGHT}'; 'DOWN' = '{DOWN}'
                'INSERT' = '{INSERT}'; 'DELETE' = '{DELETE}'
                'F1' = '{F1}'; 'F2' = '{F2}'; 'F3' = '{F3}'; 'F4' = '{F4}'
                'F5' = '{F5}'; 'F6' = '{F6}'; 'F7' = '{F7}'; 'F8' = '{F8}'
                'F9' = '{F9}'; 'F10' = '{F10}'; 'F11' = '{F11}'; 'F12' = '{F12}'
                'NUMPAD0' = '{NUMPAD0}'; 'NUMPAD1' = '{NUMPAD1}'; 'NUMPAD2' = '{NUMPAD2}'
                'NUMPAD3' = '{NUMPAD3}'; 'NUMPAD4' = '{NUMPAD4}'; 'NUMPAD5' = '{NUMPAD5}'
                'NUMPAD6' = '{NUMPAD6}'; 'NUMPAD7' = '{NUMPAD7}'; 'NUMPAD8' = '{NUMPAD8}'
                'NUMPAD9' = '{NUMPAD9}'
            }

            Write-Output "READY"

            while ($true) {
                $line = [Console]::ReadLine()
                if ($line -eq "EXIT") { break }
                if (-not $line) { continue }

                try {
                    # Focus MSFS window first
                    $shell.AppActivate('Microsoft Flight Simulator') | Out-Null
                    Start-Sleep -Milliseconds 50

                    $parts = $line -split '\\+'
                    $modPrefix = ''
                    $mainKey = $parts[-1]

                    for ($i = 0; $i -lt $parts.Length - 1; $i++) {
                        switch ($parts[$i].ToUpper()) {
                            'SHIFT' { $modPrefix += '+' }
                            'CTRL'  { $modPrefix += '^' }
                            'ALT'   { $modPrefix += '%' }
                        }
                    }

                    $sendKey = $mainKey.ToUpper()
                    if ($keyMap.ContainsKey($sendKey)) {
                        $sendKey = $keyMap[$sendKey]
                    } elseif ($sendKey.Length -eq 1) {
                        $sendKey = $sendKey.ToLower()
                    }

                    [System.Windows.Forms.SendKeys]::SendWait("$modPrefix$sendKey")
                    Write-Output "OK:$line"
                } catch {
                    Write-Output "ERR:$line"
                }
            }
        `;

        this.process = spawn('powershell', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-Command', script
        ], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout.on('data', (data) => {
            const lines = data.toString().trim().split('\n');
            for (const line of lines) {
                if (line === 'READY') {
                    this.ready = true;
                    console.log('[FastKeySender] Ready');
                    this.emit('ready');
                    this.processQueue();
                } else if (line.startsWith('OK:')) {
                    this.emit('sent', line.substring(3));
                } else if (line.startsWith('ERR:')) {
                    this.stats.errors++;
                    this.emit('error', line.substring(4));
                }
            }
        });

        this.process.stderr.on('data', (data) => {
            console.error('[FastKeySender] Error:', data.toString());
        });

        this.process.on('close', (code) => {
            console.log('[FastKeySender] Process exited with code', code);
            this.process = null;
            this.ready = false;
        });

        // Wait for ready signal
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('FastKeySender startup timeout'));
            }, 5000);

            this.once('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }

    /**
     * Stop the PowerShell process
     */
    stop() {
        if (this.process) {
            this.process.stdin.write('EXIT\n');
            this.process.kill();
            this.process = null;
            this.ready = false;
            console.log('[FastKeySender] Stopped');
        }
    }

    /**
     * Send a key
     */
    async send(key) {
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            if (!this.ready) {
                // Queue if not ready
                this.queue.push({ key, resolve, reject, startTime });
                return;
            }

            this.process.stdin.write(key + '\n');

            const onSent = (sentKey) => {
                if (sentKey === key) {
                    const latency = Date.now() - startTime;
                    this.stats.sent++;
                    this.stats.latencies.push(latency);
                    if (this.stats.latencies.length > 100) {
                        this.stats.latencies.shift();
                    }
                    this.stats.avgLatency = Math.round(
                        this.stats.latencies.reduce((a, b) => a + b, 0) / this.stats.latencies.length
                    );
                    this.removeListener('sent', onSent);
                    this.removeListener('error', onError);
                    resolve({ success: true, latency });
                }
            };

            const onError = (errKey) => {
                if (errKey === key) {
                    this.removeListener('sent', onSent);
                    this.removeListener('error', onError);
                    reject(new Error(`Failed to send key: ${key}`));
                }
            };

            this.on('sent', onSent);
            this.on('error', onError);

            // Timeout
            setTimeout(() => {
                this.removeListener('sent', onSent);
                this.removeListener('error', onError);
                reject(new Error(`Timeout sending key: ${key}`));
            }, 1000);
        });
    }

    /**
     * Process queued keys
     */
    processQueue() {
        while (this.queue.length > 0 && this.ready) {
            const { key, resolve, reject, startTime } = this.queue.shift();
            this.send(key).then(resolve).catch(reject);
        }
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            ...this.stats,
            ready: this.ready,
            queueLength: this.queue.length
        };
    }
}

module.exports = FastKeySender;
