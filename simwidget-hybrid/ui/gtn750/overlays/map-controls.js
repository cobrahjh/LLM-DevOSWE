/**
 * GTN750 Map Controls - Touch gestures and enhanced map interaction
 * Supports pinch-to-zoom, pan, and data field customization
 */

class MapControls {
    constructor(options = {}) {
        this.canvas = options.canvas;
        this.onRangeChange = options.onRangeChange || (() => {});
        this.onPan = options.onPan || (() => {});
        this.onDataFieldTap = options.onDataFieldTap || (() => {});

        // Touch state
        this.touches = [];
        this.lastPinchDistance = 0;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };

        // Map state
        this.ranges = [2, 5, 10, 20, 50, 100, 200];
        this.currentRangeIndex = 2; // 10nm default
        this.panOffset = { x: 0, y: 0 };
        this.maxPanOffset = 100; // pixels

        // Data fields configuration
        this.dataFields = {
            topLeft: { type: 'GS', label: 'GS', unit: 'KT' },
            topRight: { type: 'TRK', label: 'TRK', unit: '°' },
            bottomLeft: { type: 'ALT', label: 'ALT', unit: 'FT' },
            bottomRight: { type: 'RNG', label: 'RNG', unit: 'NM' }
        };

        this.dataFieldTypes = [
            { type: 'GS', label: 'GS', unit: 'KT', getValue: (d) => Math.round(d.groundSpeed) },
            { type: 'TRK', label: 'TRK', unit: '°', getValue: (d) => this.formatHeading(d.track || d.heading) },
            { type: 'HDG', label: 'HDG', unit: '°', getValue: (d) => this.formatHeading(d.heading) },
            { type: 'ALT', label: 'ALT', unit: 'FT', getValue: (d) => Math.round(d.altitude).toLocaleString() },
            { type: 'VS', label: 'VS', unit: 'FPM', getValue: (d) => this.formatVS(d.verticalSpeed) },
            { type: 'RNG', label: 'RNG', unit: 'NM', getValue: (d, map) => map.range },
            { type: 'BRG', label: 'BRG', unit: '°', getValue: (d, map, wpt) => wpt?.bearing || '---' },
            { type: 'DIS', label: 'DIS', unit: 'NM', getValue: (d, map, wpt) => wpt?.distance?.toFixed(1) || '--.-' },
            { type: 'ETE', label: 'ETE', unit: '', getValue: (d, map, wpt) => wpt?.ete || '--:--' },
            { type: 'DTK', label: 'DTK', unit: '°', getValue: (d, map, wpt) => wpt?.dtk?.toString().padStart(3, '0') || '---' }
        ];

        if (this.canvas) {
            this.init();
        }
    }

    init() {
        this.bindTouchEvents();
        this.bindMouseEvents();
    }

    formatHeading(hdg) {
        return Math.round(hdg).toString().padStart(3, '0');
    }

    formatVS(vs) {
        const rounded = Math.round(vs);
        return (rounded >= 0 ? '+' : '') + rounded;
    }

    /**
     * Bind touch events for mobile
     */
    bindTouchEvents() {
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    }

    /**
     * Bind mouse events for desktop
     */
    bindMouseEvents() {
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    }

    /**
     * Handle touch start
     */
    handleTouchStart(e) {
        e.preventDefault();
        this.touches = Array.from(e.touches);

        if (this.touches.length === 2) {
            // Pinch start
            this.lastPinchDistance = this.getPinchDistance();
        } else if (this.touches.length === 1) {
            // Pan start
            this.isPanning = true;
            this.panStart = {
                x: this.touches[0].clientX,
                y: this.touches[0].clientY
            };
        }
    }

    /**
     * Handle touch move
     */
    handleTouchMove(e) {
        e.preventDefault();
        this.touches = Array.from(e.touches);

        if (this.touches.length === 2) {
            // Pinch zoom
            const distance = this.getPinchDistance();
            const delta = distance - this.lastPinchDistance;

            if (Math.abs(delta) > 20) {
                if (delta > 0) {
                    this.zoomIn();
                } else {
                    this.zoomOut();
                }
                this.lastPinchDistance = distance;
            }
        } else if (this.touches.length === 1 && this.isPanning) {
            // Pan
            const dx = this.touches[0].clientX - this.panStart.x;
            const dy = this.touches[0].clientY - this.panStart.y;

            this.panOffset.x = Math.max(-this.maxPanOffset, Math.min(this.maxPanOffset, dx));
            this.panOffset.y = Math.max(-this.maxPanOffset, Math.min(this.maxPanOffset, dy));

            this.onPan(this.panOffset);
        }
    }

    /**
     * Handle touch end
     */
    handleTouchEnd(e) {
        this.touches = Array.from(e.touches);

        if (this.touches.length === 0) {
            this.isPanning = false;

            // Animate pan back to center
            this.animatePanReset();
        }
    }

    /**
     * Get distance between two touch points
     */
    getPinchDistance() {
        if (this.touches.length < 2) return 0;
        const dx = this.touches[0].clientX - this.touches[1].clientX;
        const dy = this.touches[0].clientY - this.touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Handle mouse wheel
     */
    handleWheel(e) {
        e.preventDefault();
        if (e.deltaY > 0) {
            this.zoomOut();
        } else {
            this.zoomIn();
        }
    }

    /**
     * Handle mouse down
     */
    handleMouseDown(e) {
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };
    }

    /**
     * Handle mouse move
     */
    handleMouseMove(e) {
        if (!this.isPanning) return;

        const dx = e.clientX - this.panStart.x;
        const dy = e.clientY - this.panStart.y;

        this.panOffset.x = Math.max(-this.maxPanOffset, Math.min(this.maxPanOffset, dx));
        this.panOffset.y = Math.max(-this.maxPanOffset, Math.min(this.maxPanOffset, dy));

        this.onPan(this.panOffset);
    }

    /**
     * Handle mouse up
     */
    handleMouseUp(e) {
        this.isPanning = false;
        this.animatePanReset();
    }

    /**
     * Handle double click - center on position
     */
    handleDoubleClick(e) {
        this.panOffset = { x: 0, y: 0 };
        this.onPan(this.panOffset);
    }

    /**
     * Animate pan offset back to zero
     */
    animatePanReset() {
        const animate = () => {
            this.panOffset.x *= 0.8;
            this.panOffset.y *= 0.8;

            if (Math.abs(this.panOffset.x) > 1 || Math.abs(this.panOffset.y) > 1) {
                this.onPan(this.panOffset);
                requestAnimationFrame(animate);
            } else {
                this.panOffset = { x: 0, y: 0 };
                this.onPan(this.panOffset);
            }
        };
        requestAnimationFrame(animate);
    }

    /**
     * Zoom in (decrease range)
     */
    zoomIn() {
        if (this.currentRangeIndex > 0) {
            this.currentRangeIndex--;
            this.onRangeChange(this.ranges[this.currentRangeIndex], -1);
        }
    }

    /**
     * Zoom out (increase range)
     */
    zoomOut() {
        if (this.currentRangeIndex < this.ranges.length - 1) {
            this.currentRangeIndex++;
            this.onRangeChange(this.ranges[this.currentRangeIndex], 1);
        }
    }

    /**
     * Set range directly
     */
    setRange(range) {
        const idx = this.ranges.indexOf(range);
        if (idx !== -1) {
            this.currentRangeIndex = idx;
        }
    }

    /**
     * Get current range
     */
    getRange() {
        return this.ranges[this.currentRangeIndex];
    }

    /**
     * Cycle data field type
     */
    cycleDataField(position) {
        const field = this.dataFields[position];
        if (!field) return;

        const currentIndex = this.dataFieldTypes.findIndex(t => t.type === field.type);
        const nextIndex = (currentIndex + 1) % this.dataFieldTypes.length;
        const nextType = this.dataFieldTypes[nextIndex];

        this.dataFields[position] = {
            type: nextType.type,
            label: nextType.label,
            unit: nextType.unit
        };

        this.onDataFieldTap(position, nextType);
        return nextType;
    }

    /**
     * Get data field value
     */
    getDataFieldValue(position, aircraftData, mapSettings, waypointData) {
        const field = this.dataFields[position];
        const typeConfig = this.dataFieldTypes.find(t => t.type === field.type);

        if (typeConfig && typeConfig.getValue) {
            return typeConfig.getValue(aircraftData, mapSettings, waypointData);
        }
        return '--';
    }

    /**
     * Get all data field configs
     */
    getDataFields() {
        return this.dataFields;
    }

    /**
     * Set data field configuration
     */
    setDataField(position, type) {
        const typeConfig = this.dataFieldTypes.find(t => t.type === type);
        if (typeConfig) {
            this.dataFields[position] = {
                type: typeConfig.type,
                label: typeConfig.label,
                unit: typeConfig.unit
            };
        }
    }

    /**
     * Get pan offset for rendering
     */
    getPanOffset() {
        return this.panOffset;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapControls;
}
