/**
 * GTN750 GPS Widget - Full Garmin Feature Set
 * Modular architecture with page manager and soft keys
 */

class GTN750Widget {
    constructor() {
        this.ws = null;
        this.reconnectDelay = 3000;
        this.serverPort = 8080;

        // Initialize core utilities
        this.core = new GTNCore();

        // Aircraft data
        this.data = {
            latitude: 0,
            longitude: 0,
            altitude: 0,
            groundSpeed: 0,
            heading: 0,
            track: 0,
            verticalSpeed: 0,
            com1Active: 118.00,
            com1Standby: 118.00,
            com2Active: 118.00,
            com2Standby: 118.00,
            nav1Active: 108.00,
            nav1Standby: 108.00,
            transponder: 1200,
            zuluTime: 0,
            // Navigation source
            navSource: 'GPS'
        };

        // NAV radio data
        this.nav1 = { cdi: 0, obs: 0, radial: 0, toFrom: 2, signal: 0, gsi: 0, gsFlag: true, hasLoc: false, hasGs: false };
        this.nav2 = { cdi: 0, obs: 0, radial: 0, toFrom: 2, signal: 0, gsi: 0, gsFlag: true };
        this.gps = { cdi: 0, xtrk: 0, dtk: 0, obs: 0, vertError: 0, approachMode: false };

        // Map settings
        this.map = {
            range: 10,
            ranges: [2, 5, 10, 20, 50, 100, 200],
            orientation: 'track', // 'north', 'track', 'heading'
            showTerrain: false,
            showTraffic: false,
            showWeather: false
        };

        // Data field configuration (corner fields on map)
        this.dataFields = {
            'top-left': 'trk',
            'top-right': 'gs',
            'bottom-left': 'alt',
            'bottom-right': 'ete'
        };
        this.activeFieldPosition = null; // Currently selected field for editing

        // Flight plan
        this.flightPlan = null;
        this.activeWaypointIndex = 0;

        // CDI (extended for GPS/NAV source switching)
        this.cdi = {
            source: 'GPS',
            needle: 0,        // -127 to +127 deflection
            dtk: 0,           // Desired track
            xtrk: 0,          // Cross track error in NM
            toFrom: 2,        // 0=From, 1=To, 2=None
            gsNeedle: 0,      // Glideslope deflection -119 to +119
            gsValid: false,   // Glideslope signal valid
            signalValid: true // NAV signal valid
        };

        // TAWS
        this.taws = { active: true, inhibited: false };

        // Overlays (initialized after canvas setup)
        this.terrainOverlay = null;
        this.mapControls = null;

        // Pan offset for map
        this.panOffset = { x: 0, y: 0 };

        // Cross-widget sync
        this.syncChannel = new BroadcastChannel('simwidget-sync');
        this.initSyncListener();

        this.init();
    }

    init() {
        this.cacheElements();
        this.setupCanvas();
        this.initOverlays();
        this.initPageManager();
        this.initSoftKeys();
        this.bindEvents();
        this.bindTawsAlerts();
        this.loadDataFieldConfig();
        this.connect();
        this.startClock();
        this.fetchFlightPlan();
        this.startMapRender();
        this.startTrafficPolling();
    }

    initOverlays() {
        // Initialize terrain overlay
        this.terrainOverlay = new TerrainOverlay({
            core: this.core
        });

        // Initialize traffic overlay
        this.trafficOverlay = new TrafficOverlay({
            core: this.core
        });

        // Initialize weather overlay
        this.weatherOverlay = new WeatherOverlay({
            core: this.core
        });

        // Initialize map controls with touch/gesture support
        if (this.canvas) {
            this.mapControls = new MapControls({
                canvas: this.canvas,
                onRangeChange: (range, delta) => {
                    this.map.range = range;
                    if (this.elements.dfRange) {
                        this.elements.dfRange.textContent = range;
                    }
                },
                onPan: (offset) => {
                    this.panOffset = offset;
                },
                onDataFieldTap: (position, type) => {
                    console.log(`[GTN750] Data field ${position} changed to ${type.type}`);
                }
            });
            this.mapControls.setRange(this.map.range);
        }

        // Initialize procedures page
        this.proceduresPage = new ProceduresPage({
            core: this.core,
            serverPort: this.serverPort,
            onProcedureSelect: (proc, type, waypoints) => {
                this.handleProcedureSelect(proc, type, waypoints);
            },
            onProcedureLoad: (proc, type, waypoints) => {
                this.handleProcedureLoad(proc, type, waypoints);
            }
        });

        // Initialize AUX page utilities
        this.auxPage = new AuxPage({
            core: this.core
        });

        // Initialize Charts page
        this.chartsPage = new ChartsPage({
            core: this.core,
            serverPort: this.serverPort,
            onChartSelect: (chart) => {
                console.log(`[GTN750] Chart selected: ${chart.name}`);
            }
        });

        // Initialize Nearest page
        this.nearestPage = new NearestPage({
            core: this.core,
            serverPort: this.serverPort,
            onItemSelect: (item, type) => {
                console.log(`[GTN750] Nearest ${type} selected: ${item.icao || item.id}`);
            },
            onDirectTo: (item) => {
                this.directTo(item);
            }
        });

        // Initialize System page
        this.systemPage = new SystemPage({
            core: this.core,
            onSettingChange: (key, value) => {
                this.handleSettingChange(key, value);
            }
        });
    }

    handleSettingChange(key, value) {
        // Apply settings changes
        switch (key) {
            case 'mapOrientation':
                this.map.orientation = value;
                break;
            case 'showTerrain':
                this.map.showTerrain = value;
                break;
            case 'showTraffic':
                this.map.showTraffic = value;
                break;
            case 'showWeather':
                this.map.showWeather = value;
                break;
            case 'nightMode':
                document.body.classList.toggle('night-mode', value);
                break;
        }
    }

    handleProcedureSelect(proc, type, waypoints) {
        // Store preview waypoints for map overlay
        this.procedurePreview = {
            procedure: proc,
            type: type,
            waypoints: waypoints
        };
        console.log(`[GTN750] Procedure selected: ${proc.name}`);
    }

    handleProcedureLoad(proc, type, waypoints) {
        // Add procedure to flight plan
        console.log(`[GTN750] Loading procedure: ${proc.name}`);
        this.syncChannel.postMessage({
            type: 'procedure-load',
            data: {
                procedure: proc,
                procedureType: type,
                waypoints: waypoints
            }
        });
    }

    bindTawsAlerts() {
        window.addEventListener('gtn:taws-alert', (e) => {
            this.handleTawsAlert(e.detail);
        });
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

        // Update terrain page status
        if (this.elements.tawsStatus) {
            this.elements.tawsStatus.textContent = this.taws.inhibited ? 'INHIBITED' : 'ACTIVE';
            this.elements.tawsStatus.style.color = this.taws.inhibited ? '#ffcc00' : '#00ff00';
        }
    }

    initPageManager() {
        this.pageManager = new GTNPageManager({
            onPageChange: (pageId, page) => {
                this.onPageChange(pageId);
            }
        });

        // Register page instances (basic registration for now)
        const pages = ['map', 'fpl', 'wpt', 'nrst', 'proc', 'terrain', 'traffic', 'wx', 'charts', 'aux', 'system'];
        pages.forEach(id => {
            this.pageManager.registerPage(id, {
                id,
                onActivate: () => this.onPageActivate(id),
                onDeactivate: () => this.onPageDeactivate(id),
                updateData: (data) => this.updatePageData(id, data)
            });
        });

        // Start on MAP page
        this.pageManager.switchPage('map', false);
    }

    initSoftKeys() {
        this.softKeys = new GTNSoftKeys({
            container: document.getElementById('gtn-softkeys')
        });

        // Set initial context
        this.softKeys.setContext('map');

        // Listen for soft key actions
        window.addEventListener('gtn:softkey', (e) => {
            this.handleSoftKeyAction(e.detail.action, e.detail);
        });
    }

    onPageChange(pageId) {
        // Update page title
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

        // Update soft keys context
        this.softKeys.setContext(pageId);

        // Update tabs
        document.querySelectorAll('.gtn-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.page === pageId);
        });
    }

    onPageActivate(pageId) {
        if (pageId === 'nrst') {
            this.fetchNearestAirports();
        }
        if (pageId === 'proc') {
            if (this.proceduresPage) {
                this.proceduresPage.init();
                // If we have a destination airport, pre-load it
                if (this.flightPlan?.waypoints?.length > 0) {
                    const dest = this.flightPlan.waypoints[this.flightPlan.waypoints.length - 1];
                    if (dest.ident?.length === 4) {
                        this.proceduresPage.setAirport(dest.ident);
                    }
                }
            }
        }
        if (pageId === 'terrain') {
            this.setupTerrainCanvas();
            this.startTerrainPageRender();
        }
        if (pageId === 'traffic') {
            this.setupTrafficCanvas();
            this.startTrafficPageRender();
        }
        if (pageId === 'wx') {
            this.setupWeatherCanvas();
            this.startWeatherPageRender();
        }
        if (pageId === 'aux') {
            if (this.auxPage) {
                this.auxPage.init();
            }
            this.updateAuxPageData();
        }
        if (pageId === 'charts') {
            if (this.chartsPage) {
                this.chartsPage.init();
                // Pre-load destination airport if available
                if (this.flightPlan?.waypoints?.length > 0) {
                    const dest = this.flightPlan.waypoints[this.flightPlan.waypoints.length - 1];
                    if (dest.ident?.length === 4) {
                        this.chartsPage.setAirport(dest.ident);
                    }
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
            if (this.systemPage) {
                this.systemPage.init();
            }
        }
    }

    updateAuxPageData() {
        if (!this.auxPage) return;

        const tripData = this.auxPage.updateTripData(
            { waypoints: this.flightPlan?.waypoints, activeWaypointIndex: this.activeWaypointIndex },
            this.data
        );

        if (tripData) {
            if (this.elements.auxDist) this.elements.auxDist.textContent = `${tripData.remainingDist} NM`;
            if (this.elements.auxTime) this.elements.auxTime.textContent = tripData.timeRemaining;
            if (this.elements.auxEta) this.elements.auxEta.textContent = tripData.eta;
            if (this.elements.auxFuel) this.elements.auxFuel.textContent = `${tripData.fuelRequired} GAL`;
        }
    }

    onPageDeactivate(pageId) {
        // Stop page rendering when leaving
        if (pageId === 'terrain') {
            this.terrainPageRenderActive = false;
        }
        if (pageId === 'traffic') {
            this.trafficPageRenderActive = false;
        }
        if (pageId === 'wx') {
            this.weatherPageRenderActive = false;
        }
    }

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
        // Enable test mode if no real traffic data
        if (this.trafficOverlay) {
            this.trafficOverlay.setEnabled(true);
        }
        const renderLoop = () => {
            if (!this.trafficPageRenderActive) return;
            this.renderTrafficPage();
            requestAnimationFrame(renderLoop);
        };
        renderLoop();
    }

    startWeatherPageRender() {
        this.weatherPageRenderActive = true;
        // Enable all weather layers for weather page
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

    updatePageData(pageId, data) {
        // Update page-specific data
    }

    handleSoftKeyAction(action, detail) {
        switch (action) {
            // Navigation
            case 'go-back':
                if (!this.pageManager.goBack()) {
                    this.pageManager.goHome();
                }
                break;

            // Map toggles
            case 'toggle-terrain':
                this.map.showTerrain = detail.active;
                break;
            case 'toggle-traffic':
                this.map.showTraffic = detail.active;
                break;
            case 'toggle-weather':
                this.map.showWeather = detail.active;
                if (detail.active && this.weatherOverlay) {
                    this.weatherOverlay.startAutoRefresh(this.data.latitude, this.data.longitude);
                } else if (this.weatherOverlay) {
                    this.weatherOverlay.stopAutoRefresh();
                }
                break;
            case 'declutter':
                this.cycleDeclutter();
                break;

            // CDI source selection
            case 'cdi-menu':
                this.softKeys?.setContext('cdi-menu');
                break;
            case 'cdi-source-gps':
                this.setNavSource('GPS');
                this.softKeys?.setContext('map');
                break;
            case 'cdi-source-nav1':
                this.setNavSource('NAV1');
                this.softKeys?.setContext('map');
                break;
            case 'cdi-source-nav2':
                this.setNavSource('NAV2');
                this.softKeys?.setContext('map');
                break;
            case 'obs-inc':
                this.adjustObs(1);
                break;
            case 'obs-dec':
                this.adjustObs(-1);
                break;
            case 'back-menu':
                this.softKeys?.setContext('map');
                break;

            // Map orientation
            case 'map-north-up':
                this.map.orientation = 'north';
                this.updateMapOrientation();
                break;
            case 'map-track-up':
                this.map.orientation = 'track';
                this.updateMapOrientation();
                break;
            case 'map-heading-up':
                this.map.orientation = 'heading';
                this.updateMapOrientation();
                break;

            // FPL actions
            case 'activate-leg':
                this.activateLeg();
                break;
            case 'invert-plan':
                this.invertFlightPlan();
                break;

            // Direct-To
            case 'direct-to':
                this.showDirectTo();
                break;

            // NRST type selection
            case 'nrst-apt':
            case 'nrst-vor':
            case 'nrst-ndb':
            case 'nrst-fix':
                this.switchNearestType(action.split('-')[1]);
                break;

            // TAWS / Terrain
            case 'taws-inhibit':
                this.taws.inhibited = !this.taws.inhibited;
                if (this.terrainOverlay) {
                    this.terrainOverlay.setInhibited(this.taws.inhibited);
                }
                this.updateTawsStatus();
                break;
            case 'terrain-view':
                // Cycle terrain view modes
                this.cycleTerrainView();
                break;
            case 'terrain-360':
                this.setTerrainView('360');
                break;
            case 'terrain-arc':
                this.setTerrainView('arc');
                break;
            case 'terrain-range':
                this.cycleTerrainRange();
                break;

            // Procedures
            case 'proc-departure':
                if (this.proceduresPage) this.proceduresPage.switchType('dep');
                break;
            case 'proc-arrival':
                if (this.proceduresPage) this.proceduresPage.switchType('arr');
                break;
            case 'proc-approach':
                if (this.proceduresPage) this.proceduresPage.switchType('apr');
                break;
            case 'load-proc':
                if (this.proceduresPage) this.proceduresPage.loadProcedure();
                break;
            case 'preview-proc':
                this.previewProcedure();
                break;
            case 'view-proc-chart':
                if (this.proceduresPage) this.proceduresPage.viewChart();
                break;

            // AUX page
            case 'aux-trip':
                this.showAuxSubpage('trip');
                break;
            case 'aux-util':
                this.showAuxSubpage('util');
                break;
            case 'aux-timer':
                this.toggleAuxTimer();
                break;
            case 'aux-calc':
                this.showAuxSubpage('calc');
                break;

            // Traffic
            case 'traffic-operate':
            case 'traffic-standby':
            case 'traffic-test':
                this.setTrafficMode(action.split('-')[1]);
                break;

            // Weather overlays
            case 'wx-nexrad':
            case 'wx-metar':
            case 'wx-taf':
            case 'wx-winds':
            case 'wx-lightning':
                this.toggleWeatherLayer(action.split('-')[1]);
                break;

            // Charts actions
            case 'view-chart':
                if (this.chartsPage) this.chartsPage.viewChart();
                break;
            case 'open-chartfox':
                if (this.chartsPage) this.chartsPage.openChartFox();
                break;
            case 'chart-apt':
            case 'chart-iap':
            case 'chart-dp':
            case 'chart-star':
                if (this.chartsPage) {
                    const type = action.split('-')[1].toUpperCase();
                    this.chartsPage.filterByType(type === 'APT' ? 'APD' : type);
                }
                break;

            // System actions
            case 'sys-reset':
                if (this.systemPage) this.systemPage.resetToDefaults();
                break;
            case 'sys-north-up':
                this.map.orientation = 'north';
                if (this.systemPage) this.systemPage.setSetting('mapOrientation', 'north');
                break;
            case 'sys-track-up':
                this.map.orientation = 'track';
                if (this.systemPage) this.systemPage.setSetting('mapOrientation', 'track');
                break;
            case 'sys-night-mode':
                if (this.systemPage) {
                    const current = this.systemPage.getSetting('nightMode');
                    this.systemPage.setSetting('nightMode', !current);
                }
                break;

            default:
                console.log(`[GTN750] Unhandled soft key action: ${action}`);
        }
    }

    initSyncListener() {
        this.syncChannel.onmessage = (event) => {
            const { type, data } = event.data;
            if (type === 'route-update' && data.waypoints) {
                this.flightPlan = data;
                this.renderFlightPlan();
            }
            if (type === 'waypoint-select') {
                this.selectWaypoint(data.index);
            }
        };
    }

    cacheElements() {
        this.elements = {
            // Header
            pageTitle: document.getElementById('page-title'),
            btnHome: document.getElementById('btn-home'),
            btnDirect: document.getElementById('btn-direct'),
            // Connection status
            conn: document.getElementById('conn'),
            // Map elements
            mapCanvas: document.getElementById('map-canvas'),
            zoomIn: document.getElementById('zoom-in'),
            zoomOut: document.getElementById('zoom-out'),
            tawsAlert: document.getElementById('taws-alert'),
            tawsText: document.getElementById('taws-text'),
            // Datafields
            dfGs: document.getElementById('df-gs'),
            dfTrk: document.getElementById('df-trk'),
            dfAlt: document.getElementById('df-alt'),
            dfRange: document.getElementById('df-range'),
            // Waypoint strip
            wptId: document.getElementById('wpt-id'),
            wptDis: document.getElementById('wpt-dis'),
            wptBrg: document.getElementById('wpt-brg'),
            wptEte: document.getElementById('wpt-ete'),
            // CDI (extended)
            cdiNeedle: document.getElementById('cdi-needle'),
            cdiDtk: document.getElementById('cdi-dtk'),
            cdiXtrk: document.getElementById('cdi-xtrk'),
            cdiSource: document.getElementById('cdi-source'),
            cdiToFrom: document.getElementById('cdi-tofrom'),
            cdiGsNeedle: document.getElementById('cdi-gs-needle'),
            cdiGsBar: document.getElementById('cdi-gs-bar'),
            cdiFlag: document.getElementById('cdi-flag'),
            // OBS Control
            obsValue: document.getElementById('obs-value'),
            obsInc: document.getElementById('obs-inc'),
            obsDec: document.getElementById('obs-dec'),
            obsControls: document.getElementById('obs-controls'),
            // Nav Source Selector
            navSourceGps: document.getElementById('nav-source-gps'),
            navSourceNav1: document.getElementById('nav-source-nav1'),
            navSourceNav2: document.getElementById('nav-source-nav2'),
            // FPL
            fplDep: document.getElementById('fpl-dep'),
            fplArr: document.getElementById('fpl-arr'),
            fplDist: document.getElementById('fpl-dist'),
            fplEte: document.getElementById('fpl-ete'),
            fplList: document.getElementById('fpl-list'),
            fplProgress: document.getElementById('fpl-progress'),
            // WPT
            wptSearch: document.getElementById('wpt-search'),
            wptGo: document.getElementById('wpt-go'),
            wptInfo: document.getElementById('wpt-info'),
            // NRST
            nrstList: document.getElementById('nrst-list'),
            // PROC
            procApt: document.getElementById('proc-apt'),
            procList: document.getElementById('proc-list'),
            // Terrain
            terrainCanvas: document.getElementById('terrain-canvas'),
            tawsStatus: document.getElementById('taws-status'),
            terrainMode: document.getElementById('terrain-mode'),
            terrainRange: document.getElementById('terrain-range'),
            terrainClearance: document.getElementById('terrain-clearance'),
            // Traffic
            trafficCanvas: document.getElementById('traffic-canvas'),
            trafficMode: document.getElementById('traffic-mode'),
            trafficCount: document.getElementById('traffic-count'),
            // Weather
            wxCanvas: document.getElementById('wx-canvas'),
            wxNexrad: document.getElementById('wx-nexrad'),
            wxMetar: document.getElementById('wx-metar'),
            wxMetarText: document.getElementById('wx-metar-text'),
            // Charts
            chartApt: document.getElementById('chart-apt'),
            chartSearch: document.getElementById('chart-search'),
            chartList: document.getElementById('chart-list'),
            // AUX
            auxDist: document.getElementById('aux-dist'),
            auxTime: document.getElementById('aux-time'),
            auxEta: document.getElementById('aux-eta'),
            auxFuel: document.getElementById('aux-fuel'),
            // System
            sysMapOrient: document.getElementById('sys-map-orient'),
            sysGpsStatus: document.getElementById('sys-gps-status'),
            // Frequencies
            com1: document.getElementById('com1'),
            com1Stby: document.getElementById('com1-stby'),
            com2: document.getElementById('com2'),
            com2Stby: document.getElementById('com2-stby'),
            nav1: document.getElementById('nav1'),
            nav1Stby: document.getElementById('nav1-stby'),
            swapCom1: document.getElementById('swap-com1'),
            swapCom2: document.getElementById('swap-com2'),
            swapNav1: document.getElementById('swap-nav1'),
            xpdr: document.getElementById('xpdr'),
            utcTime: document.getElementById('utc-time'),
            // Tabs
            tabs: document.querySelectorAll('.gtn-tab')
        };
    }

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
            canvas.width = rect.width;
            canvas.height = rect.height;
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
        if (canvas) {
            this.wxCtx = canvas.getContext('2d');
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
        }
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    bindEvents() {
        // Home button
        this.elements.btnHome?.addEventListener('click', () => this.pageManager.goHome());

        // Direct-To button
        this.elements.btnDirect?.addEventListener('click', () => this.showDirectTo());

        // Frequency swaps
        this.elements.swapCom1?.addEventListener('click', () => this.swapFrequency('COM1'));
        this.elements.swapCom2?.addEventListener('click', () => this.swapFrequency('COM2'));
        this.elements.swapNav1?.addEventListener('click', () => this.swapFrequency('NAV1'));

        // Zoom controls
        this.elements.zoomIn?.addEventListener('click', () => this.changeRange(-1));
        this.elements.zoomOut?.addEventListener('click', () => this.changeRange(1));

        // Nav source buttons
        this.elements.navSourceGps?.addEventListener('click', () => this.setNavSource('GPS'));
        this.elements.navSourceNav1?.addEventListener('click', () => this.setNavSource('NAV1'));
        this.elements.navSourceNav2?.addEventListener('click', () => this.setNavSource('NAV2'));

        // OBS controls
        this.elements.obsInc?.addEventListener('click', () => this.adjustObs(1));
        this.elements.obsDec?.addEventListener('click', () => this.adjustObs(-1));
        this.elements.obsValue?.addEventListener('click', () => {
            const currentObs = this.cdi.source === 'NAV1' ? this.nav1.obs : this.nav2.obs;
            const newObs = prompt('Enter OBS course (0-359):', Math.round(currentObs));
            if (newObs !== null && !isNaN(newObs)) {
                this.setObs(parseInt(newObs) % 360);
            }
        });

        // Tab navigation
        this.elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const pageId = tab.dataset.page;
                if (pageId) this.pageManager.switchPage(pageId);
            });
        });

        // WPT search
        this.elements.wptGo?.addEventListener('click', () => this.searchWaypoint());
        this.elements.wptSearch?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchWaypoint();
        });

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
        this.elements.chartApt?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchCharts();
        });

        // Chart actions
        document.getElementById('chart-view')?.addEventListener('click', () => {
            if (this.chartsPage) this.chartsPage.viewChart();
        });
        document.getElementById('chart-fox')?.addEventListener('click', () => {
            if (this.chartsPage) this.chartsPage.openChartFox();
        });

        // System reset
        document.getElementById('sys-reset')?.addEventListener('click', () => {
            if (this.systemPage) this.systemPage.resetToDefaults();
        });

        // System map orientation
        this.elements.sysMapOrient?.addEventListener('change', (e) => {
            this.map.orientation = e.target.value;
        });

        // Data field customization - corner fields
        document.querySelectorAll('.corner-field').forEach(field => {
            field.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openFieldSelector(field);
            });
        });

        // Field selector options
        document.querySelectorAll('.field-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = option.dataset.type;
                this.selectFieldType(type);
            });
        });

        // Close field selector on outside click
        document.addEventListener('click', () => {
            this.closeFieldSelector();
        });

        // Note: wheel/touch events now handled by MapControls
    }

    // ===== MAP RENDERING =====
    startMapRender() {
        this.renderMap();
        requestAnimationFrame(() => this.startMapRender());
    }

    renderMap() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Apply pan offset
        const cx = w / 2 + this.panOffset.x;
        const cy = h / 2 + this.panOffset.y;

        // Clear with background
        ctx.fillStyle = '#0a1520';
        ctx.fillRect(0, 0, w, h);

        // Terrain overlay using TerrainOverlay class
        if (this.map.showTerrain && this.terrainOverlay) {
            this.terrainOverlay.setEnabled(true);
            this.terrainOverlay.setInhibited(this.taws.inhibited);
            this.terrainOverlay.render(ctx, {
                latitude: this.data.latitude,
                longitude: this.data.longitude,
                altitude: this.data.altitude,
                heading: this.data.heading,
                verticalSpeed: this.data.verticalSpeed,
                groundSpeed: this.data.groundSpeed
            }, {
                range: this.map.range,
                orientation: this.map.orientation,
                width: w,
                height: h
            });
        } else if (this.terrainOverlay) {
            this.terrainOverlay.setEnabled(false);
        }

        // Weather overlay (render before other elements)
        if (this.map.showWeather && this.weatherOverlay) {
            this.weatherOverlay.setEnabled(true);
            this.weatherOverlay.render(ctx, {
                latitude: this.data.latitude,
                longitude: this.data.longitude,
                altitude: this.data.altitude,
                heading: this.data.heading
            }, {
                range: this.map.range,
                orientation: this.map.orientation,
                width: w,
                height: h,
                heading: this.data.heading
            });
        } else if (this.weatherOverlay) {
            this.weatherOverlay.setEnabled(false);
        }

        // Range rings
        this.renderRangeRings(ctx, cx, cy, w, h);

        // Flight plan route
        if (this.flightPlan?.waypoints) {
            this.renderRoute(ctx, cx, cy, w, h);
        }

        // Traffic overlay (render after route, before aircraft)
        if (this.map.showTraffic && this.trafficOverlay) {
            this.trafficOverlay.setEnabled(true);
            this.trafficOverlay.render(ctx, {
                latitude: this.data.latitude,
                longitude: this.data.longitude,
                altitude: this.data.altitude,
                heading: this.data.heading,
                verticalSpeed: this.data.verticalSpeed,
                groundSpeed: this.data.groundSpeed
            }, {
                range: this.map.range,
                orientation: this.map.orientation,
                width: w,
                height: h
            });
        } else if (this.trafficOverlay) {
            this.trafficOverlay.setEnabled(false);
        }

        // Aircraft symbol (always at center, unaffected by pan)
        this.renderAircraft(ctx, w / 2, h / 2);

        // Compass rose
        this.renderCompass(ctx, w / 2, h / 2, Math.min(w, h) / 2 - 25);

        // Wind vector indicator (top-left corner)
        this.renderWindVector(ctx, 50, 50);

        // Update datafields
        this.updateDatafields();
    }

    renderWindVector(ctx, x, y) {
        const windDir = this.data.windDirection || 0;
        const windSpd = this.data.windSpeed || 0;

        if (windSpd < 1) return; // Don't show if no wind

        ctx.save();

        // Background circle
        ctx.beginPath();
        ctx.arc(x, y, 28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 10, 20, 0.85)';
        ctx.fill();
        ctx.strokeStyle = '#1a3040';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Wind arrow (points in direction wind is coming FROM)
        ctx.translate(x, y);

        // Rotate arrow to show wind direction relative to map
        const mapRotation = this.getMapRotation();
        const arrowAngle = (windDir - mapRotation) * Math.PI / 180;

        ctx.rotate(arrowAngle);

        // Arrow shaft
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(0, 12);
        ctx.stroke();

        // Arrow head (points down - wind coming from)
        ctx.fillStyle = '#00ccff';
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(-6, -10);
        ctx.lineTo(6, -10);
        ctx.closePath();
        ctx.fill();

        // Wind barbs based on speed (simplified)
        if (windSpd >= 5) {
            ctx.beginPath();
            ctx.moveTo(0, 8);
            ctx.lineTo(8, 4);
            ctx.stroke();
        }
        if (windSpd >= 10) {
            ctx.beginPath();
            ctx.moveTo(0, 2);
            ctx.lineTo(10, -2);
            ctx.stroke();
        }
        if (windSpd >= 15) {
            ctx.beginPath();
            ctx.moveTo(0, -4);
            ctx.lineTo(10, -8);
            ctx.stroke();
        }

        ctx.restore();

        // Wind text below
        ctx.font = 'bold 10px Consolas, monospace';
        ctx.fillStyle = '#00ccff';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(windDir)}°`, x, y + 42);
        ctx.fillText(`${Math.round(windSpd)}kt`, x, y + 54);
    }

    renderTerrainPage() {
        // Render dedicated terrain page with full TAWS view
        if (!this.terrainCtx || !this.terrainOverlay) return;

        const canvas = this.elements.terrainCanvas;
        const w = canvas.width;
        const h = canvas.height;

        // Clear
        this.terrainCtx.fillStyle = '#0a1520';
        this.terrainCtx.fillRect(0, 0, w, h);

        // Render terrain view
        const minClearance = this.terrainOverlay.renderTerrainPage(
            this.terrainCtx,
            {
                latitude: this.data.latitude,
                longitude: this.data.longitude,
                altitude: this.data.altitude,
                heading: this.data.heading,
                verticalSpeed: this.data.verticalSpeed,
                groundSpeed: this.data.groundSpeed
            },
            w, h
        );

        // Update clearance display
        if (this.elements.terrainClearance) {
            this.elements.terrainClearance.textContent = minClearance > 0 ? minClearance : '---';
        }

        // Update mode and range displays
        if (this.elements.terrainMode) {
            this.elements.terrainMode.textContent = this.terrainOverlay.getViewMode().toUpperCase();
        }
        if (this.elements.terrainRange) {
            this.elements.terrainRange.textContent = this.terrainOverlay.getRange();
        }
    }

    renderTrafficPage() {
        // Render dedicated traffic page
        if (!this.trafficCtx || !this.trafficOverlay) return;

        const canvas = this.elements.trafficCanvas;
        const w = canvas.width;
        const h = canvas.height;

        // Render traffic view and get count
        const targetCount = this.trafficOverlay.renderTrafficPage(
            this.trafficCtx,
            {
                latitude: this.data.latitude,
                longitude: this.data.longitude,
                altitude: this.data.altitude,
                heading: this.data.heading,
                verticalSpeed: this.data.verticalSpeed,
                groundSpeed: this.data.groundSpeed
            },
            w, h
        );

        // Update display elements
        if (this.elements.trafficCount) {
            this.elements.trafficCount.textContent = targetCount;
        }
        if (this.elements.trafficMode) {
            this.elements.trafficMode.textContent = this.trafficOverlay.getMode();
        }
    }

    renderWeatherPage() {
        // Render dedicated weather page
        if (!this.wxCtx || !this.weatherOverlay) return;

        const canvas = this.elements.wxCanvas;
        const w = canvas.width;
        const h = canvas.height;

        // Render weather view
        this.weatherOverlay.renderWeatherPage(
            this.wxCtx,
            {
                latitude: this.data.latitude,
                longitude: this.data.longitude,
                altitude: this.data.altitude,
                heading: this.data.heading
            },
            w, h
        );

        // Update METAR display - show nearest METAR if available
        if (this.elements.wxMetarText) {
            const metarData = this.weatherOverlay.metarData;
            if (metarData && metarData.size > 0) {
                // Find nearest airport with METAR
                let nearest = null;
                let nearestDist = Infinity;
                metarData.forEach(m => {
                    const dist = this.core.calculateDistance(
                        this.data.latitude, this.data.longitude,
                        m.lat, m.lon
                    );
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearest = m;
                    }
                });
                if (nearest) {
                    this.elements.wxMetarText.textContent = nearest.raw || `${nearest.icao}: ${nearest.category}`;
                } else {
                    this.elements.wxMetarText.textContent = 'No METAR data';
                }
            } else {
                this.elements.wxMetarText.textContent = 'Fetching weather...';
            }
        }
    }

    // Legacy method kept for compatibility
    showTawsAlert(alert) {
        const alertEl = this.elements.tawsAlert;
        const textEl = this.elements.tawsText;
        if (!alertEl || !textEl) return;

        if (alert.level !== 'CLEAR' && alert.color) {
            alertEl.style.display = 'flex';
            alertEl.style.backgroundColor = alert.color;
            textEl.textContent = alert.level.replace('_', ' ');
        } else {
            alertEl.style.display = 'none';
        }
    }

    renderRangeRings(ctx, cx, cy, w, h) {
        const pixelsPerNm = Math.min(w, h) / 2 / this.map.range;
        ctx.strokeStyle = '#1a3040';
        ctx.lineWidth = 1;

        [0.25, 0.5, 0.75, 1].forEach(fraction => {
            const radius = this.map.range * fraction * pixelsPerNm;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    renderRoute(ctx, cx, cy, w, h) {
        const pixelsPerNm = Math.min(w, h) / 2 / this.map.range;
        const waypoints = this.flightPlan.waypoints;
        const rotation = this.getMapRotation();

        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.beginPath();

        let firstPoint = true;
        waypoints.forEach((wp, index) => {
            if (!wp.lat || !wp.lng) return;

            const pos = this.core.latLonToCanvas(
                wp.lat, wp.lng,
                this.data.latitude, this.data.longitude,
                rotation, this.map.range,
                w, h, this.map.orientation === 'north'
            );

            if (firstPoint) {
                ctx.moveTo(pos.x, pos.y);
                firstPoint = false;
            } else {
                ctx.lineTo(pos.x, pos.y);
            }

            this.renderWaypoint(ctx, pos.x, pos.y, wp.ident, index === this.activeWaypointIndex);
        });

        ctx.stroke();
    }

    renderWaypoint(ctx, x, y, ident, isActive) {
        ctx.fillStyle = isActive ? '#ff00ff' : '#00aaff';
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 6);
        ctx.lineTo(x - 5, y);
        ctx.closePath();
        ctx.fill();

        if (ident) {
            ctx.fillStyle = '#00ff00';
            ctx.font = '10px Consolas, monospace';
            ctx.fillText(ident, x + 8, y + 4);
        }
    }

    renderAircraft(ctx, cx, cy) {
        ctx.save();
        ctx.translate(cx, cy);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(-8, 10);
        ctx.lineTo(0, 5);
        ctx.lineTo(8, 10);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    renderCompass(ctx, cx, cy, radius) {
        const rotation = this.getMapRotation();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-rotation * Math.PI / 180);

        ctx.fillStyle = '#0099ff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';

        const dirs = [
            { label: 'N', angle: 0 },
            { label: 'E', angle: 90 },
            { label: 'S', angle: 180 },
            { label: 'W', angle: 270 }
        ];

        dirs.forEach(dir => {
            const angle = dir.angle * Math.PI / 180;
            const x = Math.sin(angle) * (radius - 5);
            const y = -Math.cos(angle) * (radius - 5);
            ctx.fillText(dir.label, x, y + 4);
        });

        ctx.strokeStyle = '#0066aa';
        ctx.lineWidth = 1;
        for (let i = 0; i < 360; i += 30) {
            if (i % 90 === 0) continue;
            const angle = i * Math.PI / 180;
            const inner = radius - 15;
            const outer = radius - 5;
            ctx.beginPath();
            ctx.moveTo(Math.sin(angle) * inner, -Math.cos(angle) * inner);
            ctx.lineTo(Math.sin(angle) * outer, -Math.cos(angle) * outer);
            ctx.stroke();
        }

        ctx.restore();
    }

    getMapRotation() {
        switch (this.map.orientation) {
            case 'north': return 0;
            case 'track': return this.data.track || this.data.heading;
            case 'heading': return this.data.heading;
            default: return this.data.heading;
        }
    }

    updateDatafields() {
        // Update each corner field based on configuration
        const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        positions.forEach(pos => {
            const field = document.querySelector(`.corner-field.${pos}`);
            if (field) {
                const type = this.dataFields[pos];
                const { label, value } = this.getFieldData(type);
                const labelEl = field.querySelector('.corner-label');
                const valueEl = field.querySelector('.corner-value');
                if (labelEl) labelEl.textContent = label;
                if (valueEl) valueEl.textContent = value;
            }
        });

        // Range is always shown in range selector
        if (this.elements.dfRange) this.elements.dfRange.textContent = this.map.range;
    }

    /**
     * Get data for a specific field type
     */
    getFieldData(type) {
        const wp = this.flightPlan?.waypoints?.[this.activeWaypointIndex];
        let dist = 0, brg = 0, ete = 0;

        if (wp && this.data.latitude && wp.lat && wp.lng) {
            dist = this.core.calculateDistance(this.data.latitude, this.data.longitude, wp.lat, wp.lng);
            brg = this.core.calculateBearing(this.data.latitude, this.data.longitude, wp.lat, wp.lng);
            if (this.data.groundSpeed > 0) {
                ete = (dist / this.data.groundSpeed) * 60;
            }
        }

        switch (type) {
            case 'trk':
                return { label: 'TRK', value: this.core.formatHeading(this.data.track || this.data.heading) };
            case 'gs':
                return { label: 'GS', value: Math.round(this.data.groundSpeed) + 'kt' };
            case 'alt':
                return { label: 'ALT', value: this.core.formatAltitude(this.data.altitude) };
            case 'vs':
                return { label: 'VS', value: Math.round(this.data.verticalSpeed) + 'fpm' };
            case 'hdg':
                return { label: 'HDG', value: this.core.formatHeading(this.data.heading) };
            case 'dis':
                return { label: 'DIS', value: dist > 0 ? dist.toFixed(1) + 'nm' : '--.-nm' };
            case 'ete':
                return { label: 'ETE', value: ete > 0 ? this.core.formatEte(ete) : '--:--' };
            case 'brg':
                return { label: 'BRG', value: brg > 0 ? Math.round(brg) + '°' : '---°' };
            case 'dtk':
                return { label: 'DTK', value: this.cdi.dtk ? Math.round(this.cdi.dtk) + '°' : '---°' };
            case 'xtk':
                return { label: 'XTK', value: this.cdi.xtrk ? this.cdi.xtrk.toFixed(1) + 'nm' : '0.0nm' };
            case 'wind':
                const windDir = this.data.windDirection || 0;
                const windSpd = this.data.windSpeed || 0;
                return { label: 'WIND', value: Math.round(windDir) + '°/' + Math.round(windSpd) + 'kt' };
            case 'time':
                return { label: 'TIME', value: this.core.formatTime(this.data.zuluTime) || '--:--Z' };
            case 'off':
                return { label: '', value: '' };
            default:
                return { label: type.toUpperCase(), value: '---' };
        }
    }

    /**
     * Open field selector popup near a corner field
     */
    openFieldSelector(field) {
        const selector = document.getElementById('field-selector');
        if (!selector) return;

        // Determine position from field class
        const classList = field.classList;
        let position = null;
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(pos => {
            if (classList.contains(pos)) position = pos;
        });

        if (!position) return;

        this.activeFieldPosition = position;

        // Position selector near the field
        const rect = field.getBoundingClientRect();
        const parentRect = field.parentElement.getBoundingClientRect();

        selector.style.display = 'block';

        // Position based on which corner
        if (position.includes('left')) {
            selector.style.left = (rect.left - parentRect.left) + 'px';
            selector.style.right = 'auto';
        } else {
            selector.style.right = (parentRect.right - rect.right) + 'px';
            selector.style.left = 'auto';
        }

        if (position.includes('top')) {
            selector.style.top = (rect.bottom - parentRect.top + 5) + 'px';
            selector.style.bottom = 'auto';
        } else {
            selector.style.bottom = (parentRect.bottom - rect.top + 5) + 'px';
            selector.style.top = 'auto';
        }

        // Highlight current selection
        const currentType = this.dataFields[position];
        document.querySelectorAll('.field-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.type === currentType);
        });
    }

    /**
     * Close field selector popup
     */
    closeFieldSelector() {
        const selector = document.getElementById('field-selector');
        if (selector) {
            selector.style.display = 'none';
        }
        this.activeFieldPosition = null;
    }

    /**
     * Select a field type for the active position
     */
    selectFieldType(type) {
        if (!this.activeFieldPosition) return;

        this.dataFields[this.activeFieldPosition] = type;

        // Save to localStorage
        try {
            localStorage.setItem('gtn750-datafields', JSON.stringify(this.dataFields));
        } catch (e) {}

        // Update immediately
        this.updateDatafields();
        this.closeFieldSelector();
    }

    /**
     * Load saved data field configuration
     */
    loadDataFieldConfig() {
        try {
            const saved = localStorage.getItem('gtn750-datafields');
            if (saved) {
                this.dataFields = { ...this.dataFields, ...JSON.parse(saved) };
            }
        } catch (e) {}
    }

    updateMapOrientation() {
        if (this.elements.sysMapOrient) {
            this.elements.sysMapOrient.value = this.map.orientation;
        }
    }

    changeRange(delta) {
        const idx = this.map.ranges.indexOf(this.map.range);
        const newIdx = Math.max(0, Math.min(this.map.ranges.length - 1, idx + delta));
        this.map.range = this.map.ranges[newIdx];
        if (this.elements.dfRange) {
            this.elements.dfRange.textContent = this.map.range;
        }
    }

    cycleDeclutter() {
        // Cycle through declutter levels (0-3)
        // 0: All labels, 1: Hide waypoint labels, 2: Hide range rings, 3: Minimal
        this.declutterLevel = ((this.declutterLevel || 0) + 1) % 4;

        // Apply declutter settings
        const level = this.declutterLevel;
        this.mapSettings = {
            ...this.mapSettings,
            showWaypointLabels: level < 1,
            showRangeRings: level < 2,
            showCompass: level < 3,
            showDataFields: level < 3
        };

        // Update corner field visibility
        document.querySelectorAll('.corner-field').forEach(el => {
            el.style.opacity = level < 3 ? '1' : '0.3';
        });

        console.log(`[GTN750] Declutter level: ${level}`);
    }

    // ===== FREQUENCY SWAP =====
    async swapFrequency(radio) {
        try {
            await fetch(`http://${location.hostname}:${this.serverPort}/api/simconnect/event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: `${radio}_RADIO_SWAP` })
            });
        } catch (e) {
            console.error(`[GTN750] Swap ${radio} failed:`, e);
        }
    }

    // ===== DIRECT-TO =====
    showDirectTo(prefilledIdent = null) {
        const modal = document.getElementById('dto-modal');
        const input = document.getElementById('dto-input');
        const info = document.getElementById('dto-info');
        const activateBtn = document.getElementById('dto-activate');

        if (!modal) return;

        // Reset and show modal
        modal.style.display = 'block';
        input.value = prefilledIdent || '';
        info.innerHTML = '<span class="dto-name">Enter waypoint identifier</span>';
        activateBtn.disabled = true;
        this.dtoTarget = null;

        // Focus input
        setTimeout(() => input.focus(), 50);

        // Setup event handlers
        input.oninput = () => {
            const ident = input.value.toUpperCase().trim();
            if (ident.length >= 2) {
                this.lookupDirectToWaypoint(ident);
            } else {
                info.innerHTML = '<span class="dto-name">Enter waypoint identifier</span>';
                activateBtn.disabled = true;
                this.dtoTarget = null;
            }
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter' && this.dtoTarget) {
                this.activateDirectTo();
            } else if (e.key === 'Escape') {
                this.hideDirectTo();
            }
        };

        // Button handlers
        activateBtn.onclick = () => this.activateDirectTo();
        document.getElementById('dto-cancel').onclick = () => this.hideDirectTo();
    }

    hideDirectTo() {
        const modal = document.getElementById('dto-modal');
        if (modal) modal.style.display = 'none';
    }

    async lookupDirectToWaypoint(ident) {
        const info = document.getElementById('dto-info');
        const activateBtn = document.getElementById('dto-activate');

        try {
            // Try waypoint search API
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/waypoint/${ident}`);
            if (response.ok) {
                const data = await response.json();
                if (data && (data.lat || data.latitude)) {
                    this.dtoTarget = {
                        ident: ident,
                        name: data.name || data.facility_name || ident,
                        lat: data.lat || data.latitude,
                        lon: data.lon || data.longitude,
                        type: data.type || 'WAYPOINT'
                    };

                    // Calculate distance and bearing from current position
                    const dist = this.core.calculateDistance(
                        this.data.latitude, this.data.longitude,
                        this.dtoTarget.lat, this.dtoTarget.lon
                    );
                    const brg = this.core.calculateBearing(
                        this.data.latitude, this.data.longitude,
                        this.dtoTarget.lat, this.dtoTarget.lon
                    );

                    info.innerHTML = `
                        <div class="dto-name">${this.dtoTarget.name}</div>
                        <div class="dto-coords">${this.dtoTarget.type} - ${dist.toFixed(1)}nm @ ${Math.round(brg)}°</div>
                    `;
                    activateBtn.disabled = false;
                    return;
                }
            }
        } catch (e) {
            // Fallback: create waypoint from nearest page item or manual entry
        }

        // Check if it matches a NRST item
        if (this.nearestPage) {
            const item = this.nearestPage.items?.find(i =>
                (i.icao || i.id)?.toUpperCase() === ident
            );
            if (item) {
                this.dtoTarget = {
                    ident: item.icao || item.id,
                    name: item.name || ident,
                    lat: item.lat,
                    lon: item.lon,
                    type: item.type || 'AIRPORT'
                };
                info.innerHTML = `
                    <div class="dto-name">${this.dtoTarget.name}</div>
                    <div class="dto-coords">${item.distance}nm @ ${item.bearing}°</div>
                `;
                activateBtn.disabled = false;
                return;
            }
        }

        // Not found
        info.innerHTML = '<span class="dto-name" style="color: var(--gtn-yellow);">Waypoint not found</span>';
        activateBtn.disabled = true;
        this.dtoTarget = null;
    }

    activateDirectTo() {
        if (!this.dtoTarget) return;

        console.log(`[GTN750] Direct-To activated: ${this.dtoTarget.ident}`);

        // Set as active waypoint
        this.activeWaypoint = this.dtoTarget;

        // Update waypoint display
        if (this.elements.wptId) this.elements.wptId.textContent = this.dtoTarget.ident;
        if (this.elements.wptType) this.elements.wptType.textContent = 'D→';

        // Broadcast to other widgets
        this.syncChannel.postMessage({
            type: 'direct-to',
            data: this.dtoTarget
        });

        // Hide modal
        this.hideDirectTo();

        // Switch to map page
        if (this.pageManager) {
            this.pageManager.switchPage('map');
        }
    }

    directTo(item) {
        // Called from NRST or other pages with a pre-selected item
        if (item) {
            this.dtoTarget = {
                ident: item.icao || item.id,
                name: item.name || item.icao || item.id,
                lat: item.lat,
                lon: item.lon,
                type: item.type || 'WAYPOINT'
            };
            this.activateDirectTo();
        } else {
            this.showDirectTo();
        }
    }

    // ===== FLIGHT PLAN =====
    async fetchFlightPlan() {
        try {
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/flightplan`);
            if (response.ok) {
                const data = await response.json();
                if (data?.waypoints?.length > 0) {
                    this.flightPlan = data;
                    this.renderFlightPlan();
                    this.updateFplHeader();
                }
            }
        } catch (e) {
            console.log('[GTN750] No flight plan');
        }
        setTimeout(() => this.fetchFlightPlan(), 30000);
    }

    updateFplHeader() {
        if (!this.flightPlan) return;
        const wps = this.flightPlan.waypoints;
        if (wps.length > 0) {
            if (this.elements.fplDep) this.elements.fplDep.textContent = wps[0].ident || '----';
            if (this.elements.fplArr) this.elements.fplArr.textContent = wps[wps.length - 1].ident || '----';
        }

        // Calculate total distance
        let totalDist = 0;
        wps.forEach(wp => {
            if (wp.distanceFromPrev) totalDist += wp.distanceFromPrev;
        });
        if (this.elements.fplDist) this.elements.fplDist.textContent = Math.round(totalDist);

        // Calculate ETE
        if (this.data.groundSpeed > 0 && this.elements.fplEte) {
            const eteMin = (totalDist / this.data.groundSpeed) * 60;
            this.elements.fplEte.textContent = this.core.formatEte(eteMin);
        }
    }

    renderFlightPlan() {
        if (!this.elements.fplList) return;
        this.elements.fplList.textContent = '';

        if (!this.flightPlan?.waypoints?.length) {
            const empty = document.createElement('div');
            empty.className = 'gtn-fpl-empty';
            empty.textContent = 'No flight plan loaded';
            this.elements.fplList.appendChild(empty);
            return;
        }

        this.flightPlan.waypoints.forEach((wp, index) => {
            const item = document.createElement('div');
            item.className = 'gtn-fpl-item';
            if (wp.passed) item.classList.add('passed');
            if (index === this.activeWaypointIndex) item.classList.add('active');

            const left = document.createElement('div');
            const ident = document.createElement('div');
            ident.className = 'gtn-fpl-ident';
            ident.textContent = wp.ident || `WP${index + 1}`;
            const type = document.createElement('div');
            type.className = 'gtn-fpl-type';
            type.textContent = wp.type || '';
            left.appendChild(ident);
            left.appendChild(type);

            const right = document.createElement('div');
            right.className = 'gtn-fpl-data';
            const dist = document.createElement('span');
            dist.textContent = wp.distanceFromPrev ? Math.round(wp.distanceFromPrev) + ' NM' : '';
            right.appendChild(dist);

            item.appendChild(left);
            item.appendChild(right);
            item.addEventListener('click', () => this.selectWaypoint(index));
            this.elements.fplList.appendChild(item);
        });

        this.updateFplProgress();
    }

    updateFplProgress() {
        if (!this.elements.fplProgress || !this.flightPlan?.waypoints) return;
        const total = this.flightPlan.waypoints.length;
        const passed = this.flightPlan.waypoints.filter(wp => wp.passed).length;
        const progress = total > 0 ? (passed / total) * 100 : 0;
        this.elements.fplProgress.style.width = progress + '%';
    }

    selectWaypoint(index) {
        this.activeWaypointIndex = index;
        if (this.flightPlan?.waypoints[index]) {
            this.updateWaypointDisplay();
            this.renderFlightPlan();
            this.syncChannel.postMessage({
                type: 'waypoint-select',
                data: { index, ident: this.flightPlan.waypoints[index].ident }
            });
        }
    }

    activateLeg() {
        if (this.activeWaypointIndex < this.flightPlan?.waypoints?.length) {
            // Mark previous waypoints as passed
            for (let i = 0; i < this.activeWaypointIndex; i++) {
                this.flightPlan.waypoints[i].passed = true;
            }
            this.renderFlightPlan();
        }
    }

    invertFlightPlan() {
        if (this.flightPlan?.waypoints) {
            this.flightPlan.waypoints.reverse();
            this.activeWaypointIndex = 0;
            this.renderFlightPlan();
            this.updateFplHeader();
        }
    }

    updateWaypointDisplay() {
        const wp = this.flightPlan?.waypoints[this.activeWaypointIndex];
        if (!wp) return;

        if (this.elements.wptId) this.elements.wptId.textContent = wp.ident || '----';

        if (this.data.latitude && wp.lat && wp.lng) {
            const dist = this.core.calculateDistance(this.data.latitude, this.data.longitude, wp.lat, wp.lng);
            const brg = this.core.calculateBearing(this.data.latitude, this.data.longitude, wp.lat, wp.lng);

            if (this.elements.wptDis) this.elements.wptDis.textContent = dist.toFixed(1);
            if (this.elements.wptBrg) this.elements.wptBrg.textContent = Math.round(brg).toString().padStart(3, '0');

            if (this.data.groundSpeed > 0 && this.elements.wptEte) {
                const eteMin = (dist / this.data.groundSpeed) * 60;
                this.elements.wptEte.textContent = this.core.formatEte(eteMin);
            }

            this.updateCDI(brg, dist);
        }
    }

    updateCDI(bearing, distance) {
        // Legacy GPS-calculated CDI (fallback when no SimConnect data)
        if (this.data.navSource === 'GPS' && !this.gps.dtk) {
            const trackError = this.core.normalizeAngle(bearing - this.data.heading);
            const xtrk = Math.sin(this.core.toRad(trackError)) * distance;
            this.cdi.dtk = Math.round(bearing);
            this.cdi.xtrk = Math.abs(xtrk);
            this.cdi.needle = Math.round(Math.max(-127, Math.min(127, xtrk / 2 * 127)));
            this.renderCdi();
        }
    }

    // ===== CDI SOURCE SWITCHING =====
    updateCdiFromSource() {
        const source = this.data.navSource;

        switch (source) {
            case 'NAV1':
                this.cdi = {
                    source: 'NAV1',
                    needle: this.nav1.cdi,
                    dtk: this.nav1.obs,
                    xtrk: Math.abs(this.nav1.cdi / 127 * 2),
                    toFrom: this.nav1.toFrom,
                    gsNeedle: this.nav1.gsi,
                    gsValid: !this.nav1.gsFlag && this.nav1.hasGs,
                    signalValid: this.nav1.signal > 10
                };
                break;
            case 'NAV2':
                this.cdi = {
                    source: 'NAV2',
                    needle: this.nav2.cdi,
                    dtk: this.nav2.obs,
                    xtrk: Math.abs(this.nav2.cdi / 127 * 2),
                    toFrom: this.nav2.toFrom,
                    gsNeedle: this.nav2.gsi,
                    gsValid: !this.nav2.gsFlag,
                    signalValid: this.nav2.signal > 10
                };
                break;
            case 'GPS':
            default:
                this.cdi = {
                    source: 'GPS',
                    needle: this.gps.cdi,
                    dtk: this.gps.dtk || this.cdi.dtk,
                    xtrk: Math.abs(this.gps.xtrk),
                    toFrom: 1, // GPS always shows TO
                    gsNeedle: Math.round(this.gps.vertError * 40),
                    gsValid: this.gps.approachMode,
                    signalValid: true
                };
        }

        this.renderCdi();
    }

    renderCdi() {
        // Update source indicator
        if (this.elements.cdiSource) {
            this.elements.cdiSource.textContent = this.cdi.source;
            this.elements.cdiSource.className = `cdi-source cdi-source-${this.cdi.source.toLowerCase()}`;
        }

        // Update CDI needle (horizontal deflection)
        if (this.elements.cdiNeedle) {
            const deflectionPercent = (this.cdi.needle / 127) * 40;
            this.elements.cdiNeedle.style.left = `${50 + deflectionPercent}%`;
        }

        // Update TO/FROM indicator
        if (this.elements.cdiToFrom) {
            const toFromLabels = ['FROM', 'TO', '---'];
            this.elements.cdiToFrom.textContent = toFromLabels[this.cdi.toFrom] || '---';
            this.elements.cdiToFrom.className = `cdi-tofrom ${this.cdi.toFrom === 1 ? 'to' : this.cdi.toFrom === 0 ? 'from' : 'none'}`;
        }

        // Update glideslope
        if (this.elements.cdiGsBar) {
            this.elements.cdiGsBar.style.display = this.cdi.gsValid ? 'flex' : 'none';
        }
        if (this.elements.cdiGsNeedle && this.cdi.gsValid) {
            const gsDeflectionPercent = (this.cdi.gsNeedle / 119) * 40;
            this.elements.cdiGsNeedle.style.top = `${50 - gsDeflectionPercent}%`;
        }

        // Update flag (no signal indicator)
        if (this.elements.cdiFlag) {
            this.elements.cdiFlag.style.display = this.cdi.signalValid ? 'none' : 'block';
        }

        // Update DTK and XTK display
        if (this.elements.cdiDtk) {
            this.elements.cdiDtk.textContent = Math.round(this.cdi.dtk).toString().padStart(3, '0');
        }
        if (this.elements.cdiXtrk) {
            this.elements.cdiXtrk.textContent = this.cdi.xtrk.toFixed(1);
        }

        // Update OBS value display
        if (this.elements.obsValue && this.cdi.source !== 'GPS') {
            const obs = this.cdi.source === 'NAV1' ? this.nav1.obs : this.nav2.obs;
            this.elements.obsValue.textContent = Math.round(obs).toString().padStart(3, '0');
        }
    }

    setNavSource(source) {
        this.data.navSource = source;

        // Update UI buttons
        if (this.elements.navSourceGps) this.elements.navSourceGps.classList.toggle('active', source === 'GPS');
        if (this.elements.navSourceNav1) this.elements.navSourceNav1.classList.toggle('active', source === 'NAV1');
        if (this.elements.navSourceNav2) this.elements.navSourceNav2.classList.toggle('active', source === 'NAV2');

        // Update OBS visibility (only show for VOR sources)
        if (this.elements.obsControls) {
            this.elements.obsControls.style.display = source === 'GPS' ? 'none' : 'flex';
        }

        this.updateCdiFromSource();
    }

    async setObs(value) {
        const source = this.data.navSource;
        if (source === 'GPS') return;

        const event = source === 'NAV1' ? 'VOR1_SET' : 'VOR2_SET';
        try {
            await fetch(`http://${location.hostname}:${this.serverPort}/api/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: event, value: Math.round(value) })
            });
        } catch (e) {
            console.error('[GTN750] OBS set failed:', e);
        }
    }

    async adjustObs(delta) {
        const source = this.data.navSource;
        if (source === 'GPS') return;

        const event = delta > 0
            ? (source === 'NAV1' ? 'VOR1_OBI_INC' : 'VOR2_OBI_INC')
            : (source === 'NAV1' ? 'VOR1_OBI_DEC' : 'VOR2_OBI_DEC');

        try {
            await fetch(`http://${location.hostname}:${this.serverPort}/api/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: event })
            });
        } catch (e) {
            console.error('[GTN750] OBS adjust failed:', e);
        }
    }

    // ===== WAYPOINT SEARCH =====
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
        } catch (e) {
            this.displayWaypointInfo(null, ident);
        }
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

    // ===== NEAREST =====
    switchNearestType(type) {
        if (this.nearestPage) {
            this.nearestPage.setPosition(this.data.latitude, this.data.longitude);
            this.nearestPage.switchType(type);
        }
    }

    // ===== PROCEDURES =====
    switchProcType(type) {
        document.querySelectorAll('.proc-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });
        // Would fetch procedures for the selected type
    }

    // ===== CHARTS =====
    async searchCharts() {
        const icao = this.elements.chartApt?.value.toUpperCase().trim();
        if (!icao || icao.length < 3) return;

        if (this.chartsPage) {
            this.chartsPage.searchCharts(icao);
        }
    }

    // ===== PROCEDURES =====
    previewProcedure() {
        if (this.procedurePreview?.waypoints) {
            // Toggle procedure preview on map
            this.showProcedurePreview = !this.showProcedurePreview;
            console.log(`[GTN750] Procedure preview: ${this.showProcedurePreview ? 'ON' : 'OFF'}`);
        } else {
            console.log('[GTN750] No procedure selected for preview');
        }
    }

    // ===== AUX PAGE =====
    showAuxSubpage(subpage) {
        console.log(`[GTN750] AUX subpage: ${subpage}`);
        this.auxSubpage = subpage;
        // Could show different content based on subpage selection
    }

    toggleAuxTimer() {
        if (this.auxPage) {
            this.auxPage.toggleTimer();
            const state = this.auxPage.getTimerState();
            console.log(`[GTN750] Timer ${state.running ? 'started' : 'stopped'}: ${state.formatted}`);
        }
    }

    // ===== TRAFFIC =====
    setTrafficMode(mode) {
        if (this.trafficOverlay) {
            this.trafficOverlay.setMode(mode);
        }
        if (this.elements.trafficMode) {
            this.elements.trafficMode.textContent = mode.toUpperCase();
        }
    }

    // ===== WEATHER =====
    toggleWeatherLayer(layer) {
        if (this.weatherOverlay) {
            const enabled = this.weatherOverlay.toggleLayer(layer);
            console.log(`[GTN750] Weather layer ${layer}: ${enabled ? 'ON' : 'OFF'}`);

            // Update UI checkboxes if present
            const checkbox = document.getElementById(`wx-${layer}`);
            if (checkbox) {
                checkbox.checked = enabled;
            }
        }
    }

    // ===== TAWS =====
    updateTawsStatus() {
        if (this.elements.tawsStatus) {
            this.elements.tawsStatus.textContent = this.taws.inhibited ? 'INHIBITED' : 'ACTIVE';
            this.elements.tawsStatus.style.color = this.taws.inhibited ? '#ffcc00' : '#00ff00';
        }
    }

    cycleTerrainView() {
        if (this.terrainOverlay) {
            const newMode = this.terrainOverlay.toggleViewMode();
            console.log(`[GTN750] Terrain view: ${newMode}`);
        }
    }

    setTerrainView(view) {
        if (this.terrainOverlay) {
            this.terrainOverlay.setViewMode(view);
            console.log(`[GTN750] Terrain view set to: ${view}`);
        }
    }

    cycleTerrainRange() {
        if (this.terrainOverlay) {
            const ranges = [2, 5, 10, 20, 50];
            const current = this.terrainOverlay.getRange();
            const idx = ranges.indexOf(current);
            const newRange = ranges[(idx + 1) % ranges.length];
            this.terrainOverlay.setRange(newRange);
            console.log(`[GTN750] Terrain range: ${newRange} NM`);
        }
    }

    // ===== WEBSOCKET =====
    connect() {
        const host = window.location.hostname || 'localhost';
        const wsUrl = `ws://${host}:${this.serverPort}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('[GTN750] Connected');
            this.elements.conn?.classList.add('connected');
            if (this.elements.sysGpsStatus) {
                this.elements.sysGpsStatus.textContent = '3D FIX';
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'flightData') {
                    this.updateFromSim(msg.data);
                }
            } catch (e) {}
        };

        this.ws.onclose = () => {
            this.elements.conn?.classList.remove('connected');
            if (this.elements.sysGpsStatus) {
                this.elements.sysGpsStatus.textContent = 'NO GPS';
            }
            setTimeout(() => this.connect(), this.reconnectDelay);
        };

        this.ws.onerror = () => {};
    }

    // Traffic data polling
    startTrafficPolling() {
        // Fetch traffic data every 2 seconds when traffic is enabled
        this.trafficPollingInterval = setInterval(() => {
            if (this.map.showTraffic || this.pageManager?.getCurrentPageId() === 'traffic') {
                this.fetchTrafficData();
            }
        }, 2000);
        // Initial fetch
        this.fetchTrafficData();
    }

    async fetchTrafficData() {
        try {
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/traffic`);
            if (response.ok) {
                const data = await response.json();
                if (this.trafficOverlay && data.traffic) {
                    this.trafficOverlay.updateTargets(data.traffic);
                }
            }
        } catch (e) {
            // Silently fail - traffic overlay will show test data or empty
        }
    }

    updateFromSim(d) {
        if (d.latitude !== undefined) this.data.latitude = d.latitude;
        if (d.longitude !== undefined) this.data.longitude = d.longitude;
        if (d.altitudeMSL !== undefined) this.data.altitude = d.altitudeMSL;
        if (d.groundSpeed !== undefined) this.data.groundSpeed = d.groundSpeed;
        if (d.heading !== undefined) this.data.heading = d.heading;
        if (d.verticalSpeed !== undefined) this.data.verticalSpeed = d.verticalSpeed;
        if (d.com1Active !== undefined) this.data.com1Active = d.com1Active;
        if (d.com1Standby !== undefined) this.data.com1Standby = d.com1Standby;
        if (d.com2Active !== undefined) this.data.com2Active = d.com2Active;
        if (d.com2Standby !== undefined) this.data.com2Standby = d.com2Standby;
        if (d.nav1Active !== undefined) this.data.nav1Active = d.nav1Active;
        if (d.nav1Standby !== undefined) this.data.nav1Standby = d.nav1Standby;
        if (d.transponder !== undefined) this.data.transponder = d.transponder;
        if (d.zuluTime !== undefined) this.data.zuluTime = d.zuluTime;

        // NAV1 CDI/OBS data
        if (d.nav1Cdi !== undefined) {
            this.nav1 = {
                cdi: d.nav1Cdi,
                obs: d.nav1Obs || 0,
                radial: d.nav1Radial || 0,
                toFrom: d.nav1ToFrom ?? 2,
                signal: d.nav1Signal || 0,
                gsi: d.nav1Gsi || 0,
                gsFlag: d.nav1GsFlag ?? true,
                hasLoc: d.nav1HasLoc ?? false,
                hasGs: d.nav1HasGs ?? false
            };
        }
        // NAV2 CDI/OBS data
        if (d.nav2Cdi !== undefined) {
            this.nav2 = {
                cdi: d.nav2Cdi,
                obs: d.nav2Obs || 0,
                radial: d.nav2Radial || 0,
                toFrom: d.nav2ToFrom ?? 2,
                signal: d.nav2Signal || 0,
                gsi: d.nav2Gsi || 0,
                gsFlag: d.nav2GsFlag ?? true
            };
        }
        // GPS CDI data
        if (d.gpsCdiNeedle !== undefined) {
            this.gps = {
                cdi: d.gpsCdiNeedle,
                xtrk: d.gpsCrossTrackError || 0,
                dtk: d.gpsDesiredTrack || 0,
                obs: d.gpsObsValue || 0,
                vertError: d.gpsVerticalError || 0,
                approachMode: d.gpsApproachMode ?? false
            };
        }

        this.data.track = d.track || this.data.heading;
        this.updateUI();
        this.updateWaypointDisplay();
        this.updateCdiFromSource();
    }

    updateUI() {
        // Frequencies
        if (this.elements.com1) this.elements.com1.textContent = this.data.com1Active.toFixed(2);
        if (this.elements.com1Stby) this.elements.com1Stby.textContent = this.data.com1Standby.toFixed(2);
        if (this.elements.com2) this.elements.com2.textContent = this.data.com2Active.toFixed(2);
        if (this.elements.com2Stby) this.elements.com2Stby.textContent = this.data.com2Standby.toFixed(2);
        if (this.elements.nav1) this.elements.nav1.textContent = this.data.nav1Active.toFixed(2);
        if (this.elements.nav1Stby) this.elements.nav1Stby.textContent = this.data.nav1Standby.toFixed(2);
        if (this.elements.xpdr) this.elements.xpdr.textContent = this.data.transponder.toString().padStart(4, '0');

        // Time
        if (this.elements.utcTime && this.data.zuluTime) {
            this.elements.utcTime.textContent = this.core.formatTime(this.data.zuluTime);
        }

        // AUX page data
        this.updateAuxData();
    }

    updateAuxData() {
        if (!this.flightPlan?.waypoints) return;

        // Remaining distance
        let remDist = 0;
        for (let i = this.activeWaypointIndex; i < this.flightPlan.waypoints.length; i++) {
            const wp = this.flightPlan.waypoints[i];
            if (wp.distanceFromPrev) remDist += wp.distanceFromPrev;
        }
        if (this.elements.auxDist) this.elements.auxDist.textContent = Math.round(remDist) + ' NM';

        // ETE
        if (this.data.groundSpeed > 0) {
            const eteMin = (remDist / this.data.groundSpeed) * 60;
            if (this.elements.auxTime) this.elements.auxTime.textContent = this.core.formatEte(eteMin);

            // ETA
            if (this.elements.auxEta && this.data.zuluTime) {
                const etaHrs = this.data.zuluTime + (eteMin / 60);
                this.elements.auxEta.textContent = this.core.formatTime(etaHrs);
            }
        }
    }

    startClock() {
        setInterval(() => {
            if (!this.data.zuluTime && this.elements.utcTime) {
                const now = new Date();
                const h = now.getUTCHours().toString().padStart(2, '0');
                const m = now.getUTCMinutes().toString().padStart(2, '0');
                const s = now.getUTCSeconds().toString().padStart(2, '0');
                this.elements.utcTime.textContent = `${h}:${m}:${s}Z`;
            }
        }, 1000);
    }
}

// Initialize and expose globally
document.addEventListener('DOMContentLoaded', () => {
    window.gtn750 = new GTN750Widget();
});
