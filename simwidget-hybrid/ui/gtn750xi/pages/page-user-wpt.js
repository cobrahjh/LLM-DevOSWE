/**
 * GTN750 User Waypoints Page
 * UI for creating, editing, and managing custom navigation waypoints
 */

class UserWaypointsPage {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.serverPort = options.serverPort || 8080;
        this.userWaypoints = options.userWaypoints;
        this.onDirectTo = options.onDirectTo || null;
        this.onAddToFPL = options.onAddToFPL || null;

        // Elements cache
        this.elements = {};
        this._initialized = false;

        // UI state
        this.selectedWaypoint = null;
        this.editMode = false;
        this.filterCategory = 'ALL';
        this.currentPosition = { lat: 0, lon: 0 };
    }

    init() {
        if (this._initialized) return;
        this.cacheElements();
        this.bindEvents();
        this.render();
        this._initialized = true;
    }

    cacheElements() {
        this.elements = {
            list: document.getElementById('user-wpt-list'),
            form: document.getElementById('user-wpt-form'),
            formTitle: document.getElementById('user-wpt-form-title'),
            identInput: document.getElementById('user-wpt-ident'),
            nameInput: document.getElementById('user-wpt-name'),
            latInput: document.getElementById('user-wpt-lat'),
            lonInput: document.getElementById('user-wpt-lon'),
            categorySelect: document.getElementById('user-wpt-category'),
            notesInput: document.getElementById('user-wpt-notes'),
            saveBtn: document.getElementById('user-wpt-save'),
            cancelBtn: document.getElementById('user-wpt-cancel'),
            newBtn: document.getElementById('user-wpt-new'),
            deleteBtn: document.getElementById('user-wpt-delete'),
            importBtn: document.getElementById('user-wpt-import'),
            exportBtn: document.getElementById('user-wpt-export'),
            fileInput: document.getElementById('user-wpt-file-input'),
            statsDiv: document.getElementById('user-wpt-stats'),
            filterSelect: document.getElementById('user-wpt-filter'),
            hereBtn: document.getElementById('user-wpt-here')
        };
    }

    bindEvents() {
        // New waypoint button
        if (this.elements.newBtn) {
            this.elements.newBtn.addEventListener('click', () => this.showNewForm());
        }

        // Save button
        if (this.elements.saveBtn) {
            this.elements.saveBtn.addEventListener('click', () => this.saveWaypoint());
        }

        // Cancel button
        if (this.elements.cancelBtn) {
            this.elements.cancelBtn.addEventListener('click', () => this.cancelEdit());
        }

        // Delete button
        if (this.elements.deleteBtn) {
            this.elements.deleteBtn.addEventListener('click', () => this.deleteWaypoint());
        }

        // Import button
        if (this.elements.importBtn) {
            this.elements.importBtn.addEventListener('click', () => {
                if (this.elements.fileInput) this.elements.fileInput.click();
            });
        }

        // Export button
        if (this.elements.exportBtn) {
            this.elements.exportBtn.addEventListener('click', () => this.exportWaypoints());
        }

        // File input for import
        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', (e) => this.handleFileImport(e));
        }

        // Filter dropdown
        if (this.elements.filterSelect) {
            this.elements.filterSelect.addEventListener('change', (e) => {
                this.filterCategory = e.target.value;
                this.render();
            });
        }

        // "HERE" button - use current position
        if (this.elements.hereBtn) {
            this.elements.hereBtn.addEventListener('click', () => {
                if (this.elements.latInput) this.elements.latInput.value = this.currentPosition.lat.toFixed(6);
                if (this.elements.lonInput) this.elements.lonInput.value = this.currentPosition.lon.toFixed(6);
            });
        }
    }

    /**
     * Show create new waypoint form
     */
    showNewForm() {
        this.editMode = false;
        this.selectedWaypoint = null;

        if (this.elements.formTitle) this.elements.formTitle.textContent = 'New User Waypoint';
        if (this.elements.identInput) {
            this.elements.identInput.value = '';
            this.elements.identInput.disabled = false;
        }
        if (this.elements.nameInput) this.elements.nameInput.value = '';
        if (this.elements.latInput) this.elements.latInput.value = this.currentPosition.lat.toFixed(6);
        if (this.elements.lonInput) this.elements.lonInput.value = this.currentPosition.lon.toFixed(6);
        if (this.elements.categorySelect) this.elements.categorySelect.value = 'WPT';
        if (this.elements.notesInput) this.elements.notesInput.value = '';

        this.showForm(true);
    }

    /**
     * Show edit waypoint form
     * @param {Object} waypoint - Waypoint to edit
     */
    showEditForm(waypoint) {
        this.editMode = true;
        this.selectedWaypoint = waypoint;

        if (this.elements.formTitle) this.elements.formTitle.textContent = `Edit ${waypoint.ident}`;
        if (this.elements.identInput) {
            this.elements.identInput.value = waypoint.ident;
            this.elements.identInput.disabled = true; // Cannot change identifier
        }
        if (this.elements.nameInput) this.elements.nameInput.value = waypoint.name;
        if (this.elements.latInput) this.elements.latInput.value = waypoint.lat.toFixed(6);
        if (this.elements.lonInput) this.elements.lonInput.value = waypoint.lon.toFixed(6);
        if (this.elements.categorySelect) this.elements.categorySelect.value = waypoint.category;
        if (this.elements.notesInput) this.elements.notesInput.value = waypoint.notes || '';

        this.showForm(true);
    }

    /**
     * Show/hide form
     * @param {boolean} show - Show or hide
     */
    showForm(show) {
        if (this.elements.form) {
            this.elements.form.style.display = show ? 'block' : 'none';
        }
        if (this.elements.list) {
            this.elements.list.style.display = show ? 'none' : 'block';
        }
    }

    /**
     * Save waypoint (create or update)
     */
    saveWaypoint() {
        if (!this.userWaypoints) return;

        const data = {
            ident: this.elements.identInput?.value.trim().toUpperCase(),
            name: this.elements.nameInput?.value.trim(),
            lat: parseFloat(this.elements.latInput?.value),
            lon: parseFloat(this.elements.lonInput?.value),
            category: this.elements.categorySelect?.value,
            notes: this.elements.notesInput?.value.trim()
        };

        // Validate
        if (!data.ident || data.ident.length < 3 || data.ident.length > 5) {
            alert('Identifier must be 3-5 characters (alphanumeric)');
            return;
        }

        if (isNaN(data.lat) || isNaN(data.lon)) {
            alert('Invalid coordinates');
            return;
        }

        let success = false;

        if (this.editMode && this.selectedWaypoint) {
            // Update existing waypoint
            success = this.userWaypoints.updateWaypoint(this.selectedWaypoint.ident, data);
            if (success) {
                GTNCore.log(`[UserWptPage] Updated waypoint: ${data.ident}`);
            }
        } else {
            // Create new waypoint
            const created = this.userWaypoints.createWaypoint(data);
            success = created !== null;
            if (success) {
                GTNCore.log(`[UserWptPage] Created waypoint: ${data.ident}`);
            } else {
                alert('Failed to create waypoint. Check identifier is unique.');
                return;
            }
        }

        if (success) {
            this.cancelEdit();
            this.render();
        }
    }

    /**
     * Cancel edit/create
     */
    cancelEdit() {
        this.showForm(false);
        this.selectedWaypoint = null;
        this.editMode = false;
    }

    /**
     * Delete selected waypoint
     */
    deleteWaypoint() {
        if (!this.selectedWaypoint || !this.userWaypoints) return;

        const confirm = window.confirm(`Delete waypoint ${this.selectedWaypoint.ident}?`);
        if (!confirm) return;

        const success = this.userWaypoints.deleteWaypoint(this.selectedWaypoint.ident);
        if (success) {
            GTNCore.log(`[UserWptPage] Deleted waypoint: ${this.selectedWaypoint.ident}`);
            this.cancelEdit();
            this.render();
        }
    }

    /**
     * Handle file import
     * @param {Event} event - File input change event
     */
    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target.result;
            let results;

            if (file.name.toLowerCase().endsWith('.gpx')) {
                results = this.userWaypoints.importGPX(data);
            } else if (file.name.toLowerCase().endsWith('.csv')) {
                results = this.userWaypoints.importCSV(data);
            } else {
                alert('Unsupported file format. Use GPX or CSV.');
                return;
            }

            alert(`Import complete:\n${results.imported} imported\n${results.skipped} skipped${results.errors.length > 0 ? '\n\nErrors:\n' + results.errors.join('\n') : ''}`);
            this.render();
        };

        reader.readAsText(file);

        // Reset input
        if (this.elements.fileInput) this.elements.fileInput.value = '';
    }

    /**
     * Export waypoints
     */
    exportWaypoints() {
        if (!this.userWaypoints) return;

        const waypoints = this.filterCategory === 'ALL'
            ? this.userWaypoints.getAllWaypoints()
            : this.userWaypoints.getAllWaypoints(this.filterCategory);

        if (waypoints.length === 0) {
            alert('No waypoints to export');
            return;
        }

        // Ask for format
        const format = prompt('Export format: GPX or CSV?', 'GPX').toUpperCase();

        let data, filename, mimeType;

        if (format === 'GPX') {
            data = this.userWaypoints.exportGPX(waypoints);
            filename = 'user-waypoints.gpx';
            mimeType = 'application/gpx+xml';
        } else if (format === 'CSV') {
            data = this.userWaypoints.exportCSV(waypoints);
            filename = 'user-waypoints.csv';
            mimeType = 'text/csv';
        } else {
            alert('Invalid format. Use GPX or CSV.');
            return;
        }

        // Download file
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        GTNCore.log(`[UserWptPage] Exported ${waypoints.length} waypoints as ${format}`);
    }

    /**
     * Render waypoint list
     */
    render() {
        if (!this.userWaypoints || !this.elements.list) return;

        const waypoints = this.filterCategory === 'ALL'
            ? this.userWaypoints.getAllWaypoints()
            : this.userWaypoints.getAllWaypoints(this.filterCategory);

        // Render list
        this.elements.list.innerHTML = '';

        if (waypoints.length === 0) {
            this.elements.list.innerHTML = '<div class="user-wpt-empty">No user waypoints</div>';
            this.updateStats();
            return;
        }

        waypoints.forEach(wp => {
            const category = this.userWaypoints.getCategory(wp.category);
            const distance = this.core.calculateDistance(
                this.currentPosition.lat, this.currentPosition.lon,
                wp.lat, wp.lon
            );
            const bearing = this.core.calculateBearing(
                this.currentPosition.lat, this.currentPosition.lon,
                wp.lat, wp.lon
            );

            const item = document.createElement('div');
            item.className = 'user-wpt-item';
            item.innerHTML = `
                <div class="user-wpt-item-header">
                    <span class="user-wpt-icon" style="color: ${category?.color || '#fff'}">${category?.icon || '●'}</span>
                    <span class="user-wpt-ident">${wp.ident}</span>
                    <span class="user-wpt-name">${wp.name}</span>
                </div>
                <div class="user-wpt-item-coords">
                    ${this.core.formatLatitude(wp.lat)} ${this.core.formatLongitude(wp.lon)}
                </div>
                <div class="user-wpt-item-info">
                    ${distance.toFixed(1)} NM · ${bearing.toFixed(0)}°
                </div>
            `;

            // Click to edit
            item.addEventListener('click', () => this.showEditForm(wp));

            this.elements.list.appendChild(item);
        });

        this.updateStats();
    }

    /**
     * Update statistics display
     */
    updateStats() {
        if (!this.userWaypoints || !this.elements.statsDiv) return;

        const stats = this.userWaypoints.getStats();
        this.elements.statsDiv.textContent = `${stats.total} waypoints`;
    }

    /**
     * Update current position (for distance/bearing calculations)
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     */
    setPosition(lat, lon) {
        this.currentPosition = { lat, lon };
    }

    /**
     * Handle Direct-To action
     * @param {Object} waypoint - Waypoint to navigate to
     */
    triggerDirectTo(waypoint) {
        if (typeof this.onDirectTo === 'function') {
            this.onDirectTo(waypoint);
        }
    }

    /**
     * Handle Add to Flight Plan action
     * @param {Object} waypoint - Waypoint to add
     */
    triggerAddToFPL(waypoint) {
        if (typeof this.onAddToFPL === 'function') {
            this.onAddToFPL(waypoint);
        }
    }

    /**
     * Show/hide page
     * @param {boolean} visible - Visibility state
     */
    setVisible(visible) {
        const page = document.getElementById('page-user-wpt');
        if (page) {
            page.style.display = visible ? 'block' : 'none';
        }

        if (visible) {
            this.render();
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        GTNCore.log('[UserWptPage] Page destroyed');
    }
}
