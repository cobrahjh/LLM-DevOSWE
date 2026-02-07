/**
 * GTN750 GPS Glass v2.0.0 - Full Garmin Feature Set
 * Modular architecture with page manager and soft keys
 *
 * Orchestrator: creates and wires together all module instances.
 * Actual logic lives in:
 *   - GTNMapRenderer (map canvas rendering)
 *   - GTNCdi (CDI, OBS, nav source)
 *   - GTNFlightPlan (FPL, Direct-To, sequencing)
 *   - GTNDataHandler (WebSocket, traffic, frequencies) — browser mode
 *   - GTNSimVarHandler (SimVar API, traffic, frequencies) — MSFS native mode
 *   - GTNDataFields (corner data fields)
 */

class GTN750Glass extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'gtn750',
            widgetVersion: '2.0.0',
            autoConnect: false  // Uses GTNDataHandler for WebSocket management
        });

        this.serverPort = 8080;

        // Initialize core utilities
        this.core = new GTNCore();

        // Aircraft data
        this.data = {
            latitude: 0, longitude: 0, altitude: 0,
            groundSpeed: 0, heading: 0, track: 0, magvar: 0, verticalSpeed: 0,
            com1Active: 118.00, com1Standby: 118.00,
            com2Active: 118.00, com2Standby: 118.00,
            nav1Active: 108.00, nav1Standby: 108.00,
            transponder: 1200, zuluTime: 0,
            navSource: 'GPS',
            windDirection: 0, windSpeed: 0,
            ambientTemp: 15, ambientPressure: 29.92,
            visibility: 10000, precipState: 0
        };

        // Map settings
        this.map = {
            range: 10,
            ranges: [2, 5, 10, 20, 50, 100, 200],
            orientation: 'track',
            showTerrain: false, showTraffic: false, showWeather: false
        };

        // TAWS
        this.taws = { active: true, inhibited: false };

        // Overlays (initialized after canvas setup)
        this.terrainOverlay = null;
        this.mapControls = null;

        // Pan offset for map
        this.panOffset = { x: 0, y: 0 };

        // Declutter
        this.declutterLevel = 0;

        // Cross-glass sync
        this.syncChannel = new BroadcastChannel('SimGlass-sync');

        // Create module instances
        this.dataFieldsManager = new GTNDataFields({ core: this.core });
        this.cdiManager = new GTNCdi({ core: this.core, elements: {}, serverPort: this.serverPort });
        this.flightPlanManager = new GTNFlightPlan({
            core: this.core,
            elements: {},
            serverPort: this.serverPort,
            syncChannel: this.syncChannel,
            onWaypointChanged: () => this.flightPlanManager.updateWaypointDisplay(this.data, this.cdiManager),
            onDirectToActivated: () => {
                if (this.pageManager) this.pageManager.switchPage('map');
            }
        });
        this.mapRenderer = new GTNMapRenderer({
            core: this.core,
            getState: () => this.getRendererState()
        });
        // Auto-detect: use SimVar API inside MSFS, WebSocket in browser
        const HandlerClass = (typeof SimVar !== 'undefined') ? GTNSimVarHandler : GTNDataHandler;
        this.dataHandler = new HandlerClass({
            core: this.core,
            serverPort: this.serverPort,
            elements: {},
            onDataUpdate: (d) => this.handleSimData(d)
        });

        this.initSyncListener();
        this.init();
    }

    init() {
        this.cacheElements();
        this.wireModuleElements();
        this.setupCanvas();
        this.initOverlays();
        this.initSoftKeys();
        this.initPageManager();
        this.bindEvents();
        this.bindTawsAlerts();
        this.dataFieldsManager.loadConfig();
        this.dataHandler.connect();
        this.dataHandler.startClock();
        this.flightPlanManager.fetchFlightPlan();
        this.mapRenderer.start();
        this.dataHandler.startTrafficPolling(
            () => this.map.showTraffic || this.pageManager?.getCurrentPageId() === 'traffic',
            this.trafficOverlay
        );
    }

    /**
     * Share cached DOM elements with all modules
     */
    wireModuleElements() {
        // CDI elements
        this.cdiManager.elements = {
            cdiNeedle: this.elements.cdiNeedle,
            cdiDtk: this.elements.cdiDtk,
            cdiXtrk: this.elements.cdiXtrk,
            cdiSource: this.elements.cdiSource,
            cdiToFrom: this.elements.cdiToFrom,
            cdiGsNeedle: this.elements.cdiGsNeedle,
            cdiGsBar: this.elements.cdiGsBar,
            cdiFlag: this.elements.cdiFlag,
            obsValue: this.elements.obsValue,
            obsControls: this.elements.obsControls,
            navSourceGps: this.elements.navSourceGps,
            navSourceNav1: this.elements.navSourceNav1,
            navSourceNav2: this.elements.navSourceNav2,
            obsIndicator: document.getElementById('obs-indicator'),
            obsCourse: document.getElementById('obs-course')
        };

        // Flight plan elements
        this.flightPlanManager.elements = {
            fplDep: this.elements.fplDep,
            fplArr: this.elements.fplArr,
            fplDist: this.elements.fplDist,
            fplEte: this.elements.fplEte,
            fplList: this.elements.fplList,
            fplProgress: this.elements.fplProgress,
            wptId: this.elements.wptId,
            wptDis: this.elements.wptDis,
            wptBrg: this.elements.wptBrg,
            wptEte: this.elements.wptEte,
            wptDtk: document.getElementById('wpt-dtk'),
            wptType: document.getElementById('wpt-type')
        };

        // Data handler elements
        this.dataHandler.elements = {
            conn: this.elements.conn,
            sysGpsStatus: this.elements.sysGpsStatus,
            com1: this.elements.com1,
            com1Stby: this.elements.com1Stby,
            com2: this.elements.com2,
            com2Stby: this.elements.com2Stby,
            nav1: this.elements.nav1,
            nav1Stby: this.elements.nav1Stby,
            nav1Ident: this.elements.nav1Ident,
            nav1Radial: this.elements.nav1Radial,
            nav1Dme: this.elements.nav1Dme,
            xpdr: this.elements.xpdr,
            utcTime: this.elements.utcTime
        };
    }

    /**
     * Build state snapshot for the map renderer
     */
    getRendererState() {
        return {
            ctx: this.ctx,
            canvas: this.canvas,
            panOffset: this.panOffset,
            declutterLevel: this.declutterLevel,
            map: this.map,
            data: this.data,
            taws: this.taws,
            terrainOverlay: this.terrainOverlay,
            trafficOverlay: this.trafficOverlay,
            weatherOverlay: this.weatherOverlay,
            flightPlan: this.flightPlanManager.flightPlan,
            activeWaypointIndex: this.flightPlanManager.activeWaypointIndex,
            activeWaypoint: this.flightPlanManager.activeWaypoint,
            obs: this.cdiManager.obs,
            nav1: this.cdiManager.nav1,
            nav2: this.cdiManager.nav2,
            gps: this.cdiManager.gps,
            onUpdateDatafields: () => {
                this.dataFieldsManager.update(this.data, {
                    flightPlan: this.flightPlanManager.flightPlan,
                    activeWaypointIndex: this.flightPlanManager.activeWaypointIndex,
                    cdi: this.cdiManager.cdi
                });
                // Range display
                if (this.elements.dfRange) this.elements.dfRange.textContent = this.map.range;
            }
        };
    }

    /**
     * Handle incoming sim data from WebSocket
     */
    handleSimData(d) {
        // Update local data store
        if (d.latitude !== undefined) this.data.latitude = d.latitude;
        if (d.longitude !== undefined) this.data.longitude = d.longitude;
        if (d.altitudeMSL !== undefined) this.data.altitude = d.altitudeMSL;
        if (d.altitude !== undefined) this.data.altitude = d.altitude;
        if (d.altitudeAGL !== undefined) this.data.altitudeAGL = d.altitudeAGL;
        if (d.groundAltitude !== undefined) this.data.groundAltitude = d.groundAltitude;
        if (d.groundSpeed !== undefined) this.data.groundSpeed = d.groundSpeed;
        if (d.heading !== undefined) this.data.heading = d.heading;
        if (d.magvar !== undefined) this.data.magvar = d.magvar;
        if (d.groundTrack !== undefined) this.data.track = d.groundTrack;
        if (d.track !== undefined && d.groundTrack === undefined) this.data.track = d.track;
        if (d.verticalSpeed !== undefined) this.data.verticalSpeed = d.verticalSpeed;
        if (d.com1Active !== undefined) this.data.com1Active = d.com1Active;
        if (d.com1Standby !== undefined) this.data.com1Standby = d.com1Standby;
        if (d.com2Active !== undefined) this.data.com2Active = d.com2Active;
        if (d.com2Standby !== undefined) this.data.com2Standby = d.com2Standby;
        if (d.nav1Active !== undefined) this.data.nav1Active = d.nav1Active;
        if (d.nav1Standby !== undefined) this.data.nav1Standby = d.nav1Standby;
        if (d.transponder !== undefined) this.data.transponder = d.transponder;
        if (d.zuluTime !== undefined) this.data.zuluTime = d.zuluTime;
        // Weather
        if (d.windDirection !== undefined) this.data.windDirection = d.windDirection;
        if (d.windSpeed !== undefined) this.data.windSpeed = d.windSpeed;
        if (d.ambientTemp !== undefined) this.data.ambientTemp = d.ambientTemp;
        if (d.ambientPressure !== undefined) this.data.ambientPressure = d.ambientPressure;
        if (d.visibility !== undefined) this.data.visibility = d.visibility;
        if (d.precipState !== undefined) this.data.precipState = d.precipState;
        // Fuel
        if (d.fuelTotal !== undefined) this.data.fuelTotal = d.fuelTotal;
        if (d.fuelFlow !== undefined) this.data.fuelFlow = d.fuelFlow;
        if (d.fuelCapacity !== undefined) this.data.fuelCapacity = d.fuelCapacity;

        // Update CDI nav data
        this.cdiManager.updateNav1(d);
        this.cdiManager.updateNav2(d);
        this.cdiManager.updateGps(d);

        // Mark sim time available
        if (d.zuluTime) this.dataHandler.setHasSimTime(true);

        // Update UI through modules
        this.dataHandler.updateUI(this.data, this.cdiManager.nav1);
        this.flightPlanManager.setPosition(this.data.latitude, this.data.longitude);
        this.flightPlanManager.setGroundSpeed(this.data.groundSpeed);
        this.flightPlanManager.updateWaypointDisplay(this.data, this.cdiManager);
        this.cdiManager.updateFromSource({
            flightPlan: this.flightPlanManager.flightPlan,
            activeWaypointIndex: this.flightPlanManager.activeWaypointIndex,
            data: this.data
        });
        this.flightPlanManager.checkWaypointSequencing(this.data, this.cdiManager.obs.suspended);
        this.updateAuxData();
    }

    updateAuxData() {
        if (!this.flightPlanManager.flightPlan?.waypoints) return;

        let remDist = 0;
        for (let i = this.flightPlanManager.activeWaypointIndex; i < this.flightPlanManager.flightPlan.waypoints.length; i++) {
            const wp = this.flightPlanManager.flightPlan.waypoints[i];
            if (wp.distanceFromPrev) remDist += wp.distanceFromPrev;
        }
        if (this.elements.auxDist) this.elements.auxDist.textContent = Math.round(remDist) + ' NM';

        if (this.data.groundSpeed > 0) {
            const eteMin = (remDist / this.data.groundSpeed) * 60;
            if (this.elements.auxTime) this.elements.auxTime.textContent = this.core.formatEte(eteMin);

            if (this.elements.auxEta && this.data.zuluTime) {
                const etaHrs = this.data.zuluTime + (eteMin / 60);
                this.elements.auxEta.textContent = this.core.formatTime(etaHrs);
            }
        }
    }

    // ===== OVERLAYS =====

    initOverlays() {
        this.terrainOverlay = new TerrainOverlay({ core: this.core });
        this.trafficOverlay = new TrafficOverlay({ core: this.core });
        this.weatherOverlay = new WeatherOverlay({ core: this.core });

        if (this.canvas) {
            this.mapControls = new MapControls({
                canvas: this.canvas,
                onRangeChange: (range) => {
                    this.map.range = range;
                    if (this.elements.dfRange) this.elements.dfRange.textContent = range;
                },
                onPan: (offset) => { this.panOffset = offset; },
                onDataFieldTap: (position, type) => {
                    console.log(`[GTN750] Data field ${position} changed to ${type.type}`);
                }
            });
            this.mapControls.setRange(this.map.range);
        }

        this.proceduresPage = new ProceduresPage({
            core: this.core, serverPort: this.serverPort,
            onProcedureSelect: (proc, type, waypoints) => this.handleProcedureSelect(proc, type, waypoints),
            onProcedureLoad: (proc, type, waypoints) => this.handleProcedureLoad(proc, type, waypoints)
        });
        this.auxPage = new AuxPage({ core: this.core });
        this.chartsPage = new ChartsPage({
            core: this.core, serverPort: this.serverPort,
            onChartSelect: (chart) => console.log(`[GTN750] Chart selected: ${chart.name}`)
        });
        this.nearestPage = new NearestPage({
            core: this.core, serverPort: this.serverPort,
            onItemSelect: (item, type) => console.log(`[GTN750] Nearest ${type} selected: ${item.icao || item.id}`),
            onDirectTo: (item) => this.flightPlanManager.directTo(item)
        });
        this.systemPage = new SystemPage({
            core: this.core,
            onSettingChange: (key, value) => this.handleSettingChange(key, value)
        });

        // Wire nearest page to flight plan for D→ lookups
        this.flightPlanManager.setNearestPage(this.nearestPage);
    }

    handleSettingChange(key, value) {
        switch (key) {
            case 'mapOrientation': this.map.orientation = value; break;
            case 'showTerrain': this.map.showTerrain = value; break;
            case 'showTraffic': this.map.showTraffic = value; break;
            case 'showWeather': this.map.showWeather = value; break;
            case 'nightMode': document.body.classList.toggle('night-mode', value); break;
        }
    }

    handleProcedureSelect(proc, type, waypoints) {
        this.procedurePreview = { procedure: proc, type, waypoints };
        console.log(`[GTN750] Procedure selected: ${proc.name}`);
    }

    handleProcedureLoad(proc, type, waypoints) {
        console.log(`[GTN750] Loading procedure: ${proc.name}`);
        this.syncChannel.postMessage({
            type: 'procedure-load',
            data: { procedure: proc, procedureType: type, waypoints }
        });
    }

    // ===== PAGE MANAGEMENT =====

    initPageManager() {
        this.pageManager = new GTNPageManager({
            onPageChange: (pageId) => this.onPageChange(pageId)
        });

        const pages = ['map', 'fpl', 'wpt', 'nrst', 'proc', 'terrain', 'traffic', 'wx', 'charts', 'aux', 'system'];
        pages.forEach(id => {
            this.pageManager.registerPage(id, {
                id,
                onActivate: () => this.onPageActivate(id),
                onDeactivate: () => this.onPageDeactivate(id),
                updateData: () => {}
            });
        });

        this.pageManager.switchPage('map', false);
    }

    initSoftKeys() {
        if (typeof GTNSoftKeys === 'undefined') {
            setTimeout(() => this.initSoftKeys(), 100);
            return;
        }
        if (this.softKeys) return;
        this.softKeys = new GTNSoftKeys({ container: document.getElementById('gtn-softkeys') });
        this.softKeys.setContext('map');

        window.addEventListener('gtn:softkey', (e) => {
            this.handleSoftKeyAction(e.detail.action, e.detail);
        });
    }

    onPageChange(pageId) {
        const title = document.getElementById('page-title');
        if (title) {
            const titles = {
                map: 'MAP', fpl: 'FLIGHT PLAN', wpt: 'WAYPOINT',
                nrst: 'NEAREST', proc: 'PROCEDURES', terrain: 'TERRAIN',
                traffic: 'TRAFFIC', wx: 'WEATHER', charts: 'CHARTS',
                aux: 'AUX', system: 'SYSTEM'
            };
            title.textContent = titles[pageId] || pageId.toUpperCase();
        }

        if (this.softKeys) {
            this.softKeys.setContext(pageId);
        } else {
            setTimeout(() => {
                if (!this.softKeys) this.initSoftKeys();
                this.softKeys?.setContext(pageId);
            }, 100);
        }

        document.querySelectorAll('.gtn-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.page === pageId);
        });
    }

    onPageActivate(pageId) {
        if (pageId === 'proc') {
            if (this.proceduresPage) {
                this.proceduresPage.init();
                if (this.flightPlanManager.flightPlan?.waypoints?.length > 0) {
                    const dest = this.flightPlanManager.flightPlan.waypoints[this.flightPlanManager.flightPlan.waypoints.length - 1];
                    if (dest.ident?.length === 4) this.proceduresPage.setAirport(dest.ident);
                }
            }
        }
        if (pageId === 'terrain') { this.setupTerrainCanvas(); this.startTerrainPageRender(); }
        if (pageId === 'traffic') { this.setupTrafficCanvas(); this.startTrafficPageRender(); }
        if (pageId === 'wx') { this.setupWeatherCanvas(); this.startWeatherPageRender(); }
        if (pageId === 'aux') {
            if (this.auxPage) this.auxPage.init();
            this.updateAuxPageData();
        }
        if (pageId === 'charts') {
            if (this.chartsPage) {
                this.chartsPage.init();
                if (this.flightPlanManager.flightPlan?.waypoints?.length > 0) {
                    const dest = this.flightPlanManager.flightPlan.waypoints[this.flightPlanManager.flightPlan.waypoints.length - 1];
                    if (dest.ident?.length === 4) this.chartsPage.setAirport(dest.ident);
                }
            }
        }
        if (pageId === 'nrst') {
            if (this.nearestPage) {
                this.nearestPage.setPosition(this.data.latitude, this.data.longitude);
                this.nearestPage.init();
            }
        }
        if (pageId === 'system') {
            if (this.systemPage) this.systemPage.init();
        }
    }

    onPageDeactivate(pageId) {
        if (pageId === 'terrain') this.terrainPageRenderActive = false;
        if (pageId === 'traffic') this.trafficPageRenderActive = false;
        if (pageId === 'wx') this.weatherPageRenderActive = false;
    }

    updateAuxPageData() {
        if (!this.auxPage) return;
        const tripData = this.auxPage.updateTripData(
            { waypoints: this.flightPlanManager.flightPlan?.waypoints, activeWaypointIndex: this.flightPlanManager.activeWaypointIndex },
            this.data
        );
        if (tripData) {
            if (this.elements.auxDist) this.elements.auxDist.textContent = `${tripData.remainingDist} NM`;
            if (this.elements.auxTime) this.elements.auxTime.textContent = tripData.timeRemaining;
            if (this.elements.auxEta) this.elements.auxEta.textContent = tripData.eta;
            if (this.elements.auxFuel) this.elements.auxFuel.textContent = `${tripData.fuelRequired} GAL`;
        }
    }

    // ===== CANVAS SETUP =====

    setupCanvas() {
        this.canvas = this.elements.mapCanvas;
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
        }
    }

    setupTerrainCanvas() {
        const canvas = this.elements.terrainCanvas;
        if (canvas) {
            this.terrainCtx = canvas.getContext('2d');
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width > 0 ? rect.width : 480;
            canvas.height = rect.height > 0 ? rect.height : 280;
        }
    }

    setupTrafficCanvas() {
        const canvas = this.elements.trafficCanvas;
        if (canvas) {
            this.trafficCtx = canvas.getContext('2d');
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
        }
    }

    setupWeatherCanvas() {
        const canvas = this.elements.wxCanvas;
        if (!canvas) return;
        this.wxCtx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width > 0 ? rect.width : 400;
        canvas.height = rect.height > 0 ? rect.height : 280;
        if (!this.weatherRange) this.weatherRange = 50;
        if (this.weatherOverlay) {
            this.weatherOverlay.fetchRadarData();
            this.weatherOverlay.fetchNearbyMetars(this.data.latitude, this.data.longitude);
        }
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    // ===== PAGE RENDERING (terrain, traffic, weather) =====

    startTerrainPageRender() {
        this.terrainPageRenderActive = true;
        const renderLoop = () => {
            if (!this.terrainPageRenderActive) return;
            this.renderTerrainPage();
            requestAnimationFrame(renderLoop);
        };
        renderLoop();
    }

    startTrafficPageRender() {
        this.trafficPageRenderActive = true;
        if (this.trafficOverlay) this.trafficOverlay.setEnabled(true);
        const renderLoop = () => {
            if (!this.trafficPageRenderActive) return;
            this.renderTrafficPage();
            requestAnimationFrame(renderLoop);
        };
        renderLoop();
    }

    startWeatherPageRender() {
        this.weatherPageRenderActive = true;
        if (this.weatherOverlay) {
            this.weatherOverlay.setEnabled(true);
            this.weatherOverlay.setLayer('nexrad', true);
            this.weatherOverlay.setLayer('metar', true);
        }
        const renderLoop = () => {
            if (!this.weatherPageRenderActive) return;
            this.renderWeatherPage();
            requestAnimationFrame(renderLoop);
        };
        renderLoop();
    }

    renderTerrainPage() {
        if (!this.terrainCtx || !this.terrainOverlay) return;
        const canvas = this.elements.terrainCanvas;
        const w = canvas.width, h = canvas.height;

        this.terrainCtx.fillStyle = '#0a1520';
        this.terrainCtx.fillRect(0, 0, w, h);

        const realAGL = this.data.altitudeAGL || this.data.altitude;
        this.terrainOverlay.renderTerrainPage(this.terrainCtx, {
            latitude: this.data.latitude, longitude: this.data.longitude,
            altitude: this.data.altitude, altitudeAGL: realAGL,
            heading: this.data.heading, verticalSpeed: this.data.verticalSpeed,
            groundSpeed: this.data.groundSpeed
        }, w, h);

        if (this.elements.terrainClearance) {
            const agl = Math.round(realAGL);
            this.elements.terrainClearance.textContent = agl > 0 ? agl : '---';
        }
        if (this.elements.terrainMode) this.elements.terrainMode.textContent = this.terrainOverlay.getViewMode().toUpperCase();
        if (this.elements.terrainRange) this.elements.terrainRange.textContent = this.terrainOverlay.getRange();
    }

    renderTrafficPage() {
        if (!this.trafficCtx || !this.trafficOverlay) return;
        const canvas = this.elements.trafficCanvas;
        const w = canvas.width, h = canvas.height;

        const targetCount = this.trafficOverlay.renderTrafficPage(this.trafficCtx, {
            latitude: this.data.latitude, longitude: this.data.longitude,
            altitude: this.data.altitude, heading: this.data.heading,
            verticalSpeed: this.data.verticalSpeed, groundSpeed: this.data.groundSpeed
        }, w, h);

        if (this.elements.trafficCount) this.elements.trafficCount.textContent = targetCount;
        if (this.elements.trafficMode) this.elements.trafficMode.textContent = this.trafficOverlay.getMode();
    }

    renderWeatherPage() {
        if (!this.wxCtx || !this.weatherOverlay) return;
        const canvas = this.elements.wxCanvas;
        if (!canvas) return;

        if (canvas.width === 0 || canvas.height === 0) {
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width || 400;
            canvas.height = rect.height || 280;
        }

        const w = canvas.width, h = canvas.height;
        this.weatherOverlay.renderWeatherPage(this.wxCtx, {
            latitude: this.data.latitude, longitude: this.data.longitude,
            altitude: this.data.altitude, heading: this.data.heading
        }, w, h, this.weatherRange || 50);

        // METAR display
        if (this.elements.wxMetarText) {
            const metarData = this.weatherOverlay.metarData;
            if (metarData && metarData.size > 0) {
                let nearest = null, nearestDist = Infinity;
                metarData.forEach(m => {
                    const dist = this.core.calculateDistance(this.data.latitude, this.data.longitude, m.lat, m.lon);
                    if (dist < nearestDist) { nearestDist = dist; nearest = m; }
                });
                this.elements.wxMetarText.textContent = nearest ? (nearest.raw || `${nearest.icao}: ${nearest.category}`) : 'No METAR data';
            } else {
                this.elements.wxMetarText.textContent = 'Fetching weather...';
            }
        }

        // Radar timestamp
        if (this.elements.wxRadarTime) {
            const frameTime = this.weatherOverlay.getCurrentFrameTime();
            if (frameTime) {
                const age = Math.round((Date.now() - frameTime.getTime()) / 60000);
                this.elements.wxRadarTime.textContent = `Radar: ${frameTime.toUTCString().slice(17, 22)}Z (${age}m ago)`;
            } else if (this.weatherOverlay.hasRadarData()) {
                this.elements.wxRadarTime.textContent = 'Radar: Loading...';
            } else {
                this.elements.wxRadarTime.textContent = 'Radar: Simulated';
            }
        }

        this.updateSimWeatherDisplay();
    }

    // ===== WEATHER DISPLAY =====

    updateSimWeatherDisplay() {
        if (this.elements.wxWind) {
            const dir = Math.round(this.data.windDirection || 0);
            const spd = Math.round(this.data.windSpeed || 0);
            this.elements.wxWind.textContent = `${dir.toString().padStart(3, '0')}°/${spd}kt`;
        }
        if (this.elements.wxTemp) this.elements.wxTemp.textContent = `${Math.round(this.data.ambientTemp || 15)}°C`;
        if (this.elements.wxBaro) this.elements.wxBaro.textContent = `${(this.data.ambientPressure || 29.92).toFixed(2)}"`;
        if (this.elements.wxVis) {
            const visSM = (this.data.visibility || 10000) / 1609.34;
            this.elements.wxVis.textContent = visSM >= 10 ? '10+SM' : `${visSM.toFixed(1)}SM`;
        }
        if (this.elements.wxPrecip && this.elements.wxPrecipItem) {
            const precip = this.data.precipState || 0;
            if (precip === 0) {
                this.elements.wxPrecipItem.style.display = 'none';
            } else {
                this.elements.wxPrecipItem.style.display = '';
                this.elements.wxPrecip.textContent = (precip & 4) ? 'Snow' : (precip & 2) ? 'Rain' : 'Yes';
            }
        }
        this.updateWeatherConditionDisplay();
        if (this.weatherOverlay) {
            this.weatherOverlay.updateSimWeather({
                precipState: this.data.precipState, visibility: this.data.visibility,
                windDirection: this.data.windDirection, windSpeed: this.data.windSpeed,
                ambientTemp: this.data.ambientTemp
            });
        }
    }

    updateWeatherConditionDisplay() {
        const iconEl = document.getElementById('wx-condition-icon');
        const textEl = document.getElementById('wx-condition-text');
        if (!iconEl || !textEl) return;

        const precip = this.data.precipState || 0;
        const vis = this.data.visibility || 10000;
        const wind = this.data.windSpeed || 0;
        let icon = '☀️', text = 'Clear';

        if (precip & 4) { icon = '🌨️'; text = 'Snow'; }
        else if (precip & 2) { icon = wind > 25 ? '⛈️' : '🌧️'; text = wind > 25 ? 'Storm' : 'Rain'; }
        else if (vis < 1000) { icon = '🌫️'; text = 'Fog'; }
        else if (vis < 5000) { icon = '🌁'; text = 'Mist'; }
        else if (wind > 30) { icon = '💨'; text = 'Windy'; }
        else if (wind > 15) { icon = '🌤️'; text = 'Breezy'; }

        iconEl.textContent = icon;
        textEl.textContent = text;
    }

    async setWeatherPreset(preset) {
        console.log('[GTN750] Setting weather preset:', preset);
        try {
            const response = await fetch(`http://${window.location.hostname}:${this.serverPort}/api/weather/preset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preset })
            });
            const data = await response.json();
            if (data.success) {
                document.querySelectorAll('.wx-preset-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.preset === preset));
                document.getElementById('wx-live-btn')?.classList.remove('active');
            }
        } catch (e) { console.error('[GTN750] Weather error:', e); }
    }

    async setLiveWeather() {
        try {
            const response = await fetch(`http://${window.location.hostname}:${this.serverPort}/api/weather/mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'live' })
            });
            const data = await response.json();
            if (data.success) {
                document.querySelectorAll('.wx-preset-btn').forEach(btn => btn.classList.remove('active'));
                document.getElementById('wx-live-btn')?.classList.add('active');
            }
        } catch (e) { console.error('[GTN750] Live weather error:', e); }
    }

    // ===== TAWS =====

    bindTawsAlerts() {
        window.addEventListener('gtn:taws-alert', (e) => this.handleTawsAlert(e.detail));
    }

    handleTawsAlert(alert) {
        const alertEl = this.elements.tawsAlert;
        const textEl = this.elements.tawsText;
        if (!alertEl || !textEl) return;

        if (alert.level !== 'CLEAR' && alert.color) {
            alertEl.style.display = 'flex';
            alertEl.style.backgroundColor = alert.color;
            textEl.textContent = alert.message || alert.level.replace('_', ' ');
        } else {
            alertEl.style.display = 'none';
        }

        if (this.elements.tawsStatus) {
            this.elements.tawsStatus.textContent = this.taws.inhibited ? 'INHIBITED' : 'ACTIVE';
            this.elements.tawsStatus.style.color = this.taws.inhibited ? '#ffcc00' : '#00ff00';
        }
    }

    updateTawsStatus() {
        if (this.elements.tawsStatus) {
            this.elements.tawsStatus.textContent = this.taws.inhibited ? 'INHIBITED' : 'ACTIVE';
            this.elements.tawsStatus.style.color = this.taws.inhibited ? '#ffcc00' : '#00ff00';
        }
    }

    // ===== SYNC =====

    initSyncListener() {
        this.syncChannel.onmessage = (event) => {
            const { type, data } = event.data;
            this.flightPlanManager.handleSyncMessage(type, data);
        };
    }

    // ===== DOM CACHE =====

    cacheElements() {
        this.elements = {
            pageTitle: document.getElementById('page-title'),
            btnHome: document.getElementById('btn-home'),
            btnDirect: document.getElementById('btn-direct'),
            conn: document.getElementById('conn'),
            mapCanvas: document.getElementById('map-canvas'),
            zoomIn: document.getElementById('zoom-in'),
            zoomOut: document.getElementById('zoom-out'),
            tawsAlert: document.getElementById('taws-alert'),
            tawsText: document.getElementById('taws-text'),
            dfGs: document.getElementById('df-gs'),
            dfTrk: document.getElementById('df-trk'),
            dfAlt: document.getElementById('df-alt'),
            dfRange: document.getElementById('df-range'),
            wptId: document.getElementById('wpt-id'),
            wptDis: document.getElementById('wpt-dis'),
            wptBrg: document.getElementById('wpt-brg'),
            wptEte: document.getElementById('wpt-ete'),
            cdiNeedle: document.getElementById('cdi-needle'),
            cdiDtk: document.getElementById('cdi-dtk'),
            cdiXtrk: document.getElementById('cdi-xtrk'),
            cdiSource: document.getElementById('cdi-source'),
            cdiToFrom: document.getElementById('cdi-tofrom'),
            cdiGsNeedle: document.getElementById('cdi-gs-needle'),
            cdiGsBar: document.getElementById('cdi-gs-bar'),
            cdiFlag: document.getElementById('cdi-flag'),
            obsValue: document.getElementById('obs-value'),
            obsInc: document.getElementById('obs-inc'),
            obsDec: document.getElementById('obs-dec'),
            obsControls: document.getElementById('obs-controls'),
            navSourceGps: document.getElementById('nav-source-gps'),
            navSourceNav1: document.getElementById('nav-source-nav1'),
            navSourceNav2: document.getElementById('nav-source-nav2'),
            fplDep: document.getElementById('fpl-dep'),
            fplArr: document.getElementById('fpl-arr'),
            fplDist: document.getElementById('fpl-dist'),
            fplEte: document.getElementById('fpl-ete'),
            fplList: document.getElementById('fpl-list'),
            fplProgress: document.getElementById('fpl-progress'),
            wptSearch: document.getElementById('wpt-search'),
            wptGo: document.getElementById('wpt-go'),
            wptInfo: document.getElementById('wpt-info'),
            nrstList: document.getElementById('nrst-list'),
            procApt: document.getElementById('proc-apt'),
            procList: document.getElementById('proc-list'),
            terrainCanvas: document.getElementById('terrain-canvas'),
            tawsStatus: document.getElementById('taws-status'),
            terrainMode: document.getElementById('terrain-mode'),
            terrainRange: document.getElementById('terrain-range'),
            terrainRangeValue: document.getElementById('terrain-range-value'),
            terrainClearance: document.getElementById('terrain-clearance'),
            terrainZoomIn: document.getElementById('terrain-zoom-in'),
            terrainZoomOut: document.getElementById('terrain-zoom-out'),
            terrainView360: document.getElementById('terrain-view-360'),
            terrainViewArc: document.getElementById('terrain-view-arc'),
            trafficCanvas: document.getElementById('traffic-canvas'),
            trafficMode: document.getElementById('traffic-mode'),
            trafficCount: document.getElementById('traffic-count'),
            wxCanvas: document.getElementById('wx-canvas'),
            wxSimRadar: document.getElementById('wx-sim-radar'),
            wxNexrad: document.getElementById('wx-nexrad'),
            wxMetar: document.getElementById('wx-metar'),
            wxMetarText: document.getElementById('wx-metar-text'),
            wxAnimate: document.getElementById('wx-animate'),
            wxRadarTime: document.getElementById('wx-radar-time'),
            wxRange: document.getElementById('wx-range'),
            wxZoomIn: document.getElementById('wx-zoom-in'),
            wxZoomOut: document.getElementById('wx-zoom-out'),
            wxWind: document.getElementById('wx-wind'),
            wxTemp: document.getElementById('wx-temp'),
            wxBaro: document.getElementById('wx-baro'),
            wxVis: document.getElementById('wx-vis'),
            wxPrecip: document.getElementById('wx-precip'),
            wxPrecipItem: document.getElementById('wx-precip-item'),
            chartApt: document.getElementById('chart-apt'),
            chartSearch: document.getElementById('chart-search'),
            chartList: document.getElementById('chart-list'),
            auxDist: document.getElementById('aux-dist'),
            auxTime: document.getElementById('aux-time'),
            auxEta: document.getElementById('aux-eta'),
            auxFuel: document.getElementById('aux-fuel'),
            sysMapOrient: document.getElementById('sys-map-orient'),
            sysGpsStatus: document.getElementById('sys-gps-status'),
            com1: document.getElementById('com1'),
            com1Stby: document.getElementById('com1-stby'),
            nav1: document.getElementById('nav1'),
            nav1Stby: document.getElementById('nav1-stby'),
            nav1Ident: document.getElementById('nav1-ident'),
            nav1Radial: document.getElementById('nav1-radial'),
            nav1Dme: document.getElementById('nav1-dme'),
            swapCom1: document.getElementById('swap-com1'),
            swapCom2: document.getElementById('swap-com2'),
            swapNav1: document.getElementById('swap-nav1'),
            xpdr: document.getElementById('xpdr'),
            utcTime: document.getElementById('utc-time'),
            tabs: document.querySelectorAll('.gtn-tab')
        };
    }

    // ===== EVENT BINDING =====

    bindEvents() {
        this.elements.btnHome?.addEventListener('click', () => this.pageManager.goHome());

        const homeButtonsContainer = document.getElementById('home-buttons');
        if (homeButtonsContainer) {
            homeButtonsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.home-btn');
                if (!btn) return;
                const pageId = btn.dataset.page;
                if (pageId) {
                    homeButtonsContainer.querySelectorAll('.home-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.pageManager.switchPage(pageId);
                }
            });
        }

        this.elements.btnDirect?.addEventListener('click', () => this.flightPlanManager.showDirectTo());

        // Frequency swaps
        this.elements.swapCom1?.addEventListener('click', () => this.dataHandler.swapFrequency('COM1'));
        this.elements.swapCom2?.addEventListener('click', () => this.dataHandler.swapFrequency('COM2'));
        this.elements.swapNav1?.addEventListener('click', () => this.dataHandler.swapFrequency('NAV1'));

        // Zoom
        this.elements.zoomIn?.addEventListener('click', () => this.changeRange(-1));
        this.elements.zoomOut?.addEventListener('click', () => this.changeRange(1));

        // Nav source
        this.elements.navSourceGps?.addEventListener('click', () => { this.cdiManager.setNavSource('GPS'); this.data.navSource = 'GPS'; this.cdiManager.updateFromSource(this._getCdiState()); });
        this.elements.navSourceNav1?.addEventListener('click', () => { this.cdiManager.setNavSource('NAV1'); this.data.navSource = 'NAV1'; this.cdiManager.updateFromSource(this._getCdiState()); });
        this.elements.navSourceNav2?.addEventListener('click', () => { this.cdiManager.setNavSource('NAV2'); this.data.navSource = 'NAV2'; this.cdiManager.updateFromSource(this._getCdiState()); });

        // OBS
        this.elements.obsInc?.addEventListener('click', () => this.cdiManager.adjustObs(1));
        this.elements.obsDec?.addEventListener('click', () => this.cdiManager.adjustObs(-1));
        this.elements.obsValue?.addEventListener('click', () => {
            const currentObs = this.cdiManager.navSource === 'NAV1' ? this.cdiManager.nav1.obs : this.cdiManager.nav2.obs;
            const newObs = prompt('Enter OBS course (0-359):', Math.round(currentObs));
            if (newObs !== null && !isNaN(newObs)) this.cdiManager.setObs(parseInt(newObs) % 360);
        });

        // Tabs
        this.elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const pageId = tab.dataset.page;
                if (pageId) this.pageManager.switchPage(pageId);
            });
        });

        // WPT search
        this.elements.wptGo?.addEventListener('click', () => this.searchWaypoint());
        this.elements.wptSearch?.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.searchWaypoint(); });

        // NRST type tabs
        document.querySelectorAll('.nrst-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchNearestType(tab.dataset.type));
        });

        // PROC type tabs
        document.querySelectorAll('.proc-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchProcType(tab.dataset.type));
        });

        // Chart search
        this.elements.chartSearch?.addEventListener('click', () => this.searchCharts());
        this.elements.chartApt?.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.searchCharts(); });
        document.getElementById('chart-view')?.addEventListener('click', () => { if (this.chartsPage) this.chartsPage.viewChart(); });
        document.getElementById('chart-fox')?.addEventListener('click', () => { if (this.chartsPage) this.chartsPage.openChartFox(); });

        // Weather animation
        this.elements.wxAnimate?.addEventListener('click', () => {
            if (this.weatherOverlay) {
                const animating = this.weatherOverlay.toggleRadarAnimation();
                this.elements.wxAnimate.textContent = animating ? '⏸' : '▶';
                this.elements.wxAnimate.classList.toggle('active', animating);
            }
        });

        // Weather range
        this.weatherRanges = [10, 25, 50, 100, 200];
        this.weatherRange = 50;
        this.elements.wxZoomIn?.addEventListener('click', () => this.changeWeatherRange(-1));
        this.elements.wxZoomOut?.addEventListener('click', () => this.changeWeatherRange(1));

        // Weather layer toggles
        this.elements.wxSimRadar?.addEventListener('change', (e) => { if (this.weatherOverlay) this.weatherOverlay.setLayer('simRadar', e.target.checked); });
        this.elements.wxNexrad?.addEventListener('change', (e) => { if (this.weatherOverlay) this.weatherOverlay.setLayer('nexrad', e.target.checked); });
        document.getElementById('wx-metar')?.addEventListener('change', (e) => { if (this.weatherOverlay) this.weatherOverlay.setLayer('metar', e.target.checked); });
        document.getElementById('wx-winds')?.addEventListener('change', (e) => { if (this.weatherOverlay) this.weatherOverlay.setLayer('winds', e.target.checked); });
        document.getElementById('wx-lightning')?.addEventListener('change', (e) => { if (this.weatherOverlay) this.weatherOverlay.setLayer('lightning', e.target.checked); });

        // Terrain range/view
        this.terrainRanges = [2, 5, 10, 20, 50];
        this.elements.terrainZoomIn?.addEventListener('click', () => this.changeTerrainRange(-1));
        this.elements.terrainZoomOut?.addEventListener('click', () => this.changeTerrainRange(1));
        this.elements.terrainView360?.addEventListener('click', () => { if (this.terrainOverlay) { this.terrainOverlay.setViewMode('360'); this.updateTerrainViewButtons('360'); } });
        this.elements.terrainViewArc?.addEventListener('click', () => { if (this.terrainOverlay) { this.terrainOverlay.setViewMode('arc'); this.updateTerrainViewButtons('arc'); } });

        // System
        document.getElementById('sys-reset')?.addEventListener('click', () => { if (this.systemPage) this.systemPage.resetToDefaults(); });
        this.elements.sysMapOrient?.addEventListener('change', (e) => { this.map.orientation = e.target.value; });

        // Data field customization
        document.querySelectorAll('.corner-field').forEach(field => {
            field.addEventListener('click', (e) => { e.stopPropagation(); this.dataFieldsManager.openFieldSelector(field); });
        });
        document.querySelectorAll('.field-option').forEach(option => {
            option.addEventListener('click', (e) => { e.stopPropagation(); this.dataFieldsManager.selectFieldType(option.dataset.type); });
        });
        document.addEventListener('click', () => this.dataFieldsManager.closeFieldSelector());

        // Weather presets
        document.querySelectorAll('.wx-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => this.setWeatherPreset(btn.dataset.preset));
        });
        document.getElementById('wx-live-btn')?.addEventListener('click', () => this.setLiveWeather());
    }

    _getCdiState() {
        return {
            flightPlan: this.flightPlanManager.flightPlan,
            activeWaypointIndex: this.flightPlanManager.activeWaypointIndex,
            data: this.data
        };
    }

    // ===== SOFT KEY HANDLER =====

    handleSoftKeyAction(action, detail) {
        const cdiState = this._getCdiState();

        switch (action) {
            case 'go-back':
                if (!this.pageManager.goBack()) this.pageManager.goHome();
                break;
            case 'toggle-terrain': this.map.showTerrain = detail.active; break;
            case 'toggle-traffic': this.map.showTraffic = detail.active; break;
            case 'toggle-weather':
                this.map.showWeather = detail.active;
                if (detail.active && this.weatherOverlay) this.weatherOverlay.startAutoRefresh(this.data.latitude, this.data.longitude);
                else if (this.weatherOverlay) this.weatherOverlay.stopAutoRefresh();
                break;
            case 'declutter': this.cycleDeclutter(); break;
            case 'cdi-menu': this.softKeys?.setContext('cdi-menu'); break;
            case 'cdi-source-gps': this.cdiManager.setNavSource('GPS'); this.data.navSource = 'GPS'; this.cdiManager.updateFromSource(cdiState); this.softKeys?.setContext('map'); break;
            case 'cdi-source-nav1': this.cdiManager.setNavSource('NAV1'); this.data.navSource = 'NAV1'; this.cdiManager.updateFromSource(cdiState); this.softKeys?.setContext('map'); break;
            case 'cdi-source-nav2': this.cdiManager.setNavSource('NAV2'); this.data.navSource = 'NAV2'; this.cdiManager.updateFromSource(cdiState); this.softKeys?.setContext('map'); break;
            case 'obs-inc': this.cdiManager.adjustObs(1); break;
            case 'obs-dec': this.cdiManager.adjustObs(-1); break;
            case 'back-menu': this.softKeys?.setContext('map'); break;
            case 'map-north-up': this.map.orientation = 'north'; this.updateMapOrientation(); break;
            case 'map-track-up': this.map.orientation = 'track'; this.updateMapOrientation(); break;
            case 'map-heading-up': this.map.orientation = 'heading'; this.updateMapOrientation(); break;
            case 'activate-leg': this.flightPlanManager.activateLeg(); break;
            case 'invert-plan': this.flightPlanManager.invertFlightPlan(); break;
            case 'direct-to': this.flightPlanManager.showDirectTo(); break;
            case 'nrst-apt': case 'nrst-vor': case 'nrst-ndb': case 'nrst-fix':
                this.switchNearestType(action.split('-')[1]); break;
            case 'taws-inhibit':
                this.taws.inhibited = !this.taws.inhibited;
                if (this.terrainOverlay) this.terrainOverlay.setInhibited(this.taws.inhibited);
                this.updateTawsStatus();
                break;
            case 'terrain-view': this.cycleTerrainView(); break;
            case 'terrain-360': this.setTerrainView('360'); break;
            case 'terrain-arc': this.setTerrainView('arc'); break;
            case 'terrain-range': this.cycleTerrainRange(); break;
            case 'proc-departure': if (this.proceduresPage) this.proceduresPage.switchType('dep'); break;
            case 'proc-arrival': if (this.proceduresPage) this.proceduresPage.switchType('arr'); break;
            case 'proc-approach': if (this.proceduresPage) this.proceduresPage.switchType('apr'); break;
            case 'load-proc': if (this.proceduresPage) this.proceduresPage.loadProcedure(); break;
            case 'preview-proc': this.previewProcedure(); break;
            case 'view-proc-chart': if (this.proceduresPage) this.proceduresPage.viewChart(); break;
            case 'aux-trip': this.showAuxSubpage('trip'); break;
            case 'aux-util': this.showAuxSubpage('util'); break;
            case 'aux-timer': this.toggleAuxTimer(); break;
            case 'aux-calc': this.showAuxSubpage('calc'); break;
            case 'traffic-operate': case 'traffic-standby': case 'traffic-test':
                this.setTrafficMode(action.split('-')[1]); break;
            case 'wx-simRadar': case 'wx-nexrad': case 'wx-metar': case 'wx-taf': case 'wx-winds': case 'wx-lightning':
                this.toggleWeatherLayer(action.split('-')[1]); break;
            case 'view-chart': if (this.chartsPage) this.chartsPage.viewChart(); break;
            case 'open-chartfox': if (this.chartsPage) this.chartsPage.openChartFox(); break;
            case 'chart-apt': case 'chart-iap': case 'chart-dp': case 'chart-star':
                if (this.chartsPage) { const type = action.split('-')[1].toUpperCase(); this.chartsPage.filterByType(type === 'APT' ? 'APD' : type); }
                break;
            case 'sys-reset': if (this.systemPage) this.systemPage.resetToDefaults(); break;
            case 'sys-north-up': this.map.orientation = 'north'; if (this.systemPage) this.systemPage.setSetting('mapOrientation', 'north'); break;
            case 'sys-track-up': this.map.orientation = 'track'; if (this.systemPage) this.systemPage.setSetting('mapOrientation', 'track'); break;
            case 'sys-night-mode':
                if (this.systemPage) { const current = this.systemPage.getSetting('nightMode'); this.systemPage.setSetting('nightMode', !current); }
                break;
            case 'obs-toggle': this.cdiManager.toggleObs(cdiState); break;
            case 'obs-crs-up': this.cdiManager.adjustObsCourse(1, cdiState); break;
            case 'obs-crs-down': this.cdiManager.adjustObsCourse(-1, cdiState); break;
            case 'obs-crs-up-10': this.cdiManager.adjustObsCourse(10, cdiState); break;
            case 'obs-crs-down-10': this.cdiManager.adjustObsCourse(-10, cdiState); break;
            case 'hold-toggle': this.cdiManager.toggleHoldingPattern(cdiState); break;
            case 'hold-direction': this.cdiManager.toggleHoldingDirection(this.data); break;
            case 'hold-time':
                const newTime = prompt('Enter holding leg time (30-240 seconds):', this.cdiManager.obs.legTime);
                if (newTime) this.cdiManager.setHoldingLegTime(parseInt(newTime));
                break;
            default: console.log(`[GTN750] Unhandled soft key action: ${action}`);
        }
    }

    // ===== RANGE / DECLUTTER HELPERS =====

    changeRange(delta) {
        const idx = this.map.ranges.indexOf(this.map.range);
        const newIdx = Math.max(0, Math.min(this.map.ranges.length - 1, idx + delta));
        this.map.range = this.map.ranges[newIdx];
        if (this.elements.dfRange) this.elements.dfRange.textContent = this.map.range;
    }

    changeWeatherRange(delta) {
        const ranges = this.weatherRanges || [10, 25, 50, 100, 200];
        const idx = ranges.indexOf(this.weatherRange);
        const newIdx = Math.max(0, Math.min(ranges.length - 1, idx + delta));
        this.weatherRange = ranges[newIdx];
        if (this.elements.wxRange) this.elements.wxRange.textContent = this.weatherRange;
    }

    changeTerrainRange(delta) {
        if (!this.terrainOverlay) return;
        const ranges = this.terrainRanges || [2, 5, 10, 20, 50];
        const currentRange = this.terrainOverlay.getRange();
        const idx = ranges.indexOf(currentRange);
        const newIdx = Math.max(0, Math.min(ranges.length - 1, idx + delta));
        const newRange = ranges[newIdx];
        this.terrainOverlay.setRange(newRange);
        if (this.elements.terrainRangeValue) this.elements.terrainRangeValue.textContent = newRange;
        if (this.elements.terrainRange) this.elements.terrainRange.textContent = newRange;
    }

    updateTerrainViewButtons(mode) {
        if (this.elements.terrainView360) this.elements.terrainView360.classList.toggle('active', mode === '360');
        if (this.elements.terrainViewArc) this.elements.terrainViewArc.classList.toggle('active', mode === 'arc');
        if (this.elements.terrainMode) this.elements.terrainMode.textContent = mode.toUpperCase();
    }

    updateMapOrientation() {
        if (this.elements.sysMapOrient) this.elements.sysMapOrient.value = this.map.orientation;
    }

    cycleDeclutter() {
        this.declutterLevel = ((this.declutterLevel || 0) + 1) % 4;
        document.querySelectorAll('.corner-field').forEach(el => {
            el.style.opacity = this.declutterLevel < 3 ? '1' : '0.3';
        });
    }

    // ===== MISC PAGE HELPERS =====

    async searchWaypoint() {
        const ident = this.elements.wptSearch?.value.toUpperCase().trim();
        if (!ident || ident.length < 2) return;
        try {
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/waypoint/${ident}`);
            if (response.ok) {
                const wpt = await response.json();
                this.displayWaypointInfo(wpt);
            } else {
                this.displayWaypointInfo(null, ident);
            }
        } catch (e) { this.displayWaypointInfo(null, ident); }
    }

    displayWaypointInfo(wpt, searchedIdent) {
        if (!this.elements.wptInfo) return;
        this.elements.wptInfo.textContent = '';
        if (!wpt) {
            const empty = document.createElement('div');
            empty.className = 'wpt-info-empty';
            empty.textContent = searchedIdent ? `${searchedIdent} not found` : 'Enter waypoint identifier';
            this.elements.wptInfo.appendChild(empty);
            return;
        }
        const ident = document.createElement('div');
        ident.className = 'wpt-info-ident';
        ident.textContent = wpt.ident;
        this.elements.wptInfo.appendChild(ident);
        const type = document.createElement('div');
        type.className = 'wpt-info-type';
        type.textContent = wpt.type || 'WAYPOINT';
        this.elements.wptInfo.appendChild(type);
        if (wpt.lat && wpt.lng) {
            const coords = document.createElement('div');
            coords.className = 'wpt-info-coords';
            coords.textContent = `${this.core.formatLat(wpt.lat)} ${this.core.formatLon(wpt.lng)}`;
            this.elements.wptInfo.appendChild(coords);
        }
    }

    switchNearestType(type) {
        if (this.nearestPage) {
            this.nearestPage.setPosition(this.data.latitude, this.data.longitude);
            this.nearestPage.switchType(type);
        }
    }

    switchProcType(type) {
        document.querySelectorAll('.proc-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });
    }

    async searchCharts() {
        const icao = this.elements.chartApt?.value.toUpperCase().trim();
        if (!icao || icao.length < 3) return;
        if (this.chartsPage) this.chartsPage.searchCharts(icao);
    }

    previewProcedure() {
        if (this.procedurePreview?.waypoints) {
            this.showProcedurePreview = !this.showProcedurePreview;
        }
    }

    showAuxSubpage(subpage) { this.auxSubpage = subpage; }

    toggleAuxTimer() {
        if (this.auxPage) this.auxPage.toggleTimer();
    }

    setTrafficMode(mode) {
        if (this.trafficOverlay) this.trafficOverlay.setMode(mode);
        if (this.elements.trafficMode) this.elements.trafficMode.textContent = mode.toUpperCase();
    }

    toggleWeatherLayer(layer) {
        if (this.weatherOverlay) {
            const enabled = this.weatherOverlay.toggleLayer(layer);
            const checkbox = document.getElementById(`wx-${layer}`);
            if (checkbox) checkbox.checked = enabled;
        }
    }

    cycleTerrainView() { if (this.terrainOverlay) this.terrainOverlay.toggleViewMode(); }
    setTerrainView(view) { if (this.terrainOverlay) this.terrainOverlay.setViewMode(view); }

    cycleTerrainRange() {
        if (this.terrainOverlay) {
            const ranges = [2, 5, 10, 20, 50];
            const current = this.terrainOverlay.getRange();
            const idx = ranges.indexOf(current);
            this.terrainOverlay.setRange(ranges[(idx + 1) % ranges.length]);
        }
    }

    fetchNearestAirports() {
        if (this.nearestPage) {
            this.nearestPage.setPosition(this.data.latitude, this.data.longitude);
        }
    }

    destroy() {
        this.mapRenderer.stop();
        this.dataHandler.destroy();
        this.flightPlanManager.destroy();
        this.terrainPageRenderActive = false;
        this.trafficPageRenderActive = false;
        this.weatherPageRenderActive = false;
        if (this.syncChannel) this.syncChannel.close();

        // Call parent destroy
        super.destroy();
    }
}

// Initialize and expose globally
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.gtn750 = new GTN750Glass();
        handleUrlHash();
        window.addEventListener('beforeunload', () => window.gtn750?.destroy());
    });
} else {
    window.gtn750 = new GTN750Glass();
    handleUrlHash();
    window.addEventListener('beforeunload', () => window.gtn750?.destroy());
}

function handleUrlHash() {
    const hash = window.location.hash.slice(1);
    if (hash && window.gtn750?.pageManager) {
        const validPages = ['map', 'fpl', 'wpt', 'nrst', 'proc', 'terrain', 'traffic', 'wx', 'charts', 'aux', 'system'];
        if (validPages.includes(hash)) {
            setTimeout(() => window.gtn750.pageManager.switchPage(hash), 100);
        }
    }
}
