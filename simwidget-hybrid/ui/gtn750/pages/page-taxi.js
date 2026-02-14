/**
 * GTN750 SafeTaxi Page - Airport surface diagrams
 * Shows real-time ownship position on airport diagrams with taxi routes
 */

class SafeTaxiPage {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.serverPort = options.serverPort || 8080;
        this.diagram = null;

        // Elements cache
        this.elements = {};
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        this.cacheElements();
        this.bindEvents();
        this._initialized = true;
    }

    cacheElements() {
        this.elements = {
            canvas: document.getElementById('taxi-canvas'),
            airportInput: document.getElementById('taxi-airport-input'),
            loadBtn: document.getElementById('taxi-load-btn'),
            centerBtn: document.getElementById('taxi-center-btn'),
            zoomInBtn: document.getElementById('taxi-zoom-in'),
            zoomOutBtn: document.getElementById('taxi-zoom-out'),
            autoBtn: document.getElementById('taxi-auto-btn'),
            followBtn: document.getElementById('taxi-follow-btn'),
            trackUpBtn: document.getElementById('taxi-trackup-btn'),
            satelliteBtn: document.getElementById('taxi-satellite-btn'),
            satelliteControls: document.getElementById('taxi-satellite-controls'),
            opacitySlider: document.getElementById('taxi-opacity-slider'),
            opacityValue: document.getElementById('taxi-opacity-value'),
            statusLabel: document.getElementById('taxi-status')
        };

        // Initialize diagram renderer with canvas
        if (this.elements.canvas) {
            this.diagram = new GTNAirportDiagram({
                core: this.core,
                canvas: this.elements.canvas,
                serverPort: this.serverPort
            });

            // Set initial canvas size based on container
            this.diagram.updateCanvasSize();
        }
    }

    bindEvents() {
        // Load airport button
        if (this.elements.loadBtn) {
            this.elements.loadBtn.addEventListener('click', () => {
                const icao = this.elements.airportInput?.value.trim().toUpperCase();
                if (icao && icao.length >= 3) {
                    this.loadAirport(icao);
                }
            });
        }

        // Airport input - load on Enter
        if (this.elements.airportInput) {
            this.elements.airportInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const icao = e.target.value.trim().toUpperCase();
                    if (icao && icao.length >= 3) {
                        this.loadAirport(icao);
                    }
                }
            });
        }

        // Center on ownship
        if (this.elements.centerBtn) {
            this.elements.centerBtn.addEventListener('click', () => {
                if (this.diagram) {
                    this.diagram.centerOnOwnship();
                    this.render();
                }
            });
        }

        // Zoom controls
        if (this.elements.zoomInBtn) {
            this.elements.zoomInBtn.addEventListener('click', () => {
                if (this.diagram) {
                    this.diagram.zoom(1.5);
                    this.render();
                }
            });
        }

        if (this.elements.zoomOutBtn) {
            this.elements.zoomOutBtn.addEventListener('click', () => {
                if (this.diagram) {
                    this.diagram.zoom(0.67);
                    this.render();
                }
            });
        }

        // Auto-scale button
        if (this.elements.autoBtn) {
            this.elements.autoBtn.addEventListener('click', () => {
                if (this.diagram) {
                    this.diagram.centerOnAirport();
                    this.diagram.autoScale();
                    this.render();
                }
            });
        }

        // Follow button - toggle auto-follow mode
        if (this.elements.followBtn) {
            this.elements.followBtn.addEventListener('click', () => {
                if (this.diagram) {
                    this.diagram.options.autoFollow = !this.diagram.options.autoFollow;

                    // Update button appearance
                    if (this.diagram.options.autoFollow) {
                        this.elements.followBtn.classList.add('active');
                        this.setStatus('Auto-follow: ON', '#00ff00');
                    } else {
                        this.elements.followBtn.classList.remove('active');
                        this.setStatus('Auto-follow: OFF', '#ffff00');
                    }
                }
            });
        }

        // Track-up button - toggle track-up orientation
        if (this.elements.trackUpBtn) {
            this.elements.trackUpBtn.addEventListener('click', () => {
                if (this.diagram) {
                    this.diagram.options.trackUp = !this.diagram.options.trackUp;

                    // Update button appearance
                    if (this.diagram.options.trackUp) {
                        this.elements.trackUpBtn.classList.add('active');
                        this.setStatus('Track-up: ON', '#00ff00');
                    } else {
                        this.elements.trackUpBtn.classList.remove('active');
                        this.setStatus('North-up: ON', '#ffff00');
                    }

                    // Re-render with new orientation
                    this.render();
                }
            });
        }

        // Satellite toggle button
        if (this.elements.satelliteBtn) {
            this.elements.satelliteBtn.addEventListener('click', () => {
                if (this.diagram) {
                    const enabled = this.diagram.toggleSatellite();

                    // Update button appearance
                    if (enabled) {
                        this.elements.satelliteBtn.classList.add('active');
                        this.elements.satelliteControls.style.display = 'flex';
                        this.setStatus('Satellite imagery: ON', '#00ff00');
                    } else {
                        this.elements.satelliteBtn.classList.remove('active');
                        this.elements.satelliteControls.style.display = 'none';
                        this.setStatus('Satellite imagery: OFF', '#ffff00');
                    }

                    this.render();
                }
            });
        }

        // Satellite opacity slider
        if (this.elements.opacitySlider) {
            this.elements.opacitySlider.addEventListener('input', (e) => {
                if (this.diagram) {
                    const opacity = parseInt(e.target.value) / 100;
                    this.diagram.setSatelliteOpacity(opacity);

                    // Update display value
                    if (this.elements.opacityValue) {
                        this.elements.opacityValue.textContent = `${e.target.value}%`;
                    }

                    this.render();
                }
            });
        }

        // Canvas pan with mouse drag
        if (this.elements.canvas) {
            let isDragging = false;
            let lastX = 0;
            let lastY = 0;

            this.elements.canvas.addEventListener('mousedown', (e) => {
                isDragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
                this.elements.canvas.style.cursor = 'grabbing';
            });

            this.elements.canvas.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const dx = e.clientX - lastX;
                const dy = e.clientY - lastY;
                lastX = e.clientX;
                lastY = e.clientY;

                if (this.diagram) {
                    this.diagram.pan(dx, dy);
                    this.render();
                }
            });

            this.elements.canvas.addEventListener('mouseup', () => {
                isDragging = false;
                this.elements.canvas.style.cursor = 'grab';
            });

            this.elements.canvas.addEventListener('mouseleave', () => {
                isDragging = false;
                this.elements.canvas.style.cursor = 'grab';
            });

            // Mouse wheel zoom
            this.elements.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
                if (this.diagram) {
                    this.diagram.zoom(zoomFactor);
                    this.render();
                }
            });

            this.elements.canvas.style.cursor = 'grab';
        }
    }

    /**
     * Load airport diagram
     * @param {string} icao - Airport ICAO code
     */
    async loadAirport(icao) {
        if (!this.diagram) return;

        this.setStatus('Loading...', '#ffff00');

        const success = await this.diagram.loadAirport(icao);

        if (success) {
            this.setStatus(`${icao} loaded`, '#00ff00');
            this.render();
        } else {
            this.setStatus(`Failed to load ${icao}`, '#ff0000');
        }
    }

    /**
     * Update ownship position from flight data
     * @param {Object} data - Flight data
     */
    update(data) {
        if (!this.diagram) return;

        this.diagram.updateOwnship(data);

        // Auto-load nearest airport when on ground
        if (data.agl < 50 && data.groundSpeed < 5) {
            // Check if we need to load/reload airport
            if (!this.diagram.airport) {
                // No airport loaded - load nearest
                this.autoLoadNearestAirport(data.latitude, data.longitude);
            } else {
                // Airport loaded - check if we're too far away (transitioned to different airport)
                const distNm = this.diagram.calculateDistance(
                    data.latitude, data.longitude,
                    this.diagram.airport.lat, this.diagram.airport.lon
                );

                // If more than 5nm from current airport, reload nearest
                if (distNm > 5) {
                    GTNCore.log(`[SafeTaxi] Distance from ${this.diagram.airport.icao}: ${distNm.toFixed(1)}nm - reloading nearest`);
                    this.autoLoadNearestAirport(data.latitude, data.longitude);
                }
            }
        }
    }

    /**
     * Auto-load nearest airport based on position
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     */
    async autoLoadNearestAirport(lat, lon) {
        try {
            const response = await fetch(
                `http://${location.hostname}:${this.serverPort}/api/navdb/nearby/airports?lat=${lat}&lon=${lon}&range=5&limit=1`
            );

            if (!response.ok) return;

            const data = await response.json();
            // Handle both old array format and new {items: [...]} format
            const airports = data.items || data;
            if (airports && airports.length > 0) {
                const nearest = airports[0];
                GTNCore.log(`[SafeTaxi] Auto-loading nearest airport: ${nearest.icao}`);
                this.loadAirport(nearest.icao || nearest.ident);

                // Update input field
                if (this.elements.airportInput) {
                    this.elements.airportInput.value = nearest.icao || nearest.ident;
                }
            }
        } catch (e) {
            GTNCore.log(`[SafeTaxi] Failed to auto-load airport: ${e.message}`);
        }
    }

    /**
     * Set taxi route from ATC clearance
     * @param {Array} route - Taxi route waypoints
     */
    setTaxiRoute(route) {
        if (this.diagram) {
            this.diagram.setTaxiRoute(route);
            this.render();
        }
    }

    /**
     * Clear taxi route
     */
    clearTaxiRoute() {
        if (this.diagram) {
            this.diagram.clearTaxiRoute();
            this.render();
        }
    }

    /**
     * Render diagram
     */
    async render() {
        if (this.diagram) {
            await this.diagram.render();
        }
    }

    /**
     * Set status message
     * @param {string} message - Status message
     * @param {string} color - Text color
     */
    setStatus(message, color = '#ffffff') {
        if (this.elements.statusLabel) {
            this.elements.statusLabel.textContent = message;
            this.elements.statusLabel.style.color = color;
        }
    }

    /**
     * Show/hide page
     * @param {boolean} visible - Visibility state
     */
    setVisible(visible) {
        const page = document.getElementById('page-taxi');
        if (page) {
            page.style.display = visible ? 'block' : 'none';
        }

        // Render when shown
        if (visible) {
            this.render();
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.diagram) {
            this.diagram.destroy();
            this.diagram = null;
        }
        GTNCore.log('[SafeTaxi] Page destroyed');
    }
}
