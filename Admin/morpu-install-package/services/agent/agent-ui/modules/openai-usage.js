/**
 * OpenAI Usage Monitor v1.0.0
 *
 * Tracks and displays OpenAI API token usage in the CC header.
 * Supports both local tracking and OpenAI billing API.
 *
 * Path: C:\LLM-DevOSWE\Admin\agent\agent-ui\modules\openai-usage.js
 * Last Updated: 2026-01-12
 *
 * Features:
 *   - Real-time token usage display in header
 *   - Cost estimation based on model pricing
 *   - Daily/monthly usage tracking
 *   - Rate limit monitoring
 *   - Click for detailed usage panel
 */

const OpenAIUsage = (function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const config = {
        apiKeyEndpoint: '/api/config/openai-key', // Get key from agent server
        usageEndpoint: 'https://api.openai.com/v1/usage',
        billingEndpoint: 'https://api.openai.com/v1/dashboard/billing/usage',
        refreshInterval: 60000, // Refresh every 60 seconds
        localStorageKey: 'openai_usage_data'
    };

    // Model pricing per 1K tokens (as of 2024)
    const MODEL_PRICING = {
        'gpt-4o': { input: 0.005, output: 0.015 },
        'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
        'gpt-4-turbo': { input: 0.01, output: 0.03 },
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
        'o1-preview': { input: 0.015, output: 0.06 },
        'o1-mini': { input: 0.003, output: 0.012 },
        'default': { input: 0.01, output: 0.03 }
    };

    // Account tier limits (approximate)
    const ACCOUNT_TIERS = {
        'free': { rpm: 3, tpm: 40000, dailyLimit: 100000 },
        'tier-1': { rpm: 500, tpm: 200000, dailyLimit: null },
        'tier-2': { rpm: 5000, tpm: 2000000, dailyLimit: null },
        'tier-3': { rpm: 5000, tpm: 10000000, dailyLimit: null },
        'tier-4': { rpm: 10000, tpm: 50000000, dailyLimit: null },
        'tier-5': { rpm: 10000, tpm: 100000000, dailyLimit: null }
    };

    // ==================== STATE ====================
    const state = {
        apiKey: null,
        accountTier: 'unknown',
        usage: {
            today: { input: 0, output: 0, requests: 0, cost: 0 },
            month: { input: 0, output: 0, requests: 0, cost: 0 }
        },
        rateLimit: {
            requestsRemaining: null,
            tokensRemaining: null,
            resetAt: null
        },
        lastUpdate: null,
        error: null
    };

    let refreshTimer = null;
    let elements = {};

    // ==================== LOCAL STORAGE ====================
    function saveToStorage() {
        try {
            localStorage.setItem(config.localStorageKey, JSON.stringify({
                usage: state.usage,
                lastUpdate: state.lastUpdate,
                accountTier: state.accountTier
            }));
        } catch (e) { }
    }

    function loadFromStorage() {
        try {
            const data = JSON.parse(localStorage.getItem(config.localStorageKey));
            if (data) {
                // Check if it's a new day - reset daily counters
                const lastDate = new Date(data.lastUpdate).toDateString();
                const today = new Date().toDateString();

                if (lastDate !== today) {
                    state.usage.today = { input: 0, output: 0, requests: 0, cost: 0 };
                } else {
                    state.usage.today = data.usage?.today || state.usage.today;
                }

                // Check if new month - reset monthly counters
                const lastMonth = new Date(data.lastUpdate).getMonth();
                const thisMonth = new Date().getMonth();

                if (lastMonth !== thisMonth) {
                    state.usage.month = { input: 0, output: 0, requests: 0, cost: 0 };
                } else {
                    state.usage.month = data.usage?.month || state.usage.month;
                }

                state.accountTier = data.accountTier || 'unknown';
            }
        } catch (e) { }
    }

    // ==================== COST CALCULATION ====================
    function calculateCost(model, inputTokens, outputTokens) {
        const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
        const inputCost = (inputTokens / 1000) * pricing.input;
        const outputCost = (outputTokens / 1000) * pricing.output;
        return inputCost + outputCost;
    }

    // ==================== TRACK USAGE (called by other modules) ====================
    function trackUsage(model, inputTokens, outputTokens) {
        const cost = calculateCost(model, inputTokens, outputTokens);

        state.usage.today.input += inputTokens;
        state.usage.today.output += outputTokens;
        state.usage.today.requests += 1;
        state.usage.today.cost += cost;

        state.usage.month.input += inputTokens;
        state.usage.month.output += outputTokens;
        state.usage.month.requests += 1;
        state.usage.month.cost += cost;

        state.lastUpdate = Date.now();
        saveToStorage();
        updateUI();

        console.log(`[OpenAIUsage] Tracked: ${inputTokens}+${outputTokens} tokens, $${cost.toFixed(4)}`);
    }

    // ==================== UPDATE FROM RATE LIMIT HEADERS ====================
    function updateFromHeaders(headers) {
        if (headers['x-ratelimit-remaining-requests']) {
            state.rateLimit.requestsRemaining = parseInt(headers['x-ratelimit-remaining-requests']);
        }
        if (headers['x-ratelimit-remaining-tokens']) {
            state.rateLimit.tokensRemaining = parseInt(headers['x-ratelimit-remaining-tokens']);
        }
        if (headers['x-ratelimit-reset-requests']) {
            state.rateLimit.resetAt = headers['x-ratelimit-reset-requests'];
        }
        updateUI();
    }

    // ==================== FETCH FROM OPENAI API ====================
    async function fetchUsageFromAPI() {
        if (!state.apiKey) {
            // Try to get API key from agent server
            try {
                const res = await fetch(`http://${location.hostname}:8585/api/config/openai-key`);
                const data = await res.json();
                if (data.key) {
                    state.apiKey = data.key;
                }
            } catch (e) {
                console.log('[OpenAIUsage] No API key configured');
                return;
            }
        }

        if (!state.apiKey) return;

        try {
            // Try to fetch usage from OpenAI (requires admin access)
            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const endDate = now.toISOString().split('T')[0];

            const res = await fetch(`https://api.openai.com/v1/dashboard/billing/usage?start_date=${startDate}&end_date=${endDate}`, {
                headers: {
                    'Authorization': `Bearer ${state.apiKey}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.total_usage) {
                    state.usage.month.cost = data.total_usage / 100; // API returns cents
                    state.lastUpdate = Date.now();
                    saveToStorage();
                    updateUI();
                }
            }
        } catch (e) {
            console.log('[OpenAIUsage] Could not fetch from API:', e.message);
        }
    }

    // ==================== FORMAT HELPERS ====================
    function formatTokens(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    function formatCost(cost) {
        if (cost < 0.01) return '<$0.01';
        if (cost < 1) return '$' + cost.toFixed(2);
        if (cost < 100) return '$' + cost.toFixed(2);
        return '$' + cost.toFixed(0);
    }

    // ==================== UI CREATION ====================
    function createUI() {
        // Check if header-actions exists
        const headerActions = document.querySelector('.header-actions');
        if (!headerActions) {
            console.warn('[OpenAIUsage] Header actions not found');
            return;
        }

        // Check if already exists
        if (document.getElementById('openai-usage-indicator')) return;

        // Create indicator
        const indicator = document.createElement('div');
        indicator.id = 'openai-usage-indicator';
        indicator.className = 'openai-usage-indicator';
        indicator.innerHTML = `
            <span class="openai-icon">💰</span>
            <span class="openai-cost" id="openai-cost">$0.00</span>
            <span class="openai-tokens" id="openai-tokens">0</span>
        `;

        // Insert before the Claude status
        const claudeStatus = headerActions.querySelector('.header-claude-status');
        if (claudeStatus) {
            headerActions.insertBefore(indicator, claudeStatus);
        } else {
            headerActions.prepend(indicator);
        }

        // Store references
        elements.indicator = indicator;
        elements.cost = document.getElementById('openai-cost');
        elements.tokens = document.getElementById('openai-tokens');

        // Add click handler for details panel
        indicator.addEventListener('click', (e) => {
            e.stopPropagation();
            showDetailsPanel();
        });

        // Add styles
        addStyles();

        console.log('[OpenAIUsage] UI created');
    }

    function addStyles() {
        if (document.getElementById('openai-usage-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'openai-usage-styles';
        styles.textContent = `
            .openai-usage-indicator {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 4px 12px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border: 1px solid #333;
                border-radius: 20px;
                cursor: pointer;
                transition: all 0.2s;
                margin-right: 8px;
            }
            .openai-usage-indicator:hover {
                border-color: #10a37f;
                background: linear-gradient(135deg, #1e2a3e 0%, #1a2f4e 100%);
            }
            .openai-icon {
                font-size: 14px;
            }
            .openai-cost {
                font-size: 12px;
                font-weight: 600;
                color: #10a37f;
                font-family: 'JetBrains Mono', monospace;
            }
            .openai-tokens {
                font-size: 10px;
                color: #888;
                font-family: 'JetBrains Mono', monospace;
            }
            .openai-usage-indicator.warning .openai-cost {
                color: #f59e0b;
            }
            .openai-usage-indicator.danger .openai-cost {
                color: #ef4444;
            }

            /* Details Panel */
            .openai-details-panel {
                position: fixed;
                top: 60px;
                right: 20px;
                background: #1a1a2e;
                border: 1px solid #333;
                border-radius: 12px;
                width: 320px;
                z-index: 10000;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                animation: slideIn 0.2s ease-out;
            }
            @keyframes slideIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .openai-details-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid #333;
                background: linear-gradient(135deg, #10a37f22 0%, transparent 100%);
                border-radius: 12px 12px 0 0;
            }
            .openai-details-header h3 {
                margin: 0;
                color: #10a37f;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .openai-details-header .btn-close {
                background: none;
                border: none;
                color: #888;
                font-size: 18px;
                cursor: pointer;
                padding: 4px 8px;
            }
            .openai-details-header .btn-close:hover {
                color: #fff;
            }
            .openai-details-body {
                padding: 16px;
            }
            .usage-section {
                margin-bottom: 16px;
            }
            .usage-section-title {
                font-size: 11px;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 8px;
            }
            .usage-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
            }
            .usage-stat {
                background: #2a2a3e;
                padding: 10px 12px;
                border-radius: 8px;
            }
            .usage-stat-label {
                font-size: 10px;
                color: #888;
                margin-bottom: 4px;
            }
            .usage-stat-value {
                font-size: 16px;
                font-weight: 600;
                color: #e0e0e0;
                font-family: 'JetBrains Mono', monospace;
            }
            .usage-stat-value.cost {
                color: #10a37f;
            }
            .usage-stat.full {
                grid-column: 1 / -1;
            }
            .tier-badge {
                display: inline-block;
                padding: 2px 8px;
                background: #10a37f33;
                color: #10a37f;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
            }
            .openai-details-footer {
                padding: 12px 16px;
                border-top: 1px solid #333;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .last-update {
                font-size: 10px;
                color: #666;
            }
            .refresh-btn {
                background: #10a37f;
                border: none;
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 11px;
                cursor: pointer;
            }
            .refresh-btn:hover {
                background: #0d8a6a;
            }
        `;
        document.head.appendChild(styles);
    }

    // ==================== UPDATE UI ====================
    function updateUI() {
        if (!elements.cost || !elements.tokens) return;

        const totalTokens = state.usage.today.input + state.usage.today.output;
        const cost = state.usage.today.cost;

        elements.cost.textContent = formatCost(cost);
        elements.tokens.textContent = formatTokens(totalTokens);

        // Update indicator style based on cost thresholds
        if (elements.indicator) {
            elements.indicator.classList.remove('warning', 'danger');
            if (cost > 10) {
                elements.indicator.classList.add('danger');
            } else if (cost > 5) {
                elements.indicator.classList.add('warning');
            }
        }

        // Update tooltip
        if (elements.indicator) {
            elements.indicator.title = `Today: ${formatCost(cost)} | ${formatTokens(totalTokens)} tokens | ${state.usage.today.requests} requests`;
        }
    }

    // ==================== DETAILS PANEL ====================
    function showDetailsPanel() {
        // Remove existing panel
        const existing = document.querySelector('.openai-details-panel');
        if (existing) {
            existing.remove();
            return;
        }

        const panel = document.createElement('div');
        panel.className = 'openai-details-panel';
        panel.innerHTML = `
            <div class="openai-details-header">
                <h3><span>💰</span> OpenAI Usage</h3>
                <button class="btn-close" onclick="this.closest('.openai-details-panel').remove()">×</button>
            </div>
            <div class="openai-details-body">
                <div class="usage-section">
                    <div class="usage-section-title">Today</div>
                    <div class="usage-grid">
                        <div class="usage-stat">
                            <div class="usage-stat-label">Cost</div>
                            <div class="usage-stat-value cost">${formatCost(state.usage.today.cost)}</div>
                        </div>
                        <div class="usage-stat">
                            <div class="usage-stat-label">Requests</div>
                            <div class="usage-stat-value">${state.usage.today.requests}</div>
                        </div>
                        <div class="usage-stat">
                            <div class="usage-stat-label">Input Tokens</div>
                            <div class="usage-stat-value">${formatTokens(state.usage.today.input)}</div>
                        </div>
                        <div class="usage-stat">
                            <div class="usage-stat-label">Output Tokens</div>
                            <div class="usage-stat-value">${formatTokens(state.usage.today.output)}</div>
                        </div>
                    </div>
                </div>

                <div class="usage-section">
                    <div class="usage-section-title">This Month</div>
                    <div class="usage-grid">
                        <div class="usage-stat">
                            <div class="usage-stat-label">Total Cost</div>
                            <div class="usage-stat-value cost">${formatCost(state.usage.month.cost)}</div>
                        </div>
                        <div class="usage-stat">
                            <div class="usage-stat-label">Total Requests</div>
                            <div class="usage-stat-value">${state.usage.month.requests}</div>
                        </div>
                        <div class="usage-stat full">
                            <div class="usage-stat-label">Total Tokens</div>
                            <div class="usage-stat-value">${formatTokens(state.usage.month.input + state.usage.month.output)}</div>
                        </div>
                    </div>
                </div>

                <div class="usage-section">
                    <div class="usage-section-title">Account</div>
                    <div class="usage-grid">
                        <div class="usage-stat full">
                            <div class="usage-stat-label">Tier</div>
                            <div class="usage-stat-value"><span class="tier-badge">${state.accountTier.toUpperCase()}</span></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="openai-details-footer">
                <span class="last-update">Updated: ${state.lastUpdate ? new Date(state.lastUpdate).toLocaleTimeString() : 'Never'}</span>
                <button class="refresh-btn" onclick="OpenAIUsage.refresh()">Refresh</button>
            </div>
        `;

        document.body.appendChild(panel);

        // Close when clicking outside
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!panel.contains(e.target) && !elements.indicator?.contains(e.target)) {
                    panel.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    }

    // ==================== REFRESH ====================
    async function refresh() {
        await fetchUsageFromAPI();
        updateUI();
    }

    // ==================== SET ACCOUNT TIER ====================
    function setAccountTier(tier) {
        state.accountTier = tier;
        saveToStorage();
        updateUI();
    }

    // ==================== RESET COUNTERS ====================
    function resetToday() {
        state.usage.today = { input: 0, output: 0, requests: 0, cost: 0 };
        saveToStorage();
        updateUI();
    }

    function resetMonth() {
        state.usage.month = { input: 0, output: 0, requests: 0, cost: 0 };
        saveToStorage();
        updateUI();
    }

    // ==================== INITIALIZATION ====================
    function init() {
        console.log('[OpenAIUsage] Initializing...');

        // Load saved data
        loadFromStorage();

        // Create UI
        createUI();

        // Initial UI update
        updateUI();

        // Start periodic refresh
        refreshTimer = setInterval(refresh, config.refreshInterval);

        // Initial API fetch
        setTimeout(refresh, 2000);

        console.log('[OpenAIUsage] Ready');
    }

    // ==================== PUBLIC API ====================
    return {
        init,
        refresh,
        trackUsage,
        updateFromHeaders,
        setAccountTier,
        resetToday,
        resetMonth,
        getState: () => ({ ...state }),
        MODEL_PRICING
    };
})();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', OpenAIUsage.init);
} else {
    setTimeout(OpenAIUsage.init, 600);
}

// Export for other modules
window.OpenAIUsage = OpenAIUsage;
