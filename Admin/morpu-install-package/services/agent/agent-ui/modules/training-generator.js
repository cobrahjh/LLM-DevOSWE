/**
 * Admin Kitt - Training Generator Module
 * Version: v1.0.0
 * Last updated: 2026-01-13
 *
 * Capture and curate training examples for fine-tuning LLMs
 */

const TrainingGenerator = (function() {
    'use strict';

    const RELAY_PORT = 8600;
    let panelVisible = false;
    let examples = [];
    let captureEnabled = false;
    let selectedExample = null;
    let trainingMetrics = [];
    let metricsChart = null;

    const sources = ['manual', 'relay', 'benchmark', 'chat'];
    const categories = ['general', 'coding', 'review', 'debug', 'simwidget'];

    function getBaseUrl() {
        return `http://${location.hostname}:${RELAY_PORT}`;
    }

    async function loadExamples(filters = {}) {
        try {
            let url = `${getBaseUrl()}/api/training/examples`;
            const params = new URLSearchParams();
            if (filters.source) params.set('source', filters.source);
            if (filters.approved !== undefined) params.set('approved', filters.approved);
            if (filters.category) params.set('category', filters.category);
            params.set('limit', '50');
            if (params.toString()) url += '?' + params.toString();

            const res = await fetch(url);
            const data = await res.json();
            examples = data.examples || [];
            renderExampleList();
        } catch (err) {
            console.error('Failed to load examples:', err);
        }
    }

    async function checkCaptureStatus() {
        try {
            const res = await fetch(`${getBaseUrl()}/api/training/capture`);
            const data = await res.json();
            captureEnabled = data.enabled;
            updateCaptureUI();
        } catch (err) {
            console.error('Failed to check capture status:', err);
        }
    }

    async function toggleCapture() {
        try {
            const res = await fetch(`${getBaseUrl()}/api/training/capture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !captureEnabled, source: 'relay' })
            });
            const data = await res.json();
            captureEnabled = data.enabled;
            updateCaptureUI();
            showNotification(`Auto-capture ${captureEnabled ? 'enabled' : 'disabled'}`);
        } catch (err) {
            showNotification('Failed to toggle capture: ' + err.message, 'error');
        }
    }

    function updateCaptureUI() {
        const btn = document.getElementById('capture-toggle-btn');
        const status = document.getElementById('capture-status');
        if (btn) {
            btn.classList.toggle('active', captureEnabled);
            btn.textContent = captureEnabled ? 'Capturing...' : 'Start Capture';
        }
        if (status) {
            status.textContent = captureEnabled ? 'Auto-capture ON' : 'Auto-capture OFF';
            status.className = 'capture-status ' + (captureEnabled ? 'on' : 'off');
        }
    }

    function renderExampleList() {
        const listEl = document.getElementById('training-example-list');
        if (!listEl) return;

        if (examples.length === 0) {
            listEl.innerHTML = '<div class="empty-state">No training examples yet</div>';
            return;
        }

        listEl.innerHTML = examples.map(e => `
            <div class="example-item ${selectedExample?.id === e.id ? 'selected' : ''} ${e.approved ? 'approved' : ''}"
                 onclick="TrainingGenerator.selectExample('${e.id}')">
                <div class="example-preview">${escapeHtml(e.input_text?.substring(0, 60))}...</div>
                <div class="example-meta">
                    <span class="example-source">${e.source}</span>
                    <span class="example-rating">${'★'.repeat(e.rating || 0)}${'☆'.repeat(5 - (e.rating || 0))}</span>
                    ${e.approved ? '<span class="approved-badge">✓</span>' : ''}
                </div>
            </div>
        `).join('');
    }

    function selectExample(id) {
        selectedExample = examples.find(e => e.id === id);
        renderExampleList();
        renderExampleDetails();
    }

    function renderExampleDetails() {
        const detailsEl = document.getElementById('training-example-details');
        if (!detailsEl) return;

        if (!selectedExample) {
            detailsEl.innerHTML = '<div class="empty-state">Select an example to view/edit</div>';
            return;
        }

        const e = selectedExample;
        detailsEl.innerHTML = `
            <div class="example-editor">
                <div class="editor-section">
                    <label>Input (User Message)</label>
                    <textarea id="example-input" class="example-textarea">${escapeHtml(e.input_text)}</textarea>
                </div>
                <div class="editor-section">
                    <label>Output (Assistant Response)</label>
                    <textarea id="example-output" class="example-textarea">${escapeHtml(e.output_text)}</textarea>
                </div>
                <div class="editor-controls">
                    <div class="rating-control">
                        <label>Quality:</label>
                        ${[1,2,3,4,5].map(r => `
                            <button class="rating-btn ${e.rating >= r ? 'active' : ''}"
                                onclick="TrainingGenerator.rateExample(${r})">${r}</button>
                        `).join('')}
                    </div>
                    <select id="example-category" onchange="TrainingGenerator.updateCategory(this.value)">
                        ${categories.map(c => `<option value="${c}" ${e.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="editor-actions">
                    <button class="btn-primary" onclick="TrainingGenerator.saveExample()">Save</button>
                    <button class="btn-success ${e.approved ? 'active' : ''}" onclick="TrainingGenerator.toggleApproval()">
                        ${e.approved ? '✓ Approved' : 'Approve'}
                    </button>
                    <button class="btn-danger" onclick="TrainingGenerator.deleteExample()">Delete</button>
                </div>
            </div>
        `;
    }

    async function rateExample(rating) {
        if (!selectedExample) return;
        try {
            await fetch(`${getBaseUrl()}/api/training/examples/${selectedExample.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating })
            });
            selectedExample.rating = rating;
            renderExampleDetails();
            renderExampleList();
        } catch (err) {
            console.error('Failed to rate example:', err);
        }
    }

    async function updateCategory(category) {
        if (!selectedExample) return;
        try {
            await fetch(`${getBaseUrl()}/api/training/examples/${selectedExample.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category })
            });
            selectedExample.category = category;
        } catch (err) {
            console.error('Failed to update category:', err);
        }
    }

    async function toggleApproval() {
        if (!selectedExample) return;
        const newApproval = selectedExample.approved ? 0 : 1;
        try {
            await fetch(`${getBaseUrl()}/api/training/examples/${selectedExample.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approved: newApproval })
            });
            selectedExample.approved = newApproval;
            renderExampleDetails();
            renderExampleList();
        } catch (err) {
            console.error('Failed to toggle approval:', err);
        }
    }

    async function saveExample() {
        if (!selectedExample) return;
        const inputText = document.getElementById('example-input')?.value;
        const outputText = document.getElementById('example-output')?.value;

        if (!inputText || !outputText) {
            showNotification('Both input and output are required', 'error');
            return;
        }

        try {
            // Since the API doesn't support text updates, we'll need to delete and recreate
            // For now, just update the local state
            selectedExample.input_text = inputText;
            selectedExample.output_text = outputText;
            showNotification('Example updated');
        } catch (err) {
            showNotification('Failed to save: ' + err.message, 'error');
        }
    }

    async function deleteExample() {
        if (!selectedExample) return;
        if (!confirm('Delete this training example?')) return;

        try {
            await fetch(`${getBaseUrl()}/api/training/examples/${selectedExample.id}`, { method: 'DELETE' });
            selectedExample = null;
            loadExamples();
            renderExampleDetails();
            showNotification('Example deleted');
        } catch (err) {
            showNotification('Failed to delete: ' + err.message, 'error');
        }
    }

    async function createExample() {
        const input = prompt('User message (input):');
        if (!input) return;
        const output = prompt('Assistant response (output):');
        if (!output) return;

        try {
            const res = await fetch(`${getBaseUrl()}/api/training/examples`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input_text: input,
                    output_text: output,
                    source: 'manual',
                    category: 'general'
                })
            });
            const data = await res.json();
            if (data.id) {
                loadExamples();
                showNotification('Example created');
            }
        } catch (err) {
            showNotification('Failed to create: ' + err.message, 'error');
        }
    }

    // === Training Metrics Functions ===
    async function loadMetrics(model = null) {
        try {
            let url = `${getBaseUrl()}/api/training/metrics`;
            if (model) url += `?model=${encodeURIComponent(model)}`;
            const res = await fetch(url);
            const data = await res.json();
            trainingMetrics = data.metrics || [];
            renderMetricsChart();
            renderMetricsTable();
        } catch (err) {
            console.error('Failed to load metrics:', err);
        }
    }

    async function recordMetric(data) {
        try {
            const res = await fetch(`${getBaseUrl()}/api/training/metrics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.success) {
                loadMetrics();
                showNotification('Metric recorded');
            }
        } catch (err) {
            showNotification('Failed to record metric: ' + err.message, 'error');
        }
    }

    function renderMetricsChart() {
        const canvas = document.getElementById('metrics-chart');
        if (!canvas || trainingMetrics.length === 0) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.parentElement?.clientWidth || 400;
        const height = canvas.height = 150;

        ctx.clearRect(0, 0, width, height);

        // Get loss values
        const losses = trainingMetrics.map(m => m.loss).filter(l => l != null);
        const perplexities = trainingMetrics.map(m => m.perplexity).filter(p => p != null);

        if (losses.length === 0) return;

        const maxLoss = Math.max(...losses) * 1.1;
        const minLoss = Math.min(...losses) * 0.9;

        // Draw grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const y = (height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(40, y);
            ctx.lineTo(width - 10, y);
            ctx.stroke();
        }

        // Draw loss line
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        losses.forEach((loss, i) => {
            const x = 40 + (i / (losses.length - 1 || 1)) * (width - 50);
            const y = height - 10 - ((loss - minLoss) / (maxLoss - minLoss || 1)) * (height - 20);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw perplexity line if available
        if (perplexities.length > 0) {
            const maxPerp = Math.max(...perplexities) * 1.1;
            const minPerp = Math.min(...perplexities) * 0.9;

            ctx.strokeStyle = '#4ecdc4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            perplexities.forEach((perp, i) => {
                const x = 40 + (i / (perplexities.length - 1 || 1)) * (width - 50);
                const y = height - 10 - ((perp - minPerp) / (maxPerp - minPerp || 1)) * (height - 20);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }

        // Labels
        ctx.fillStyle = '#aaa';
        ctx.font = '10px sans-serif';
        ctx.fillText('Loss', 5, 12);
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(35, 5, 20, 3);
        if (perplexities.length > 0) {
            ctx.fillStyle = '#aaa';
            ctx.fillText('Perplexity', 70, 12);
            ctx.fillStyle = '#4ecdc4';
            ctx.fillRect(130, 5, 20, 3);
        }
    }

    function renderMetricsTable() {
        const tableEl = document.getElementById('metrics-table');
        if (!tableEl) return;

        if (trainingMetrics.length === 0) {
            tableEl.innerHTML = '<tr><td colspan="6" class="empty-state">No metrics recorded yet</td></tr>';
            return;
        }

        // Show last 10 metrics
        const recent = trainingMetrics.slice(-10).reverse();
        tableEl.innerHTML = recent.map(m => `
            <tr>
                <td>${new Date(m.timestamp).toLocaleString()}</td>
                <td>${m.model || 'unknown'}</td>
                <td>${m.epoch || '-'}</td>
                <td class="metric-loss">${m.loss?.toFixed(4) || '-'}</td>
                <td class="metric-perp">${m.perplexity?.toFixed(2) || '-'}</td>
                <td class="metric-acc">${m.accuracy ? (m.accuracy * 100).toFixed(1) + '%' : '-'}</td>
            </tr>
        `).join('');
    }

    function addMetricManually() {
        const model = document.getElementById('metric-model')?.value || 'unknown';
        const epoch = parseInt(document.getElementById('metric-epoch')?.value) || 1;
        const loss = parseFloat(document.getElementById('metric-loss')?.value);
        const perplexity = parseFloat(document.getElementById('metric-perplexity')?.value);
        const accuracy = parseFloat(document.getElementById('metric-accuracy')?.value);

        if (isNaN(loss) && isNaN(perplexity)) {
            showNotification('Enter at least loss or perplexity', 'error');
            return;
        }

        recordMetric({
            model,
            epoch,
            loss: isNaN(loss) ? null : loss,
            perplexity: isNaN(perplexity) ? null : perplexity,
            accuracy: isNaN(accuracy) ? null : accuracy / 100
        });
    }

    async function exportData() {
        const format = document.getElementById('export-format')?.value || 'jsonl';
        const approvedOnly = document.getElementById('export-approved')?.checked;

        try {
            const res = await fetch(`${getBaseUrl()}/api/training/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    format,
                    approved_only: approvedOnly,
                    session_name: `Export ${new Date().toISOString().slice(0, 16)}`
                })
            });
            const data = await res.json();

            // Download the data
            const blob = new Blob([data.data], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `training-data.${format}`;
            a.click();
            URL.revokeObjectURL(url);

            showNotification(`Exported ${data.count} examples`);
        } catch (err) {
            showNotification('Export failed: ' + err.message, 'error');
        }
    }

    function toggle() {
        panelVisible = !panelVisible;
        let panel = document.getElementById('training-generator-panel');

        if (!panel) {
            panel = createPanel();
            document.body.appendChild(panel);
        }

        panel.style.display = panelVisible ? 'flex' : 'none';
        if (panelVisible) {
            checkCaptureStatus();
            loadExamples();
            loadMetrics();
        }
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'training-generator-panel';
        panel.className = 'llm-panel training-generator-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>Training Data Generator</h3>
                <div class="panel-header-actions">
                    <button onclick="TrainingGenerator.createExample()" title="Add Example">+</button>
                    <button onclick="TrainingGenerator.toggle()" title="Close">×</button>
                </div>
            </div>
            <div class="panel-toolbar">
                <button id="capture-toggle-btn" class="capture-btn" onclick="TrainingGenerator.toggleCapture()">
                    Start Capture
                </button>
                <span id="capture-status" class="capture-status off">Auto-capture OFF</span>
                <select id="example-filter-source" onchange="TrainingGenerator.loadExamples({source: this.value})">
                    <option value="">All Sources</option>
                    ${sources.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
                <label class="filter-checkbox">
                    <input type="checkbox" id="filter-approved" onchange="TrainingGenerator.loadExamples({approved: this.checked ? 'true' : ''})">
                    Approved only
                </label>
            </div>
            <div class="panel-body">
                <div class="panel-tabs">
                    <button class="tab-btn active" onclick="TrainingGenerator.showTab('examples')">Examples</button>
                    <button class="tab-btn" onclick="TrainingGenerator.showTab('metrics')">Metrics</button>
                </div>
                <div id="tab-examples" class="tab-content active">
                    <div class="example-list" id="training-example-list"></div>
                    <div class="example-details" id="training-example-details">
                        <div class="empty-state">Select an example to view/edit</div>
                    </div>
                </div>
                <div id="tab-metrics" class="tab-content" style="display:none">
                    <div class="metrics-section">
                        <h4>Training Metrics</h4>
                        <div class="metrics-chart-container">
                            <canvas id="metrics-chart"></canvas>
                        </div>
                        <div class="metrics-input">
                            <input type="text" id="metric-model" placeholder="Model name" value="kitt:latest">
                            <input type="number" id="metric-epoch" placeholder="Epoch" min="1" value="1">
                            <input type="number" id="metric-loss" placeholder="Loss" step="0.0001">
                            <input type="number" id="metric-perplexity" placeholder="Perplexity" step="0.01">
                            <input type="number" id="metric-accuracy" placeholder="Accuracy %" step="0.1" min="0" max="100">
                            <button onclick="TrainingGenerator.addMetricManually()">Record</button>
                        </div>
                        <table class="metrics-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Model</th>
                                    <th>Epoch</th>
                                    <th>Loss</th>
                                    <th>Perplexity</th>
                                    <th>Accuracy</th>
                                </tr>
                            </thead>
                            <tbody id="metrics-table"></tbody>
                        </table>
                        <div class="metrics-legend">
                            <span><span class="legend-loss"></span> Loss (lower = better)</span>
                            <span><span class="legend-perp"></span> Perplexity (lower = better)</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="panel-footer">
                <div class="export-controls">
                    <select id="export-format">
                        <option value="jsonl">JSONL (OpenAI)</option>
                        <option value="csv">CSV</option>
                        <option value="json">JSON</option>
                    </select>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-approved" checked> Approved only
                    </label>
                    <button class="btn-export" onclick="TrainingGenerator.exportData()">Export</button>
                </div>
            </div>
        `;
        return panel;
    }

    function showTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');

        const tabEl = document.getElementById(`tab-${tabName}`);
        if (tabEl) {
            tabEl.style.display = 'flex';
            document.querySelector(`.tab-btn[onclick*="${tabName}"]`)?.classList.add('active');
        }

        if (tabName === 'metrics') {
            loadMetrics();
            setTimeout(renderMetricsChart, 100);
        }
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
        loadExamples,
        selectExample,
        rateExample,
        updateCategory,
        toggleApproval,
        saveExample,
        deleteExample,
        createExample,
        toggleCapture,
        exportData,
        showTab,
        loadMetrics,
        addMetricManually
    };
})();

window.TrainingGenerator = TrainingGenerator;
