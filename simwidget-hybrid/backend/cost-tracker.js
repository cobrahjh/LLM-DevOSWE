/**
 * Cost Tracker Module v1.0.0
 * 
 * Tracks operational costs for SimWidget services including:
 * - Current usage costs
 * - Future projected costs
 * - External API costs
 * - Service uptime and resource usage
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\backend\cost-tracker.js
 * Created: 2025-01-08
 */

const fs = require('fs');
const path = require('path');

class CostTracker {
    constructor(logPath = path.join(__dirname, '..', 'logs', 'costs.json')) {
        this.logPath = logPath;
        this.costs = {
            // Service costs per hour (USD)
            services: {
                simwidget: { hourly: 0.05, current: 0, projected: 0, external: 0 },
                agent: { hourly: 0.08, current: 0, projected: 0, external: 0.12 },
                remote: { hourly: 0.03, current: 0, projected: 0, external: 0 }
            },
            // Session tracking
            sessions: {},
            // Daily/monthly limits
            limits: {
                daily: 10.00,
                monthly: 250.00
            },
            // Cost matrix data
            matrix: {
                today: 0,
                thisMonth: 0,
                projectedDaily: 0,
                projectedMonthly: 0,
                externalToday: 0,
                externalMonth: 0
            }
        };
        
        this.loadCosts();
        
        // Update costs every minute
        setInterval(() => this.updateCosts(), 60000);
        
        // Save costs every 5 minutes
        setInterval(() => this.saveCosts(), 300000);
    }
    
    loadCosts() {
        try {
            if (fs.existsSync(this.logPath)) {
                const data = JSON.parse(fs.readFileSync(this.logPath, 'utf8'));
                // Merge saved data with defaults
                this.costs = { ...this.costs, ...data };
                console.log('[CostTracker] Loaded cost data');
            }
        } catch (e) {
            console.log('[CostTracker] Using default cost data');
        }
    }
    
    saveCosts() {
        try {
            const dir = path.dirname(this.logPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            const data = {
                ...this.costs,
                lastUpdated: new Date().toISOString()
            };
            
            fs.writeFileSync(this.logPath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('[CostTracker] Save error:', e.message);
        }
    }
    
    startSession(service, status = 'online') {
        const now = Date.now();
        this.costs.sessions[service] = {
            startTime: now,
            status: status,
            lastUpdate: now
        };
        
        console.log(`[CostTracker] Started session for ${service}`);
    }
    
    endSession(service) {
        const session = this.costs.sessions[service];
        if (session) {
            const duration = (Date.now() - session.startTime) / 1000 / 3600; // hours
            const cost = duration * this.costs.services[service].hourly;
            
            this.costs.services[service].current += cost;
            this.costs.matrix.today += cost;
            this.costs.matrix.thisMonth += cost;
            
            delete this.costs.sessions[service];
            
            console.log(`[CostTracker] Ended session for ${service}: $${cost.toFixed(4)}`);
        }
    }
    
    updateServiceStatus(service, status) {
        if (status === 'online' && !this.costs.sessions[service]) {\n            this.startSession(service, status);\n        } else if (status === 'offline' && this.costs.sessions[service]) {\n            this.endSession(service);\n        }\n        \n        if (this.costs.sessions[service]) {\n            this.costs.sessions[service].status = status;\n            this.costs.sessions[service].lastUpdate = Date.now();\n        }\n    }\n    \n    updateCosts() {\n        const now = Date.now();\n        \n        // Update running sessions\n        for (const [service, session] of Object.entries(this.costs.sessions)) {\n            if (session.status === 'online') {\n                const duration = (now - session.lastUpdate) / 1000 / 3600; // hours since last update\n                const cost = duration * this.costs.services[service].hourly;\n                \n                this.costs.services[service].current += cost;\n                this.costs.matrix.today += cost;\n                this.costs.matrix.thisMonth += cost;\n                \n                session.lastUpdate = now;\n            }\n        }\n        \n        // Calculate projections based on current usage patterns\n        this.updateProjections();\n    }\n    \n    updateProjections() {\n        // Simple projection: current daily rate * remaining days in month\n        const now = new Date();\n        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();\n        const dayOfMonth = now.getDate();\n        const remainingDays = daysInMonth - dayOfMonth;\n        \n        this.costs.matrix.projectedDaily = this.costs.matrix.today;\n        this.costs.matrix.projectedMonthly = this.costs.matrix.thisMonth + (this.costs.matrix.today * remainingDays);\n        \n        // Update service projections\n        for (const service of Object.keys(this.costs.services)) {\n            const current = this.costs.services[service].current;\n            this.costs.services[service].projected = current * 24; // daily projection\n        }\n    }\n    \n    addExternalCost(service, amount, description = '') {\n        this.costs.services[service].external += amount;\n        this.costs.matrix.externalToday += amount;\n        this.costs.matrix.externalMonth += amount;\n        \n        console.log(`[CostTracker] External cost for ${service}: $${amount} - ${description}`);\n    }\n    \n    getCostSummary() {\n        return {\n            services: this.costs.services,\n            matrix: this.costs.matrix,\n            limits: this.costs.limits,\n            alerts: this.getAlerts(),\n            sessions: Object.keys(this.costs.sessions).length\n        };\n    }\n    \n    getServiceCost(service) {\n        const svc = this.costs.services[service];\n        if (!svc) return null;\n        \n        const session = this.costs.sessions[service];\n        let runningCost = 0;\n        \n        if (session && session.status === 'online') {\n            const duration = (Date.now() - session.startTime) / 1000 / 3600;\n            runningCost = duration * svc.hourly;\n        }\n        \n        return {\n            current: svc.current + runningCost,\n            projected: svc.projected,\n            external: svc.external,\n            hourly: svc.hourly,\n            running: session ? session.status === 'online' : false\n        };\n    }\n    \n    getAlerts() {\n        const alerts = [];\n        \n        // Daily limit check\n        if (this.costs.matrix.today >= this.costs.limits.daily * 0.8) {\n            alerts.push({\n                type: 'warning',\n                message: `Daily costs approaching limit: $${this.costs.matrix.today.toFixed(2)}/$${this.costs.limits.daily}`\n            });\n        }\n        \n        // Monthly projection check\n        if (this.costs.matrix.projectedMonthly >= this.costs.limits.monthly * 0.9) {\n            alerts.push({\n                type: 'error',\n                message: `Monthly projection exceeds limit: $${this.costs.matrix.projectedMonthly.toFixed(2)}/$${this.costs.limits.monthly}`\n            });\n        }\n        \n        return alerts;\n    }\n    \n    resetDaily() {\n        // Called at midnight to reset daily counters\n        this.costs.matrix.today = 0;\n        this.costs.matrix.externalToday = 0;\n        \n        for (const service of Object.keys(this.costs.services)) {\n            this.costs.services[service].current = 0;\n        }\n        \n        this.saveCosts();\n        console.log('[CostTracker] Daily costs reset');\n    }\n    \n    resetMonthly() {\n        // Called at start of month to reset monthly counters\n        this.costs.matrix.thisMonth = 0;\n        this.costs.matrix.externalMonth = 0;\n        this.saveCosts();\n        console.log('[CostTracker] Monthly costs reset');\n    }\n}\n\n// Singleton instance\nlet costTracker = null;\n\nfunction getCostTracker() {\n    if (!costTracker) {\n        costTracker = new CostTracker();\n    }\n    return costTracker;\n}\n\nmodule.exports = {\n    getCostTracker,\n    CostTracker\n};"