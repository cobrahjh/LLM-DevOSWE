/**
 * GTN Data Fields - Corner data field display & customization
 * Extracted from widget.js for modular architecture
 */

class GTNDataFields {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();

        // Data field configuration (corner fields on map)
        this.dataFields = {
            'top-left': 'trk',
            'top-right': 'gs',
            'bottom-left': 'alt',
            'bottom-right': 'ete'
        };
        this.activeFieldPosition = null;
    }

    /**
     * Load saved data field configuration from localStorage
     */
    loadConfig() {
        try {
            const saved = localStorage.getItem('gtn750-datafields');
            if (saved) {
                this.dataFields = { ...this.dataFields, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('[GTN750] Failed to load datafields:', e.message);
        }
    }

    /**
     * Update all corner data fields on the map
     * @param {Object} data - Current sim data
     * @param {Object} flightPlanState - { flightPlan, activeWaypointIndex, cdi }
     */
    update(data, flightPlanState) {
        const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        positions.forEach(pos => {
            const field = document.querySelector(`.corner-field.${pos}`);
            if (field) {
                const type = this.dataFields[pos];
                const { label, value } = this.getFieldData(type, data, flightPlanState);
                const labelEl = field.querySelector('.corner-label');
                const valueEl = field.querySelector('.corner-value');
                if (labelEl) labelEl.textContent = label;
                if (valueEl) valueEl.textContent = value;
            }
        });
    }

    /**
     * Get data for a specific field type
     * @param {string} type - Field type identifier
     * @param {Object} data - Current sim data
     * @param {Object} state - { flightPlan, activeWaypointIndex, cdi }
     * @returns {{ label: string, value: string }}
     */
    getFieldData(type, data, state) {
        const wp = state.flightPlan?.waypoints?.[state.activeWaypointIndex];
        let dist = 0, trueBrg = 0, ete = 0;

        if (wp && data.latitude && wp.lat && wp.lng) {
            dist = this.core.calculateDistance(data.latitude, data.longitude, wp.lat, wp.lng);
            trueBrg = this.core.calculateBearing(data.latitude, data.longitude, wp.lat, wp.lng);
            if (data.groundSpeed > 0) {
                ete = (dist / data.groundSpeed) * 60;
            }
        }
        const magBrg = this.core.trueToMagnetic(trueBrg, data.magvar || 0);

        switch (type) {
            case 'trk':
                return { label: 'TRK', value: this.core.formatHeading(data.track || data.heading) };
            case 'gs':
                return { label: 'GS', value: Math.round(data.groundSpeed) + 'kt' };
            case 'alt':
                return { label: 'ALT', value: this.core.formatAltitude(data.altitude) };
            case 'vs':
                return { label: 'VS', value: Math.round(data.verticalSpeed) + 'fpm' };
            case 'hdg':
                return { label: 'HDG', value: this.core.formatHeading(data.heading) };
            case 'dis':
                return { label: 'DIS', value: dist > 0 ? dist.toFixed(1) + 'nm' : '--.-nm' };
            case 'ete':
                return { label: 'ETE', value: ete > 0 ? this.core.formatEte(ete) : '--:--' };
            case 'brg':
                return { label: 'BRG', value: magBrg > 0 ? Math.round(magBrg) + '°' : '---°' };
            case 'dtk':
                return { label: 'DTK', value: state.cdi?.dtk ? Math.round(state.cdi.dtk) + '°' : '---°' };
            case 'xtk':
                return { label: 'XTK', value: state.cdi?.xtrk ? state.cdi.xtrk.toFixed(1) + 'nm' : '0.0nm' };
            case 'wind':
                const windDir = data.windDirection || 0;
                const windSpd = data.windSpeed || 0;
                return { label: 'WIND', value: Math.round(windDir) + '°/' + Math.round(windSpd) + 'kt' };
            case 'time':
                return { label: 'TIME', value: this.core.formatTime(data.zuluTime) || '--:--Z' };
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

        const classList = field.classList;
        let position = null;
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(pos => {
            if (classList.contains(pos)) position = pos;
        });

        if (!position) return;

        this.activeFieldPosition = position;

        const rect = field.getBoundingClientRect();
        const parentRect = field.parentElement.getBoundingClientRect();

        selector.style.display = 'block';

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

        try {
            localStorage.setItem('gtn750-datafields', JSON.stringify(this.dataFields));
        } catch (e) {
            console.warn('[GTN750] Failed to save datafields:', e.message);
        }

        this.closeFieldSelector();
    }
}
