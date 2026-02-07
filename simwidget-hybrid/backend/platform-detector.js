/**
 * Platform Detector for SimGlass
 * 
 * Detects the current platform and available input methods
 * Provides platform indicators for button processes
 */

const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');

class PlatformDetector {
    constructor() {
        this.platform = os.platform();
        this.architecture = os.arch();
        this.capabilities = {
            powershell: false,
            vjoy: false,
            sendkeys: false,
            simconnect: false,
            keyboardAPI: false
        };
        this.preferredMethod = 'unknown';
        this.lastCheck = null;
        this.buttonExecutionMethods = [];
    }

    /**
     * Get basic platform info
     */
    getPlatformInfo() {
        return {
            platform: this.platform,
            arch: this.architecture,
            node: process.version,
            isWindows: this.platform === 'win32',
            isLinux: this.platform === 'linux',
            isMac: this.platform === 'darwin'
        };
    }

    /**
     * Detect available input capabilities
     */
    async detectCapabilities() {
        console.log('[Platform] Detecting input capabilities...');
        
        const checks = [];

        // Check PowerShell (Windows only)
        if (this.platform === 'win32') {
            checks.push(this.checkPowerShell());
            checks.push(this.checkVJoy());
            checks.push(this.checkSendKeys());
            checks.push(this.checkKeyboardAPI());
        }

        // Check SimConnect availability
        checks.push(this.checkSimConnect());

        await Promise.all(checks);
        this.determinePreferredMethod();
        this.buildButtonExecutionMethods();
        this.lastCheck = Date.now();

        console.log('[Platform] Capabilities:', this.capabilities);
        console.log('[Platform] Preferred method:', this.preferredMethod);
        console.log('[Platform] Button execution methods:', this.buttonExecutionMethods.map(m => m.method));

        return this.getStatus();
    }

    /**
     * Check if PowerShell is available and working
     */
    async checkPowerShell() {
        return new Promise((resolve) => {
            exec('powershell -Command "Write-Output OK"', { timeout: 5000 }, (err, stdout) => {
                this.capabilities.powershell = !err && stdout.trim() === 'OK';
                resolve(this.capabilities.powershell);
            });
        });
    }

    /**
     * Check if vJoy is installed and configured
     */
    async checkVJoy() {
        return new Promise((resolve) => {
            // Check if vJoy DLL exists
            const vjoyPath = 'C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll';
            
            fs.access(vjoyPath, fs.constants.F_OK, (err) => {
                if (err) {
                    this.capabilities.vjoy = false;
                    resolve(false);
                    return;
                }

                // Test vJoy functionality
                const testScript = `
                    try {
                        Add-Type -Path "${vjoyPath}"
                        $vjoy = New-Object vJoy.vJoy
                        if ($vjoy.vJoyEnabled()) {
                            Write-Output "OK"
                        } else {
                            Write-Output "DISABLED"
                        }
                    } catch {
                        Write-Output "ERROR"
                    }
                `;

                exec(`powershell -Command "${testScript.replace(/\n\s+/g, ' ')}"`, 
                    { timeout: 5000 }, (err, stdout) => {
                        this.capabilities.vjoy = !err && stdout.trim() === 'OK';
                        resolve(this.capabilities.vjoy);
                    });
            });
        });
    }

    /**
     * Check if Windows SendKeys is available
     */
    async checkSendKeys() {
        return new Promise((resolve) => {
            const testScript = `
                try {
                    Add-Type -AssemblyName System.Windows.Forms
                    Write-Output "OK"
                } catch {
                    Write-Output "ERROR"
                }
            `;

            exec(`powershell -Command "${testScript.replace(/\n\s+/g, ' ')}"`, 
                { timeout: 5000 }, (err, stdout) => {
                    this.capabilities.sendkeys = !err && stdout.trim() === 'OK';
                    resolve(this.capabilities.sendkeys);
                });
        });
    }

    /**
     * Check if Keyboard API (KeySenderService) is available
     */
    async checkKeyboardAPI() {
        return new Promise((resolve) => {
            const servicePath = 'C:\\DevOSWE\\KeySenderService\\bin\\Release\\net8.0\\KeySenderService.exe';
            
            fs.access(servicePath, fs.constants.F_OK, (err) => {
                this.capabilities.keyboardAPI = !err;
                resolve(this.capabilities.keyboardAPI);
            });
        });
    }

    /**
     * Check SimConnect availability (placeholder)
     */
    async checkSimConnect() {
        // For now, assume SimConnect might be available on Windows
        // This would need actual SimConnect SDK integration
        this.capabilities.simconnect = this.platform === 'win32';
        return this.capabilities.simconnect;
    }

    /**
     * Determine the best input method based on capabilities
     */
    determinePreferredMethod() {
        if (this.capabilities.vjoy) {
            this.preferredMethod = 'vjoy';
        } else if (this.capabilities.keyboardAPI) {
            this.preferredMethod = 'keyboard-api';
        } else if (this.capabilities.sendkeys) {
            this.preferredMethod = 'sendkeys';
        } else if (this.capabilities.powershell) {
            this.preferredMethod = 'powershell';
        } else if (this.capabilities.simconnect) {
            this.preferredMethod = 'simconnect';
        } else {
            this.preferredMethod = 'none';
        }
    }

    /**
     * Build list of available button execution methods with details
     */
    buildButtonExecutionMethods() {
        this.buttonExecutionMethods = [];

        if (this.capabilities.vjoy) {
            this.buttonExecutionMethods.push({
                method: 'vjoy',
                name: 'vJoy Virtual Joystick',
                icon: '🎮',
                reliability: 'excellent',
                speed: 'instant',
                description: 'Virtual joystick input - most reliable for flight simulators',
                compatible: ['MSFS 2024', 'X-Plane', 'P3D', 'FSX'],
                preferred: true
            });
        }

        if (this.capabilities.keyboardAPI) {
            this.buttonExecutionMethods.push({
                method: 'keyboard-api',
                name: 'KeySender Service',
                icon: '⚡',
                reliability: 'excellent',
                speed: 'very-fast',
                description: 'Native Windows key sender service (~5ms response)',
                compatible: ['All Windows applications'],
                preferred: !this.capabilities.vjoy
            });
        }

        if (this.capabilities.sendkeys) {
            this.buttonExecutionMethods.push({
                method: 'sendkeys',
                name: 'Windows SendKeys',
                icon: '⌨️',
                reliability: 'good',
                speed: 'fast',
                description: 'Windows Forms SendKeys API',
                compatible: ['All Windows applications'],
                preferred: false
            });
        }

        if (this.capabilities.powershell) {
            this.buttonExecutionMethods.push({
                method: 'powershell',
                name: 'PowerShell Direct',
                icon: '💻',
                reliability: 'fair',
                speed: 'slow',
                description: 'PowerShell script execution',
                compatible: ['Windows system functions'],
                preferred: false
            });
        }

        if (this.capabilities.simconnect) {
            this.buttonExecutionMethods.push({
                method: 'simconnect',
                name: 'SimConnect SDK',
                icon: '✈️',
                reliability: 'excellent',
                speed: 'instant',
                description: 'Direct simulator communication',
                compatible: ['MSFS 2024', 'P3D', 'FSX'],
                preferred: false // Would be preferred but not implemented yet
            });
        }

        if (this.buttonExecutionMethods.length === 0) {
            this.buttonExecutionMethods.push({
                method: 'none',
                name: 'No Method Available',
                icon: '❌',
                reliability: 'none',
                speed: 'none',
                description: 'No compatible input method detected',
                compatible: [],
                preferred: false
            });
        }
    }

    /**
     * Get platform indicator for UI
     */
    getPlatformIndicator() {
        const method = this.buttonExecutionMethods.find(m => m.method === this.preferredMethod) || 
                     this.buttonExecutionMethods[0] || 
                     { method: 'unknown', name: 'Detecting...', icon: '❓', reliability: 'unknown' };

        return {
            icon: method.icon,
            label: method.name,
            method: this.preferredMethod,
            reliable: ['excellent', 'good'].includes(method.reliability),
            platform: this.platform,
            speed: method.speed || 'unknown',
            description: method.description || ''
        };
    }

    /**
     * Get button execution context for button processes
     */
    getButtonExecutionContext() {
        const indicator = this.getPlatformIndicator();
        
        return {
            platform: this.getPlatformInfo(),
            preferredMethod: this.preferredMethod,
            availableMethods: this.buttonExecutionMethods,
            indicator: indicator,
            capabilities: this.capabilities,
            recommendations: this.getRecommendations(),
            performance: {
                estimatedLatency: this.getEstimatedLatency(this.preferredMethod),
                reliability: indicator.reliable ? 'high' : 'medium'
            }
        };
    }

    /**
     * Get estimated latency for button execution method
     */
    getEstimatedLatency(method) {
        const latencies = {
            'vjoy': '1-2ms',
            'keyboard-api': '5-10ms',
            'sendkeys': '50-100ms',
            'simconnect': '1-5ms',
            'powershell': '200-700ms',
            'none': 'N/A'
        };
        return latencies[method] || 'Unknown';
    }

    /**
     * Get full status including recommendations
     */
    getStatus() {
        const indicator = this.getPlatformIndicator();
        
        return {
            platform: this.getPlatformInfo(),
            capabilities: this.capabilities,
            preferred: this.preferredMethod,
            indicator: indicator,
            buttonMethods: this.buttonExecutionMethods,
            buttonContext: this.getButtonExecutionContext(),
            recommendations: this.getRecommendations(),
            lastCheck: this.lastCheck
        };
    }

    /**
     * Get recommendations for improving input reliability
     */
    getRecommendations() {
        const recommendations = [];

        if (this.platform === 'win32') {
            if (!this.capabilities.vjoy) {
                recommendations.push({
                    type: 'install',
                    priority: 'high',
                    title: 'Install vJoy',
                    description: 'vJoy provides the most reliable button input for flight simulators',
                    url: 'http://vjoystick.sourceforge.net/',
                    benefit: 'Instant button response, 100% compatibility with flight simulators'
                });
            }

            if (!this.capabilities.keyboardAPI && this.capabilities.powershell) {
                recommendations.push({
                    type: 'build',
                    priority: 'medium',
                    title: 'Build KeySender Service',
                    description: 'Fast native key sending service (5ms vs 700ms)',
                    benefit: '95% faster key sending, more reliable than PowerShell'
                });
            }

            if (!this.capabilities.powershell && this.platform === 'win32') {
                recommendations.push({
                    type: 'system',
                    priority: 'medium',
                    title: 'Enable PowerShell',
                    description: 'PowerShell execution policy may be blocking scripts',
                    benefit: 'Enable fallback button execution method'
                });
            }
        } else {
            recommendations.push({
                type: 'platform',
                priority: 'info',
                title: 'Limited Support',
                description: `Platform ${this.platform} has limited input method support`,
                benefit: 'Consider using Windows for full SimGlass functionality'
            });
        }

        return recommendations;
    }

    /**
     * Force refresh of capabilities
     */
    async refresh() {
        return await this.detectCapabilities();
    }

    /**
     * Get method-specific button execution indicator
     */
    getMethodIndicator(method) {
        const methodData = this.buttonExecutionMethods.find(m => m.method === method);
        if (!methodData) return null;

        return {
            icon: methodData.icon,
            name: methodData.name,
            reliability: methodData.reliability,
            speed: methodData.speed,
            description: methodData.description,
            estimatedLatency: this.getEstimatedLatency(method)
        };
    }

    /**
     * Check if a specific method is available
     */
    hasMethod(method) {
        return this.buttonExecutionMethods.some(m => m.method === method);
    }

    /**
     * Get best method for specific action type
     */
    getBestMethodFor(actionType) {
        switch (actionType) {
            case 'keyboard':
                if (this.hasMethod('keyboard-api')) return 'keyboard-api';
                if (this.hasMethod('sendkeys')) return 'sendkeys';
                if (this.hasMethod('powershell')) return 'powershell';
                break;
            case 'joystick':
            case 'button':
                if (this.hasMethod('vjoy')) return 'vjoy';
                break;
            case 'simvar':
            case 'event':
                if (this.hasMethod('simconnect')) return 'simconnect';
                if (this.hasMethod('keyboard-api')) return 'keyboard-api';
                break;
        }
        return this.preferredMethod;
    }
}

// Create singleton instance
let instance = null;

function getPlatformDetector() {
    if (!instance) {
        instance = new PlatformDetector();
    }
    return instance;
}

module.exports = { PlatformDetector, getPlatformDetector };