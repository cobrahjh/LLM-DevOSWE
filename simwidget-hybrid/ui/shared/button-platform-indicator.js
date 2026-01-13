/**
 * Button Platform Indicator v1.0.0
 * Last Updated: 2025-01-08
 * 
 * Shows platform capabilities and method indicators for button execution
 */

class ButtonPlatformIndicator {
    constructor(options = {}) {
        this.container = options.container;
        this.api = options.api;
        this.mode = options.mode || 'compact'; // 'compact', 'detailed', 'tooltip'
        this.position = options.position || 'top-right';
        this.showRecommendations = options.showRecommendations !== false;
        
        this.platformData = null;
        this.indicatorEl = null;
        this.detailsEl = null;
        this.isExpanded = false;
        
        this.init();
    }

    init() {
        this.createIndicator();
        if (this.api) {
            this.loadPlatformData();
        }
    }

    /**
     * Create the platform indicator UI
     */
    createIndicator() {
        this.indicatorEl = document.createElement('div');
        this.indicatorEl.className = `button-platform-indicator ${this.mode} ${this.position}`;
        this.indicatorEl.innerHTML = this.renderLoading();
        
        // Add click handler for expansion
        this.indicatorEl.addEventListener('click', () => this.toggleDetails());
        
        if (this.container) {
            this.container.appendChild(this.indicatorEl);
        } else {
            document.body.appendChild(this.indicatorEl);
        }
    }

    /**
     * Render loading state
     */
    renderLoading() {
        return `
            <div class="platform-indicator-content">
                <span class="platform-icon">🔍</span>
                <span class="platform-label">Detecting...</span>
            </div>
        `;
    }

    /**
     * Load platform data from server
     */
    async loadPlatformData() {
        try {
            const response = await fetch('/api/platform/status');
            this.platformData = await response.json();
            this.render();
        } catch (e) {
            console.error('[ButtonPlatformIndicator] Failed to load platform data:', e);
            this.renderError();
        }
    }

    /**
     * Render error state
     */
    renderError() {
        this.indicatorEl.innerHTML = `
            <div class="platform-indicator-content error">
                <span class="platform-icon">⚠️</span>
                <span class="platform-label">Detection Failed</span>
            </div>
        `;
    }

    /**
     * Main render method
     */
    render() {
        if (!this.platformData) {
            this.indicatorEl.innerHTML = this.renderLoading();
            return;
        }

        const { indicator, buttonContext } = this.platformData;
        
        this.indicatorEl.innerHTML = `
            <div class="platform-indicator-content ${indicator.reliable ? 'reliable' : 'unreliable'}">
                <span class="platform-icon" title="${indicator.description}">${indicator.icon}</span>
                ${this.mode !== 'icon-only' ? `<span class="platform-label">${indicator.label}</span>` : ''}
                ${this.mode === 'detailed' ? this.renderSpeedIndicator(indicator.speed) : ''}
                <span class="expand-arrow ${this.isExpanded ? 'expanded' : ''}">▼</span>
            </div>
            ${this.isExpanded ? this.renderDetails() : ''}
        `;
    }

    /**
     * Render speed indicator
     */
    renderSpeedIndicator(speed) {
        const speedClass = {
            'instant': 'speed-excellent',
            'very-fast': 'speed-good', 
            'fast': 'speed-fair',
            'slow': 'speed-poor',
            'unknown': 'speed-unknown'
        }[speed] || 'speed-unknown';

        return `<span class="speed-indicator ${speedClass}" title="Execution Speed: ${speed}"></span>`;
    }

    /**
     * Render expanded details panel
     */
    renderDetails() {
        const { buttonContext } = this.platformData;
        
        return `
            <div class="platform-details">
                <div class="details-header">
                    <h3>Button Execution Platform</h3>
                    <span class="platform-name">${buttonContext.platform.platform} ${buttonContext.platform.arch}</span>
                </div>
                
                <div class="current-method">
                    <h4>Current Method</h4>
                    <div class="method-card primary">
                        ${this.renderMethodCard(buttonContext.availableMethods.find(m => m.preferred))}
                    </div>
                </div>
                
                ${buttonContext.availableMethods.length > 1 ? `
                    <div class="available-methods">
                        <h4>Alternative Methods</h4>
                        <div class="methods-list">
                            ${buttonContext.availableMethods
                                .filter(m => !m.preferred)
                                .map(method => `
                                    <div class="method-card">
                                        ${this.renderMethodCard(method)}
                                    </div>
                                `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="performance-info">
                    <h4>Performance</h4>
                    <div class="perf-stats">
                        <div class="perf-stat">
                            <span class="perf-label">Estimated Latency:</span>
                            <span class="perf-value">${buttonContext.performance.estimatedLatency}</span>
                        </div>
                        <div class="perf-stat">
                            <span class="perf-label">Reliability:</span>
                            <span class="perf-value ${buttonContext.performance.reliability}">${buttonContext.performance.reliability}</span>
                        </div>
                    </div>
                </div>
                
                ${this.showRecommendations && buttonContext.recommendations.length > 0 ? `
                    <div class="recommendations">
                        <h4>Recommendations</h4>
                        <div class="recommendations-list">
                            ${buttonContext.recommendations.map(rec => this.renderRecommendation(rec)).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render individual method card
     */
    renderMethodCard(method) {
        if (!method) return '';

        const reliabilityClass = {
            'excellent': 'reliability-excellent',
            'good': 'reliability-good',
            'fair': 'reliability-fair',
            'poor': 'reliability-poor',
            'none': 'reliability-none'
        }[method.reliability] || '';

        return `
            <div class="method-info">
                <div class="method-header">
                    <span class="method-icon">${method.icon}</span>
                    <span class="method-name">${method.name}</span>
                    <span class="reliability-badge ${reliabilityClass}">${method.reliability}</span>
                </div>
                <div class="method-description">${method.description}</div>
                ${method.compatible && method.compatible.length > 0 ? `
                    <div class="method-compatibility">
                        <strong>Compatible:</strong> ${method.compatible.join(', ')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render recommendation
     */
    renderRecommendation(recommendation) {
        const priorityClass = {
            'high': 'priority-high',
            'medium': 'priority-medium',
            'low': 'priority-low',
            'info': 'priority-info'
        }[recommendation.priority] || '';

        return `
            <div class="recommendation ${priorityClass}">
                <div class="rec-header">
                    <span class="rec-title">${recommendation.title}</span>
                    <span class="rec-priority">${recommendation.priority}</span>
                </div>
                <div class="rec-description">${recommendation.description}</div>
                ${recommendation.benefit ? `<div class="rec-benefit"><strong>Benefit:</strong> ${recommendation.benefit}</div>` : ''}
                ${recommendation.url ? `<div class="rec-action"><a href="${recommendation.url}" target="_blank">Learn More</a></div>` : ''}
            </div>
        `;
    }

    /**
     * Toggle details panel
     */
    toggleDetails() {
        this.isExpanded = !this.isExpanded;
        this.render();
    }

    /**
     * Show details
     */
    showDetails() {
        this.isExpanded = true;
        this.render();
    }

    /**
     * Hide details
     */
    hideDetails() {
        this.isExpanded = false;
        this.render();
    }

    /**
     * Update with new platform data
     */
    update(platformData) {
        this.platformData = platformData;
        this.render();
    }

    /**
     * Refresh platform data from server
     */
    async refresh() {
        await this.loadPlatformData();
    }

    /**
     * Get current platform indicator data
     */
    getIndicatorData() {
        return this.platformData?.indicator || null;
    }

    /**
     * Get button execution context
     */
    getButtonContext() {
        return this.platformData?.buttonContext || null;
    }

    /**
     * Destroy the indicator
     */
    destroy() {
        if (this.indicatorEl && this.indicatorEl.parentNode) {
            this.indicatorEl.parentNode.removeChild(this.indicatorEl);
        }
    }

    /**
     * Set position
     */
    setPosition(position) {
        this.position = position;
        this.indicatorEl.className = this.indicatorEl.className.replace(/position-\w+/, '');
        this.indicatorEl.classList.add(position);
    }

    /**
     * Set mode
     */
    setMode(mode) {
        this.mode = mode;
        this.indicatorEl.className = this.indicatorEl.className.replace(/mode-\w+/, '');
        this.indicatorEl.classList.add(mode);
        this.render();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ButtonPlatformIndicator;
}