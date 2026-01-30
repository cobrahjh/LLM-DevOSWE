/**
 * Claude Code Performance Tracker
 * Monitors MarginLab's Claude Code benchmark results
 * Alerts via Relay when performance degrades
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
    url: 'https://marginlab.ai/trackers/claude-code/',
    checkInterval: 24 * 60 * 60 * 1000, // 24 hours
    alertThreshold: 45, // Alert if pass rate drops below this
    warningThreshold: 50, // Warning if below this
    relayUrl: 'http://localhost:8600',
    dataFile: path.join(__dirname, 'claude-performance-data.json')
};

// Load historical data
function loadData() {
    try {
        if (fs.existsSync(CONFIG.dataFile)) {
            return JSON.parse(fs.readFileSync(CONFIG.dataFile, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load data:', e.message);
    }
    return { history: [], lastCheck: null, lastAlert: null };
}

// Save data
function saveData(data) {
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify(data, null, 2));
}

// Fetch and parse the tracker page
async function fetchPerformanceData() {
    try {
        const res = await fetch(CONFIG.url);
        const html = await res.text();

        // Extract metrics from the page
        // Looking for patterns like "50%" pass rate, "53%" 7-day, etc.
        const metrics = {};

        // Current/daily pass rate (usually the prominent number)
        const dailyMatch = html.match(/(\d+(?:\.\d+)?)\s*%\s*(?:pass|daily|current)/i) ||
                          html.match(/pass[^%]*?(\d+(?:\.\d+)?)\s*%/i);
        if (dailyMatch) metrics.daily = parseFloat(dailyMatch[1]);

        // 7-day aggregate
        const weeklyMatch = html.match(/7[- ]?day[^%]*?(\d+(?:\.\d+)?)\s*%/i) ||
                           html.match(/(\d+(?:\.\d+)?)\s*%[^%]*?7[- ]?day/i);
        if (weeklyMatch) metrics.weekly = parseFloat(weeklyMatch[1]);

        // 30-day aggregate
        const monthlyMatch = html.match(/30[- ]?day[^%]*?(\d+(?:\.\d+)?)\s*%/i) ||
                            html.match(/(\d+(?:\.\d+)?)\s*%[^%]*?30[- ]?day/i);
        if (monthlyMatch) metrics.monthly = parseFloat(monthlyMatch[1]);

        // Baseline
        const baselineMatch = html.match(/baseline[^%]*?(\d+(?:\.\d+)?)\s*%/i) ||
                             html.match(/(\d+(?:\.\d+)?)\s*%[^%]*?baseline/i);
        if (baselineMatch) metrics.baseline = parseFloat(baselineMatch[1]);

        // Alternative: try to find any prominent percentage numbers
        if (!metrics.daily) {
            const allPercents = html.match(/(\d{2}(?:\.\d+)?)\s*%/g);
            if (allPercents && allPercents.length > 0) {
                // Take the first reasonable percentage (between 30-80%)
                for (const p of allPercents) {
                    const val = parseFloat(p);
                    if (val >= 30 && val <= 80) {
                        metrics.daily = val;
                        break;
                    }
                }
            }
        }

        return {
            success: true,
            timestamp: new Date().toISOString(),
            metrics
        };
    } catch (e) {
        return {
            success: false,
            error: e.message,
            timestamp: new Date().toISOString()
        };
    }
}

// Send alert to Relay
async function sendAlert(severity, title, message, metrics) {
    try {
        await fetch(`${CONFIG.relayUrl}/api/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                severity,
                source: 'claude-performance-tracker',
                title,
                message,
                service: 'Claude Code',
                metadata: metrics
            })
        });
        console.log(`[Alert] ${severity}: ${title}`);
    } catch (e) {
        console.error('Failed to send alert:', e.message);
    }
}

// Check performance and alert if needed
async function checkPerformance() {
    console.log(`[${new Date().toISOString()}] Checking Claude Code performance...`);

    const data = loadData();
    const result = await fetchPerformanceData();

    if (!result.success) {
        console.error('Failed to fetch performance data:', result.error);
        return;
    }

    const { metrics } = result;
    console.log('Current metrics:', metrics);

    // Store in history
    data.history.push({
        timestamp: result.timestamp,
        ...metrics
    });

    // Keep last 90 days
    if (data.history.length > 90) {
        data.history = data.history.slice(-90);
    }

    data.lastCheck = result.timestamp;

    // Check for alerts
    const passRate = metrics.daily || metrics.weekly || metrics.monthly;

    if (passRate) {
        if (passRate < CONFIG.alertThreshold) {
            await sendAlert(
                'high',
                'Claude Code Performance Critical',
                `Pass rate dropped to ${passRate}% (threshold: ${CONFIG.alertThreshold}%)`,
                metrics
            );
            data.lastAlert = result.timestamp;
        } else if (passRate < CONFIG.warningThreshold) {
            // Only warn once per day
            const lastAlertDate = data.lastAlert ? new Date(data.lastAlert).toDateString() : null;
            const today = new Date().toDateString();

            if (lastAlertDate !== today) {
                await sendAlert(
                    'medium',
                    'Claude Code Performance Warning',
                    `Pass rate at ${passRate}% (warning threshold: ${CONFIG.warningThreshold}%)`,
                    metrics
                );
                data.lastAlert = result.timestamp;
            }
        } else {
            console.log(`Pass rate OK: ${passRate}%`);
        }

        // Check for significant drop from previous
        if (data.history.length >= 2) {
            const prev = data.history[data.history.length - 2];
            const prevRate = prev.daily || prev.weekly || prev.monthly;
            if (prevRate && passRate < prevRate - 5) {
                await sendAlert(
                    'medium',
                    'Claude Code Performance Drop',
                    `Pass rate dropped from ${prevRate}% to ${passRate}% (-${(prevRate - passRate).toFixed(1)}%)`,
                    metrics
                );
            }
        }
    }

    saveData(data);
    return { metrics, passRate };
}

// API endpoint handler (for integration with other services)
function getStatus() {
    const data = loadData();
    const latest = data.history[data.history.length - 1] || {};
    return {
        service: 'claude-performance-tracker',
        lastCheck: data.lastCheck,
        current: latest,
        history: data.history.slice(-7), // Last 7 days
        thresholds: {
            alert: CONFIG.alertThreshold,
            warning: CONFIG.warningThreshold
        }
    };
}

// Run as standalone or export for integration
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--once')) {
        // Single check mode
        checkPerformance().then(result => {
            console.log('Check complete:', result);
            process.exit(0);
        });
    } else if (args.includes('--status')) {
        // Show current status
        console.log(JSON.stringify(getStatus(), null, 2));
    } else {
        // Continuous monitoring mode
        console.log('Claude Code Performance Tracker');
        console.log('================================');
        console.log(`Checking every ${CONFIG.checkInterval / 3600000} hours`);
        console.log(`Alert threshold: ${CONFIG.alertThreshold}%`);
        console.log(`Warning threshold: ${CONFIG.warningThreshold}%`);
        console.log('');

        // Initial check
        checkPerformance();

        // Schedule periodic checks
        setInterval(checkPerformance, CONFIG.checkInterval);
    }
}

module.exports = { checkPerformance, getStatus, fetchPerformanceData };
