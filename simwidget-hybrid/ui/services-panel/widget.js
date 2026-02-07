/**
 * Services Panel Widget v1.1.0
 * 
 * Monitors and controls SimGlass services with enhanced logging and status feedback
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\ui\services-panel\widget.js
 * Last Updated: 2025-01-08
 */

class ServicesPanel {
    constructor() {
        const host = window.location.hostname || 'localhost';
        this.services = {
            SimGlass: { port: 8080, url: `http://${host}:8080`, status: 'checking' },
            agent: { port: 8585, url: `http://${host}:8585`, status: 'checking' },
            remote: { port: 8590, url: `http://${host}:8590`, status: 'checking' }
        };
        
        this.collapsed = false;
        this.checkInterval = null;
        this.logContainer = null;
        
        this.init();
    }
    
    init() {
        this.logContainer = document.getElementById('service-log');
        this.bindEvents();
        this.checkAllServices();
        
        // Check services every 5 seconds
        this.checkInterval = setInterval(() => this.checkAllServices(), 5000);
        
        this.addLogMessage('Services panel initialized', 'info');
    }
    
    bindEvents() {
        // Collapse button
        const btnCollapse = document.getElementById('btn-collapse');
        if (btnCollapse) {
            btnCollapse.addEventListener('click', () => this.toggleCollapse());
        }
        
        // Clear log button
        const btnClearLog = document.getElementById('btn-clear-log');
        if (btnClearLog) {
            btnClearLog.addEventListener('click', () => this.clearLog());
        }
        
        // Status dot clicks - show service details
        document.querySelectorAll('.status-dot').forEach(dot => {
            dot.addEventListener('click', (e) => {
                const serviceId = e.target.id.replace('status-', '');
                this.showServiceStatus(serviceId);
            });
        });
        
        // Service control buttons
        document.querySelectorAll('.service-row').forEach(row => {
            const service = row.dataset.service;
            
            row.querySelectorAll('.btn-control').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    this.handleServiceAction(service, action);
                });
            });
        });
        
        // Compact dots - click to expand
        document.querySelectorAll('.compact-dot').forEach(dot => {
            dot.addEventListener('click', () => this.toggleCollapse());
        });
    }
    
    addLogMessage(message, type = 'info', service = null) {
        if (!this.logContainer) return;
        
        // Remove welcome message if present
        const welcome = this.logContainer.querySelector('.welcome');
        if (welcome) {
            welcome.remove();
        }
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-message ${type}`;
        
        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        let content = `<span class="log-timestamp">${timestamp}</span>`;
        if (service) {
            content += `<span class="log-service">[${service.toUpperCase()}]</span>`;
        }
        content += message;
        
        logEntry.innerHTML = content;
        this.logContainer.appendChild(logEntry);
        
        // Auto-scroll to bottom
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
        
        // Keep only last 50 messages
        const messages = this.logContainer.querySelectorAll('.log-message:not(.welcome)');
        if (messages.length > 50) {
            messages[0].remove();
        }
    }
    
    clearLog() {
        if (this.logContainer) {
            this.logContainer.innerHTML = '<div class="log-message welcome">Log cleared</div>';
        }
    }
    
    showServiceStatus(serviceId) {
        const service = this.services[serviceId];
        if (!service) return;
        
        const statusText = service.status.charAt(0).toUpperCase() + service.status.slice(1);
        this.addLogMessage(`Status: ${statusText} (Port ${service.port})`, 'info', serviceId);
        
        // Show additional info based on status
        if (service.status === 'online') {
            this.addLogMessage(`Service is running and responding on ${service.url}`, 'success', serviceId);
        } else if (service.status === 'offline') {
            this.addLogMessage(`Service is not responding on port ${service.port}`, 'warning', serviceId);
        } else if (service.status === 'checking') {
            this.addLogMessage(`Checking service connectivity...`, 'info', serviceId);
        }
    }
    
    async checkService(name) {
        const service = this.services[name];
        this.updateStatus(name, 'checking');
        
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${service.url}/api/status`, {
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            
            if (response.ok) {
                if (service.status !== 'online') {
                    this.addLogMessage('Service came online', 'success', name);
                }
                service.status = 'online';
            } else {
                if (service.status === 'online') {
                    this.addLogMessage(`Service returned error ${response.status}`, 'error', name);
                }
                service.status = 'offline';
            }
        } catch (err) {
            if (service.status === 'online') {
                this.addLogMessage('Service went offline', 'warning', name);
            }
            service.status = 'offline';
        }
        
        this.updateStatus(name, service.status);
    }
    
    async checkAllServices() {
        for (const name of Object.keys(this.services)) {
            await this.checkService(name);
        }
    }
    
    updateStatus(name, status) {
        // Update main status dot
        const dot = document.getElementById(`status-${name}`);
        if (dot) {
            dot.className = 'status-dot ' + status;
        }
        
        // Update compact dot
        const compactDot = document.getElementById(`compact-${name}`);
        if (compactDot) {
            compactDot.className = 'compact-dot ' + status;
        }
    }
    
    disableControls(service, disabled = true) {
        const row = document.querySelector(`[data-service="${service}"]`);
        if (!row) return;
        
        const controls = row.querySelectorAll('.btn-control:not(.btn-refresh)');
        controls.forEach(btn => {
            btn.disabled = disabled;
        });
    }
    
    async handleServiceAction(service, action) {
        console.log(`[Services] ${action} ${service}`);
        
        if (action === 'refresh') {
            this.addLogMessage(`Refreshing status...`, 'info', service);
            await this.checkService(service);
            return;
        }
        
        // Set status to show we're working
        const actionStatus = action === 'start' ? 'starting' : 'stopping';
        this.updateStatus(service, actionStatus);
        this.disableControls(service, true);
        
        this.addLogMessage(`${action === 'start' ? 'Starting' : 'Stopping'} service...`, 'info', service);
        
        try {
            // Try main SimGlass API first
            const host = window.location.hostname || 'localhost';
            const response = await fetch(`http://${host}:8080/api/services`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service, action })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.addLogMessage(`${action} command sent successfully`, 'success', service);
                    if (result.error) {
                        this.addLogMessage(`Warning: ${result.error}`, 'warning', service);
                    }
                } else {
                    this.addLogMessage(`${action} failed: ${result.error || 'Unknown error'}`, 'error', service);
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
            
        } catch (err) {
            this.addLogMessage(`Main API failed (${err.message}), trying Remote API...`, 'warning', service);
            
            // Fallback to Remote Support API
            try {\n                const remoteResponse = await fetch('http://localhost:8590/api/services', {\n                    method: 'POST',\n                    headers: { \n                        'Content-Type': 'application/json',\n                        'X-API-Key': 'SimGlass-remote-2025'\n                    },\n                    body: JSON.stringify({ service, action })\n                });\n                \n                if (remoteResponse.ok) {\n                    const result = await remoteResponse.json();\n                    if (result.success) {\n                        this.addLogMessage(`${action} via Remote API: OK`, 'success', service);\n                    } else {\n                        this.addLogMessage(`Remote API error: ${result.error}`, 'error', service);\n                    }\n                } else {\n                    this.addLogMessage(`Remote API HTTP ${remoteResponse.status}`, 'error', service);\n                }\n            } catch (remoteErr) {\n                this.addLogMessage(`Remote API also failed: ${remoteErr.message}`, 'error', service);\n                this.addLogMessage('Try manually starting the service from command line', 'warning', service);\n            }\n        }\n        \n        // Re-enable controls and check status after a delay\n        setTimeout(() => {\n            this.disableControls(service, false);\n            this.checkService(service);\n        }, 3000);\n    }\n    \n    toggleCollapse() {\n        this.collapsed = !this.collapsed;\n        const container = document.getElementById('services-panel');\n        \n        if (this.collapsed) {\n            container.classList.add('collapsed');\n            this.addLogMessage('Panel collapsed to status dots', 'info');\n        } else {\n            container.classList.remove('collapsed');\n            this.addLogMessage('Panel expanded', 'info');\n        }\n    }\n    \n    destroy() {\n        if (this.checkInterval) {\n            clearInterval(this.checkInterval);\n        }\n    }\n}\n\n// Initialize\nconst servicesPanel = new ServicesPanel();