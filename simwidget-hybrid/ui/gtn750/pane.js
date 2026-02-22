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

function _esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

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
            pageSystem: false,
            pageTaxi: false,
            pageUserWpt: false
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
            showTerrain: false, showTraffic: false, showWeather: false,
            showAirways: false
        };

        // Nearby airways cache
        this.nearbyAirways = [];
        this._airwaysFetchTimer = null;

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

        // Destination runway data for runway extensions overlay
        this.destinationRunways = null;
        this._lastDestinationIcao = null;

        // Auto Zoom state
        this._autoZoomActive = false;
        this._autoZoomOverridden = false;
        this._lastAutoZoomWaypointIndex = -1;

        // Handler refs for cleanup
        this._resizeHandler = () => { this.resizeCanvas(); this._applyDeviceSize(); };
        this._beforeUnloadHandler = () => this.destroy();

        // Page instances (lazy-created on first visit)
        this.fplPage = null;
        this.proceduresPage = null;
        this.auxPage = null;
        this.chartsPage = null;
        this.nearestPage = null;
        this.systemPage = null;
        this.taxiPage = null;
        this.userWptPage = null;

        // Soft key retry counter
        this._softKeyRetries = 0;

        // Compact mode
        this.compactMode = localStorage.getItem('gtn750-compact') === 'true';
        this._compactRafId = null;
        this.gcCompactPage = 'map';

        // UI update throttle (5Hz = 200ms, matches real avionics refresh)
        this._uiThrottle = new ThrottleManager(200);

        // cross-pane sync
        this.syncChannel = new SafeChannel('SimGlass-sync');

        // Create critical module instances (loaded immediately)
        this.dataFieldsManager = new GTNDataFields({ core: this.core });
        this.cdiManager = new GTNCdi({ core: this.core, elements: {}, serverPort: this.serverPort });
        this.vnavManager = new GTNVNav({ core: this.core });
        this.holdingManager = new GTNHolding({
            core: this.core,
            serverPort: this.serverPort,
            syncChannel: this.syncChannel
        });
        this.mapRenderer = new GTNMapRenderer({
            core: this.core,
            getState: () => this.getRendererState()
        });

        // Flight Plan Validator
        this.flightPlanValidator = new GTNFlightPlanValidator({
            core: this.core,
            terrainGrid: window._terrainGrid || null
        });

        // XPDR control panel
        this.xpdrControl = new GTNXpdrControl({ serverPort: this.serverPort });

        // Notification system (immediate load)
        this.notification = new GTNNotification();

        // Fuel monitor (will be initialized after flight plan manager)
        this.fuelMonitor = null;

        // Altitude alerts
        this.altitudeAlerts = new GTNAltitudeAlerts({
            core: this.core,
            onAlert: (type, message, level) => this.handleAltitudeAlert(type, message, level)
        });

        // TCAS (Traffic Collision Avoidance System)
        this.tcas = new GTNTCAS({
            core: this.core,
            onAlert: (type, message, level, threat) => this.handleTCASAlert(type, message, level, threat)
        });

        // Flight Logger (automatic logbook and timer tracking)
        this.flightLogger = new GTNFlightLogger({
            core: this.core,
            onPhaseChange: (newPhase, oldPhase) => this.handleFlightPhaseChange(newPhase, oldPhase)
        });

        // User Waypoints (custom waypoint management)
        this.userWaypoints = new GTNUserWaypoints({
            core: this.core
        });

        // Frequency Tuner (COM/NAV radio management)
        this.frequencyTuner = new GTNFrequencyTuner({
            serverPort: this.serverPort,
            onFrequencyChange: (radio, type, freq) => this.handleFrequencyChange(radio, type, freq)
        });

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
        this.restoreState();
        this.initKeyboardShortcuts();

        // Defer non-critical modules (500ms after initial render)
        this.deferredInit();

        // Check database currency (safety-critical)
        this.checkDatabaseCurrency();

        // Apply device-size class immediately and on every resize
        this._applyDeviceSize();
    }

    /**
     * Initialize keyboard shortcuts for power users
     */
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignore if user is typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // Ctrl/Cmd shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        this.saveFlightPlan();
                        break;
                    case 'l':
                        e.preventDefault();
                        this.loadFlightPlan();
                        break;
                    case 'd':
                        e.preventDefault();
                        this.activateDirectTo();
                        break;
                }
                return;
            }

            // Arrow key cursor navigation on FPL page
            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                if (this.pageManager?.getCurrentPageId() === 'fpl' && this.fplPage) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); this.fplPage.moveCursor(1); return; }
                    if (e.key === 'ArrowUp') { e.preventDefault(); this.fplPage.moveCursor(-1); return; }
                }
            }

            // Single-key shortcuts (no modifiers)
            if (!e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'm':
                        e.preventDefault();
                        if (this.pageManager) this.pageManager.switchPage('map');
                        break;
                    case 'f':
                        e.preventDefault();
                        if (this.pageManager) this.pageManager.switchPage('fpl');
                        break;
                    case 'p':
                        e.preventDefault();
                        if (this.pageManager) this.pageManager.switchPage('proc');
                        break;
                    case 'n':
                        e.preventDefault();
                        if (this.pageManager) this.pageManager.switchPage('nrst');
                        break;
                    case 't':
                        e.preventDefault();
                        if (this.pageManager) this.pageManager.switchPage('taxi');
                        break;
                    case 'w':
                        e.preventDefault();
                        if (this.pageManager) this.pageManager.switchPage('wx');
                        break;
                    case ' ':
                        e.preventDefault();
                        this.toggleCDISource();
                        break;
                    case '+':
                    case '=':
                        e.preventDefault();
                        this.zoomIn();
                        break;
                    case '-':
                    case '_':
                        e.preventDefault();
                        this.zoomOut();
                        break;
                    case 'c':
                        e.preventDefault();
                        this.centerMap();
                        break;
                    case 'i':
                        e.preventDefault();
                        if (this.pageManager?.getCurrentPageId() === 'fpl') this.showFlightPlanInfoModal();
                        break;
                    case 'y':
                        e.preventDefault();
                        if (this.pageManager?.getCurrentPageId() === 'fpl') this.sendFlightPlanToAutopilot();
                        break;
                }
            }
        });

        GTNCore.log('[GTN750] Keyboard shortcuts initialized');
    }

    /**
     * Save flight plan (Ctrl+S handler)
     */
    async saveFlightPlan() {
        if (!this.flightPlanManager?.flightPlan) {
            this.showNotification('No flight plan to save', 'warning');
            return;
        }
        await this.flightPlanManager.saveFlightPlan();
        this.showNotification('Flight plan saved', 'success');
    }

    /**
     * Load flight plan (Ctrl+L handler)
     */
    loadFlightPlan() {
        if (this.pageManager) {
            this.pageManager.switchPage('fpl');
            // Trigger load modal
            setTimeout(() => {
                const loadBtn = document.querySelector('[data-action="load-fpl"]');
                if (loadBtn) loadBtn.click();
            }, 100);
        }
    }

    /**
     * Activate Direct-To (Ctrl+D handler)
     */
    activateDirectTo() {
        if (this.flightPlanManager) {
            this.flightPlanManager.showDirectToModal();
        }
    }

    /**
     * Toggle CDI source (Space handler)
     */
    toggleCDISource() {
        if (!this.cdiManager) return;

        const sources = ['GPS', 'NAV1', 'NAV2'];
        const current = this.data.navSource || 'GPS';
        const currentIndex = sources.indexOf(current);
        const nextIndex = (currentIndex + 1) % sources.length;
        const nextSource = sources[nextIndex];

        this.cdiManager.setSource(nextSource);
        this.data.navSource = nextSource;
        this.showNotification(`CDI: ${nextSource}`, 'info');
    }

    /**
     * Zoom in (+ handler)
     */
    zoomIn() {
        if (!this.mapControls) return;
        const currentIndex = this.map.ranges.indexOf(this.map.range);
        if (currentIndex > 0) {
            this.map.range = this.map.ranges[currentIndex - 1];
            this.mapControls.setRange(this.map.range);
            this.saveState();
            this._checkNorthUpAbove();
            // Manual zoom overrides auto zoom
            this._autoZoomOverridden = true;
        }
    }

    /**
     * Zoom out (- handler)
     */
    zoomOut() {
        if (!this.mapControls) return;
        const currentIndex = this.map.ranges.indexOf(this.map.range);
        if (currentIndex < this.map.ranges.length - 1) {
            this.map.range = this.map.ranges[currentIndex + 1];
            this.mapControls.setRange(this.map.range);
            this.saveState();
            this._checkNorthUpAbove();
            // Manual zoom overrides auto zoom
            this._autoZoomOverridden = true;
        }
    }

    /**
     * North Up Above — auto-switch to North Up when zoomed out beyond threshold
     * Per Garmin GTN750Xi Pilot's Guide section 3-9
     */
    _checkNorthUpAbove() {
        const settings = this.systemPage?.getSettings();
        if (!settings?.northUpAboveEnabled) return;

        const threshold = settings.northUpAbove || 50; // nm
        const previousOrientation = this._northUpAboveState || this.map.orientation;

        if (this.map.range >= threshold && this.map.orientation !== 'north') {
            // Switched above threshold — save previous orientation and switch to North Up
            this._northUpAboveState = this.map.orientation;
            this.map.orientation = 'north';
            GTNCore.log(`[GTN750] North Up Above: Switched to North Up at ${this.map.range}nm`);
        } else if (this.map.range < threshold && this._northUpAboveState && this.map.orientation === 'north') {
            // Switched below threshold — restore previous orientation
            this.map.orientation = this._northUpAboveState;
            this._northUpAboveState = null;
            GTNCore.log(`[GTN750] North Up Above: Restored ${this.map.orientation} orientation at ${this.map.range}nm`);
        }
    }

    /**
     * Center map on aircraft (C handler)
     */
    centerMap() {
        this.panOffset = { x: 0, y: 0 };
        if (this.mapControls) {
            this.mapControls.resetPan();
        }
    }

    /**
     * Show brief notification toast
     */
    showNotification(message, type = 'info') {
        this.notification.showNotification(message, type);
    }

    /**
     * Restore saved state from localStorage
     */
    restoreState() {
        try {
            const saved = JSON.parse(localStorage.getItem('gtn750-state') || '{}');

            // Restore map settings
            if (saved.mapRange !== undefined && this.map.ranges.includes(saved.mapRange)) {
                this.map.range = saved.mapRange;
            }
            if (saved.mapOrientation && ['north', 'track', 'heading'].includes(saved.mapOrientation)) {
                this.map.orientation = saved.mapOrientation;
            }

            // Restore overlay toggles
            if (saved.showTerrain !== undefined) this.map.showTerrain = saved.showTerrain;
            if (saved.showTraffic !== undefined) this.map.showTraffic = saved.showTraffic;
            if (saved.showWeather !== undefined) this.map.showWeather = saved.showWeather;
            if (saved.showAirways !== undefined) this.map.showAirways = saved.showAirways;

            // Restore last page (apply after page manager is ready)
            if (saved.currentPage && this.pageManager) {
                setTimeout(() => {
                    this.pageManager.switchPage(saved.currentPage);
                }, 100);
            }

            GTNCore.log('[GTN750] State restored from localStorage');
        } catch (e) {
            console.warn('[GTN750] Failed to restore state:', e.message);
        }
    }

    /**
     * Save current state to localStorage
     */
    saveState() {
        try {
            const state = {
                currentPage: this.currentPage || 'map',
                mapRange: this.map.range,
                mapOrientation: this.map.orientation,
                showTerrain: this.map.showTerrain,
                showTraffic: this.map.showTraffic,
                showWeather: this.map.showWeather,
                showAirways: this.map.showAirways
            };
            localStorage.setItem('gtn750-state', JSON.stringify(state));
        } catch (e) {
            // Silently fail if localStorage is unavailable
        }
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
            userWaypoints: this.userWaypoints,
            onWaypointChanged: () => this.flightPlanManager?.updateWaypointDisplay(this.data, this.cdiManager),
            onDirectToActivated: () => {
                if (this.pageManager) this.pageManager.switchPage('map');
            },
            onInsertComplete: () => {
                if (this.pageManager) this.pageManager.switchPage('fpl');
            },
            onCdiSourceSwitch: (source, reason) => this.handleCdiSourceSwitch(source, reason),
            onFlightPlanChanged: (plan) => {
                this.fplPage?.update(plan);
            }
        });

        // Initialize fuel monitor (needs flight plan manager reference)
        this.fuelMonitor = new GTNFuelMonitor({
            core: this.core,
            serverPort: this.serverPort,
            flightPlanManager: this.flightPlanManager
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
            system: 'pages/page-system.js',
            taxi: 'pages/page-taxi.js',
            'user-wpt': 'pages/page-user-wpt.js'
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
            nearbyAirways: this.nearbyAirways,
            flightPlan: this.flightPlanManager?.flightPlan || null,
            activeWaypointIndex: this.flightPlanManager?.activeWaypointIndex || 0,
            activeWaypoint: this.flightPlanManager?.activeWaypoint || null,
            obs: this.cdiManager.obs,
            nav1: this.cdiManager.nav1,
            nav2: this.cdiManager.nav2,
            gps: this.cdiManager.gps,
            vnavManager: this.vnavManager,
            holdingManager: this.holdingManager,
            fuelMonitor: this.fuelMonitor,
            procedurePreview: this.procedurePreview || null,
            systemSettings: this.systemPage?.getSettings() || {},
            destinationRunways: this.destinationRunways,
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
        // Always update data model immediately — map renderer reads this on its own RAF loop
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

        // Check if destination changed and fetch runway data
        this._updateDestinationRunways();

        // Auto Zoom logic
        this._updateAutoZoom();

        // Always update CDI nav data (critical for navigation accuracy)
        this.cdiManager.updateNav1(d);
        this.cdiManager.updateNav2(d);
        this.cdiManager.updateGps(d);

        // Mark sim time available
        if (d.zuluTime) this.dataHandler?.setHasSimTime(true);

        // Throttle the UI/module update cascade to 5Hz (200ms)
        this._uiThrottle.throttle(() => this._updateUI());
    }

    /**
     * Perform all UI/module updates (called at throttled rate)
     */
    _updateUI() {
        this.dataHandler?.updateUI(this.data, this.cdiManager.nav1);
        this.xpdrControl?.update(this.data);
        this.flightPlanManager?.setPosition(this.data.latitude, this.data.longitude);
        this.flightPlanManager?.setGroundSpeed(this.data.groundSpeed);
        if (this.fplPage) {
            this.fplPage.aircraftData = { latitude: this.data.latitude, longitude: this.data.longitude };
            this.fplPage.magvar = this.data.magvar || 0;
        }
        this.flightPlanManager?.updateWaypointDisplay(this.data, this.cdiManager);

        if (this.taxiPage) {
            this.taxiPage.update(this.data);
            if (this.pageManager?.getCurrentPageId() === 'taxi') {
                this.taxiPage.render();
            }
        }

        const gpsNav = this.flightPlanManager?.calculateGpsNavigation(this.data.latitude, this.data.longitude);
        const vnav = gpsNav ? this.flightPlanManager?.calculateVNav(this.data.altitude, gpsNav.distance) : null;

        this.cdiManager.updateFromSource({
            flightPlan: this.flightPlanManager?.flightPlan || null,
            activeWaypointIndex: this.flightPlanManager?.activeWaypointIndex || 0,
            data: this.data,
            gpsNav: gpsNav,
            vnav: vnav
        });
        this.flightPlanManager?.checkWaypointSequencing(this.data, this.cdiManager.obs.suspended);
        this.flightPlanManager?.checkApproachPhase(this.data);
        this.holdingManager?.update(this.data);
        this.checkHoldingPattern();
        this.fuelMonitor?.update(this.data, this.flightPlanManager?.flightPlan);
        this.altitudeAlerts?.update(this.data);

        if (this.tcas && this.trafficOverlay) {
            const trafficList = Array.from(this.trafficOverlay.targets.values());
            const ownShip = {
                latitude: this.data.latitude,
                longitude: this.data.longitude,
                altitude: this.data.altitude,
                heading: this.data.heading,
                track: this.data.groundTrack,
                groundSpeed: this.data.groundSpeed,
                verticalSpeed: this.data.verticalSpeed
            };
            this.tcas.update(trafficList, ownShip);
        }

        if (this.flightLogger) {
            this.flightLogger.update(this.data);
            if (this.flightPlanManager?.flightPlan) {
                this.flightLogger.updateFlightPlan(this.flightPlanManager.flightPlan);
            }
        }

        this.updateApproachPhaseDisplay();
        this.updateIlsDisplay();
        this.updateFuelDisplay();
        this.updateAltitudeDisplay();
        this.updateTCASDisplay();
        this.updateTimerDisplay();
        this.updateAuxData();

        if (this.taxiPage) {
            if (this.pageManager?.activePage === 'taxi') {
                this.taxiPage.render();
            }
        }

        if (this.frequencyTuner) {
            this.frequencyTuner.update(this.data);
        }
    }

    /**
     * Update destination runway data for runway extensions overlay
     * Fetches runway info when destination airport changes
     */
    async _updateDestinationRunways() {
        if (!this.flightPlanManager?.flightPlan?.waypoints?.length) {
            this.destinationRunways = null;
            this._lastDestinationIcao = null;
            return;
        }

        const waypoints = this.flightPlanManager.flightPlan.waypoints;
        const destination = waypoints[waypoints.length - 1];

        // Only fetch if destination changed and it's an airport
        if (!destination.icao || destination.icao === this._lastDestinationIcao) return;
        if (destination.type && destination.type !== 'airport') return;

        this._lastDestinationIcao = destination.icao;

        try {
            const res = await fetch(`/api/navdb/airport/${destination.icao}/runways`);
            if (!res.ok) {
                this.destinationRunways = null;
                return;
            }

            const runways = await res.json();

            // Transform to format needed by renderer: { lat, lon, heading, name }
            this.destinationRunways = runways.map(rwy => ({
                lat: rwy.lat || rwy.latitude || destination.lat,
                lon: rwy.lon || rwy.longitude || destination.lng,
                heading: parseFloat(rwy.heading || rwy.true_heading || 0),
                name: rwy.name || rwy.runway_name || rwy.ident || '??'
            }));

            GTNCore.log(`[GTN750] Loaded ${this.destinationRunways.length} runways for ${destination.icao}`);
        } catch (e) {
            GTNCore.log(`[GTN750] Failed to fetch runways for ${destination.icao}: ${e.message}`, 'WARN');
            this.destinationRunways = null;
        }
    }

    /**
     * Auto Zoom — automatically adjusts map range to show next waypoint
     * Per Garmin GTN750Xi Pilot's Guide section 3-11
     * Resumes when: waypoint sequences, ground→air transition, or manual zoom matches auto range
     */
    _updateAutoZoom() {
        const settings = this.systemPage?.getSettings();
        if (!settings?.autoZoom) return;

        const activeIndex = this.flightPlanManager?.activeWaypointIndex;
        const waypoints = this.flightPlanManager?.flightPlan?.waypoints;

        if (!waypoints || activeIndex === undefined || activeIndex >= waypoints.length) {
            this._autoZoomActive = false;
            return;
        }

        // Resume auto zoom when waypoint sequences
        if (activeIndex !== this._lastAutoZoomWaypointIndex) {
            this._autoZoomOverridden = false;
            this._lastAutoZoomWaypointIndex = activeIndex;
        }

        // Resume auto zoom when manual zoom matches calculated auto zoom range
        const nextWp = waypoints[activeIndex];
        if (nextWp && this._autoZoomOverridden) {
            const distance = GTNCore.distance(
                this.data.latitude, this.data.longitude,
                nextWp.lat, nextWp.lng
            );
            const idealRange = this._calculateAutoZoomRange(distance, settings);
            if (Math.abs(this.map.range - idealRange) < 0.1) {
                this._autoZoomOverridden = false;
            }
        }

        if (this._autoZoomOverridden) return;

        // Calculate ideal range to show next waypoint
        if (!nextWp) return;

        const distance = GTNCore.distance(
            this.data.latitude, this.data.longitude,
            nextWp.lat, nextWp.lng
        );

        const newRange = this._calculateAutoZoomRange(distance, settings);

        if (newRange !== this.map.range) {
            this.map.range = newRange;
            if (this.mapControls) {
                this.mapControls.setRange(this.map.range);
            }
            this._autoZoomActive = true;
        }
    }

    /**
     * Calculate auto zoom range based on distance to next waypoint
     */
    _calculateAutoZoomRange(distance, settings) {
        const minRange = settings.autoZoomMin || 2;
        const maxRange = settings.autoZoomMax || 100;

        // Find smallest range that fits the waypoint with 20% margin
        const targetDistance = distance * 1.2;

        for (const range of this.map.ranges) {
            if (range >= targetDistance && range >= minRange && range <= maxRange) {
                return range;
            }
        }

        // Default to max if waypoint is beyond max range
        return Math.min(maxRange, this.map.ranges[this.map.ranges.length - 1]);
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
     * Update approach phase display based on current flight plan state
     */
    updateApproachPhaseDisplay() {
        if (!this.elements.cdiApproachPhase) return;

        const approachStatus = this.flightPlanManager?.getApproachStatus();
        if (!approachStatus || !approachStatus.phase) {
            this.elements.cdiApproachPhase.style.display = 'none';
            return;
        }

        const phase = approachStatus.phase;
        let displayText = '';
        let className = '';

        switch (phase) {
            case 'TERM':
                displayText = 'TERM';
                className = 'term';
                break;
            case 'APR':
                displayText = 'APR';
                className = 'apr';
                break;
            case 'FAF':
                displayText = `FAF: ${approachStatus.fafIdent || '---'}`;
                className = 'faf';
                break;
            case 'MAP':
                displayText = `MAP: ${approachStatus.mapIdent || '---'}`;
                className = 'map';
                break;
            case 'MISSED':
                displayText = 'MISSED APPR';
                className = 'missed';
                break;
            default:
                this.elements.cdiApproachPhase.style.display = 'none';
                return;
        }

        this.elements.cdiApproachPhase.textContent = displayText;
        this.elements.cdiApproachPhase.className = `cdi-approach-phase ${className}`;
        this.elements.cdiApproachPhase.style.display = '';
    }

    /**
     * Update ILS frequency display for ILS/LOC approaches
     */
    updateIlsDisplay() {
        if (!this.elements.cdiApproachType) return;

        const ilsInfo = this.flightPlanManager?.getIlsInfo();
        if (!ilsInfo) {
            this.elements.cdiApproachType.style.display = 'none';
            return;
        }

        const freq = ilsInfo.frequency.toFixed(2);
        const runway = ilsInfo.runway || '';
        const tuned = ilsInfo.autoTuned ? '✓' : '';

        this.elements.cdiApproachType.textContent = `ILS ${freq} ${tuned}`;
        this.elements.cdiApproachType.className = ilsInfo.autoTuned ? 'cdi-approach-type ils' : 'cdi-approach-type';
        this.elements.cdiApproachType.style.display = '';
    }

    updateFuelDisplay() {
        const fuelRemaining = document.getElementById('fuel-remaining');
        const fuelEndurance = document.getElementById('fuel-endurance');
        const fuelState = document.getElementById('fuel-state');

        if (!fuelRemaining || !fuelEndurance || !fuelState || !this.fuelMonitor) return;

        const status = this.fuelMonitor.getStatus();

        // Update fuel remaining
        fuelRemaining.textContent = status.fuelRemaining.toFixed(1);
        fuelRemaining.style.color = status.stateColor;

        // Update endurance
        fuelEndurance.textContent = status.enduranceStr;

        // Update state indicator
        fuelState.className = `fuel-state-indicator ${status.state}`;
        fuelState.style.color = status.stateColor;
    }

    updateAltitudeDisplay() {
        const altStatusLabel = document.getElementById('alt-status-label');
        const altState = document.getElementById('alt-state');

        if (!altStatusLabel || !altState || !this.altitudeAlerts) return;

        const status = this.altitudeAlerts.getStatus();

        // Update status label
        altStatusLabel.textContent = status.stateLabel || '---';
        altStatusLabel.style.color = status.stateColor;

        // Update state indicator
        altState.className = `alt-state-indicator ${status.state}`;
        altState.style.color = status.stateColor;
    }

    handleAltitudeAlert(type, message, level) {
        // Show visual notification (reuse sequence notification element for now)
        const notify = document.getElementById('cdi-sequence-notify');
        if (!notify) return;

        notify.textContent = message;
        notify.style.display = '';
        notify.style.background = level === 'critical' ? 'rgba(255, 0, 0, 0.9)' :
                                   level === 'warning' ? 'rgba(255, 170, 0, 0.9)' :
                                   level === 'success' ? 'rgba(0, 255, 0, 0.9)' :
                                   'rgba(0, 255, 255, 0.9)';

        // Clear after 3 seconds
        if (this._altAlertTimer) {
            clearTimeout(this._altAlertTimer);
        }
        this._altAlertTimer = setTimeout(() => {
            notify.style.display = 'none';
            notify.style.background = ''; // Reset to default
        }, 3000);
    }

    /**
     * Update TCAS display
     */
    updateTCASDisplay() {
        if (!this.tcas || !this.elements.tcasStatusLabel || !this.elements.tcasState || !this.elements.tcasCount) {
            return;
        }

        const status = this.tcas.getStatus();

        // Update status label
        this.elements.tcasStatusLabel.textContent = status.statusLabel;

        // Update state indicator color
        this.elements.tcasState.style.color = status.statusColor;
        this.elements.tcasState.className = 'tcas-state-indicator';

        if (status.hasRA) {
            this.elements.tcasState.classList.add('ra');
        } else if (status.hasTA) {
            this.elements.tcasState.classList.add('ta');
        } else if (status.threatCount > 0) {
            this.elements.tcasState.classList.add('traffic');
        } else {
            this.elements.tcasState.classList.add('clear');
        }

        // Update traffic count
        this.elements.tcasCount.textContent = status.threatCount;
    }

    /**
     * Handle TCAS alert
     * @param {string} type - 'TA' or 'RA'
     * @param {string} message - Alert message
     * @param {string} level - Alert level
     * @param {Object} threat - Threat object
     */
    handleTCASAlert(type, message, level, threat) {
        // Show visual notification
        const notify = document.getElementById('cdi-sequence-notify');
        if (!notify) return;

        notify.textContent = message.toUpperCase();
        notify.style.display = '';
        notify.style.fontSize = '16px';
        notify.style.fontWeight = '700';
        notify.style.background = type === 'RA' ? 'rgba(255, 0, 0, 0.95)' : 'rgba(255, 255, 0, 0.90)';

        // Clear after duration (RA stays longer)
        const duration = type === 'RA' ? 5000 : 3000;

        if (this._tcasAlertTimer) {
            clearTimeout(this._tcasAlertTimer);
        }
        this._tcasAlertTimer = setTimeout(() => {
            notify.style.display = 'none';
            notify.style.fontSize = '';
            notify.style.fontWeight = '';
            notify.style.background = '';
        }, duration);

        // Log alert
        GTNCore.log(`[GTN750] TCAS ${type}: ${message}`);
    }

    /**
     * Update flight timer display
     */
    updateTimerDisplay() {
        if (!this.flightLogger || !this.elements.timerPhase || !this.elements.timerHobbs) {
            return;
        }

        const status = this.flightLogger.getStatus();
        const timers = status.timers;

        // Update phase label with color
        this.elements.timerPhase.textContent = status.phaseLabel;
        this.elements.timerPhase.className = 'timer-phase-label';
        this.elements.timerPhase.classList.add(status.phase.toLowerCase().replace('_', '-'));
        this.elements.timerPhase.style.color = status.phaseColor;

        // Update Hobbs time
        this.elements.timerHobbs.textContent = timers.hobbsTimeStr;
    }

    /**
     * Handle flight phase change
     * @param {string} newPhase - New flight phase
     * @param {string} oldPhase - Previous flight phase
     */
    handleFlightPhaseChange(newPhase, oldPhase) {
        GTNCore.log(`[GTN750] Flight phase: ${oldPhase} → ${newPhase}`);

        // Show notification for significant phase changes
        if (newPhase === 'TAKEOFF') {
            this.showSequenceNotification('', 'TAKEOFF');
        } else if (newPhase === 'LANDING') {
            this.showSequenceNotification('', 'LANDING');
        }
    }

    /**
     * Handle frequency change
     * @param {string} radio - Radio name (com1, com2, nav1, nav2)
     * @param {string} type - 'active', 'standby', or 'swap'
     * @param {number} frequency - New frequency
     */
    handleFrequencyChange(radio, type, frequency) {
        GTNCore.log(`[GTN750] ${radio} ${type}: ${frequency.toFixed(3)}`);

        // Update display elements if they exist
        const activeEl = document.getElementById(radio);
        const standbyEl = document.getElementById(`${radio}-stby`);

        if (this.frequencyTuner) {
            const active = this.frequencyTuner.getFrequency(radio, 'active');
            const standby = this.frequencyTuner.getFrequency(radio, 'standby');
            const radioType = radio.startsWith('com') ? 'com' : 'nav';

            if (activeEl) activeEl.textContent = this.frequencyTuner.formatFrequency(active, radioType);
            if (standbyEl) standbyEl.textContent = this.frequencyTuner.formatFrequency(standby, radioType);
        }
    }

    /**
     * Show visual notification when waypoint sequencing occurs
     * @param {string} passedIdent - Waypoint that was passed
     * @param {string} activeIdent - New active waypoint
     */
    showSequenceNotification(passedIdent, activeIdent) {
        this.notification.showSequenceNotification(passedIdent, activeIdent);
    }

    /**
     * Show ILS auto-tune notification
     * @param {Object} data - { frequency, runway, airport }
     */
    showIlsTunedNotification(data) {
        this.notification.showIlsTunedNotification(data);
    }

    /**
     * Handle CDI source switch request from flight plan manager
     * @param {string} source - 'GPS'|'NAV1'|'NAV2'
     * @param {string} reason - Reason for switch (e.g., 'ILS approach at FAF')
     */
    handleCdiSourceSwitch(source, reason) {
        if (!this.cdiManager) return;

        const prevSource = this.cdiManager.navSource;
        if (prevSource === source) return; // Already on this source

        // Switch CDI source
        this.cdiManager.setNavSource(source);

        // Show notification
        this.showCdiSourceNotification(source, reason);

        GTNCore.log(`[GTN750] CDI source switched: ${prevSource} → ${source} (${reason})`);
    }

    /**
     * Show CDI source switch notification
     * @param {string} source - 'GPS'|'NAV1'|'NAV2'
     * @param {string} reason - Reason for switch
     */
    showCdiSourceNotification(source, reason) {
        const notify = this.elements.cdiIlsNotify; // Reuse ILS notify element
        if (!notify) return;

        let message = `CDI: ${source}`;
        if (reason) message += ` - ${reason}`;

        notify.textContent = message;
        notify.style.display = '';

        // Clear any existing timeout
        if (this._cdiSourceNotifyTimer) {
            clearTimeout(this._cdiSourceNotifyTimer);
        }

        // Hide after 2.5s
        this._cdiSourceNotifyTimer = setTimeout(() => {
            notify.style.display = 'none';
            this._cdiSourceNotifyTimer = null;
        }, 2500);
    }

    /**
     * Check for holding pattern at active waypoint and enter if found
     */
    checkHoldingPattern() {
        if (!this.flightPlanManager || !this.holdingManager) return;

        // Don't auto-enter if already in a hold
        if (this.holdingManager.active) return;

        // Check if active waypoint is a holding pattern
        const holdParams = this.flightPlanManager.getActiveHoldingPattern();
        if (!holdParams) return;

        // Calculate distance to hold fix
        const distToFix = this.core.calculateDistance(
            this.data.latitude, this.data.longitude,
            holdParams.fix.lat, holdParams.fix.lon
        );

        // Enter hold when within 2nm of fix
        if (distToFix < 2.0) {
            this.holdingManager.enterHold(holdParams, this.data.heading, this.data.altitude);
            GTNCore.log(`[GTN750] Auto-entering holding pattern at ${holdParams.fix.ident}`);
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
                    this.saveState();
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
                        frequencyTuner: this.frequencyTuner,
                        onProcedureSelect: (proc, type, waypoints) => this.handleProcedureSelect(proc, type, waypoints),
                        onProcedureLoad: (proc, type, waypoints) => this.handleProcedureLoad(proc, type, waypoints)
                    });
                }
                break;
            case 'aux':
                if (!this.auxPage && typeof AuxPage !== 'undefined') {
                    this.auxPage = new AuxPage({ core: this.core });
                    // Connect flight logger to AUX page
                    if (this.flightLogger) {
                        this.auxPage.setFlightLogger(this.flightLogger);
                    }
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
                        frequencyTuner: this.frequencyTuner,
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
            case 'taxi':
                if (!this.taxiPage && typeof SafeTaxiPage !== 'undefined') {
                    this.taxiPage = new SafeTaxiPage({
                        core: this.core,
                        serverPort: this.serverPort
                    });
                }
                break;
            case 'user-wpt':
                if (!this.userWptPage && typeof UserWaypointsPage !== 'undefined') {
                    this.userWptPage = new UserWaypointsPage({
                        core: this.core,
                        serverPort: this.serverPort,
                        userWaypoints: this.userWaypoints,
                        onDirectTo: (wp) => this.flightPlanManager?.directTo(wp),
                        onAddToFPL: (wp) => this.flightPlanManager?.insertWaypoint(wp)
                    });
                }
                break;
        }
    }

    handleSettingChange(key, value) {
        switch (key) {
            case 'mapOrientation': this.map.orientation = value; this.saveState(); break;
            case 'showTerrain': this.map.showTerrain = value; this.saveState(); break;
            case 'showTraffic': this.map.showTraffic = value; this.saveState(); break;
            case 'showWeather': this.map.showWeather = value; this.saveState(); break;
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
        if (this.flightPlanManager) {
            this.flightPlanManager.loadProcedure(type, proc, waypoints);

            // Switch to FPL page to show loaded procedure
            if (this.pageManager) {
                this.pageManager.switchPage('fpl');
            }
        } else {
            GTNCore.log('[GTN750] Flight plan manager not available');
        }

        // Auto-enable VNAV if approach has altitude constraints
        if (type === 'apr' && waypoints?.some(wp => wp.altitude && wp.altitudeConstraint)) {
            if (this.vnavManager && !this.vnavManager.enabled) {
                GTNCore.log('[GTN750] Auto-enabling VNAV for approach with altitude constraints');
                this.vnavManager.setEnabled(true);

                // Update UI
                if (this.elements.vnavToggle) {
                    this.elements.vnavToggle.textContent = 'ON';
                    this.elements.vnavToggle.classList.add('active');
                }
                if (this.elements.vnavDisplay) {
                    this.elements.vnavDisplay.style.display = 'block';
                }
            }
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

        const pages = ['map', 'fpl', 'wpt', 'nrst', 'proc', 'terrain', 'traffic', 'wx', 'charts', 'aux', 'system', 'taxi', 'user-wpt'];
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
        this.currentPage = pageId;
        this.saveState();

        const title = this.elements.pageTitle;
        if (title) {
            const titles = {
                map: 'MAP', fpl: 'FLIGHT PLAN', wpt: 'WAYPOINT',
                nrst: 'NEAREST', proc: 'PROCEDURES', terrain: 'TERRAIN',
                traffic: 'TRAFFIC', wx: 'WEATHER', charts: 'CHARTS',
                aux: 'AUX', system: 'SYSTEM', taxi: 'SAFETAXI', 'user-wpt': 'USER WAYPOINTS'
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

            // Restore auto-saved flight plan
            if (this.flightPlanManager) {
                this.flightPlanManager.restoreFlightPlan();

                // Start auto-save timer (every 30s)
                if (!this._autoSaveTimer) {
                    this._autoSaveTimer = setInterval(() => {
                        if (this.flightPlanManager) {
                            this.flightPlanManager.autoSaveFlightPlan();
                        }
                    }, 30000);
                }
            }

            // Start server poll if no SimBrief plan is active
            if (this.flightPlanManager && this.flightPlanManager.flightPlan?.source !== 'simbrief') {
                this.flightPlanManager.fetchFlightPlan();
            }
        }

        // Lazy load page-specific modules
        if (['fpl', 'proc', 'charts', 'nrst', 'aux', 'system', 'taxi', 'user-wpt'].includes(pageId)) {
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
        if (pageId === 'taxi') {
            if (this.taxiPage) {
                this.taxiPage.init();
                this.taxiPage.update(this.data);
                this.taxiPage.render();
            }
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
        if (pageId === 'user-wpt') {
            if (this.userWptPage) {
                this.userWptPage.init();
                this.userWptPage.setPosition(this.data.latitude, this.data.longitude);
                this.userWptPage.render();
            }
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
            if (this.weatherOverlay) this.weatherOverlay.stopAutoRefresh();
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
            const hasPos = this.data.latitude !== 0 || this.data.longitude !== 0;
            if (hasPos) {
                this.weatherOverlay.fetchNearbyMetars(this.data.latitude, this.data.longitude);
                this.weatherOverlay.fetchTaf(this.data.latitude, this.data.longitude, this.weatherRange || 50);
            }
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

    /**
     * Detect device size and apply device-* class to the root element.
     * Runs on init and on every resize event.
     */
    _applyDeviceSize() {
        const root = this.elements.root || document.querySelector('.gtn750');
        if (!root) return;
        const size = typeof PlatformUtils !== 'undefined'
            ? PlatformUtils.applyDeviceSize(root)
            : (() => {
                const w = window.innerWidth;
                const isTouch = navigator.maxTouchPoints > 0;
                const s = isTouch && w >= 600 ? 'tablet' : isTouch && w < 600 ? 'phone' : 'desktop';
                root.classList.remove('device-phone', 'device-tablet', 'device-desktop');
                root.classList.add(`device-${s}`);
                return s;
            })();
        GTNCore.log(`[GTN750] Device size: ${size} (${window.innerWidth}x${window.innerHeight})`);
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
            this.weatherOverlay.startAutoRefresh(this.data.latitude, this.data.longitude);
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
            if (wx.some(w => (w.raw || w).includes('TS') || (w.raw || w).includes('GR'))) { iconEl.textContent = '⛈️'; textEl.textContent = 'Storm'; }
            else if (wx.some(w => (w.raw || w).includes('SN'))) { iconEl.textContent = '🌨️'; textEl.textContent = 'Snow'; }
            else if (wx.some(w => (w.raw || w).includes('RA') || (w.raw || w).includes('DZ'))) { iconEl.textContent = '🌧️'; textEl.textContent = 'Rain'; }
            else if (wx.some(w => (w.raw || w).includes('FG'))) { iconEl.textContent = '🌫️'; textEl.textContent = 'Fog'; }
            else if (wx.some(w => (w.raw || w).includes('BR') || (w.raw || w).includes('HZ'))) { iconEl.textContent = '🌁'; textEl.textContent = 'Haze'; }
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
            html += `<div class="wx-sd-row">Wx: <b>${wx.map(w => w.raw || w).join(', ')}</b></div>`;
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
            } else if (msg.type === 'ils-tuned') {
                // Show ILS auto-tune notification
                this.showIlsTunedNotification(msg.data);
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
            cdiApproachPhase: document.getElementById('cdi-approach-phase'),
            cdiIlsNotify: document.getElementById('cdi-ils-notify'),
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
            altAssigned: document.getElementById('alt-assigned'),
            tcasStatusLabel: document.getElementById('tcas-status-label'),
            tcasState: document.getElementById('tcas-state'),
            tcasCount: document.getElementById('tcas-count'),
            timerPhase: document.getElementById('timer-phase'),
            timerHobbs: document.getElementById('timer-hobbs'),
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
            airwaysToggle: document.getElementById('airways-toggle'),
            vnavVdev: document.getElementById('vnav-vdev'),
            vnavReqvs: document.getElementById('vnav-reqvs'),
            vnavTgtalt: document.getElementById('vnav-tgtalt'),
            vnavNext: document.getElementById('vnav-next'),
            lat: document.getElementById('lat'),
            lon: document.getElementById('lon'),
            navIls: document.getElementById('nav-ils'),
            gcGpsDot: document.getElementById('gc-gps-dot'),
            gcGpsLbl: document.getElementById('gc-gps-lbl')
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

        // Frequency swaps (use frequency tuner)
        this.elements.swapCom1?.addEventListener('click', () => this.frequencyTuner?.swapFrequencies('com1'));
        this.elements.swapCom2?.addEventListener('click', () => this.frequencyTuner?.swapFrequencies('com2'));
        this.elements.swapNav1?.addEventListener('click', () => this.frequencyTuner?.swapFrequencies('nav1'));
        this.elements.swapNav2?.addEventListener('click', () => this.frequencyTuner?.swapFrequencies('nav2'));

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

        // Airways toggle button
        this.elements.airwaysToggle?.addEventListener('click', () => this.toggleAirways());

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

        // Altitude alerts
        this.elements.altAssigned?.addEventListener('change', (e) => {
            const altitude = parseFloat(e.target.value);
            if (!isNaN(altitude) && altitude > 0) {
                this.altitudeAlerts.setAssignedAltitude(altitude);
            } else {
                this.altitudeAlerts.setAssignedAltitude(null);
            }
        });
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
            case 'fpl-airway': if (this.fplPage) this.fplPage.onInsertAirway(); break;
            case 'fpl-move-up': if (this.fplPage) this.fplPage.onMoveUp(); break;
            case 'fpl-move-down': if (this.fplPage) this.fplPage.onMoveDown(); break;
            case 'fpl-invert': if (this.fplPage) this.fplPage.onInvert(); break;
            case 'fpl-clear': this.showClearFlightPlanConfirm(); break;
            case 'fly-plan': this.sendFlightPlanToAutopilot(); break;
            case 'save-fpl': this.showSaveFlightPlanModal(); break;
            case 'load-fpl': this.showLoadFlightPlanModal(); break;
            case 'fpl-info': this.showFlightPlanInfoModal(); break;
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
            case 'aux-logbook': if (this.auxPage) this.auxPage.showSubpage('logbook'); break;
            case 'logbook-export': if (this.auxPage) this.auxPage.exportLogbook(); break;
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
            case 'toggle-vnav':
                this.toggleVNav();
                break;
            case 'taxi-load':
                if (this.taxiPage && this.taxiPage.elements.airportInput) {
                    this.taxiPage.elements.airportInput.focus();
                }
                break;
            case 'taxi-center':
                if (this.taxiPage) {
                    this.taxiPage.diagram?.centerOnOwnship();
                    this.taxiPage.render();
                }
                break;
            case 'taxi-auto':
                if (this.taxiPage) {
                    this.taxiPage.diagram?.centerOnAirport();
                    this.taxiPage.diagram?.autoScale();
                    this.taxiPage.render();
                }
                break;
            case 'taxi-zoom-in':
                if (this.taxiPage) {
                    this.taxiPage.diagram?.zoom(1.5);
                    this.taxiPage.render();
                }
                break;
            case 'taxi-zoom-out':
                if (this.taxiPage) {
                    this.taxiPage.diagram?.zoom(0.67);
                    this.taxiPage.render();
                }
                break;
            case 'taxi-satellite':
                if (this.taxiPage && this.taxiPage.elements.satelliteBtn) {
                    this.taxiPage.elements.satelliteBtn.click();
                }
                break;
            case 'user-wpt-new':
                if (this.userWptPage) {
                    this.userWptPage.showNewForm();
                }
                break;
            case 'user-wpt-import':
                if (this.userWptPage && this.userWptPage.elements.importBtn) {
                    this.userWptPage.elements.importBtn.click();
                }
                break;
            case 'user-wpt-export':
                if (this.userWptPage) {
                    this.userWptPage.exportWaypoints();
                }
                break;
            case 'user-wpt-add-fpl':
                if (this.userWptPage && this.userWptPage.selectedWaypoint) {
                    this.userWptPage.triggerAddToFPL(this.userWptPage.selectedWaypoint);
                }
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

    showSaveFlightPlanModal() {
        const modal = document.getElementById('save-fpl-modal');
        if (!modal) return;

        const filenameInput = document.getElementById('save-fpl-filename');
        const formatSelect = document.getElementById('save-fpl-format');
        const infoDiv = document.getElementById('save-fpl-info');

        // Generate default filename
        if (filenameInput && this.flightPlanManager?.flightPlan?.waypoints) {
            const wp = this.flightPlanManager.flightPlan.waypoints;
            const origin = wp[0]?.ident || 'WPT';
            const dest = wp[wp.length - 1]?.ident || 'END';
            filenameInput.value = `${origin}-${dest}`;
        }

        if (infoDiv) infoDiv.textContent = '';

        modal.style.display = 'block';

        // Wire up buttons
        const saveBtn = document.getElementById('save-fpl-btn');
        const cancelBtn = document.getElementById('save-fpl-cancel');

        const closeModal = () => modal.style.display = 'none';

        saveBtn.onclick = () => {
            const filename = filenameInput?.value || 'flight-plan';
            const format = formatSelect?.value || 'fpl';

            const success = this.flightPlanManager?.saveFlightPlan(filename, format);

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

        loadBtn.onclick = async () => {
            const file = fileInput?.files[0];

            if (!file) {
                if (infoDiv) infoDiv.textContent = 'Please select a file';
                return;
            }

            if (infoDiv) infoDiv.textContent = `Loading ${file.name}...`;

            const success = await this.flightPlanManager?.loadFlightPlan(file);

            if (success) {
                // Add to recent plans
                const filename = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
                this.flightPlanManager?.addToRecentPlans(filename);

                if (infoDiv) infoDiv.textContent = `Loaded ${file.name}`;
                setTimeout(() => closeModal(), 1000);

                // Refresh FPL page if visible
                if (this.fplPage) this.fplPage.render();
            } else {
                if (infoDiv) infoDiv.textContent = 'Failed to load flight plan';
            }
        };

        cancelBtn.onclick = closeModal;
    }

    switchLoadTab(tabName) {
        const modal = document.getElementById('load-fpl-modal');
        if (!modal) return;

        // Update tab buttons
        const tabs = modal.querySelectorAll('.fpl-load-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Show/hide tab content
        const recentTab = document.getElementById('recent-plans-tab');
        const fileTab = document.getElementById('file-load-tab');

        if (recentTab) recentTab.style.display = tabName === 'recent' ? 'block' : 'none';
        if (fileTab) fileTab.style.display = tabName === 'file' ? 'block' : 'none';
    }

    renderRecentPlans() {
        const list = document.getElementById('recent-plans-list');
        const empty = document.getElementById('recent-plans-empty');
        if (!list || !empty) return;

        const recent = this.flightPlanManager?.getRecentPlans() || [];

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
                const success = this.flightPlanManager?.activateRecentPlan(index);
                if (success) {
                    document.getElementById('load-fpl-modal').style.display = 'none';
                    if (this.fplPage) this.fplPage.render();
                }
            };

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'recent-plan-btn delete';
            deleteBtn.textContent = '✕';
            deleteBtn.title = 'Delete from recent';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.flightPlanManager?.deleteRecentPlan(index);
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
        if (!modal || !this.flightPlanManager) return;

        // Get current groundspeed and fuel burn rate (use live fuelFlow when sim running)
        const groundSpeed = this.data?.groundSpeed || 120;
        const fuelBurnRate = (this.data?.fuelFlow > 0) ? this.data.fuelFlow : 8.5;

        // Calculate statistics
        const stats = this.flightPlanManager.getFlightPlanStatistics(groundSpeed, fuelBurnRate, this.data?.magvar || 0);

        if (!stats) {
            alert('No flight plan loaded');
            return;
        }

        // Update summary section
        document.getElementById('fpl-info-dist').textContent = `${stats.totalDistance.toFixed(1)} NM`;

        const hours = Math.floor(stats.totalETE / 60);
        const minutes = Math.round(stats.totalETE % 60);
        document.getElementById('fpl-info-ete').textContent = `${hours}:${minutes.toString().padStart(2, '0')}`;

        document.getElementById('fpl-info-fuel').textContent =
            `${stats.totalFuel.total} GAL (${stats.totalFuel.trip} + ${stats.totalFuel.reserve} rsv)`;

        document.getElementById('fpl-info-alt').textContent =
            stats.maxAltitude ? `${stats.maxAltitude.toLocaleString()} FT` : 'N/A';

        document.getElementById('fpl-info-wpts').textContent = stats.waypointCount;

        // Update groundspeed and burn rate display
        document.getElementById('fpl-info-gs').textContent = Math.round(groundSpeed);
        document.getElementById('fpl-info-burn').textContent = fuelBurnRate;

        // Populate leg details table
        const tbody = document.getElementById('fpl-info-legs');
        tbody.innerHTML = '';

        stats.legs.forEach((leg, index) => {
            const row = document.createElement('tr');
            if (leg.isActive) row.classList.add('active');

            const isLast = index === stats.legs.length - 1;

            // Waypoint ident
            const wptCell = document.createElement('td');
            wptCell.className = isLast ? 'wpt-last' : 'wpt-ident';
            wptCell.textContent = leg.ident;
            row.appendChild(wptCell);

            // Leg distance
            const legCell = document.createElement('td');
            legCell.textContent = isLast ? '---' : `${leg.legDistance.toFixed(1)}`;
            row.appendChild(legCell);

            // Course
            const crsCell = document.createElement('td');
            crsCell.textContent = leg.bearing !== null ? `${Math.round(leg.bearing)}°` : '---';
            row.appendChild(crsCell);

            // Cumulative distance
            const cumulCell = document.createElement('td');
            cumulCell.textContent = `${leg.cumulativeDistance.toFixed(1)}`;
            row.appendChild(cumulCell);

            // Cumulative ETE
            const eteCell = document.createElement('td');
            const eteHours = Math.floor(leg.cumulativeTime / 60);
            const eteMinutes = Math.round(leg.cumulativeTime % 60);
            eteCell.textContent = `${eteHours}:${eteMinutes.toString().padStart(2, '0')}`;
            row.appendChild(eteCell);

            tbody.appendChild(row);
        });

        // Show modal
        modal.style.display = 'block';

        // Wire up close button
        const closeBtn = document.getElementById('fpl-info-close');
        closeBtn.onclick = () => modal.style.display = 'none';
    }

    showClearFlightPlanConfirm() {
        const modal = document.getElementById('fpl-clear-confirm-modal');
        if (!modal) return;

        // Check if there's actually a flight plan to clear
        if (!this.flightPlanManager?.flightPlan?.waypoints?.length) {
            return;
        }

        // Show modal
        modal.style.display = 'block';

        // Wire up buttons
        const confirmBtn = document.getElementById('fpl-clear-confirm');
        const cancelBtn = document.getElementById('fpl-clear-cancel');

        const closeModal = () => {
            modal.style.display = 'none';
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        confirmBtn.onclick = () => {
            if (this.fplPage) {
                this.fplPage.confirmClear();
            }
            closeModal();
        };

        cancelBtn.onclick = closeModal;
    }

    sendFlightPlanToAutopilot() {
        if (!this.flightPlanManager?.flightPlan?.waypoints?.length) {
            alert('No flight plan loaded');
            return;
        }

        // Validate flight plan first
        this.showValidationModal(() => {
            const plan = this.flightPlanManager.flightPlan;
            const wps = plan.waypoints;

            // Prepare flight plan data for autopilot
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
                totalDistance: this.flightPlanManager.calculateTotalDistance()
            };

            // Send via SafeChannel
            if (this.syncChannel) {
                this.syncChannel.postMessage({
                    type: 'execute-flight-plan',
                    data: autopilotPlan,
                    source: 'GTN750'
                });

                // Visual confirmation
                const msg = `AI Autopilot engaged\nFlying: ${autopilotPlan.name}\n${wps.length} waypoints`;
                alert(msg);

                GTNCore.log(`[GTN750] Sent flight plan to AI Autopilot: ${autopilotPlan.name}`);
            } else {
                alert('SafeChannel not available\nOpen AI Autopilot pane first');
            }
        });
    }

    showValidationModal(onProceed) {
        if (!this.flightPlanValidator || !this.flightPlanManager?.flightPlan) {
            // No validator or no plan, proceed directly
            if (onProceed) onProceed();
            return;
        }

        // Run validation
        const validation = this.flightPlanValidator.validateFlightPlan(
            this.flightPlanManager.flightPlan,
            { fuelTotal: this.data.fuelTotal }
        );

        const summary = this.flightPlanValidator.getValidationSummary(validation);

        // If no issues, proceed directly
        if (validation.warnings.length === 0 && validation.errors.length === 0) {
            if (onProceed) onProceed();
            return;
        }

        // Show validation modal
        const modal = document.getElementById('fpl-validation-modal');
        const header = document.getElementById('validation-header');
        const summaryEl = document.getElementById('validation-summary');
        const issuesEl = document.getElementById('validation-issues');
        const proceedBtn = document.getElementById('validation-proceed');
        const reviewBtn = document.getElementById('validation-review');
        const cancelBtn = document.getElementById('validation-cancel');

        if (!modal || !summaryEl || !issuesEl) {
            // Modal not available, proceed
            if (onProceed) onProceed();
            return;
        }

        // Update header color and summary
        summaryEl.className = `validation-summary ${summary.level}`;
        if (summary.level === 'critical') {
            header.style.background = 'var(--gtn-red, #ff0000)';
        } else if (summary.level === 'warning') {
            header.style.background = 'var(--gtn-yellow, #ffaa00)';
        }

        summaryEl.textContent = summary.message + (summary.canProceed ? ' found. Review before proceeding.' : ' must be resolved.');

        // Render issues list
        issuesEl.innerHTML = '';
        const allIssues = [...validation.errors, ...validation.warnings];
        allIssues.forEach(issue => {
            const issueEl = document.createElement('div');
            issueEl.className = `validation-issue ${issue.severity}`;

            const icon = issue.severity === 'critical' ? '❌' : '⚠️';
            const waypointTag = issue.waypointIndex >= 0
                ? `<span class="validation-waypoint">Leg ${issue.waypointIndex + 1}</span>`
                : '';

            issueEl.innerHTML = `
                <div class="validation-issue-header">
                    <span class="validation-icon ${_esc(issue.severity)}">${icon}</span>
                    <span class="validation-message">${_esc(issue.message)}</span>
                    ${waypointTag}
                </div>
                ${issue.details ? `<div class="validation-details">${_esc(issue.details)}</div>` : ''}
            `;
            issuesEl.appendChild(issueEl);
        });

        // Show/hide proceed button based on can proceed
        if (summary.canProceed) {
            proceedBtn.style.display = 'inline-block';
        } else {
            proceedBtn.style.display = 'none';
        }

        // Show modal
        modal.style.display = 'block';

        // Wire up buttons
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
            // Switch to FPL page to review
            if (this.pageManager) {
                this.pageManager.setActivePage('fpl');
            }
        };

        cancelBtn.onclick = closeModal;
    }

    findCruiseAltitude(waypoints) {
        // Find the highest altitude in middle third of flight plan
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

    // ===== AIRWAYS =====

    toggleAirways() {
        this.map.showAirways = !this.map.showAirways;

        // Update toggle button if it exists
        const toggle = document.getElementById('airways-toggle');
        if (toggle) {
            toggle.textContent = this.map.showAirways ? 'ON' : 'OFF';
            toggle.classList.toggle('active', this.map.showAirways);
        }

        // Start/stop airways fetching
        if (this.map.showAirways) {
            this.fetchNearbyAirways();
            this._airwaysFetchTimer = setInterval(() => this.fetchNearbyAirways(), 15000); // Every 15s
        } else {
            if (this._airwaysFetchTimer) {
                clearInterval(this._airwaysFetchTimer);
                this._airwaysFetchTimer = null;
            }
            this.nearbyAirways = [];
        }
    }

    async fetchNearbyAirways() {
        if (!this.map.showAirways || !this.data.latitude || !this.data.longitude) return;

        try {
            const range = Math.max(this.map.range * 2, 100); // Fetch wider area than visible
            const url = `http://${location.hostname}:${this.serverPort}/api/navdb/nearby/airways?lat=${this.data.latitude}&lon=${this.data.longitude}&range=${range}&limit=20`;

            const response = await fetch(url);
            if (!response.ok) {
                GTNCore.log('[GTN750] Airways fetch failed:', response.status);
                return;
            }

            const data = await response.json();
            if (!data.items) return;

            // Fetch fix details for each airway
            const airwaysWithFixes = await Promise.all(
                data.items.map(async (airway) => {
                    try {
                        const fixUrl = `http://${location.hostname}:${this.serverPort}/api/navdb/airway/${airway.ident}`;
                        const fixResponse = await fetch(fixUrl);
                        if (!fixResponse.ok) return null;

                        const fixData = await fixResponse.json();
                        return {
                            ident: airway.ident,
                            type: airway.type,
                            fixes: fixData.fixes
                        };
                    } catch (e) {
                        return null;
                    }
                })
            );

            this.nearbyAirways = airwaysWithFixes.filter(a => a !== null);

        } catch (e) {
            GTNCore.log('[GTN750] Airways fetch error:', e.message);
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

        // Next constraint
        if (this.elements.vnavNext) {
            if (status.nextConstraint) {
                const c = status.nextConstraint;
                const constraint = c.constraint === '@' ? '' : c.constraint;
                this.elements.vnavNext.textContent = `${c.ident} ${constraint}${c.altitude}'`;
            } else {
                this.elements.vnavNext.textContent = '---';
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

    /**
     * Check navigation database currency and display warnings
     */
    async checkDatabaseCurrency() {
        try {
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/navdb/status`);
            if (!response.ok) {
                // Database not available - show warning
                this.showDatabaseWarning('DATABASE NOT AVAILABLE', 'Install navigation database', '#ff6600');
                return;
            }

            const status = await response.json();
            if (!status.available) {
                this.showDatabaseWarning('DATABASE NOT AVAILABLE', 'Run: node tools/navdata/build-navdb.js', '#ff6600');
                return;
            }

            // Parse AIRAC cycle (format: "2602" = 2026 cycle 02)
            const cycle = status.airac_cycle;
            const buildDate = status.build_date;

            if (!cycle || cycle === 'unknown') {
                return; // No cycle info, can't check expiry
            }

            // Extract year and cycle number
            const year = parseInt('20' + cycle.substring(0, 2));
            const cycleNum = parseInt(cycle.substring(2, 4));

            // AIRAC cycles: 28 days each, 13 cycles per year
            // Cycle 01 starts on third Thursday of January
            const cycleStartDate = this.calculateAiracStart(year, cycleNum);
            const cycleEndDate = new Date(cycleStartDate.getTime() + 28 * 24 * 60 * 60 * 1000);
            const now = new Date();

            const daysUntilExpiry = Math.floor((cycleEndDate - now) / (24 * 60 * 60 * 1000));

            // Update status bar AIRAC badge
            const airacWarn = document.getElementById('airac-warn');
            if (airacWarn) {
                if (daysUntilExpiry < 0) {
                    airacWarn.style.display = '';
                    airacWarn.textContent = 'DB EXP';
                    airacWarn.style.color = '#ff4444';
                } else if (daysUntilExpiry <= 7) {
                    airacWarn.style.display = '';
                    airacWarn.textContent = `DB ${daysUntilExpiry}D`;
                    airacWarn.style.color = '#ffaa00';
                } else {
                    airacWarn.style.display = 'none';
                }
            }

            if (daysUntilExpiry < 0) {
                // Expired
                this.showDatabaseWarning(
                    `AIRAC ${cycle} EXPIRED`,
                    `Expired ${Math.abs(daysUntilExpiry)} days ago - Update required`,
                    '#ff0000'
                );
            } else if (daysUntilExpiry <= 7) {
                // Expiring soon
                this.showDatabaseWarning(
                    `AIRAC ${cycle}`,
                    `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
                    '#ffff00'
                );
            } else {
                // Valid - show badge but no warning
                this.showDatabaseBadge(`AIRAC ${cycle}`, `Valid for ${daysUntilExpiry} days`, '#00ff00');
            }

        } catch (e) {
            console.warn('[GTN750] Database currency check failed:', e.message);
        }
    }

    /**
     * Calculate AIRAC cycle effective start date
     * AIRAC follows a fixed 28-day global schedule from a known epoch
     */
    calculateAiracStart(year, cycleNum) {
        // Known reference: AIRAC 2601 = January 22, 2026
        const EPOCH = new Date(Date.UTC(2026, 0, 22)); // 2026-01-22
        const yearDiff = year - 2026;
        const cycleDiff = (yearDiff * 13) + (cycleNum - 1);
        return new Date(EPOCH.getTime() + cycleDiff * 28 * 24 * 60 * 60 * 1000);
    }

    /**
     * Show database warning banner
     */
    showDatabaseWarning(title, message, color) {
        // Create warning banner if it doesn't exist
        let banner = document.getElementById('db-warning-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'db-warning-banner';
            banner.className = 'db-warning-banner';
            banner.style.cssText = `
                position: fixed;
                top: 60px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                background: rgba(0, 0, 0, 0.95);
                border: 2px solid ${color};
                border-radius: 4px;
                padding: 8px 16px;
                font-family: Consolas, monospace;
                font-size: 11px;
                color: ${color};
                box-shadow: 0 0 12px ${color}88;
                animation: pulse 2s infinite;
            `;
            document.body.appendChild(banner);

            // Add pulse animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
            `;
            document.head.appendChild(style);
        }

        banner.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 2px;">${title}</div>
            <div style="font-size: 9px; opacity: 0.8;">${message}</div>
        `;
        banner.style.borderColor = color;
        banner.style.color = color;
        banner.style.boxShadow = `0 0 12px ${color}88`;

        // Add UPDATE button for expired/expiring databases
        if (!banner.querySelector('.db-update-btn')) {
            const btn = document.createElement('button');
            btn.className = 'db-update-btn';
            btn.textContent = 'UPDATE DATABASE';
            btn.style.cssText = `
                display: block; margin-top: 6px; padding: 3px 10px;
                background: transparent; border: 1px solid ${color}; color: ${color};
                font-family: Consolas, monospace; font-size: 9px; cursor: pointer;
                border-radius: 2px;
            `;
            btn.addEventListener('click', () => this.startDatabaseUpdate());
            banner.appendChild(btn);
        }
    }

    /**
     * Show database status badge (non-intrusive)
     */
    showDatabaseBadge(title, message, color) {
        // Add small badge to PROC/WPT pages instead of banner
        const badge = document.createElement('div');
        badge.id = 'db-status-badge';
        badge.className = 'db-status-badge';
        badge.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 9999;
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid ${color};
            border-radius: 3px;
            padding: 4px 8px;
            font-family: Consolas, monospace;
            font-size: 8px;
            color: ${color};
            opacity: 0.7;
        `;
        badge.textContent = title;
        badge.title = message;

        const existing = document.getElementById('db-status-badge');
        if (existing) existing.remove();
        document.body.appendChild(badge);
    }

    /**
     * Start AIRAC database update via backend
     */
    async startDatabaseUpdate() {
        const baseUrl = `http://${location.hostname}:${this.serverPort}`;
        try {
            const res = await fetch(`${baseUrl}/api/navdb/update`, { method: 'POST' });
            if (res.status === 409) {
                return; // Already running
            }
            if (!res.ok) {
                this.showDatabaseWarning('UPDATE FAILED', `Server returned ${res.status}`, '#ff0000');
                return;
            }
            // Start polling
            this.showDatabaseWarning('UPDATING', 'Downloading FAA CIFP data...', '#00ffff');
            // Disable the update button
            const btn = document.querySelector('.db-update-btn');
            if (btn) { btn.disabled = true; btn.textContent = 'UPDATING...'; }

            this._updatePollTimer = setInterval(() => this.pollUpdateStatus(), 1000);
        } catch (e) {
            this.showDatabaseWarning('UPDATE FAILED', e.message, '#ff0000');
        }
    }

    /**
     * Poll backend for AIRAC update progress
     */
    async pollUpdateStatus() {
        const baseUrl = `http://${location.hostname}:${this.serverPort}`;
        try {
            const res = await fetch(`${baseUrl}/api/navdb/update-status`);
            const job = await res.json();

            if (job.status === 'complete') {
                clearInterval(this._updatePollTimer);
                this._updatePollTimer = null;
                // Remove banner, re-check currency
                const banner = document.getElementById('db-warning-banner');
                if (banner) banner.remove();
                this.checkDatabaseCurrency();
            } else if (job.status === 'error') {
                clearInterval(this._updatePollTimer);
                this._updatePollTimer = null;
                this.showDatabaseWarning('UPDATE FAILED', job.message || 'Unknown error', '#ff0000');
            } else {
                // Still running — update banner text
                this.showDatabaseWarning('UPDATING', job.message || job.status, '#00ffff');
                const btn = document.querySelector('.db-update-btn');
                if (btn) { btn.disabled = true; btn.textContent = `${job.progress || 0}%`; }
            }
        } catch (e) {
            // Network error during poll — keep trying
        }
    }

    destroy() {
        if (this._updatePollTimer) {
            clearInterval(this._updatePollTimer);
            this._updatePollTimer = null;
        }
        if (this.mapRenderer) this.mapRenderer.stop();
        if (this.dataHandler) this.dataHandler.destroy();
        if (this.flightPlanManager) this.flightPlanManager.destroy();
        if (this.xpdrControl) this.xpdrControl.destroy();
        if (this._uiThrottle) this._uiThrottle.destroy();

        // Stop airways fetching
        if (this._airwaysFetchTimer) {
            clearInterval(this._airwaysFetchTimer);
            this._airwaysFetchTimer = null;
        }

        // Stop auto-save timer
        if (this._autoSaveTimer) {
            clearInterval(this._autoSaveTimer);
            this._autoSaveTimer = null;
        }

        // Destroy page instances
        if (this.taxiPage) this.taxiPage.destroy();
        if (this.userWptPage) this.userWptPage.destroy();

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
        const validPages = ['map', 'fpl', 'wpt', 'nrst', 'proc', 'terrain', 'traffic', 'wx', 'charts', 'aux', 'system', 'taxi', 'user-wpt'];
        if (validPages.includes(hash)) {
            setTimeout(() => window.gtn750.pageManager.switchPage(hash), 100);
        }
    }
}
