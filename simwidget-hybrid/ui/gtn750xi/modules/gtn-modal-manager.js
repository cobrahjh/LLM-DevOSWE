/**
 * GTN750 Modal Manager v1.0.0
 * Flight plan modals + validation
 * Extracted from pane.js
 *
 * Lazy loaded on first modal open via _ensureModalManager()
 *
 * @param {Object} opts
 * @param {GTNCore} opts.core
 * @param {number} opts.serverPort
 * @param {Function} opts.getData - Returns current aircraft data
 * @param {Function} opts.getFlightPlanManager - Returns GTNFlightPlan instance
 * @param {Function} opts.getFlightPlanValidator - Returns GTNFlightPlanValidator instance
 * @param {Function} opts.getSyncChannel - Returns SafeChannel instance
 * @param {Function} opts.getPageManager - Returns page manager instance
 * @param {Function} opts.getFplPage - Returns FPL page instance
 * @param {Function} opts.showNotification - Notification callback
 */

class GTNModalManager {
    constructor({ core, serverPort, getData, getFlightPlanManager,
                  getFlightPlanValidator, getSyncChannel, getPageManager,
                  getFplPage, showNotification }) {
        this.core = core;
        this.serverPort = serverPort;
        this.getData = getData;
        this.getFlightPlanManager = getFlightPlanManager;
        this.getFlightPlanValidator = getFlightPlanValidator;
        this.getSyncChannel = getSyncChannel;
        this.getPageManager = getPageManager;
        this.getFplPage = getFplPage;
        this.showNotification = showNotification;
    }

    showWaypointInfoModal() {
        const fplPage = this.getFplPage();
        const wp = fplPage?.getSelectedWaypoint();
        if (!wp) return;

        // Switch to map page where the modal lives
        const pageManager = this.getPageManager();
        if (pageManager) pageManager.switchPage('map');

        const body = document.getElementById('wpt-info-body');
        const modal = document.getElementById('wpt-info-modal');
        if (!body || !modal) return;

        const data = this.getData();
        let html = `<div class="dto-name" style="font-size: 16px; font-weight: bold;">${wp.ident || '----'}</div>`;
        html += `<div class="dto-coords">${wp.type || 'WAYPOINT'}</div>`;

        if (wp.lat !== undefined && wp.lng !== undefined) {
            html += `<div class="dto-coords">${this.core.formatLat(wp.lat)} ${this.core.formatLon(wp.lng)}</div>`;
        }

        if (wp.altitude) {
            html += `<div class="dto-coords">ALT: ${Math.round(wp.altitude).toLocaleString()} ft</div>`;
        }

        if (data.latitude && wp.lat && wp.lng) {
            const dist = this.core.calculateDistance(data.latitude, data.longitude, wp.lat, wp.lng);
            const brg = this.core.calculateBearing(data.latitude, data.longitude, wp.lat, wp.lng);
            html += `<div class="dto-coords">DIS: ${dist.toFixed(1)} nm &nbsp; BRG: ${Math.round(brg).toString().padStart(3, '0')}\u00B0</div>`;
        }

        body.innerHTML = html;
        modal.style.display = 'block';

        const closeModal = () => {
            modal.style.display = 'none';
            document.removeEventListener('keydown', escHandler);
        };
        const escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
        document.addEventListener('keydown', escHandler);
        document.getElementById('wpt-info-close').onclick = closeModal;
    }

    showSaveFlightPlanModal() {
        const modal = document.getElementById('save-fpl-modal');
        if (!modal) return;

        const flightPlanManager = this.getFlightPlanManager();
        const filenameInput = document.getElementById('save-fpl-filename');
        const formatSelect = document.getElementById('save-fpl-format');
        const infoDiv = document.getElementById('save-fpl-info');

        // Generate default filename
        if (filenameInput && flightPlanManager?.flightPlan?.waypoints) {
            const wp = flightPlanManager.flightPlan.waypoints;
            const origin = wp[0]?.ident || 'WPT';
            const dest = wp[wp.length - 1]?.ident || 'END';
            filenameInput.value = `${origin}-${dest}`;
        }

        if (infoDiv) infoDiv.textContent = '';

        modal.style.display = 'block';

        const saveBtn = document.getElementById('save-fpl-btn');
        const cancelBtn = document.getElementById('save-fpl-cancel');

        const closeModal = () => modal.style.display = 'none';

        saveBtn.onclick = () => {
            const filename = filenameInput?.value || 'flight-plan';
            const format = formatSelect?.value || 'fpl';

            const success = flightPlanManager?.saveFlightPlan(filename, format);

            if (success) {
                closeModal();
            } else {
                if (infoDiv) infoDiv.textContent = 'No flight plan to save';
            }
        };

        cancelBtn.onclick = closeModal;
    }

    showLoadFlightPlanModal() {
        const modal = document.getElementById('load-fpl-modal');
        if (!modal) return;

        // Reset to recent plans tab
        this.switchLoadTab('recent');

        // Populate recent plans
        this.renderRecentPlans();

        modal.style.display = 'block';

        // Wire up tab switcher
        const tabs = modal.querySelectorAll('.fpl-load-tab');
        tabs.forEach(tab => {
            tab.onclick = () => this.switchLoadTab(tab.dataset.tab);
        });

        // Wire up file load buttons
        const fileInput = document.getElementById('load-fpl-file');
        const infoDiv = document.getElementById('load-fpl-info');
        const loadBtn = document.getElementById('load-fpl-btn');
        const cancelBtn = document.getElementById('load-fpl-cancel');

        if (fileInput) fileInput.value = '';
        if (infoDiv) infoDiv.textContent = 'Select a .fpl, .gpx, or .json file';

        const closeModal = () => modal.style.display = 'none';
        const flightPlanManager = this.getFlightPlanManager();
        const fplPage = this.getFplPage();

        loadBtn.onclick = async () => {
            const file = fileInput?.files[0];

            if (!file) {
                if (infoDiv) infoDiv.textContent = 'Please select a file';
                return;
            }

            if (infoDiv) infoDiv.textContent = `Loading ${file.name}...`;

            const success = await flightPlanManager?.loadFlightPlan(file);

            if (success) {
                const filename = file.name.replace(/\.[^/.]+$/, '');
                flightPlanManager?.addToRecentPlans(filename);

                if (infoDiv) infoDiv.textContent = `Loaded ${file.name}`;
                setTimeout(() => closeModal(), 1000);

                if (fplPage) fplPage.render();
            } else {
                if (infoDiv) infoDiv.textContent = 'Failed to load flight plan';
            }
        };

        cancelBtn.onclick = closeModal;
    }

    switchLoadTab(tabName) {
        const modal = document.getElementById('load-fpl-modal');
        if (!modal) return;

        const tabs = modal.querySelectorAll('.fpl-load-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        const recentTab = document.getElementById('recent-plans-tab');
        const fileTab = document.getElementById('file-load-tab');

        if (recentTab) recentTab.style.display = tabName === 'recent' ? 'block' : 'none';
        if (fileTab) fileTab.style.display = tabName === 'file' ? 'block' : 'none';
    }

    renderRecentPlans() {
        const list = document.getElementById('recent-plans-list');
        const empty = document.getElementById('recent-plans-empty');
        if (!list || !empty) return;

        const flightPlanManager = this.getFlightPlanManager();
        const fplPage = this.getFplPage();
        const recent = flightPlanManager?.getRecentPlans() || [];

        if (recent.length === 0) {
            list.style.display = 'none';
            empty.style.display = 'block';
            return;
        }

        list.style.display = 'flex';
        empty.style.display = 'none';
        list.innerHTML = '';

        recent.forEach((plan, index) => {
            const item = document.createElement('div');
            item.className = 'recent-plan-item';

            const info = document.createElement('div');
            info.className = 'recent-plan-info';

            const name = document.createElement('div');
            name.className = 'recent-plan-name';
            name.textContent = plan.name;

            const route = document.createElement('div');
            route.className = 'recent-plan-route';
            route.textContent = `${plan.departure} → ${plan.arrival}`;

            const meta = document.createElement('div');
            meta.className = 'recent-plan-meta';
            const dist = plan.distance ? `${Math.round(plan.distance)} NM · ` : '';
            const age = this.formatAge(plan.timestamp);
            meta.textContent = `${dist}${plan.waypointCount} waypoints · ${age}`;

            info.appendChild(name);
            info.appendChild(route);
            info.appendChild(meta);

            const actions = document.createElement('div');
            actions.className = 'recent-plan-actions';

            const activateBtn = document.createElement('button');
            activateBtn.className = 'recent-plan-btn activate';
            activateBtn.textContent = 'ACTIVATE';
            activateBtn.onclick = (e) => {
                e.stopPropagation();
                const success = flightPlanManager?.activateRecentPlan(index);
                if (success) {
                    document.getElementById('load-fpl-modal').style.display = 'none';
                    if (fplPage) fplPage.render();
                }
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'recent-plan-btn delete';
            deleteBtn.textContent = '\u2715';
            deleteBtn.title = 'Delete from recent';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                flightPlanManager?.deleteRecentPlan(index);
                this.renderRecentPlans();
            };

            actions.appendChild(activateBtn);
            actions.appendChild(deleteBtn);

            item.appendChild(info);
            item.appendChild(actions);
            list.appendChild(item);
        });
    }

    formatAge(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    showFlightPlanInfoModal() {
        const modal = document.getElementById('fpl-info-modal');
        const flightPlanManager = this.getFlightPlanManager();
        if (!modal || !flightPlanManager) return;

        const data = this.getData();
        const groundSpeed = data?.groundSpeed || 120;
        const fuelBurnRate = 8.5;

        const stats = flightPlanManager.getFlightPlanStatistics(groundSpeed, fuelBurnRate);

        if (!stats) {
            alert('No flight plan loaded');
            return;
        }

        document.getElementById('fpl-info-dist').textContent = `${stats.totalDistance.toFixed(1)} NM`;

        const hours = Math.floor(stats.totalETE / 60);
        const minutes = Math.round(stats.totalETE % 60);
        document.getElementById('fpl-info-ete').textContent = `${hours}:${minutes.toString().padStart(2, '0')}`;

        document.getElementById('fpl-info-fuel').textContent =
            `${stats.totalFuel.total} GAL (${stats.totalFuel.trip} + ${stats.totalFuel.reserve} rsv)`;

        document.getElementById('fpl-info-alt').textContent =
            stats.maxAltitude ? `${stats.maxAltitude.toLocaleString()} FT` : 'N/A';

        document.getElementById('fpl-info-wpts').textContent = stats.waypointCount;

        document.getElementById('fpl-info-gs').textContent = Math.round(groundSpeed);
        document.getElementById('fpl-info-burn').textContent = fuelBurnRate;

        const tbody = document.getElementById('fpl-info-legs');
        tbody.innerHTML = '';

        stats.legs.forEach((leg, index) => {
            const row = document.createElement('tr');
            if (leg.isActive) row.classList.add('active');

            const isLast = index === stats.legs.length - 1;

            const wptCell = document.createElement('td');
            wptCell.className = isLast ? 'wpt-last' : 'wpt-ident';
            wptCell.textContent = leg.ident;
            row.appendChild(wptCell);

            const legCell = document.createElement('td');
            legCell.textContent = isLast ? '---' : `${leg.legDistance.toFixed(1)}`;
            row.appendChild(legCell);

            const crsCell = document.createElement('td');
            crsCell.textContent = leg.bearing !== null ? `${Math.round(leg.bearing)}°` : '---';
            row.appendChild(crsCell);

            const cumulCell = document.createElement('td');
            cumulCell.textContent = `${leg.cumulativeDistance.toFixed(1)}`;
            row.appendChild(cumulCell);

            const eteCell = document.createElement('td');
            const eteHours = Math.floor(leg.cumulativeTime / 60);
            const eteMinutes = Math.round(leg.cumulativeTime % 60);
            eteCell.textContent = `${eteHours}:${eteMinutes.toString().padStart(2, '0')}`;
            row.appendChild(eteCell);

            tbody.appendChild(row);
        });

        modal.style.display = 'block';

        const closeBtn = document.getElementById('fpl-info-close');
        closeBtn.onclick = () => modal.style.display = 'none';
    }

    showClearFlightPlanConfirm() {
        const modal = document.getElementById('fpl-clear-confirm-modal');
        if (!modal) return;

        const flightPlanManager = this.getFlightPlanManager();
        if (!flightPlanManager?.flightPlan?.waypoints?.length) {
            return;
        }

        modal.style.display = 'block';

        const confirmBtn = document.getElementById('fpl-clear-confirm');
        const cancelBtn = document.getElementById('fpl-clear-cancel');

        const closeModal = () => {
            modal.style.display = 'none';
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        confirmBtn.onclick = () => {
            const fplPage = this.getFplPage();
            if (fplPage) {
                fplPage.confirmClear();
            }
            closeModal();
        };

        cancelBtn.onclick = closeModal;
    }

    sendFlightPlanToAutopilot() {
        const flightPlanManager = this.getFlightPlanManager();
        if (!flightPlanManager?.flightPlan?.waypoints?.length) {
            alert('No flight plan loaded');
            return;
        }

        this.showValidationModal(() => {
            const plan = flightPlanManager.flightPlan;
            const wps = plan.waypoints;

            const autopilotPlan = {
                name: `${wps[0]?.ident || 'WPT'}-${wps[wps.length - 1]?.ident || 'END'}`,
                departure: wps[0]?.ident || null,
                arrival: wps[wps.length - 1]?.ident || null,
                waypoints: wps.map(wp => ({
                    ident: wp.ident,
                    lat: wp.lat,
                    lon: wp.lng || wp.lon,
                    altitude: wp.altitude || null,
                    type: wp.type || 'WAYPOINT'
                })),
                cruiseAltitude: this.findCruiseAltitude(wps),
                totalDistance: flightPlanManager.calculateTotalDistance()
            };

            const syncChannel = this.getSyncChannel();
            if (syncChannel) {
                syncChannel.postMessage({
                    type: 'execute-flight-plan',
                    data: autopilotPlan,
                    source: 'GTN750'
                });

                const msg = `AI Autopilot engaged\nFlying: ${autopilotPlan.name}\n${wps.length} waypoints`;
                alert(msg);

                GTNCore.log(`[GTN750] Sent flight plan to AI Autopilot: ${autopilotPlan.name}`);
            } else {
                alert('SafeChannel not available\nOpen AI Autopilot pane first');
            }
        });
    }

    showValidationModal(onProceed) {
        const flightPlanValidator = this.getFlightPlanValidator();
        const flightPlanManager = this.getFlightPlanManager();
        const data = this.getData();

        if (!flightPlanValidator || !flightPlanManager?.flightPlan) {
            if (onProceed) onProceed();
            return;
        }

        const validation = flightPlanValidator.validateFlightPlan(
            flightPlanManager.flightPlan,
            { fuelTotal: data.fuelTotal }
        );

        const summary = flightPlanValidator.getValidationSummary(validation);

        if (validation.warnings.length === 0 && validation.errors.length === 0) {
            if (onProceed) onProceed();
            return;
        }

        const modal = document.getElementById('fpl-validation-modal');
        const header = document.getElementById('validation-header');
        const summaryEl = document.getElementById('validation-summary');
        const issuesEl = document.getElementById('validation-issues');
        const proceedBtn = document.getElementById('validation-proceed');
        const reviewBtn = document.getElementById('validation-review');
        const cancelBtn = document.getElementById('validation-cancel');

        if (!modal || !summaryEl || !issuesEl) {
            if (onProceed) onProceed();
            return;
        }

        summaryEl.className = `validation-summary ${summary.level}`;
        if (summary.level === 'critical') {
            header.style.background = 'var(--gtn-red, #ff0000)';
        } else if (summary.level === 'warning') {
            header.style.background = 'var(--gtn-yellow, #ffaa00)';
        }

        summaryEl.textContent = summary.message + (summary.canProceed ? ' found. Review before proceeding.' : ' must be resolved.');

        issuesEl.innerHTML = '';
        const allIssues = [...validation.errors, ...validation.warnings];
        allIssues.forEach(issue => {
            const issueEl = document.createElement('div');
            issueEl.className = `validation-issue ${issue.severity}`;

            const icon = issue.severity === 'critical' ? '\u274C' : '\u26A0\uFE0F';
            const waypointTag = issue.waypointIndex >= 0
                ? `<span class="validation-waypoint">Leg ${issue.waypointIndex + 1}</span>`
                : '';

            issueEl.innerHTML = `
                <div class="validation-issue-header">
                    <span class="validation-icon ${issue.severity}">${icon}</span>
                    <span class="validation-message">${issue.message}</span>
                    ${waypointTag}
                </div>
                ${issue.details ? `<div class="validation-details">${issue.details}</div>` : ''}
            `;
            issuesEl.appendChild(issueEl);
        });

        if (summary.canProceed) {
            proceedBtn.style.display = 'inline-block';
        } else {
            proceedBtn.style.display = 'none';
        }

        modal.style.display = 'block';

        const closeModal = () => {
            modal.style.display = 'none';
            proceedBtn.onclick = null;
            reviewBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        proceedBtn.onclick = () => {
            closeModal();
            if (onProceed) onProceed();
        };

        reviewBtn.onclick = () => {
            closeModal();
            const pageManager = this.getPageManager();
            if (pageManager) {
                pageManager.setActivePage('fpl');
            }
        };

        cancelBtn.onclick = closeModal;
    }

    findCruiseAltitude(waypoints) {
        if (!waypoints || waypoints.length < 3) return 8500;

        const startIdx = Math.floor(waypoints.length / 3);
        const endIdx = Math.floor(waypoints.length * 2 / 3);
        const middleWaypoints = waypoints.slice(startIdx, endIdx);

        const altitudes = middleWaypoints
            .map(wp => wp.altitude)
            .filter(alt => alt && alt > 0);

        if (altitudes.length === 0) return 8500;

        return Math.max(...altitudes);
    }

    destroy() {
        // No persistent state to clean up
    }
}
