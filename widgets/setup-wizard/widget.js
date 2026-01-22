/**
 * Setup Wizard Widget
 * SimWidget Engine v2.0.0 - Smart Installer / First-Run Wizard
 */

class SetupWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.config = {
            msfsVersion: null,
            chasePlaneDetected: false,
            ahkDetected: false,
            simConnectDetected: false,
            cameraMode: 'native',
            autostartServer: false,
            autostartOverlay: false,
            serverPort: 8080,
            theme: 'dark'
        };

        this.init();
    }

    init() {
        this.cacheElements();
        this.setupEvents();
        this.loadExistingConfig();
    }

    cacheElements() {
        this.elements = {
            steps: document.querySelectorAll('.wiz-step'),
            panels: document.querySelectorAll('.wiz-panel'),
            btnBack: document.getElementById('btn-back'),
            btnNext: document.getElementById('btn-next'),
            // Detection elements
            detectMsfs: document.getElementById('detect-msfs'),
            detectChaseplane: document.getElementById('detect-chaseplane'),
            detectAhk: document.getElementById('detect-ahk'),
            detectSimconnect: document.getElementById('detect-simconnect'),
            msfsStatus: document.getElementById('msfs-status'),
            chaseplaneStatus: document.getElementById('chaseplane-status'),
            ahkStatus: document.getElementById('ahk-status'),
            simconnectStatus: document.getElementById('simconnect-status'),
            detectSummary: document.getElementById('detect-summary'),
            summaryIcon: document.getElementById('summary-icon'),
            summaryText: document.getElementById('summary-text'),
            // Config elements
            camChaseplane: document.getElementById('cam-chaseplane'),
            camNative: document.getElementById('cam-native'),
            autostartServer: document.getElementById('autostart-server'),
            autostartOverlay: document.getElementById('autostart-overlay'),
            serverPort: document.getElementById('server-port'),
            // Final summary
            finalMsfs: document.getElementById('final-msfs'),
            finalCamera: document.getElementById('final-camera'),
            finalPort: document.getElementById('final-port')
        };
    }

    setupEvents() {
        // Navigation buttons
        this.elements.btnBack.addEventListener('click', () => this.prevStep());
        this.elements.btnNext.addEventListener('click', () => this.nextStep());

        // Theme buttons
        document.querySelectorAll('.wiz-theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.wiz-theme-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.config.theme = e.target.dataset.theme;
            });
        });

        // Config inputs
        if (this.elements.camChaseplane) {
            this.elements.camChaseplane.addEventListener('change', () => {
                this.config.cameraMode = 'chaseplane';
            });
        }
        if (this.elements.camNative) {
            this.elements.camNative.addEventListener('change', () => {
                this.config.cameraMode = 'native';
            });
        }
        if (this.elements.autostartServer) {
            this.elements.autostartServer.addEventListener('change', (e) => {
                this.config.autostartServer = e.target.checked;
            });
        }
        if (this.elements.autostartOverlay) {
            this.elements.autostartOverlay.addEventListener('change', (e) => {
                this.config.autostartOverlay = e.target.checked;
            });
        }
        if (this.elements.serverPort) {
            this.elements.serverPort.addEventListener('change', (e) => {
                this.config.serverPort = parseInt(e.target.value) || 8080;
            });
        }
    }

    async loadExistingConfig() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const existingConfig = await response.json();
                Object.assign(this.config, existingConfig);
                this.applyConfigToUI();
            }
        } catch (e) {
            // No existing config, use defaults
        }
    }

    applyConfigToUI() {
        if (this.config.cameraMode === 'chaseplane' && this.elements.camChaseplane) {
            this.elements.camChaseplane.checked = true;
        }
        if (this.elements.autostartServer) {
            this.elements.autostartServer.checked = this.config.autostartServer;
        }
        if (this.elements.autostartOverlay) {
            this.elements.autostartOverlay.checked = this.config.autostartOverlay;
        }
        if (this.elements.serverPort) {
            this.elements.serverPort.value = this.config.serverPort;
        }
    }

    goToStep(step) {
        this.currentStep = step;

        // Update step indicators
        this.elements.steps.forEach((el, i) => {
            el.classList.toggle('active', i + 1 <= step);
            el.classList.toggle('current', i + 1 === step);
        });

        // Update panels
        this.elements.panels.forEach((el, i) => {
            el.classList.toggle('active', i + 1 === step);
        });

        // Update navigation buttons
        this.elements.btnBack.style.visibility = step === 1 ? 'hidden' : 'visible';

        if (step === this.totalSteps) {
            this.elements.btnNext.textContent = 'Finish ✓';
            this.elements.btnNext.classList.add('finish');
        } else {
            this.elements.btnNext.textContent = 'Next →';
            this.elements.btnNext.classList.remove('finish');
        }

        // Run step-specific actions
        if (step === 2) {
            this.runDetection();
        } else if (step === 3) {
            this.prepareConfigStep();
        } else if (step === 4) {
            this.prepareFinalStep();
        }
    }

    nextStep() {
        if (this.currentStep === this.totalSteps) {
            this.finishSetup();
        } else {
            this.goToStep(this.currentStep + 1);
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.goToStep(this.currentStep - 1);
        }
    }

    async runDetection() {
        // Reset detection UI
        const items = ['msfs', 'chaseplane', 'ahk', 'simconnect'];
        items.forEach(item => {
            const el = document.getElementById(`detect-${item}`);
            const status = document.getElementById(`${item}-status`);
            if (el) el.querySelector('.wiz-detect-icon').textContent = '⏳';
            if (status) status.textContent = 'Checking...';
        });
        this.elements.detectSummary.style.display = 'none';

        // Run detection via server API
        try {
            const response = await fetch('/api/detect');
            const results = await response.json();

            // Update MSFS status
            await this.delay(500);
            this.updateDetectItem('msfs', results.msfs?.detected, results.msfs?.version || 'Not found');
            this.config.msfsVersion = results.msfs?.version;

            // Update ChasePlane status
            await this.delay(400);
            this.updateDetectItem('chaseplane', results.chaseplane?.detected,
                results.chaseplane?.detected ? 'Installed' : 'Not found');
            this.config.chasePlaneDetected = results.chaseplane?.detected;

            // Update AHK status
            await this.delay(300);
            this.updateDetectItem('ahk', results.ahk?.detected,
                results.ahk?.detected ? 'Installed' : 'Not found');
            this.config.ahkDetected = results.ahk?.detected;

            // Update SimConnect status
            await this.delay(400);
            this.updateDetectItem('simconnect', results.simconnect?.detected,
                results.simconnect?.detected ? 'Available' : 'Not found');
            this.config.simConnectDetected = results.simconnect?.detected;

        } catch (e) {
            // Fallback: simulate detection for demo
            await this.simulateDetection();
        }

        // Show summary
        await this.delay(500);
        this.showDetectionSummary();
    }

    async simulateDetection() {
        // Simulated detection for demo/testing
        await this.delay(600);
        this.updateDetectItem('msfs', true, 'MSFS 2024');
        this.config.msfsVersion = 'MSFS 2024';

        await this.delay(400);
        this.updateDetectItem('chaseplane', false, 'Not found');
        this.config.chasePlaneDetected = false;

        await this.delay(300);
        this.updateDetectItem('ahk', true, 'Installed');
        this.config.ahkDetected = true;

        await this.delay(400);
        this.updateDetectItem('simconnect', true, 'Available');
        this.config.simConnectDetected = true;
    }

    updateDetectItem(item, success, statusText) {
        const el = document.getElementById(`detect-${item}`);
        const status = document.getElementById(`${item}-status`);

        if (el) {
            el.querySelector('.wiz-detect-icon').textContent = success ? '✅' : '❌';
            el.classList.toggle('success', success);
            el.classList.toggle('failed', !success);
        }
        if (status) {
            status.textContent = statusText;
        }
    }

    showDetectionSummary() {
        const hasRequired = this.config.msfsVersion && this.config.simConnectDetected;

        this.elements.summaryIcon.textContent = hasRequired ? '✅' : '⚠️';
        this.elements.summaryText.textContent = hasRequired
            ? 'All required components detected!'
            : 'Some components missing. SimWidget may have limited functionality.';

        this.elements.detectSummary.style.display = 'flex';
        this.elements.detectSummary.classList.toggle('warning', !hasRequired);
    }

    prepareConfigStep() {
        // Pre-select camera mode based on detection
        if (this.config.chasePlaneDetected && this.config.ahkDetected) {
            this.elements.camChaseplane.checked = true;
            this.config.cameraMode = 'chaseplane';
        } else {
            this.elements.camNative.checked = true;
            this.config.cameraMode = 'native';
        }

        // Disable ChasePlane option if not detected
        if (this.elements.camChaseplane) {
            const label = this.elements.camChaseplane.closest('.wiz-radio');
            if (!this.config.chasePlaneDetected || !this.config.ahkDetected) {
                this.elements.camChaseplane.disabled = true;
                label.classList.add('disabled');
                label.title = 'ChasePlane or AutoHotKey not detected';
            } else {
                this.elements.camChaseplane.disabled = false;
                label.classList.remove('disabled');
                label.title = '';
            }
        }
    }

    prepareFinalStep() {
        // Update final summary
        this.elements.finalMsfs.textContent = this.config.msfsVersion || 'Not detected';
        this.elements.finalCamera.textContent = this.config.cameraMode === 'chaseplane'
            ? 'ChasePlane (AHK)'
            : 'Native MSFS';
        this.elements.finalPort.textContent = this.config.serverPort;
    }

    async finishSetup() {
        // Save configuration
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.config)
            });
        } catch (e) {
            console.log('Config saved locally (server not available)');
        }

        // Save to localStorage as backup
        localStorage.setItem('simwidget-config', JSON.stringify(this.config));

        // Mark setup as complete
        localStorage.setItem('simwidget-setup-complete', 'true');

        // Redirect to main widget or close
        this.elements.btnNext.textContent = 'Done! ✓';
        this.elements.btnNext.disabled = true;

        // Show completion message
        setTimeout(() => {
            alert('Setup complete! You can now use SimWidget.');
            // Optionally redirect: window.location.href = '/';
        }, 500);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.setupWizard = new SetupWizard();
});
