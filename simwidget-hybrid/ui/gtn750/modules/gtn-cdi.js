/**
 * GTN CDI Manager - CDI, OBS, NAV source switching, and holding patterns
 * Extracted from widget.js for modular architecture
 */

class GTNCdi {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.elements = options.elements || {};
        this.serverPort = options.serverPort || 8080;

        // CDI state
        this.cdi = {
            source: 'GPS',
            needle: 0,
            dtk: 0,
            xtrk: 0,
            toFrom: 2,
            gsNeedle: 0,
            gsValid: false,
            signalValid: true
        };

        // NAV radio data
        this.nav1 = { cdi: 0, obs: 0, radial: 0, toFrom: 2, signal: 0, gsi: 0, gsFlag: true, hasLoc: false, hasGs: false, dme: 0 };
        this.nav2 = { cdi: 0, obs: 0, radial: 0, toFrom: 2, signal: 0, gsi: 0, gsFlag: true, dme: 0 };
        this.gps = { cdi: 0, xtrk: 0, dtk: 0, obs: 0, vertError: 0, approachMode: false };

        // OBS mode
        this.obs = {
            active: false,
            course: 0,
            suspended: false,
            holdingPattern: false,
            legTime: 60,
            turnDirection: 'R',
            entryType: null,
            currentLeg: 'inbound',
            outboundTimer: 0
        };

        // Nav source
        this.navSource = 'GPS';
    }

    /**
     * Update CDI from the active nav source
     * @param {Object} state - { flightPlan, activeWaypointIndex, data }
     */
    updateFromSource(state) {
        const source = this.navSource;

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
                if (this.obs.active) {
                    const obsCdi = this.calculateObsCdi(state);
                    this.cdi = {
                        source: 'OBS',
                        needle: obsCdi.needle,
                        dtk: this.obs.course,
                        xtrk: obsCdi.xtrk,
                        toFrom: obsCdi.toFrom,
                        gsNeedle: Math.round(this.gps.vertError * 40),
                        gsValid: this.gps.approachMode,
                        signalValid: true
                    };
                } else {
                    // Use flight plan GPS navigation if available
                    if (state.gpsNav) {
                        this.cdi = {
                            source: 'GPS',
                            needle: state.gpsNav.cdi,
                            dtk: state.gpsNav.dtk,
                            xtrk: state.gpsNav.xtrk,
                            toFrom: 1,  // Always TO when following flight plan
                            gsNeedle: Math.round(this.gps.vertError * 40),
                            gsValid: this.gps.approachMode,
                            signalValid: true
                        };
                    } else {
                        // Fall back to raw GPS data from SimConnect
                        this.cdi = {
                            source: 'GPS',
                            needle: this.gps.cdi,
                            dtk: this.gps.dtk || this.cdi.dtk,
                            xtrk: Math.abs(this.gps.xtrk),
                            toFrom: 1,
                            gsNeedle: Math.round(this.gps.vertError * 40),
                            gsValid: this.gps.approachMode,
                            signalValid: true
                        };
                    }
                }
        }

        this.render();
    }

    /**
     * Render CDI display elements
     */
    render() {
        if (this.elements.cdiSource) {
            this.elements.cdiSource.textContent = this.cdi.source;
            this.elements.cdiSource.className = `cdi-source cdi-source-${this.cdi.source.toLowerCase()}`;
        }

        if (this.elements.cdiNeedle) {
            const deflectionPercent = (this.cdi.needle / 127) * 40;
            this.elements.cdiNeedle.style.left = `${50 + deflectionPercent}%`;
        }

        if (this.elements.cdiToFrom) {
            const toFromLabels = ['FROM', 'TO', '---'];
            this.elements.cdiToFrom.textContent = toFromLabels[this.cdi.toFrom] || '---';
            this.elements.cdiToFrom.className = `cdi-tofrom ${this.cdi.toFrom === 1 ? 'to' : this.cdi.toFrom === 0 ? 'from' : 'none'}`;
        }

        if (this.elements.cdiGsBar) {
            this.elements.cdiGsBar.style.display = this.cdi.gsValid ? 'flex' : 'none';
        }
        if (this.elements.cdiGsNeedle && this.cdi.gsValid) {
            const gsDeflectionPercent = (this.cdi.gsNeedle / 119) * 40;
            this.elements.cdiGsNeedle.style.top = `${50 - gsDeflectionPercent}%`;
        }

        if (this.elements.cdiFlag) {
            this.elements.cdiFlag.style.display = this.cdi.signalValid ? 'none' : 'block';
        }

        if (this.elements.cdiDtk) {
            this.elements.cdiDtk.textContent = Math.round(this.cdi.dtk).toString().padStart(3, '0');
        }
        if (this.elements.cdiXtrk) {
            this.elements.cdiXtrk.textContent = this.cdi.xtrk.toFixed(1);
        }

        if (this.elements.obsValue && this.cdi.source !== 'GPS') {
            const obs = this.cdi.source === 'NAV1' ? this.nav1.obs : this.nav2.obs;
            this.elements.obsValue.textContent = Math.round(obs).toString().padStart(3, '0');
        }
    }

    /**
     * Legacy GPS-calculated CDI (fallback when no SimConnect data)
     */
    updateLegacyCDI(bearing, distance, data) {
        if (this.navSource === 'GPS' && !this.gps.dtk) {
            const trackError = this.core.normalizeAngle(bearing - data.heading);
            const xtrk = Math.sin(this.core.toRad(trackError)) * distance;
            this.cdi.dtk = Math.round(bearing);
            this.cdi.xtrk = Math.abs(xtrk);
            this.cdi.needle = Math.round(Math.max(-127, Math.min(127, xtrk / 2 * 127)));
            this.render();
        }
    }

    /**
     * Set the active navigation source
     */
    setNavSource(source) {
        this.navSource = source;

        if (this.elements.navSourceGps) this.elements.navSourceGps.classList.toggle('active', source === 'GPS');
        if (this.elements.navSourceNav1) this.elements.navSourceNav1.classList.toggle('active', source === 'NAV1');
        if (this.elements.navSourceNav2) this.elements.navSourceNav2.classList.toggle('active', source === 'NAV2');

        if (this.elements.obsControls) {
            this.elements.obsControls.style.display = source === 'GPS' ? 'none' : 'flex';
        }
    }

    /**
     * Set OBS value via SimConnect
     */
    async setObs(value) {
        if (this.navSource === 'GPS') return;

        const event = this.navSource === 'NAV1' ? 'VOR1_SET' : 'VOR2_SET';
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

    /**
     * Adjust OBS by increment/decrement
     */
    async adjustObs(delta) {
        if (this.navSource === 'GPS') return;

        const event = delta > 0
            ? (this.navSource === 'NAV1' ? 'VOR1_OBI_INC' : 'VOR2_OBI_INC')
            : (this.navSource === 'NAV1' ? 'VOR1_OBI_DEC' : 'VOR2_OBI_DEC');

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

    // ===== OBS MODE =====

    /**
     * Toggle OBS mode on/off
     * @param {Object} state - { flightPlan, activeWaypointIndex, data }
     */
    toggleObs(state) {
        this.obs.active = !this.obs.active;

        if (this.obs.active) {
            const wp = state.flightPlan?.waypoints?.[state.activeWaypointIndex];
            if (wp && state.data.latitude && state.data.longitude) {
                const brg = this.core.calculateBearing(
                    state.data.latitude, state.data.longitude,
                    wp.lat, wp.lng
                );
                this.obs.course = Math.round(brg);
            } else {
                this.obs.course = this.cdi.dtk || state.data.heading || 0;
            }
            this.obs.suspended = true;
            GTNCore.log(`[GTN750] OBS mode ON - Course: ${this.obs.course}°`);
        } else {
            this.obs.suspended = false;
            GTNCore.log('[GTN750] OBS mode OFF - Resuming leg mode');
        }

        this.updateFromSource(state);
        this.updateObsDisplay();
    }

    adjustObsCourse(delta, state) {
        if (!this.obs.active) return;

        this.obs.course = (this.obs.course + delta + 360) % 360;
        GTNCore.log(`[GTN750] OBS course: ${this.obs.course}°`);
        this.updateFromSource(state);
        this.updateObsDisplay();
    }

    setObsCourse(course, state) {
        this.obs.course = ((course % 360) + 360) % 360;
        if (this.obs.active) {
            this.updateFromSource(state);
            this.updateObsDisplay();
        }
    }

    calculateObsCdi(state) {
        const wp = state.flightPlan?.waypoints?.[state.activeWaypointIndex];
        if (!wp || !state.data.latitude || !state.data.longitude) {
            return { needle: 0, xtrk: 0, toFrom: 2 };
        }

        const brg = this.core.calculateBearing(
            state.data.latitude, state.data.longitude,
            wp.lat, wp.lng
        );
        const dist = this.core.calculateDistance(
            state.data.latitude, state.data.longitude,
            wp.lat, wp.lng
        );

        const courseDiff = this.core.normalizeAngle(brg - this.obs.course);
        const xtrk = dist * Math.sin(this.core.toRad(courseDiff));

        const fullScale = this.gps.approachMode ? 1.0 : 2.0;
        const needle = Math.round(Math.max(-127, Math.min(127, (xtrk / fullScale) * 127)));

        const toFrom = Math.abs(courseDiff) < 90 ? 1 : 0;

        return { needle, xtrk: Math.abs(xtrk), toFrom };
    }

    updateObsDisplay() {
        if (this.elements.obsIndicator) {
            this.elements.obsIndicator.style.display = this.obs.active ? 'block' : 'none';
        }
        if (this.elements.obsCourse) {
            this.elements.obsCourse.textContent = this.obs.course.toString().padStart(3, '0') + '°';
        }
    }

    // ===== HOLDING PATTERN =====

    toggleHoldingPattern(state) {
        this.obs.holdingPattern = !this.obs.holdingPattern;

        if (this.obs.holdingPattern) {
            if (!this.obs.active) {
                this.toggleObs(state);
            }
            this.obs.entryType = this.calculateHoldingEntry(state.data);
            GTNCore.log(`[GTN750] Holding pattern ON - Entry: ${this.obs.entryType}, Turn: ${this.obs.turnDirection}`);
        } else {
            GTNCore.log('[GTN750] Holding pattern OFF');
        }
    }

    setHoldingLegTime(seconds) {
        this.obs.legTime = Math.max(30, Math.min(240, seconds));
    }

    toggleHoldingDirection(data) {
        this.obs.turnDirection = this.obs.turnDirection === 'R' ? 'L' : 'R';
        this.obs.entryType = this.calculateHoldingEntry(data);
    }

    calculateHoldingEntry(data) {
        if (!this.obs.active) return null;

        const track = data.track || data.heading;
        const inboundCourse = this.obs.course;
        const isRightTurn = this.obs.turnDirection === 'R';

        let relativeBearing = this.core.normalizeAngle(track - inboundCourse);

        if (!isRightTurn) {
            relativeBearing = -relativeBearing;
        }

        if (relativeBearing >= 0 && relativeBearing < 110) {
            return 'direct';
        } else if (relativeBearing >= 110 && relativeBearing < 180) {
            return 'teardrop';
        } else {
            return 'parallel';
        }
    }

    /**
     * Update NAV radio data from sim
     */
    updateNav1(d) {
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
                hasGs: d.nav1HasGs ?? false,
                dme: d.dme1Distance || d.nav1Dme || 0,
                ident: d.nav1Ident || null
            };
        }
    }

    updateNav2(d) {
        if (d.nav2Cdi !== undefined) {
            this.nav2 = {
                cdi: d.nav2Cdi,
                obs: d.nav2Obs || 0,
                radial: d.nav2Radial || 0,
                toFrom: d.nav2ToFrom ?? 2,
                signal: d.nav2Signal || 0,
                gsi: d.nav2Gsi || 0,
                gsFlag: d.nav2GsFlag ?? true,
                dme: d.dme2Distance || d.nav2Dme || 0,
                ident: d.nav2Ident || null
            };
        }
    }

    updateGps(d) {
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
    }
}
