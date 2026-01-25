/**
 * Admin Kitt - Evaluation Dashboard Module
 * Version: v1.0.0
 * Last updated: 2026-01-13
 *
 * Run benchmarks against LLMs and compare performance
 */

const EvaluationDashboard = (function() {
    'use strict';

    const RELAY_PORT = 8600;
    let panelVisible = false;
    let benchmarks = [];
    let selectedBenchmark = null;
    let isRunning = false;

    const models = [
        { id: 'qwen3-coder:latest', name: 'Qwen3 Coder (30.5B)' },
        { id: 'qwen2.5-coder:14b', name: 'Qwen2.5 Coder (14B)' },
        { id: 'qwen2.5-coder:7b', name: 'Qwen2.5 Coder (7B)' }
    ];

    const categories = ['general', 'code-gen', 'code-review', 'refactor', 'explain', 'simwidget'];

    function getBaseUrl() {
        return `http://${location.hostname}:${RELAY_PORT}`;
    }

    async function loadBenchmarks(category = '') {
        try {
            let url = `${getBaseUrl()}/api/benchmarks`;
            if (category) url += `?category=${category}`;

            const res = await fetch(url);
            const data = await res.json();
            benchmarks = data.benchmarks || [];
            renderBenchmarkList();
        } catch (err) {
            console.error('Failed to load benchmarks:', err);
        }
    }

    function renderBenchmarkList() {
        const listEl = document.getElementById('benchmark-list');
        if (!listEl) return;

        if (benchmarks.length === 0) {
            listEl.innerHTML = '<div class="empty-state">No benchmarks yet. Create one!</div>';
            return;
        }

        listEl.innerHTML = benchmarks.map(b => `
            <div class="benchmark-item ${selectedBenchmark?.id === b.id ? 'selected' : ''}"
                 onclick="EvaluationDashboard.selectBenchmark('${b.id}')">
                <div class="benchmark-name">${escapeHtml(b.name)}</div>
                <div class="benchmark-meta">
                    <span class="benchmark-category">${b.category}</span>
                    <span class="benchmark-cases">${b.test_cases.length} cases</span>
                    <span class="benchmark-runs">${b.run_count} runs</span>
                </div>
            </div>
        `).join('');
    }

    async function selectBenchmark(id) {
        try {
            const res = await fetch(`${getBaseUrl()}/api/benchmarks/${id}`);
            selectedBenchmark = await res.json();
            renderBenchmarkList();
            renderBenchmarkDetails();
        } catch (err) {
            console.error('Failed to load benchmark:', err);
        }
    }

    function renderBenchmarkDetails() {
        const detailsEl = document.getElementById('benchmark-details');
        if (!detailsEl) return;

        if (!selectedBenchmark) {
            detailsEl.innerHTML = '<div class="empty-state">Select a benchmark to view details</div>';
            return;
        }

        const b = selectedBenchmark;
        detailsEl.innerHTML = `
            <div class="benchmark-header">
                <h4>${escapeHtml(b.name)}</h4>
                <p>${escapeHtml(b.description || 'No description')}</p>
            </div>

            <div class="benchmark-runner">
                <h5>Run Benchmark</h5>
                <div class="runner-controls">
                    <select id="run-model-select">
                        ${models.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
                    </select>
                    <button class="btn-primary" onclick="EvaluationDashboard.runBenchmark()" ${isRunning ? 'disabled' : ''}>
                        ${isRunning ? 'Running...' : 'Run'}
                    </button>
                </div>
                <div class="run-progress" id="run-progress"></div>
                <div class="run-results" id="run-results"></div>
            </div>

            <div class="test-cases-section">
                <h5>Test Cases (${b.test_cases.length})</h5>
                <div class="test-cases-list">
                    ${b.test_cases.map((tc, i) => `
                        <div class="test-case">
                            <div class="tc-input"><strong>Input ${i+1}:</strong> ${escapeHtml(tc.input?.substring(0, 100))}...</div>
                            <div class="tc-expected"><strong>Expected:</strong> ${escapeHtml(tc.expected || 'Any')}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            ${b.runs && b.runs.length > 0 ? `
                <div class="run-history">
                    <h5>Recent Runs</h5>
                    <table class="runs-table">
                        <thead>
                            <tr>
                                <th>Model</th>
                                <th>Pass Rate</th>
                                <th>Time</th>
                                <th>Avg Tokens</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${b.runs.slice(0, 10).map(r => `
                                <tr class="${r.passed === r.passed + r.failed ? 'all-passed' : r.failed > 0 ? 'has-failures' : ''}">
                                    <td>${r.model}</td>
                                    <td>${Math.round((r.passed / (r.passed + r.failed)) * 100)}% (${r.passed}/${r.passed + r.failed})</td>
                                    <td>${(r.total_time / 1000).toFixed(1)}s</td>
                                    <td>${r.avg_tokens}</td>
                                    <td>${new Date(r.run_at).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}
        `;
    }

    async function runBenchmark() {
        if (!selectedBenchmark || isRunning) return;

        const model = document.getElementById('run-model-select')?.value;
        const progressEl = document.getElementById('run-progress');
        const resultsEl = document.getElementById('run-results');

        isRunning = true;
        renderBenchmarkDetails();

        if (progressEl) progressEl.innerHTML = '<div class="loading">Running benchmark...</div>';
        if (resultsEl) resultsEl.innerHTML = '';

        try {
            const res = await fetch(`${getBaseUrl()}/api/benchmarks/${selectedBenchmark.id}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model })
            });
            const data = await res.json();

            if (progressEl) progressEl.innerHTML = '';
            if (resultsEl) {
                resultsEl.innerHTML = `
                    <div class="run-summary ${data.failed === 0 ? 'all-passed' : 'has-failures'}">
                        <h5>Results: ${data.pass_rate}% Pass Rate</h5>
                        <div class="summary-stats">
                            <span class="passed">Passed: ${data.passed}</span>
                            <span class="failed">Failed: ${data.failed}</span>
                            <span class="time">Time: ${(data.total_time_ms / 1000).toFixed(1)}s</span>
                            <span class="tokens">Avg Tokens: ${data.avg_tokens}</span>
                        </div>
                    </div>
                    <div class="result-details">
                        ${data.results.map((r, i) => `
                            <div class="result-item ${r.passed ? 'passed' : 'failed'}">
                                <div class="result-header">
                                    <span class="result-status">${r.passed ? '✓' : '✗'}</span>
                                    <span class="result-label">Test ${i + 1}</span>
                                    <span class="result-time">${r.time_ms}ms</span>
                                </div>
                                ${!r.passed ? `
                                    <div class="result-expected">Expected: ${escapeHtml(r.expected)}</div>
                                    <div class="result-actual">Got: ${escapeHtml(r.actual?.substring(0, 200))}...</div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            // Refresh to get updated run history
            await selectBenchmark(selectedBenchmark.id);
        } catch (err) {
            if (progressEl) progressEl.innerHTML = `<div class="error">Error: ${err.message}</div>`;
        } finally {
            isRunning = false;
        }
    }

    async function createBenchmark() {
        const name = prompt('Benchmark name:');
        if (!name) return;

        // Create with sample test case
        try {
            const res = await fetch(`${getBaseUrl()}/api/benchmarks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description: 'New benchmark',
                    category: 'general',
                    test_cases: [
                        { input: 'What is 2+2?', expected: '4' }
                    ]
                })
            });
            const data = await res.json();
            if (data.id) {
                await loadBenchmarks();
                await selectBenchmark(data.id);
            }
        } catch (err) {
            showNotification('Failed to create: ' + err.message, 'error');
        }
    }

    async function showComparison() {
        if (!selectedBenchmark) return;

        try {
            const res = await fetch(`${getBaseUrl()}/api/benchmarks/${selectedBenchmark.id}/compare`);
            const data = await res.json();

            const models = Object.keys(data.comparison);
            if (models.length === 0) {
                showNotification('No runs to compare yet');
                return;
            }

            // Show comparison in a modal
            const modal = document.createElement('div');
            modal.className = 'llm-modal';
            modal.innerHTML = `
                <div class="modal-content comparison-modal">
                    <div class="modal-header">
                        <h3>Model Comparison: ${escapeHtml(selectedBenchmark.name)}</h3>
                        <button onclick="this.closest('.llm-modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <table class="comparison-table">
                            <thead>
                                <tr>
                                    <th>Model</th>
                                    <th>Best Pass Rate</th>
                                    <th>Avg Time</th>
                                    <th>Runs</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${models.map(model => {
                                    const runs = data.comparison[model];
                                    const bestRate = Math.max(...runs.map(r => r.pass_rate));
                                    const avgTime = Math.round(runs.reduce((a, r) => a + r.total_time, 0) / runs.length / 1000);
                                    return `
                                        <tr>
                                            <td>${model}</td>
                                            <td>${bestRate}%</td>
                                            <td>${avgTime}s</td>
                                            <td>${runs.length}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } catch (err) {
            showNotification('Failed to load comparison: ' + err.message, 'error');
        }
    }

    function toggle() {
        panelVisible = !panelVisible;
        let panel = document.getElementById('eval-dashboard-panel');

        if (!panel) {
            panel = createPanel();
            document.body.appendChild(panel);
        }

        panel.style.display = panelVisible ? 'flex' : 'none';
        if (panelVisible) loadBenchmarks();
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'eval-dashboard-panel';
        panel.className = 'llm-panel eval-dashboard-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>Evaluation Dashboard</h3>
                <div class="panel-header-actions">
                    <button onclick="EvaluationDashboard.createBenchmark()" title="New Benchmark">+</button>
                    <button onclick="EvaluationDashboard.showComparison()" title="Compare Models">📊</button>
                    <button onclick="EvaluationDashboard.toggle()" title="Close">×</button>
                </div>
            </div>
            <div class="panel-toolbar">
                <select id="benchmark-filter" onchange="EvaluationDashboard.loadBenchmarks(this.value)">
                    <option value="">All Categories</option>
                    ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
            </div>
            <div class="panel-body">
                <div class="benchmark-list" id="benchmark-list"></div>
                <div class="benchmark-details" id="benchmark-details">
                    <div class="empty-state">Select a benchmark to view details</div>
                </div>
            </div>
        `;
        return panel;
    }

    function showNotification(msg, type = 'success') {
        if (typeof AdminKitt !== 'undefined' && AdminKitt.addMessage) {
            AdminKitt.addMessage('system', msg, { fadeAfter: 3000 });
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    return {
        toggle,
        loadBenchmarks,
        selectBenchmark,
        runBenchmark,
        createBenchmark,
        showComparison
    };
})();

window.EvaluationDashboard = EvaluationDashboard;
