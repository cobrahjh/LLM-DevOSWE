/**
 * GTN750 Compact Mode v1.0.0
 * Compact canvas rendering + UI for 320x200 layout
 * Extracted from pane.js
 *
 * Lazy loaded on first compact toggle via _ensureCompactMode()
 *
 * @param {Object} opts
 * @param {GTNCore} opts.core
 * @param {Object} opts.elements - DOM element refs from pane.js
 * @param {Function} opts.getData - Returns current aircraft data
 * @param {Function} opts.getMap - Returns map settings object
 * @param {Function} opts.getFlightPlanManager - Returns GTNFlightPlan instance
 * @param {Function} opts.getCdiManager - Returns GTNCdi instance
 * @param {Function} opts.getPageManager - Returns page manager instance
 * @param {Function} opts.changeRange - Changes map range (+1/-1)
 * @param {Function} opts.updateVNav - Updates VNAV display
 * @param {Function} opts.resizeCanvas - Resizes main map canvas
 * @param {Function} opts._getCdiState - Returns CDI state
 */

class GTNCompactMode {
    constructor({ core, elements, getData, getMap, getFlightPlanManager,
                  getCdiManager, getPageManager, changeRange,
                  updateVNav, resizeCanvas, getCdiState }) {
        this.core = core;
        this.elements = elements;
        this.getData = getData;
        this.getMap = getMap;
        this.getFlightPlanManager = getFlightPlanManager;
        this.getCdiManager = getCdiManager;
        this.getPageManager = getPageManager;
        this.changeRange = changeRange;
        this.updateVNav = updateVNav;
        this.resizeCanvas = resizeCanvas;
        this.getCdiState = getCdiState;

        // Canvas state
        this.gcCanvas = null;
        this.gcCtx = null;
        this.gcCanvasW = 0;
        this.gcCanvasH = 0;
        this._compactRafId = null;
        this.gcCompactPage = 'map';
        this.compactMode = false;
    }

    setupCompactCanvas() {
        this.gcCanvas = document.getElementById('gc-map');
        if (!this.gcCanvas) return;
        this.gcCtx = this.gcCanvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = this.gcCanvas.parentElement.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        this.gcCanvas.width = rect.width * dpr;
        this.gcCanvas.height = rect.height * dpr;
        this.gcCtx.scale(dpr, dpr);
        this.gcCanvasW = rect.width;
        this.gcCanvasH = rect.height;
    }

    startCompactRender() {
        this.compactMode = true;
        setTimeout(() => {
            this.setupCompactCanvas();
            if (this._compactRafId) cancelAnimationFrame(this._compactRafId);
            const loop = () => {
                if (!this.compactMode) { this._compactRafId = null; return; }
                this.renderCompactMap();
                this.updateCompact();
                this._compactRafId = requestAnimationFrame(loop);
            };
            this._compactRafId = requestAnimationFrame(loop);
        }, 50);
    }

    stopCompactRender() {
        this.compactMode = false;
        if (this._compactRafId) {
            cancelAnimationFrame(this._compactRafId);
            this._compactRafId = null;
        }
    }

    renderCompactMap() {
        if (!this.gcCtx || !this.gcCanvasW) {
            this.setupCompactCanvas();
            if (!this.gcCtx || !this.gcCanvasW) return;
        }
        const ctx = this.gcCtx;
        const w = this.gcCanvasW;
        const h = this.gcCanvasH;
        const data = this.getData();
        const map = this.getMap();
        const flightPlanManager = this.getFlightPlanManager();

        // Dark background
        ctx.fillStyle = '#050e1a';
        ctx.fillRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = 'rgba(0,212,255,0.06)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < w; i += 30) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
        for (let j = 0; j < h; j += 30) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke(); }

        // Range ring
        const ringR = Math.min(w, h) * 0.3;
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.65, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,212,255,0.12)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Aircraft position (center-lower)
        const ax = w / 2, ay = h * 0.65;

        // Draw flight plan line if available
        const fpl = flightPlanManager?.flightPlan;
        if (fpl?.waypoints?.length > 1 && data.latitude) {
            const nmPerPx = map.range / ringR;
            const rotation = map.orientation === 'north' ? 0 : -(data.track || data.heading || 0) * Math.PI / 180;

            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(rotation);

            ctx.beginPath();
            let started = false;
            fpl.waypoints.forEach(wp => {
                if (!wp.lat || !wp.lng) return;
                const dlat = (wp.lat - data.latitude) * 60;
                const dlon = (wp.lng - data.longitude) * 60 * Math.cos(data.latitude * Math.PI / 180);
                const px = dlon / nmPerPx;
                const py = -dlat / nmPerPx;
                if (!started) { ctx.moveTo(px, py); started = true; }
                else ctx.lineTo(px, py);
            });
            ctx.strokeStyle = '#FF44CC';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Waypoint diamonds and labels
            const activeIdx = flightPlanManager?.activeWaypointIndex || 0;
            fpl.waypoints.forEach((wp, i) => {
                if (!wp.lat || !wp.lng) return;
                const dlat = (wp.lat - data.latitude) * 60;
                const dlon = (wp.lng - data.longitude) * 60 * Math.cos(data.latitude * Math.PI / 180);
                const px = dlon / nmPerPx;
                const py = -dlat / nmPerPx;
                if (Math.abs(px) > w && Math.abs(py) > h) return;

                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(Math.PI / 4);
                ctx.fillStyle = i === activeIdx ? '#FF44CC' : '#00D4FF';
                ctx.fillRect(-3, -3, 6, 6);
                ctx.restore();

                ctx.font = '700 8px Consolas, monospace';
                ctx.fillStyle = '#00D4FF';
                ctx.fillText(wp.ident || '', px + 6, py - 2);
            });

            ctx.restore();
        }

        // Aircraft symbol
        ctx.beginPath();
        ctx.moveTo(ax, ay - 6);
        ctx.lineTo(ax - 5, ay + 4);
        ctx.lineTo(ax, ay + 1);
        ctx.lineTo(ax + 5, ay + 4);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.fill();
    }

    updateCompact() {
        const d = this.getData();
        const e = this.elements;
        const flightPlanManager = this.getFlightPlanManager();
        const cdiManager = this.getCdiManager();
        const map = this.getMap();

        // Frequencies
        if (e.gcCom1) e.gcCom1.textContent = (d.com1Active || 118.00).toFixed(3);
        if (e.gcCom1Stby) e.gcCom1Stby.textContent = (d.com1Standby || 118.00).toFixed(3);
        if (e.gcNav1) e.gcNav1.textContent = (d.nav1Active || 108.00).toFixed(2);
        if (e.gcNav1Stby) e.gcNav1Stby.textContent = (d.nav1Standby || 108.00).toFixed(2);
        if (e.gcXpdr) e.gcXpdr.textContent = Math.round(d.transponder || 1200).toString(16).toUpperCase().padStart(4, '0');
        if (e.gcXpdrMode) {
            const modeMap = { 0: 'OFF', 1: 'SBY', 2: 'TST', 3: 'ON', 4: 'ALT', 5: 'GND' };
            e.gcXpdrMode.textContent = modeMap[d.transponderState] || 'ALT';
        }

        // Corner data
        if (e.gcTrk) e.gcTrk.textContent = Math.round(d.track || d.heading || 0).toString().padStart(3, '0') + '\u00B0';
        if (e.gcGs) e.gcGs.textContent = Math.round(d.groundSpeed || 0) + 'kt';
        if (e.gcAlt) e.gcAlt.textContent = Math.round(d.altitude || 0).toLocaleString();

        // ETE
        if (e.gcEte) {
            if (flightPlanManager?.activeWaypoint && d.groundSpeed > 5) {
                const dist = this.core.calculateDistance(d.latitude, d.longitude, flightPlanManager.activeWaypoint.lat, flightPlanManager.activeWaypoint.lng);
                const eteMin = (dist / d.groundSpeed) * 60;
                e.gcEte.textContent = this.core.formatEte(eteMin);
            } else {
                e.gcEte.textContent = '--:--';
            }
        }

        // Waypoint
        if (e.gcWptId) {
            const wp = flightPlanManager?.activeWaypoint;
            e.gcWptId.textContent = wp?.ident || '----';
        }
        if (e.gcWptDtk) {
            const cdiDtk = cdiManager?.cdi?.dtk;
            e.gcWptDtk.textContent = cdiDtk ? Math.round(cdiDtk).toString().padStart(3, '0') + '\u00B0' : '---\u00B0';
        }
        if (e.gcWptDis) {
            const wp = flightPlanManager?.activeWaypoint;
            if (wp?.lat && d.latitude) {
                const dist = this.core.calculateDistance(d.latitude, d.longitude, wp.lat, wp.lng);
                e.gcWptDis.textContent = dist.toFixed(1) + 'nm';
            } else {
                e.gcWptDis.textContent = '--.-nm';
            }
        }

        // CDI
        if (e.gcCdiSrc) e.gcCdiSrc.textContent = cdiManager?.navSource || 'GPS';
        if (e.gcCdiTo) {
            const tf = cdiManager?.cdi?.toFrom;
            e.gcCdiTo.textContent = ['FROM', 'TO', '---'][tf] || '---';
        }
        if (e.gcCdiDtk) {
            const dtk = cdiManager?.cdi?.dtk;
            e.gcCdiDtk.textContent = dtk ? Math.round(dtk).toString().padStart(3, '0') : '---';
        }
        if (e.gcCdiXtk) {
            const xtk = cdiManager?.cdi?.xtk;
            e.gcCdiXtk.textContent = xtk != null ? Math.abs(xtk).toFixed(1) : '0.0';
        }

        // CDI needle position
        if (e.gcCdiNeedle) {
            const needle = cdiManager?.cdi?.needle || 0;
            const offset = Math.max(-30, Math.min(30, needle * 20));
            e.gcCdiNeedle.style.left = `calc(50% + ${offset}px)`;
        }

        // Range
        if (e.gcRange) e.gcRange.textContent = map.range;

        // Update VNAV
        this.updateVNav();
    }

    bindCompactEvents() {
        const cdiManager = this.getCdiManager();
        const flightPlanManager = this.getFlightPlanManager();
        const pageManager = this.getPageManager();

        // Compact range buttons
        document.getElementById('gc-zoom-in')?.addEventListener('click', () => this.changeRange(-1));
        document.getElementById('gc-zoom-out')?.addEventListener('click', () => this.changeRange(1));

        // Compact softkeys
        document.getElementById('gc-sk-menu')?.addEventListener('click', () => {
            document.getElementById('gc-tabs')?.classList.toggle('visible');
        });
        document.getElementById('gc-sk-ter')?.addEventListener('click', () => {
            const map = this.getMap();
            map.showTerrain = !map.showTerrain;
            document.getElementById('gc-sk-ter')?.classList.toggle('active', map.showTerrain);
        });
        document.getElementById('gc-sk-tfc')?.addEventListener('click', () => {
            const map = this.getMap();
            map.showTraffic = !map.showTraffic;
            document.getElementById('gc-sk-tfc')?.classList.toggle('active', map.showTraffic);
        });
        document.getElementById('gc-sk-dto')?.addEventListener('click', () => {
            this.getFlightPlanManager()?.showDirectTo();
        });
        document.getElementById('gc-sk-cdi')?.addEventListener('click', () => {
            const cm = this.getCdiManager();
            const sources = ['GPS', 'NAV1', 'NAV2'];
            const idx = sources.indexOf(cm?.navSource || 'GPS');
            const next = sources[(idx + 1) % sources.length];
            cm.setNavSource(next);
            // Update data.navSource via getData ref
            const data = this.getData();
            data.navSource = next;
            cm.updateFromSource(this.getCdiState());
        });
        document.getElementById('gc-sk-back')?.addEventListener('click', () => {
            document.getElementById('gc-tabs')?.classList.remove('visible');
            document.getElementById('gc-fpl')?.classList.remove('visible');
            this.gcCompactPage = 'map';
        });

        // Compact page tabs
        document.getElementById('gc-tabs')?.addEventListener('click', (e) => {
            const tab = e.target.closest('.gc-tab');
            if (!tab) return;
            const pageId = tab.dataset.page;

            document.querySelectorAll('#gc-tabs .gc-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (pageId === 'fpl') {
                document.getElementById('gc-fpl')?.classList.add('visible');
                this.gcCompactPage = 'fpl';
                this.updateCompactFpl();
            } else {
                document.getElementById('gc-fpl')?.classList.remove('visible');
                this.gcCompactPage = pageId;
            }

            pageManager?.switchPage(pageId, false);

            document.getElementById('gc-tabs')?.classList.remove('visible');
        });
    }

    updateCompactFpl() {
        const fplEl = document.getElementById('gc-fpl');
        if (!fplEl) return;

        const flightPlanManager = this.getFlightPlanManager();
        const plan = flightPlanManager?.flightPlan;
        if (!plan?.waypoints?.length) {
            fplEl.innerHTML = '<div style="color:#607080;font-size:9px;padding:20px;text-align:center">No flight plan</div>';
            return;
        }

        const activeIdx = flightPlanManager?.activeWaypointIndex || 0;
        let html = '';
        plan.waypoints.forEach((wp, i) => {
            const isActive = i === activeIdx;
            const alt = wp.altitude ? (wp.altitude >= 18000 ? 'FL' + Math.round(wp.altitude / 100) : Math.round(wp.altitude)) : '---';
            html += `<div class="gc-fpl-row${isActive ? ' active' : ''}">`;
            html += `<span class="gc-fpl-wpt">${wp.ident || '----'}</span>`;
            html += `<span class="gc-fpl-dtk">${wp.dtk ? Math.round(wp.dtk) + '\u00B0' : '---'}</span>`;
            html += `<span class="gc-fpl-dis">${wp.distanceFromPrev ? wp.distanceFromPrev.toFixed(0) + 'nm' : '---'}</span>`;
            html += `<span class="gc-fpl-alt">${alt}</span>`;
            html += `</div>`;
        });
        fplEl.innerHTML = html;
    }

    destroy() {
        this.stopCompactRender();
    }
}
