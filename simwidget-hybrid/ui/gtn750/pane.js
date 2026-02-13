/**
 * GTN750 GPS Glass v2.3.0 - Full Garmin Feature Set with Code Splitting
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
 *
 * Code Splitting Strategy:
 *   - Critical: core, map-renderer, cdi, data-fields (load immediately)
 *   - Deferred 500ms: data-handler, simvar-handler, overlays
 *   - Lazy (on-demand): flight-plan (FPL page), page modules (PROC, CHARTS, etc.)
 *
 * @typedef {import('./types.js').SimData} SimData
 * @typedef {import('./types.js').FlightPlan} FlightPlan
 * @typedef {import('./types.js').CDIState} CDIState
 * @typedef {import('./types.js').MapState} MapState
 */

class GTN750Pane extends SimGlassBase {
    constructor() {
        super({
            widgetName: 'gtn750',
            widgetVersion: '2.3.0',
            autoConnect: false  // Uses GTNDataHandler for WebSocket management
        });

        this.serverPort = 8080;

        // Module loader for code splitting
        this.moduleLoader = new ModuleLoader({
            basePath: '',
            telemetry: this.telemetry
        });

        // Track lazy-loaded modules
        this.loadedModules = {
            flightPlan: false,
            dataHandler: false,
            overlays: false,
            pageFpl: false,
            pageProc: false,
            pageCharts: false,
            pageNrst: false,
            pageAux: false,
            pageSystem: false
        };

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

        // VNAV
        this.vnavManager = null;

        // Pan offset for map
        this.panOffset = { x: 0, y: 0 };

        // Declutter
        this.declutterLevel = 0;

        // Shared range constants
        this.TERRAIN_RANGES = [2, 5, 10, 20, 50];
        this.WEATHER_RANGES = [10, 25, 50, 100, 200];

        // RAF IDs for page render loops
        this._terrainRafId = null;
        this._trafficRafId = null;
        this._weatherRafId = null;

        // Handler refs for cleanup
        this._resizeHandler = () => this.resizeCanvas();
        this._beforeUnloadHandler = () => this.destroy();

        // Page instances (lazy-created on first visit)
        this.fplPage = null;
        this.proceduresPage = null;
        this.auxPage = null;
        this.chartsPage = null;
        this.nearestPage = null;
        this.systemPage = null;

        // Soft key retry counter
        this._softKeyRetries = 0;

        // Compact mode
        this.compactMode = localStorage.getItem('gtn750-compact') === 'true';
        this._compactRafId = null;
        this.gcCompactPage = 'map';

        // cross-pane sync
        this.syncChannel = new SafeChannel('SimGlass-sync');

        // Create critical module instances (loaded immediately)
        this.dataFieldsManager = new GTNDataFields({ core: this.core });
        this.cdiManager = new GTNCdi({ core: this.core, elements: {}, serverPort: this.serverPort });
        this.vnavManager = new GTNVNav({ core: this.core });
        this.mapRenderer = new GTNMapRenderer({
            core: this.core,
            getState: () => this.getRendererState()
        });

        // XPDR control panel
        this.xpdrControl = new GTNXpdrControl({ serverPort: this.serverPort });

        // Deferred modules (loaded after 500ms)
        this.flightPlanManager = null;
        this.dataHandler = null;

        this.initSyncListener();
        this.init();
    }

    init() {
        this.cacheElements();
        this.wireModuleElements();
        this.setupCanvas();
        this.initSoftKeys();
        this.initPageManager();
        this.bindEvents();
        this.bindTawsAlerts();
        this.dataFieldsManager.loadConfig();
        this.mapRenderer.start();
        this.setupCompactToggle();

        // Defer non-critical modules (500ms after initial render)
        this.deferredInit();
    }

    /**
     * Deferred initialization - Load non-critical modules after 500ms
     */
    async deferredInit() {
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            // Load data handler and simvar handler modules
            await this.loadDataHandler();

            // Load overlays
            await this.loadOverlays();

            GTNCore.log('[GTN750] Deferred modules loaded');

            // Start broadcasting nav-state to other panes
            this._startNavBroadcast();

            // Check server for a stored SimBrief plan (cross-machine or late join)
            this._fetchStoredPlan();
        } catch (error) {
            console.error('[GTN750] Failed to load deferred modules:', error);
            if (this.telemetry) {
                this.telemetry.captureError(error, { context: 'GTN750.deferredInit' });
            }
        }
    }

    /**
     * Lazy load data handler module
     */
    async loadDataHandler() {
        if (this.loadedModules.dataHandler) return;

        await this.moduleLoader.loadMultiple([
            'modules/gtn-data-handler.js',
            'modules/gtn-simvar-handler.js'
        ]);

        // Auto-detect: use SimVar API inside MSFS, WebSocket in browser
        const HandlerClass = (typeof SimVar !== 'undefined') ? GTNSimVarHandler : GTNDataHandler;
        this.dataHandler = new HandlerClass({
            core: this.core,
            serverPort: this.serverPort,
            elements: this.elements,
            onDataUpdate: (d) => this.handleSimData(d)
        });

        this.dataHandler.connect();
        this.dataHandler.startClock();

        this.loadedModules.dataHandler = true;
    }

    /**
     * Lazy load flight plan module
     */
    async loadFlightPlan() {
        if (this.loadedModules.flightPlan || this.flightPlanManager) return;

        await this.moduleLoader.load('modules/gtn-flight-plan.js');

        this.flightPlanManager = new GTNFlightPlan({
            core: this.core,
            elements: this.elements,
            serverPort: this.serverPort,
            syncChannel: this.syncChannel,
            onWaypointChanged: () => this.flightPlanManager?.updateWaypointDisplay(this.data, this.cdiManager),
            onDirectToActivated: () => {
                if (this.pageManager) this.pageManager.switchPage('map');
            },
            onInsertComplete: () => {
                if (this.pageManager) this.pageManager.switchPage('fpl');
            },
            onFlightPlanChanged: (plan) => {
                this.fplPage?.update(plan);
            }
        });

        this.loadedModules.flightPlan = true;
    }

    /**
     * Lazy load overlays
     */
    async loadOverlays() {
        if (this.loadedModules.overlays) return;

        await this.moduleLoader.loadMultiple([
            'overlays/terrain-overlay.js',
            'overlays/traffic-overlay.js',
            'overlays/weather-overlay.js',
            'overlays/map-controls.js'
        ]);

        this.initOverlays();
        this.loadedModules.overlays = true;

        // Start traffic polling if data handler loaded
        if (this.dataHandler) {
            this.dataHandler.startTrafficPolling(
                () => this.map.showTraffic || this.pageManager?.getCurrentPageId() === 'traffic',
                this.trafficOverlay
            );
        }
    }

    /**
     * Lazy load page module (PROC, CHARTS, NRST, AUX, SYSTEM)
     */
    async loadPageModule(pageId) {
        const moduleKey = `page${pageId.charAt(0).toUpperCase() + pageId.slice(1)}`;
        if (this.loadedModules[moduleKey]) return;

        const moduleMap = {
            fpl: 'pages/page-fpl.js',
            proc: 'pages/page-proc.js',
            charts: 'pages/page-charts.js',
            nrst: 'pages/page-nrst.js',
            aux: 'pages/page-aux.js',
            system: 'pages/page-system.js'
        };

        const modulePath = moduleMap[pageId];
        if (!modulePath) return;

        await this.moduleLoader.load(modulePath);
        this.loadedModules[moduleKey] = true;
        GTNCore.log(`[GTN750] Loaded page module: ${pageId}`);
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
            cdiMode: this.elements.cdiMode,
            cdiToFrom: this.elements.cdiToFrom,
            cdiVnav: this.elements.cdiVnav,
            cdiApproachType: this.elements.cdiApproachType,
            cdiGsNeedle: this.elements.cdiGsNeedle,
            cdiGsBar: this.elements.cdiGsBar,
            cdiFlag: this.elements.cdiFlag,
            obsValue: this.elements.obsValue,
            obsControls: this.elements.obsControls,
            navSourceGps: this.elements.navSourceGps,
            navSourceNav1: this.elements.navSourceNav1,
            navSourceNav2: this.elements.navSourceNav2,
            obsIndicator: this.elements.obsIndicator,
            obsCourse: this.elements.obsCourse
        };

        // Flight plan elements (lazy-loaded)
        if (this.flightPlanManager) {
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
                wptDtk: this.elements.wptDtk,
                wptType: this.elements.wptType
            };
        }

        // Data handler elements (lazy-loaded)
        if (this.dataHandler) {
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
                xpdrIdent: this.elements.xpdrIdent,
                xpdrMode: this.elements.xpdrMode,
                xpdrModeIndicator: this.elements.xpdrModeIndicator,
                utcTime: this.elements.utcTime
            };
        }
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
            flightPlan: this.flightPlanManager?.flightPlan || null,
            activeWaypointIndex: this.flightPlanManager?.activeWaypointIndex || 0,
            activeWaypoint: this.flightPlanManager?.activeWaypoint || null,
            obs: this.cdiManager.obs,
            nav1: this.cdiManager.nav1,
            nav2: this.cdiManager.nav2,
            gps: this.cdiManager.gps,
            vnavManager: this.vnavManager,
            onUpdateDatafields: () => {
                this.dataFieldsManager.update(this.data, {
                    flightPlan: this.flightPlanManager?.flightPlan || null,
                    activeWaypointIndex: this.flightPlanManager?.activeWaypointIndex || 0,
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
        if (d.transponderState !== undefined) this.data.transponderState = d.transponderState;
        if (d.transponderIdent !== undefined) this.data.transponderIdent = d.transponderIdent;
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
        if (d.zuluTime) this.dataHandler?.setHasSimTime(true);

        // Update UI through modules
        this.dataHandler?.updateUI(this.data, this.cdiManager.nav1);
        this.xpdrControl?.update(this.data);
        this.flightPlanManager?.setPosition(this.data.latitude, this.data.longitude);
        this.flightPlanManager?.setGroundSpeed(this.data.groundSpeed);
        this.flightPlanManager?.updateWaypointDisplay(this.data, this.cdiManager);

        // Calculate GPS navigation from flight plan
        const gpsNav = this.flightPlanManager?.calculateGpsNavigation(this.data.latitude, this.data.longitude);

        // Calculate VNAV (vertical navigation) from altitude constraints
        const vnav = gpsNav ? this.flightPlanManager?.calculateVNav(this.data.altitude, gpsNav.distance) : null;

        this.cdiManager.updateFromSource({
            flightPlan: this.flightPlanManager?.flightPlan || null,
            activeWaypointIndex: this.flightPlanManager?.activeWaypointIndex || 0,
            data: this.data,
            gpsNav: gpsNav,  // Pass calculated GPS navigation to CDI
            vnav: vnav       // Pass vertical navigation data
        });
        this.flightPlanManager?.checkWaypointSequencing(this.data, this.cdiManager.obs.suspended);
        this.updateAuxData();
    }

    updateAuxData() {
        if (!this.flightPlanManager?.flightPlan?.waypoints) return;

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

    /**
     * Show visual notification when waypoint sequencing occurs
     * @param {string} passedIdent - Waypoint that was passed
     * @param {string} activeIdent - New active waypoint
     */
    showSequenceNotification(passedIdent, activeIdent) {
        const notify = document.getElementById('cdi-sequence-notify');
        if (!notify) return;

        notify.textContent = `${passedIdent} → ${activeIdent}`;
        notify.style.display = '';

        // Clear any existing timeout
        if (this._sequenceNotifyTimer) {
            clearTimeout(this._sequenceNotifyTimer);
        }

        // Hide after animation completes (2s)
        this._sequenceNotifyTimer = setTimeout(() => {
            notify.style.display = 'none';
            this._sequenceNotifyTimer = null;
        }, 2000);
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
                    try {
                        const saved = JSON.parse(localStorage.getItem('gtn750-map-datafields') || '{}');
                        saved[position] = type.type;
                        localStorage.setItem('gtn750-map-datafields', JSON.stringify(saved));
                    } catch (e) { /* ignore */ }
                }
            });
            this.mapControls.setRange(this.map.range);

            // Restore saved data field selections
            try {
                const saved = JSON.parse(localStorage.getItem('gtn750-map-datafields') || '{}');
                Object.entries(saved).forEach(([pos, type]) => this.mapControls.setDataField(pos, type));
            } catch (e) { /* ignore */ }
        }
    }

    /**
     * Lazy-create page instance on first visit (after script is loaded by loadPageModule)
     */
    _ensurePageInstance(pageId) {
        switch (pageId) {
            case 'fpl':
                if (!this.fplPage && typeof FlightPlanPage !== 'undefined') {
                    this.fplPage = new FlightPlanPage({
                        core: this.core,
                        serverPort: this.serverPort,
                        flightPlanManager: this.flightPlanManager,
                        softKeys: this.softKeys
                    });
                }
                break;
            case 'proc':
                if (!this.proceduresPage && typeof ProceduresPage !== 'undefined') {
                    this.proceduresPage = new ProceduresPage({
                        core: this.core, serverPort: this.serverPort,
                        onProcedureSelect: (proc, type, waypoints) => this.handleProcedureSelect(proc, type, waypoints),
                        onProcedureLoad: (proc, type, waypoints) => this.handleProcedureLoad(proc, type, waypoints)
                    });
                }
                break;
            case 'aux':
                if (!this.auxPage && typeof AuxPage !== 'undefined') {
                    this.auxPage = new AuxPage({ core: this.core });
                }
                break;
            case 'charts':
                if (!this.chartsPage && typeof ChartsPage !== 'undefined') {
                    this.chartsPage = new ChartsPage({
                        core: this.core, serverPort: this.serverPort,
                        onChartSelect: (chart) => GTNCore.log(`[GTN750] Chart selected: ${chart.name}`)
                    });
                }
                break;
            case 'nrst':
                if (!this.nearestPage && typeof NearestPage !== 'undefined') {
                    this.nearestPage = new NearestPage({
                        core: this.core, serverPort: this.serverPort,
                        onItemSelect: (item, type) => {},
                        onDirectTo: (item) => this.flightPlanManager?.directTo(item)
                    });
                    this.flightPlanManager?.setNearestPage(this.nearestPage);
                }
                break;
            case 'system':
                if (!this.systemPage && typeof SystemPage !== 'undefined') {
                    this.systemPage = new SystemPage({
                        core: this.core,
                        onSettingChange: (key, value) => this.handleSettingChange(key, value)
                    });
                }
                break;
        }
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
        GTNCore.log(`[GTN750] Procedure selected: ${proc.name}`);
    }

    handleProcedureLoad(proc, type, waypoints) {
        GTNCore.log(`[GTN750] Loading procedure: ${proc.name} (${type})`);

        // Load procedure into flight plan
        if (this.flightPlanModule) {
            this.flightPlanModule.loadProcedure(type, proc, waypoints);

            // Switch to FPL page to show loaded procedure
            if (this.pageManager) {
                this.pageManager.setActivePage('fpl');
            }
        } else {
            GTNCore.log('[GTN750] Flight plan module not available');
        }

        // Notify other instances via sync channel
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
            if (++this._softKeyRetries > 50) {
                console.warn('[GTN750] GTNSoftKeys not available after 5s, giving up');
                return;
            }
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
        const title = this.elements.pageTitle;
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

    async onPageActivate(pageId) {
        // Lazy load flight plan module when FPL page accessed
        if (pageId === 'fpl' && !this.flightPlanManager) {
            await this.loadFlightPlan();
            // Start server poll if no SimBrief plan is active
            if (this.flightPlanManager && this.flightPlanManager.flightPlan?.source !== 'simbrief') {
                this.flightPlanManager.fetchFlightPlan();
            }
        }

        // Lazy load page-specific modules
        if (['fpl', 'proc', 'charts', 'nrst', 'aux', 'system'].includes(pageId)) {
            await this.loadPageModule(pageId);
        }

        // Lazy-create page instance after script is loaded
        this._ensurePageInstance(pageId);

        // Page-specific initialization
        if (pageId === 'fpl') {
            if (this.fplPage) {
                this.fplPage.init();
                this.fplPage.update(this.flightPlanManager?.flightPlan || null);
            }
        }
        if (pageId === 'proc') {
            if (this.proceduresPage) {
                this.proceduresPage.init();
                if (this.flightPlanManager?.flightPlan?.waypoints?.length > 0) {
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
                if (this.flightPlanManager?.flightPlan?.waypoints?.length > 0) {
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
        if (pageId === 'terrain') {
            this.terrainPageRenderActive = false;
            if (this._terrainRafId) { cancelAnimationFrame(this._terrainRafId); this._terrainRafId = null; }
        }
        if (pageId === 'traffic') {
            this.trafficPageRenderActive = false;
            if (this._trafficRafId) { cancelAnimationFrame(this._trafficRafId); this._trafficRafId = null; }
        }
        if (pageId === 'wx') {
            this.weatherPageRenderActive = false;
            if (this._weatherRafId) { cancelAnimationFrame(this._weatherRafId); this._weatherRafId = null; }
        }
    }

    updateAuxPageData() {
        if (!this.auxPage) return;
        const tripData = this.auxPage.updateTripData(
            { waypoints: this.flightPlanManager?.flightPlan?.waypoints, activeWaypointIndex: this.flightPlanManager?.activeWaypointIndex || 0 },
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
            window.addEventListener('resize', this._resizeHandler);
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
            this.weatherOverlay.fetchTaf(this.data.latitude, this.data.longitude, this.weatherRange || 50);
        }
    }

    resizeCanvas() {
        const resizeOne = (canvas) => {
            if (!canvas || !canvas.parentElement) return;
            const rect = canvas.parentElement.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
        };
        resizeOne(this.canvas);
        resizeOne(this.elements.terrainCanvas);
        resizeOne(this.elements.trafficCanvas);
        resizeOne(this.elements.wxCanvas);
    }

    // ===== PAGE RENDERING (terrain, traffic, weather) =====

    startTerrainPageRender() {
        if (this._terrainRafId) cancelAnimationFrame(this._terrainRafId);
        this.terrainPageRenderActive = true;
        const renderLoop = () => {
            if (!this.terrainPageRenderActive) { this._terrainRafId = null; return; }
            this.renderTerrainPage();
            this._terrainRafId = requestAnimationFrame(renderLoop);
        };
        this._terrainRafId = requestAnimationFrame(renderLoop);
    }

    startTrafficPageRender() {
        if (this._trafficRafId) cancelAnimationFrame(this._trafficRafId);
        this.trafficPageRenderActive = true;
        if (this.trafficOverlay) this.trafficOverlay.setEnabled(true);
        const renderLoop = () => {
            if (!this.trafficPageRenderActive) { this._trafficRafId = null; return; }
            this.renderTrafficPage();
            this._trafficRafId = requestAnimationFrame(renderLoop);
        };
        this._trafficRafId = requestAnimationFrame(renderLoop);
    }

    startWeatherPageRender() {
        if (this._weatherRafId) cancelAnimationFrame(this._weatherRafId);
        this.weatherPageRenderActive = true;
        if (this.weatherOverlay) {
            this.weatherOverlay.setEnabled(true);
            this.weatherOverlay.setLayer('nexrad', true);
            this.weatherOverlay.setLayer('metar', true);
            this.weatherOverlay.setLayer('taf', true);
            if (this.elements.wxTaf) this.elements.wxTaf.checked = true;
        }
        const renderLoop = () => {
            if (!this.weatherPageRenderActive) { this._weatherRafId = null; return; }
            this.renderWeatherPage();
            this._weatherRafId = requestAnimationFrame(renderLoop);
        };
        this._weatherRafId = requestAnimationFrame(renderLoop);
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

        this.updateWxInfoPanel();
    }

    // ===== WEATHER DISPLAY =====

    /**
     * Unified weather info panel update — flight rules, decoded METAR grid,
     * computed aviation data, raw METAR, condition icon, and station detail on tap.
     * Falls back to sim weather when no METAR data available.
     */
    updateWxInfoPanel() {
        // Find nearest METAR station
        let nearest = null, nearestDist = Infinity;
        const metarData = this.weatherOverlay?.metarData;
        if (metarData && metarData.size > 0) {
            metarData.forEach(m => {
                const dist = this.core.calculateDistance(this.data.latitude, this.data.longitude, m.lat, m.lon);
                if (dist < nearestDist) { nearestDist = dist; nearest = m; }
            });
        }

        const hasMetar = !!nearest;

        // --- Flight Rules Badge ---
        if (this.elements.wxFltRules) {
            const cat = hasMetar ? (nearest.category || 'VFR') : this._simFlightRules();
            this.elements.wxFltRules.textContent = cat;
            this.elements.wxFltRules.className = 'wx-flt-rules wx-flt-' + cat.toLowerCase();
        }
        if (this.elements.wxNearestId) {
            this.elements.wxNearestId.textContent = hasMetar ? nearest.icao : '----';
        }

        // --- Condition Icon (prefer METAR category over sim precip) ---
        this._updateConditionFromMetar(nearest);

        // --- Decoded METAR Grid ---
        if (hasMetar) {
            // Wind
            if (this.elements.wxDWind) {
                const dir = nearest.wdir != null ? String(nearest.wdir).padStart(3, '0') : 'VRB';
                const spd = nearest.wspd != null ? nearest.wspd : '--';
                let windStr = `${dir}°/${spd}kt`;
                if (nearest.gust) windStr += `G${nearest.gust}`;
                this.elements.wxDWind.textContent = windStr;
            }
            // Visibility
            if (this.elements.wxDVis) {
                const v = nearest.visib;
                this.elements.wxDVis.textContent = v != null ? (v >= 10 ? '10+SM' : `${v}SM`) : '--SM';
            }
            // Ceiling — lowest BKN/OVC
            if (this.elements.wxDCeil) {
                const clouds = nearest.clouds || [];
                const ceil = clouds.find(c => c.cover === 'BKN' || c.cover === 'OVC');
                if (ceil) {
                    const alt = String(Math.round((ceil.base || 0) / 100)).padStart(3, '0');
                    this.elements.wxDCeil.textContent = `${ceil.cover}${alt}`;
                } else if (clouds.length > 0 && clouds[0].cover === 'CLR') {
                    this.elements.wxDCeil.textContent = 'CLR';
                } else if (clouds.length > 0) {
                    const top = clouds[clouds.length - 1];
                    const alt = String(Math.round((top.base || 0) / 100)).padStart(3, '0');
                    this.elements.wxDCeil.textContent = `${top.cover}${alt}`;
                } else {
                    this.elements.wxDCeil.textContent = 'CLR';
                }
            }
            // Temp/Dewpoint
            if (this.elements.wxDTemp) {
                const t = nearest.temp != null ? nearest.temp : '--';
                const d = nearest.dewp != null ? nearest.dewp : '--';
                this.elements.wxDTemp.textContent = `${t}°/${d}°C`;
                const spread = (nearest.temp != null && nearest.dewp != null) ? Math.abs(nearest.temp - nearest.dewp) : 99;
                this.elements.wxDTemp.classList.toggle('wx-fog-risk', spread <= 3);
            }
            // Altimeter
            if (this.elements.wxDAltim) {
                const alt = nearest.altimeter;
                this.elements.wxDAltim.textContent = alt != null ? `${Number(alt).toFixed(2)}"` : '--.--"';
            }
        } else {
            // Fallback to sim weather data
            const dir = Math.round(this.data.windDirection || 0);
            const spd = Math.round(this.data.windSpeed || 0);
            if (this.elements.wxDWind) this.elements.wxDWind.textContent = `${String(dir).padStart(3, '0')}°/${spd}kt`;
            if (this.elements.wxDVis) {
                const visSM = (this.data.visibility || 10000) / 1609.34;
                this.elements.wxDVis.textContent = visSM >= 10 ? '10+SM' : `${visSM.toFixed(1)}SM`;
            }
            if (this.elements.wxDCeil) this.elements.wxDCeil.textContent = '---';
            if (this.elements.wxDTemp) {
                this.elements.wxDTemp.textContent = `${Math.round(this.data.ambientTemp || 15)}°C`;
                this.elements.wxDTemp.classList.remove('wx-fog-risk');
            }
            if (this.elements.wxDAltim) this.elements.wxDAltim.textContent = `${(this.data.ambientPressure || 29.92).toFixed(2)}"`;
        }

        // --- Computed Aviation Data ---
        const oat = hasMetar && nearest.temp != null ? nearest.temp : (this.data.ambientTemp || 15);
        const alt = this.data.altitude || 0;
        const baro = hasMetar && nearest.altimeter != null ? nearest.altimeter : (this.data.ambientPressure || 29.92);

        // Freezing level: surface temp + lapse rate 2°C/1000ft
        if (this.elements.wxFrzLvl) {
            if (oat <= 0) {
                this.elements.wxFrzLvl.textContent = 'SFC';
            } else {
                const frzLvl = Math.round(alt + (oat / 2) * 1000);
                this.elements.wxFrzLvl.textContent = frzLvl.toLocaleString();
            }
        }

        // Density altitude: pressureAlt + 120 * (OAT - stdTemp)
        if (this.elements.wxDnsAlt) {
            const pressureAlt = alt + (29.92 - baro) * 1000;
            const stdTemp = 15 - (pressureAlt / 1000 * 2);
            const dnsAlt = Math.round(pressureAlt + 120 * (oat - stdTemp));
            this.elements.wxDnsAlt.textContent = dnsAlt.toLocaleString();
        }

        // Icing risk
        if (this.elements.wxIcing) {
            const hasMoisture = hasMetar
                ? ((nearest.weather && nearest.weather.length > 0) || (nearest.clouds && nearest.clouds.some(c => c.cover === 'BKN' || c.cover === 'OVC')))
                : ((this.data.precipState || 0) > 0 || (this.data.visibility || 10000) < 5000);
            let icing = 'NONE', cls = 'wx-icing-none';
            if (oat <= 2 && oat > -5 && hasMoisture) { icing = 'LIGHT'; cls = 'wx-icing-light'; }
            else if (oat <= -5 && hasMoisture) { icing = 'MOD'; cls = 'wx-icing-moderate'; }
            this.elements.wxIcing.textContent = icing;
            this.elements.wxIcing.className = cls;
        }

        // --- Raw METAR text ---
        if (this.elements.wxMetarText) {
            if (hasMetar) {
                let text = nearest.raw || `${nearest.icao}: ${nearest.category}`;
                if (this.weatherOverlay.layers.taf) {
                    const tafSummary = this.weatherOverlay.getNearestTafSummary(this.data.latitude, this.data.longitude);
                    if (tafSummary) text += ' | TAF: ' + tafSummary;
                }
                this.elements.wxMetarText.textContent = text;
            } else {
                this.elements.wxMetarText.textContent = 'No METAR data';
            }
        }

        // --- Station Detail (from canvas tap) ---
        this._updateStationDetail();

        // Push sim weather to overlay for rendering
        if (this.weatherOverlay) {
            this.weatherOverlay.updateSimWeather({
                precipState: this.data.precipState, visibility: this.data.visibility,
                windDirection: this.data.windDirection, windSpeed: this.data.windSpeed,
                ambientTemp: this.data.ambientTemp
            });
        }
    }

    /**
     * Derive flight rules from sim data when no METAR available
     */
    _simFlightRules() {
        const visSM = (this.data.visibility || 10000) / 1609.34;
        // No ceiling from sim, use visibility only
        if (visSM < 1) return 'LIFR';
        if (visSM < 3) return 'IFR';
        if (visSM < 5) return 'MVFR';
        return 'VFR';
    }

    /**
     * Update condition icon/text from METAR category (preferred) or sim precip (fallback)
     */
    _updateConditionFromMetar(nearest) {
        const iconEl = this.elements.wxConditionIcon;
        const textEl = this.elements.wxConditionText;
        if (!iconEl || !textEl) return;

        if (nearest) {
            const cat = nearest.category || 'VFR';
            const catMap = { VFR: ['☀️', 'Clear'], MVFR: ['🌤️', 'Marginal'], IFR: ['🌧️', 'IFR'], LIFR: ['⛈️', 'Low IFR'] };
            // Refine with weather phenomena if available
            const wx = nearest.weather || [];
            if (wx.some(w => w.includes('TS') || w.includes('GR'))) { iconEl.textContent = '⛈️'; textEl.textContent = 'Storm'; }
            else if (wx.some(w => w.includes('SN'))) { iconEl.textContent = '🌨️'; textEl.textContent = 'Snow'; }
            else if (wx.some(w => w.includes('RA') || w.includes('DZ'))) { iconEl.textContent = '🌧️'; textEl.textContent = 'Rain'; }
            else if (wx.some(w => w.includes('FG'))) { iconEl.textContent = '🌫️'; textEl.textContent = 'Fog'; }
            else if (wx.some(w => w.includes('BR') || w.includes('HZ'))) { iconEl.textContent = '🌁'; textEl.textContent = 'Haze'; }
            else { const [icon, text] = catMap[cat] || catMap.VFR; iconEl.textContent = icon; textEl.textContent = text; }
        } else {
            // Sim precip fallback
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
    }

    /**
     * Show station detail div when a METAR station is tapped on the canvas
     */
    _updateStationDetail() {
        const el = this.elements.wxStationDetail;
        if (!el || !this.weatherOverlay) return;

        const popup = this.weatherOverlay._metarPopup;
        if (!popup || !popup.station) {
            el.style.display = 'none';
            return;
        }

        const s = popup.station;
        el.style.display = '';

        // Flight rules badge class for inline use
        const rulesCls = 'wx-flt-' + (s.category || 'vfr').toLowerCase();

        let html = `<span class="wx-sd-icao">${s.icao}</span>`;
        html += `<span class="wx-sd-rules ${rulesCls}" style="display:inline-block;padding:1px 4px;border-radius:2px;font-size:9px;font-weight:700;margin-left:4px;">${s.category || 'VFR'}</span>`;

        // Sky condition
        const clouds = s.clouds || [];
        if (clouds.length > 0) {
            const skyStr = clouds.map(c => {
                const base = c.base ? Math.round(c.base) : '';
                return `${c.cover}${base ? ' ' + base + 'ft' : ''}`;
            }).join(', ');
            html += `<div class="wx-sd-row">Sky: <b>${skyStr}</b></div>`;
        }

        // Weather phenomena
        const wx = s.weather || [];
        if (wx.length > 0) {
            html += `<div class="wx-sd-row">Wx: <b>${wx.join(', ')}</b></div>`;
        }

        // Wind
        if (s.wdir != null || s.wspd != null) {
            let wStr = `${s.wdir != null ? String(s.wdir).padStart(3, '0') : 'VRB'}°/${s.wspd || 0}kt`;
            if (s.gust) wStr += ` G${s.gust}kt`;
            html += `<div class="wx-sd-row">Wind: <b>${wStr}</b></div>`;
        }

        // Temp/Dew/Altimeter
        if (s.temp != null) html += `<div class="wx-sd-row">Temp: <b>${s.temp}°C</b> Dew: <b>${s.dewp != null ? s.dewp + '°C' : '--'}</b></div>`;
        if (s.altimeter != null) html += `<div class="wx-sd-row">Altim: <b>${Number(s.altimeter).toFixed(2)}"</b></div>`;

        // Raw METAR
        if (s.raw) html += `<div class="wx-sd-row" style="margin-top:3px;font-size:9px;color:var(--gtn-text-dim);">${s.raw}</div>`;

        el.innerHTML = html;
    }

    async setWeatherPreset(preset) {
        GTNCore.log('[GTN750] Setting weather preset:', preset);
        try {
            const response = await fetch(`http://${window.location.hostname}:${this.serverPort}/api/weather/preset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preset })
            });
            const data = await response.json();
            if (data.success) {
                document.querySelectorAll('.wx-preset-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.preset === preset));
                this.elements.wxLiveBtn?.classList.remove('active');
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
                this.elements.wxLiveBtn?.classList.add('active');
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

        // Forward TAWS alert to SafeChannel for AI Autopilot
        if (this.syncChannel) {
            this.syncChannel.postMessage({
                type: 'taws-alert',
                data: {
                    level: alert.level || 'CLEAR',
                    message: alert.message || alert.level?.replace('_', ' ') || 'TERRAIN',
                    timestamp: Date.now()
                }
            });
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
        // Autopilot state from AI Autopilot pane
        this._autopilotState = null;

        this.syncChannel.onmessage = (event) => {
            const msg = event.data;
            if (!msg || !msg.type) return;

            if (msg.type === 'autopilot-state') {
                this._autopilotState = msg.data;
                this._renderAutopilotStatus();
            } else if (msg.type === 'waypoint-sequence') {
                // Show visual notification for waypoint sequencing
                this.showSequenceNotification(msg.data.passedIdent, msg.data.activeIdent);
            } else if (msg.type === 'simbrief-plan' || msg.type === 'route-update') {
                // Flight plan messages — ensure module is loaded first
                if (!this.flightPlanManager) {
                    this.loadFlightPlan().then(() => {
                        this.flightPlanManager?.handleSyncMessage(msg.type, msg.data);
                    });
                } else {
                    this.flightPlanManager.handleSyncMessage(msg.type, msg.data);
                }
            } else {
                this.flightPlanManager?.handleSyncMessage(msg.type, msg.data);
            }
        };
    }

    /**
     * Check server for a stored SimBrief plan (handles cross-machine and late-join)
     */
    async _fetchStoredPlan() {
        let simbriefLoaded = false;
        try {
            const res = await fetch('/api/ai-pilot/shared-state/nav');
            if (res.ok) {
                const json = await res.json();
                const plan = json.nav?.simbriefPlan;
                if (plan && plan.waypoints?.length) {
                    GTNCore.log('[GTN750] Found stored SimBrief plan on server, loading...');
                    if (!this.flightPlanManager) await this.loadFlightPlan();
                    this.flightPlanManager?.handleSyncMessage('simbrief-plan', plan);
                    simbriefLoaded = true;
                }
            }
        } catch (e) {
            // Server not available, no stored plan — ignore
        }
        // Only start server polling if no SimBrief plan was loaded
        if (!simbriefLoaded && this.flightPlanManager) {
            this.flightPlanManager.fetchFlightPlan();
        }
    }

    /**
     * Start broadcasting nav-state at 1Hz (called after deferredInit completes)
     */
    _startNavBroadcast() {
        if (this._navBroadcastTimer) return;
        this._navBroadcastTimer = setInterval(() => this._broadcastNavState(), 1000);
    }

    /**
     * Build and broadcast nav-state to AI Autopilot and other panes
     */
    _broadcastNavState() {
        if (!this.syncChannel) return;

        const fpm = this.flightPlanManager;
        const cdi = this.cdiManager;
        const d = this.data;

        // Build flight plan summary
        let flightPlan = null;
        if (fpm?.flightPlan?.waypoints?.length > 0) {
            const wps = fpm.flightPlan.waypoints;
            const dep = wps[0]?.ident || null;
            const arr = wps[wps.length - 1]?.ident || null;
            let totalDist = 0;
            for (const wp of wps) {
                if (wp.distanceFromPrev) totalDist += wp.distanceFromPrev;
            }
            flightPlan = {
                departure: dep,
                arrival: arr,
                waypointCount: wps.length,
                cruiseAltitude: fpm.flightPlan.cruiseAltitude || 0,
                totalDistance: Math.round(totalDist),
                source: fpm.flightPlan.source || 'manual'
            };
        }

        // Build active waypoint
        let activeWaypoint = null;
        if (fpm?.activeWaypoint && d.latitude) {
            const wp = fpm.activeWaypoint;
            const distNm = this.core.calculateDistance(d.latitude, d.longitude, wp.lat, wp.lng);
            const bearingMag = this.core.calculateBearing(d.latitude, d.longitude, wp.lat, wp.lng);
            const eteMin = d.groundSpeed > 5 ? (distNm / d.groundSpeed) * 60 : null;
            activeWaypoint = {
                index: fpm.activeWaypointIndex || 0,
                ident: wp.ident || '----',
                lat: wp.lat,
                lon: wp.lng,
                distNm: Math.round(distNm * 10) / 10,
                eteMin: eteMin ? Math.round(eteMin * 10) / 10 : null,
                bearingMag: Math.round(bearingMag)
            };
        }

        // Build CDI state
        const cdiState = cdi?.cdi || {};
        const cdiData = {
            source: cdi?.navSource || 'GPS',
            needle: cdiState.needle || 0,
            dtk: cdiState.dtk || 0,
            xtrk: cdiState.xtk || 0,
            toFrom: cdiState.toFrom !== undefined ? cdiState.toFrom : 2,
            gsNeedle: cdiState.gsNeedle || 0,
            gsValid: cdiState.gsValid || false
        };

        // Build approach status
        const approach = {
            mode: cdi?.obs?.aprMode || false,
            hasGlideslope: cdiState.gsValid || false,
            navSource: cdi?.navSource || 'GPS'
        };

        // Remaining distance to destination
        let destDistNm = null;
        if (fpm?.flightPlan?.waypoints?.length > 0 && fpm.activeWaypointIndex !== undefined) {
            let rem = 0;
            const wps = fpm.flightPlan.waypoints;
            // Distance from current position to active waypoint
            if (fpm.activeWaypoint && d.latitude) {
                rem += this.core.calculateDistance(d.latitude, d.longitude, fpm.activeWaypoint.lat, fpm.activeWaypoint.lng);
            }
            // Sum remaining leg distances
            for (let i = fpm.activeWaypointIndex + 1; i < wps.length; i++) {
                if (wps[i].distanceFromPrev) rem += wps[i].distanceFromPrev;
            }
            destDistNm = Math.round(rem * 10) / 10;
        }

        this.syncChannel.postMessage({
            type: 'nav-state',
            data: {
                flightPlan,
                activeWaypoint,
                cdi: cdiData,
                approach,
                destDistNm,
                timestamp: Date.now()
            }
        });
    }

    /**
     * Render autopilot status badge in the GTN750 header area
     */
    _renderAutopilotStatus() {
        const el = document.getElementById('gtn-ap-status');
        if (!el) return;

        const ap = this._autopilotState;
        if (!ap || !ap.enabled) {
            el.style.display = 'none';
            return;
        }

        // Check for stale data (>5s)
        if (Date.now() - ap.timestamp > 5000) {
            el.style.display = 'none';
            return;
        }

        el.style.display = 'flex';

        // Build mode string
        const modes = [];
        if (ap.ap?.hdg) modes.push('HDG');
        if (ap.ap?.alt) modes.push('ALT');
        if (ap.ap?.vs) modes.push('VS');
        if (ap.ap?.spd) modes.push('SPD');
        if (ap.ap?.nav) modes.push('NAV');
        if (ap.ap?.apr) modes.push('APR');

        // Terrain alert styling
        let alertClass = '';
        if (ap.terrainAlert === 'WARNING') alertClass = ' ap-terrain-warning';
        else if (ap.terrainAlert === 'CAUTION') alertClass = ' ap-terrain-caution';

        el.className = 'gtn-ap-status' + alertClass;
        el.innerHTML = `<span class="ap-phase">${ap.phase || '---'}</span><span class="ap-modes">${modes.join(' ') || 'AP'}</span>`;
        if (!el._clickBound) {
            el.addEventListener('click', () => window.open('/ui/ai-autopilot/', '_blank'));
            el._clickBound = true;
        }
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
            cdiMode: document.getElementById('cdi-mode'),
            cdiToFrom: document.getElementById('cdi-tofrom'),
            cdiVnav: document.getElementById('cdi-vnav'),
            cdiApproachType: document.getElementById('cdi-approach-type'),
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
            wxSatellite: document.getElementById('wx-satellite'),
            wxMetar: document.getElementById('wx-metar'),
            wxTaf: document.getElementById('wx-taf'),
            wxMetarText: document.getElementById('wx-metar-text'),
            wxAnimate: document.getElementById('wx-animate'),
            wxRadarTime: document.getElementById('wx-radar-time'),
            wxRange: document.getElementById('wx-range'),
            wxZoomIn: document.getElementById('wx-zoom-in'),
            wxZoomOut: document.getElementById('wx-zoom-out'),
            wxFltRules: document.getElementById('wx-flt-rules'),
            wxNearestId: document.getElementById('wx-nearest-id'),
            wxDWind: document.getElementById('wx-d-wind'),
            wxDVis: document.getElementById('wx-d-vis'),
            wxDCeil: document.getElementById('wx-d-ceil'),
            wxDTemp: document.getElementById('wx-d-temp'),
            wxDAltim: document.getElementById('wx-d-altim'),
            wxFrzLvl: document.getElementById('wx-frz-lvl'),
            wxDnsAlt: document.getElementById('wx-dns-alt'),
            wxIcing: document.getElementById('wx-icing'),
            wxStationDetail: document.getElementById('wx-station-detail'),
            chartApt: document.getElementById('chart-apt'),
            chartSearch: document.getElementById('chart-search'),
            chartList: document.getElementById('chart-list'),
            auxDist: document.getElementById('aux-dist'),
            auxTime: document.getElementById('aux-time'),
            auxEta: document.getElementById('aux-eta'),
            auxFuel: document.getElementById('aux-fuel'),
            obsIndicator: document.getElementById('obs-indicator'),
            obsCourse: document.getElementById('obs-course'),
            wptDtk: document.getElementById('wpt-dtk'),
            wptType: document.getElementById('wpt-type'),
            wxConditionIcon: document.getElementById('wx-condition-icon'),
            wxConditionText: document.getElementById('wx-condition-text'),
            wxLiveBtn: document.getElementById('wx-live-btn'),
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
            xpdrIdent: document.getElementById('xpdr-ident'),
            xpdrMode: document.getElementById('xpdr-mode'),
            xpdrModeIndicator: document.querySelector('.xpdr-mode-indicator'),
            utcTime: document.getElementById('utc-time'),
            tabs: document.querySelectorAll('.gtn-tab'),
            // Compact mode elements
            gcCom1: document.getElementById('gc-com1'),
            gcCom1Stby: document.getElementById('gc-com1-stby'),
            gcNav1: document.getElementById('gc-nav1'),
            gcNav1Stby: document.getElementById('gc-nav1-stby'),
            gcXpdr: document.getElementById('gc-xpdr'),
            gcXpdrMode: document.getElementById('gc-xpdr-mode'),
            gcTrk: document.getElementById('gc-trk'),
            gcGs: document.getElementById('gc-gs'),
            gcAlt: document.getElementById('gc-alt'),
            gcEte: document.getElementById('gc-ete'),
            gcWptId: document.getElementById('gc-wpt-id'),
            gcWptDtk: document.getElementById('gc-wpt-dtk'),
            gcWptDis: document.getElementById('gc-wpt-dis'),
            gcCdiSrc: document.getElementById('gc-cdi-src'),
            gcCdiTo: document.getElementById('gc-cdi-to'),
            gcCdiDtk: document.getElementById('gc-cdi-dtk'),
            gcCdiXtk: document.getElementById('gc-cdi-xtk'),
            gcCdiNeedle: document.getElementById('gc-cdi-needle'),
            gcRange: document.getElementById('gc-range'),
            trafficInfo: document.getElementById('traffic-info'),
            trafficCallsign: document.getElementById('traffic-callsign'),
            trafficAlt: document.getElementById('traffic-alt'),
            trafficRelAlt: document.getElementById('traffic-rel-alt'),
            trafficSpeed: document.getElementById('traffic-speed'),
            trafficHdg: document.getElementById('traffic-hdg'),
            trafficVs: document.getElementById('traffic-vs'),
            trafficDist: document.getElementById('traffic-dist'),
            trafficBrg: document.getElementById('traffic-brg'),
            trafficClose: document.getElementById('traffic-close'),
            vnavDisplay: document.getElementById('vnav-display'),
            vnavStatus: document.getElementById('vnav-status'),
            vnavToggle: document.getElementById('vnav-toggle'),
            vnavTod: document.getElementById('vnav-tod'),
            vnavVdev: document.getElementById('vnav-vdev'),
            vnavReqvs: document.getElementById('vnav-reqvs'),
            vnavTgtalt: document.getElementById('vnav-tgtalt')
        };
    }

    // ===== EVENT BINDING =====

    bindEvents() {
        // Collapsible section toggles
        document.querySelectorAll('.section-toggle').forEach(btn => {
            const targetId = btn.dataset.target;
            const el = document.getElementById(targetId);
            if (!el) return;
            const key = 'gtn750-collapsed-' + targetId;
            if (localStorage.getItem(key) === '1') el.classList.add('collapsed');
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                el.classList.toggle('collapsed');
                localStorage.setItem(key, el.classList.contains('collapsed') ? '1' : '0');
                setTimeout(() => this.resizeCanvas(), 300);
            });
        });

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

        this.elements.btnDirect?.addEventListener('click', () => this.flightPlanManager?.showDirectTo());

        // XPDR code click → open modal
        this.elements.xpdr?.addEventListener('click', (e) => { e.stopPropagation(); this.xpdrControl.toggle(); });
        // Top bar IDENT button → quick ident toggle
        this.elements.xpdrIdent?.addEventListener('click', (e) => { e.stopPropagation(); this.xpdrControl._onIdent(); });

        // Frequency swaps
        this.elements.swapCom1?.addEventListener('click', () => this.dataHandler?.swapFrequency('COM1'));
        this.elements.swapCom2?.addEventListener('click', () => this.dataHandler?.swapFrequency('COM2'));
        this.elements.swapNav1?.addEventListener('click', () => this.dataHandler?.swapFrequency('NAV1'));

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

        // Map canvas click for traffic selection
        this.elements.mapCanvas?.addEventListener('click', (e) => this.handleMapClick(e));

        // Traffic info close button
        this.elements.trafficClose?.addEventListener('click', () => this.hideTrafficInfo());

        // VNAV toggle button
        this.elements.vnavToggle?.addEventListener('click', () => this.toggleVNav());
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
        this.weatherRange = 50;
        this.elements.wxZoomIn?.addEventListener('click', () => this.changeWeatherRange(-1));
        this.elements.wxZoomOut?.addEventListener('click', () => this.changeWeatherRange(1));

        // Weather layer toggles
        this.elements.wxSimRadar?.addEventListener('change', (e) => { if (this.weatherOverlay) this.weatherOverlay.setLayer('simRadar', e.target.checked); });
        this.elements.wxNexrad?.addEventListener('change', (e) => { if (this.weatherOverlay) this.weatherOverlay.setLayer('nexrad', e.target.checked); });
        document.getElementById('wx-metar')?.addEventListener('change', (e) => { if (this.weatherOverlay) this.weatherOverlay.setLayer('metar', e.target.checked); });
        document.getElementById('wx-winds')?.addEventListener('change', (e) => { if (this.weatherOverlay) this.weatherOverlay.setLayer('winds', e.target.checked); });
        document.getElementById('wx-lightning')?.addEventListener('change', (e) => { if (this.weatherOverlay) this.weatherOverlay.setLayer('lightning', e.target.checked); });
        this.elements.wxSatellite?.addEventListener('change', (e) => { if (this.weatherOverlay) this.weatherOverlay.setLayer('satellite', e.target.checked); });
        this.elements.wxTaf?.addEventListener('change', (e) => { if (this.weatherOverlay) this.weatherOverlay.setLayer('taf', e.target.checked); });

        // METAR popup on canvas tap
        this.elements.wxCanvas?.addEventListener('click', (e) => {
            if (!this.weatherOverlay) return;
            const rect = e.target.getBoundingClientRect();
            this.weatherOverlay.handleCanvasTap(e.clientX - rect.left, e.clientY - rect.top);
        });

        // Terrain range/view
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
            flightPlan: this.flightPlanManager?.flightPlan || null,
            activeWaypointIndex: this.flightPlanManager?.activeWaypointIndex || 0,
            data: this.data
        };
    }

    // ===== SOFT KEY HANDLER =====

    handleSoftKeyAction(action, detail) {
        const cdiState = this._getCdiState();

        switch (action) {
            case 'go-back':
                // If FPL page has cursor selected, deselect first
                if (this.fplPage && this.fplPage.cursorIndex >= 0 && this.pageManager?.getCurrentPageId() === 'fpl') {
                    this.fplPage.setCursor(-1);
                    break;
                }
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
            case 'activate-leg':
                if (this.fplPage && this.fplPage.cursorIndex >= 0) {
                    this.fplPage.onActivateLeg();
                } else {
                    this.flightPlanManager?.activateLeg();
                }
                break;
            case 'invert-plan': this.flightPlanManager?.invertFlightPlan(); break;
            case 'direct-to':
                if (this.pageManager) this.pageManager.switchPage('map');
                this.flightPlanManager?.showDirectTo();
                break;
            case 'insert-airway': this.flightPlanManager?.showAirwaysModal(); break;
            case 'waypoint-info': this.showWaypointInfoModal(); break;
            case 'fpl-delete': if (this.fplPage) this.fplPage.onDelete(); break;
            case 'fpl-insert': if (this.fplPage) this.fplPage.onInsert(); break;
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
            case 'aux-trip': if (this.auxPage) this.auxPage.showSubpage('trip'); break;
            case 'aux-util': if (this.auxPage) this.auxPage.showSubpage('util'); break;
            case 'aux-timer': this.toggleAuxTimer(); break;
            case 'aux-calc': if (this.auxPage) this.auxPage.showSubpage('calc'); break;
            case 'traffic-operate': case 'traffic-standby': case 'traffic-test':
                this.setTrafficMode(action.split('-')[1]); break;
            case 'wx-simRadar': case 'wx-nexrad': case 'wx-metar': case 'wx-taf': case 'wx-satellite': case 'wx-winds': case 'wx-lightning':
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
            default: GTNCore.log(`[GTN750] Unhandled soft key action: ${action}`);
        }
    }

    // ===== WAYPOINT INFO MODAL =====

    showWaypointInfoModal() {
        const wp = this.fplPage?.getSelectedWaypoint();
        if (!wp) return;

        // Switch to map page where the modal lives
        if (this.pageManager) this.pageManager.switchPage('map');

        const body = document.getElementById('wpt-info-body');
        const modal = document.getElementById('wpt-info-modal');
        if (!body || !modal) return;

        let html = `<div class="dto-name" style="font-size: 16px; font-weight: bold;">${wp.ident || '----'}</div>`;
        html += `<div class="dto-coords">${wp.type || 'WAYPOINT'}</div>`;

        if (wp.lat !== undefined && wp.lng !== undefined) {
            html += `<div class="dto-coords">${this.core.formatLat(wp.lat)} ${this.core.formatLon(wp.lng)}</div>`;
        }

        if (wp.altitude) {
            html += `<div class="dto-coords">ALT: ${Math.round(wp.altitude).toLocaleString()} ft</div>`;
        }

        if (this.data.latitude && wp.lat && wp.lng) {
            const dist = this.core.calculateDistance(this.data.latitude, this.data.longitude, wp.lat, wp.lng);
            const brg = this.core.calculateBearing(this.data.latitude, this.data.longitude, wp.lat, wp.lng);
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

    // ===== RANGE / DECLUTTER HELPERS =====

    changeRange(delta) {
        const idx = this.map.ranges.indexOf(this.map.range);
        const newIdx = Math.max(0, Math.min(this.map.ranges.length - 1, idx + delta));
        this.map.range = this.map.ranges[newIdx];
        if (this.elements.dfRange) this.elements.dfRange.textContent = this.map.range;
    }

    changeWeatherRange(delta) {
        const ranges = this.WEATHER_RANGES;
        const idx = ranges.indexOf(this.weatherRange);
        const newIdx = Math.max(0, Math.min(ranges.length - 1, idx + delta));
        this.weatherRange = ranges[newIdx];
        if (this.elements.wxRange) this.elements.wxRange.textContent = this.weatherRange;
    }

    changeTerrainRange(delta) {
        if (!this.terrainOverlay) return;
        const ranges = this.TERRAIN_RANGES;
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
            const ranges = this.TERRAIN_RANGES;
            const current = this.terrainOverlay.getRange();
            const idx = ranges.indexOf(current);
            this.terrainOverlay.setRange(ranges[(idx + 1) % ranges.length]);
        }
    }

    // ===== COMPACT MODE =====

    setupCompactToggle() {
        const toggle = document.getElementById('compact-toggle');
        if (!toggle) return;

        const root = document.getElementById('gtn750');
        if (this.compactMode) {
            root?.classList.add('compact');
            toggle.classList.add('active');
            this.startCompactRender();
        }

        toggle.addEventListener('click', () => {
            this.compactMode = !this.compactMode;
            localStorage.setItem('gtn750-compact', this.compactMode);
            root?.classList.toggle('compact', this.compactMode);
            toggle.classList.toggle('active', this.compactMode);

            if (this.compactMode) {
                this.startCompactRender();
            } else {
                this.stopCompactRender();
                this.resizeCanvas();
            }
        });

        this.bindCompactEvents();
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
        // Delay setup slightly to let layout settle
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
        const fpl = this.flightPlanManager?.flightPlan;
        if (fpl?.waypoints?.length > 1 && this.data.latitude) {
            const nmPerPx = this.map.range / ringR;
            const rotation = this.map.orientation === 'north' ? 0 : -(this.data.track || this.data.heading || 0) * Math.PI / 180;

            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(rotation);

            ctx.beginPath();
            let started = false;
            fpl.waypoints.forEach(wp => {
                if (!wp.lat || !wp.lng) return;
                const dlat = (wp.lat - this.data.latitude) * 60;
                const dlon = (wp.lng - this.data.longitude) * 60 * Math.cos(this.data.latitude * Math.PI / 180);
                const px = dlon / nmPerPx;
                const py = -dlat / nmPerPx;
                if (!started) { ctx.moveTo(px, py); started = true; }
                else ctx.lineTo(px, py);
            });
            ctx.strokeStyle = '#FF44CC';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Waypoint diamonds and labels
            const activeIdx = this.flightPlanManager?.activeWaypointIndex || 0;
            fpl.waypoints.forEach((wp, i) => {
                if (!wp.lat || !wp.lng) return;
                const dlat = (wp.lat - this.data.latitude) * 60;
                const dlon = (wp.lng - this.data.longitude) * 60 * Math.cos(this.data.latitude * Math.PI / 180);
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
        const d = this.data;
        const e = this.elements;

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
            const fpm = this.flightPlanManager;
            if (fpm?.activeWaypoint && d.groundSpeed > 5) {
                const dist = this.core.calculateDistance(d.latitude, d.longitude, fpm.activeWaypoint.lat, fpm.activeWaypoint.lng);
                const eteMin = (dist / d.groundSpeed) * 60;
                e.gcEte.textContent = this.core.formatEte(eteMin);
            } else {
                e.gcEte.textContent = '--:--';
            }
        }

        // Waypoint
        if (e.gcWptId) {
            const wp = this.flightPlanManager?.activeWaypoint;
            e.gcWptId.textContent = wp?.ident || '----';
        }
        if (e.gcWptDtk) {
            const cdiDtk = this.cdiManager?.cdi?.dtk;
            e.gcWptDtk.textContent = cdiDtk ? Math.round(cdiDtk).toString().padStart(3, '0') + '\u00B0' : '---\u00B0';
        }
        if (e.gcWptDis) {
            const wp = this.flightPlanManager?.activeWaypoint;
            if (wp?.lat && d.latitude) {
                const dist = this.core.calculateDistance(d.latitude, d.longitude, wp.lat, wp.lng);
                e.gcWptDis.textContent = dist.toFixed(1) + 'nm';
            } else {
                e.gcWptDis.textContent = '--.-nm';
            }
        }

        // CDI
        if (e.gcCdiSrc) e.gcCdiSrc.textContent = this.cdiManager?.navSource || 'GPS';
        if (e.gcCdiTo) {
            const tf = this.cdiManager?.cdi?.toFrom;
            e.gcCdiTo.textContent = ['FROM', 'TO', '---'][tf] || '---';
        }
        if (e.gcCdiDtk) {
            const dtk = this.cdiManager?.cdi?.dtk;
            e.gcCdiDtk.textContent = dtk ? Math.round(dtk).toString().padStart(3, '0') : '---';
        }
        if (e.gcCdiXtk) {
            const xtk = this.cdiManager?.cdi?.xtk;
            e.gcCdiXtk.textContent = xtk != null ? Math.abs(xtk).toFixed(1) : '0.0';
        }

        // CDI needle position
        if (e.gcCdiNeedle) {
            const needle = this.cdiManager?.cdi?.needle || 0;
            const offset = Math.max(-30, Math.min(30, needle * 20));
            e.gcCdiNeedle.style.left = `calc(50% + ${offset}px)`;
        }

        // Range
        if (e.gcRange) e.gcRange.textContent = this.map.range;

        // Update VNAV
        this.updateVNav();
    }

    bindCompactEvents() {
        // Compact range buttons
        document.getElementById('gc-zoom-in')?.addEventListener('click', () => this.changeRange(-1));
        document.getElementById('gc-zoom-out')?.addEventListener('click', () => this.changeRange(1));

        // Compact softkeys
        document.getElementById('gc-sk-menu')?.addEventListener('click', () => {
            document.getElementById('gc-tabs')?.classList.toggle('visible');
        });
        document.getElementById('gc-sk-ter')?.addEventListener('click', () => {
            this.map.showTerrain = !this.map.showTerrain;
            document.getElementById('gc-sk-ter')?.classList.toggle('active', this.map.showTerrain);
        });
        document.getElementById('gc-sk-tfc')?.addEventListener('click', () => {
            this.map.showTraffic = !this.map.showTraffic;
            document.getElementById('gc-sk-tfc')?.classList.toggle('active', this.map.showTraffic);
        });
        document.getElementById('gc-sk-dto')?.addEventListener('click', () => {
            this.flightPlanManager?.showDirectTo();
        });
        document.getElementById('gc-sk-cdi')?.addEventListener('click', () => {
            const sources = ['GPS', 'NAV1', 'NAV2'];
            const idx = sources.indexOf(this.cdiManager?.navSource || 'GPS');
            const next = sources[(idx + 1) % sources.length];
            this.cdiManager.setNavSource(next);
            this.data.navSource = next;
            this.cdiManager.updateFromSource(this._getCdiState());
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

            // Update tab active state
            document.querySelectorAll('#gc-tabs .gc-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show/hide FPL view
            if (pageId === 'fpl') {
                document.getElementById('gc-fpl')?.classList.add('visible');
                this.gcCompactPage = 'fpl';
                this.updateCompactFpl();
            } else {
                document.getElementById('gc-fpl')?.classList.remove('visible');
                this.gcCompactPage = pageId;
            }

            // Also switch the full-size page (for data loading)
            this.pageManager?.switchPage(pageId, false);

            // Hide tabs after selection
            document.getElementById('gc-tabs')?.classList.remove('visible');
        });
    }

    updateCompactFpl() {
        const fplEl = document.getElementById('gc-fpl');
        if (!fplEl) return;

        const plan = this.flightPlanManager?.flightPlan;
        if (!plan?.waypoints?.length) {
            fplEl.innerHTML = '<div style="color:#607080;font-size:9px;padding:20px;text-align:center">No flight plan</div>';
            return;
        }

        const activeIdx = this.flightPlanManager?.activeWaypointIndex || 0;
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

    // ===== TRAFFIC INFO =====

    handleMapClick(e) {
        if (!this.trafficOverlay) return;

        const rect = this.elements.mapCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const targetSelected = this.trafficOverlay.handleClick(x, y);
        if (targetSelected) {
            this.showTrafficInfo();
        } else {
            this.hideTrafficInfo();
        }
    }

    showTrafficInfo() {
        if (!this.trafficOverlay) return;

        const info = this.trafficOverlay.getSelectedTargetInfo();
        if (!info || !this.elements.trafficInfo) return;

        // Update info panel content
        if (this.elements.trafficCallsign) this.elements.trafficCallsign.textContent = info.callsign;
        if (this.elements.trafficAlt) this.elements.trafficAlt.textContent = `${info.altitude} ft`;
        if (this.elements.trafficRelAlt) {
            const sign = info.relativeAlt >= 0 ? '+' : '';
            this.elements.trafficRelAlt.textContent = `${sign}${info.relativeAlt} ft`;
        }
        if (this.elements.trafficSpeed) this.elements.trafficSpeed.textContent = `${info.groundSpeed} kts`;
        if (this.elements.trafficHdg) this.elements.trafficHdg.textContent = `${info.heading}°`;
        if (this.elements.trafficVs) {
            const vs = info.verticalSpeed;
            const sign = vs >= 0 ? '+' : '';
            this.elements.trafficVs.textContent = `${sign}${vs} fpm`;
        }
        if (this.elements.trafficDist) this.elements.trafficDist.textContent = `${info.distance} nm`;
        if (this.elements.trafficBrg) this.elements.trafficBrg.textContent = `${info.bearing}°`;

        // Show panel
        this.elements.trafficInfo.style.display = 'block';
    }

    hideTrafficInfo() {
        if (this.elements.trafficInfo) {
            this.elements.trafficInfo.style.display = 'none';
        }
        if (this.trafficOverlay) {
            this.trafficOverlay.clearSelection();
        }
    }

    // ===== VNAV =====

    toggleVNav() {
        if (!this.vnavManager) return;

        const newState = !this.vnavManager.enabled;
        this.vnavManager.setEnabled(newState);

        if (this.elements.vnavToggle) {
            this.elements.vnavToggle.textContent = newState ? 'ON' : 'OFF';
            this.elements.vnavToggle.classList.toggle('active', newState);
        }

        if (this.elements.vnavDisplay) {
            this.elements.vnavDisplay.style.display = newState ? 'block' : 'none';
        }

        if (newState) {
            this.updateVNav();
        }
    }

    updateVNav() {
        if (!this.vnavManager || !this.vnavManager.enabled) return;

        // Calculate VNAV with current flight plan and position
        const flightPlan = this.flightPlanManager?.flightPlan;
        if (!flightPlan) {
            return;
        }

        this.vnavManager.calculate(flightPlan, {
            latitude: this.data.latitude,
            longitude: this.data.longitude,
            altitude: this.data.altitude
        }, this.data.groundSpeed);

        // Update display
        const status = this.vnavManager.getStatus();

        // TOD distance
        if (this.elements.vnavTod) {
            if (status.todDistance > 0) {
                this.elements.vnavTod.textContent = `${status.todDistance.toFixed(1)} NM`;
                this.elements.vnavTod.classList.remove('active', 'warning');
                if (status.armed) {
                    this.elements.vnavTod.classList.add('armed');
                }
            } else if (status.todDistance < 0) {
                this.elements.vnavTod.textContent = `${Math.abs(status.todDistance).toFixed(1)} NM PAST`;
                this.elements.vnavTod.classList.add('active');
            } else {
                this.elements.vnavTod.textContent = '--- NM';
                this.elements.vnavTod.classList.remove('active', 'armed');
            }
        }

        // Vertical deviation
        if (this.elements.vnavVdev) {
            const dev = status.verticalDeviation;
            if (status.active && dev !== 0) {
                const sign = dev >= 0 ? '+' : '';
                this.elements.vnavVdev.textContent = `${sign}${Math.round(dev)} FT`;
                this.elements.vnavVdev.classList.remove('active', 'warning', 'alert');
                if (Math.abs(dev) > 500) {
                    this.elements.vnavVdev.classList.add('alert');
                } else if (Math.abs(dev) > 200) {
                    this.elements.vnavVdev.classList.add('warning');
                }
            } else {
                this.elements.vnavVdev.textContent = '--- FT';
                this.elements.vnavVdev.classList.remove('active', 'warning', 'alert');
            }
        }

        // Required VS
        if (this.elements.vnavReqvs) {
            if (status.requiredVS > 0) {
                this.elements.vnavReqvs.textContent = `-${status.requiredVS} FPM`;
                this.elements.vnavReqvs.classList.remove('warning', 'alert');
                if (status.requiredVS > 1500) {
                    this.elements.vnavReqvs.classList.add('alert');
                } else if (status.requiredVS > 1000) {
                    this.elements.vnavReqvs.classList.add('warning');
                }
            } else {
                this.elements.vnavReqvs.textContent = '--- FPM';
                this.elements.vnavReqvs.classList.remove('warning', 'alert');
            }
        }

        // Target altitude
        if (this.elements.vnavTgtalt) {
            if (status.targetAltitude > 0 && status.active) {
                this.elements.vnavTgtalt.textContent = `${status.targetAltitude} FT`;
            } else {
                this.elements.vnavTgtalt.textContent = '--- FT';
            }
        }

        // Update status indicator
        if (this.elements.vnavStatus) {
            if (status.active) {
                this.elements.vnavStatus.textContent = 'VNAV ACT';
                this.elements.vnavStatus.style.color = 'var(--gtn-green)';
            } else if (status.armed) {
                this.elements.vnavStatus.textContent = 'VNAV ARM';
                this.elements.vnavStatus.style.color = 'var(--gtn-yellow)';
            } else {
                this.elements.vnavStatus.textContent = 'VNAV';
                this.elements.vnavStatus.style.color = 'var(--gtn-green)';
            }
        }
    }

    destroy() {
        if (this.mapRenderer) this.mapRenderer.stop();
        if (this.dataHandler) this.dataHandler.destroy();
        if (this.flightPlanManager) this.flightPlanManager.destroy();
        if (this.xpdrControl) this.xpdrControl.destroy();

        // Cancel compact render
        this.stopCompactRender();

        // Cancel page render RAF loops
        this.terrainPageRenderActive = false;
        this.trafficPageRenderActive = false;
        this.weatherPageRenderActive = false;
        if (this._terrainRafId) { cancelAnimationFrame(this._terrainRafId); this._terrainRafId = null; }
        if (this._trafficRafId) { cancelAnimationFrame(this._trafficRafId); this._trafficRafId = null; }
        if (this._weatherRafId) { cancelAnimationFrame(this._weatherRafId); this._weatherRafId = null; }

        // Remove window listeners
        window.removeEventListener('resize', this._resizeHandler);
        window.removeEventListener('beforeunload', this._beforeUnloadHandler);

        if (this._navBroadcastTimer) {
            clearInterval(this._navBroadcastTimer);
            this._navBroadcastTimer = null;
        }
        if (this._sequenceNotifyTimer) {
            clearTimeout(this._sequenceNotifyTimer);
            this._sequenceNotifyTimer = null;
        }
        if (this.syncChannel) this.syncChannel.close();

        // Call parent destroy
        super.destroy();
    }
}

// Initialize and expose globally
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.gtn750 = new GTN750Pane();
        handleUrlHash();
        window.addEventListener('beforeunload', window.gtn750._beforeUnloadHandler);
    });
} else {
    window.gtn750 = new GTN750Pane();
    handleUrlHash();
    window.addEventListener('beforeunload', window.gtn750._beforeUnloadHandler);
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
