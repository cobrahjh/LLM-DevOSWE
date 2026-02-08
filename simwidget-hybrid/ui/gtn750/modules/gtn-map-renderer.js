/**
 * GTN Map Renderer - Canvas map rendering (route, waypoints, aircraft, compass, overlays)
 * Extracted from widget.js for modular architecture
 */

class GTNMapRenderer {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.getState = options.getState || (() => ({}));

        // Render loop
        this._renderFrameId = null;
        this._boundRenderLoop = this._renderLoop.bind(this);

        // Waypoint position cache for performance
        this._waypointCache = new Map();
        this._lastCacheKey = null;
    }

    // ===== RENDER LOOP =====

    start() {
        this._renderFrameId = requestAnimationFrame(this._boundRenderLoop);
    }

    stop() {
        if (this._renderFrameId) {
            cancelAnimationFrame(this._renderFrameId);
            this._renderFrameId = null;
        }
    }

    _renderLoop() {
        this.renderMap();
        this._renderFrameId = requestAnimationFrame(this._boundRenderLoop);
    }

    // ===== MAIN RENDER =====

    renderMap() {
        const state = this.getState();
        if (!state.ctx) return;

        const ctx = state.ctx;
        const w = state.canvas.width;
        const h = state.canvas.height;

        const cx = w / 2 + (state.panOffset?.x || 0);
        const cy = h / 2 + (state.panOffset?.y || 0);

        // Clear
        ctx.fillStyle = '#0a1520';
        ctx.fillRect(0, 0, w, h);

        // Range rings (behind everything)
        if ((state.declutterLevel || 0) < 2) {
            this.renderRangeRings(ctx, cx, cy, w, h, state);
        }

        // Terrain overlay
        if (state.map.showTerrain && state.terrainOverlay) {
            state.terrainOverlay.setEnabled(true);
            state.terrainOverlay.setInhibited(state.taws?.inhibited);
            state.terrainOverlay.render(ctx, {
                latitude: state.data.latitude,
                longitude: state.data.longitude,
                altitude: state.data.altitude,
                heading: state.data.heading,
                verticalSpeed: state.data.verticalSpeed,
                groundSpeed: state.data.groundSpeed
            }, {
                range: state.map.range,
                orientation: state.map.orientation,
                width: w,
                height: h
            });
        } else if (state.terrainOverlay) {
            state.terrainOverlay.setEnabled(false);
        }

        // Fuel range ring
        if (state.map.showFuelRange !== false && state.data.fuelTotal && state.data.fuelFlow && state.data.groundSpeed) {
            this.renderFuelRangeRing(ctx, cx, cy, w, h, state);
        }

        // Weather overlay
        if (state.map.showWeather && state.weatherOverlay) {
            state.weatherOverlay.setEnabled(true);
            state.weatherOverlay.render(ctx, {
                latitude: state.data.latitude,
                longitude: state.data.longitude,
                altitude: state.data.altitude,
                heading: state.data.heading
            }, {
                range: state.map.range,
                orientation: state.map.orientation,
                width: w,
                height: h,
                heading: state.data.heading
            });
        } else if (state.weatherOverlay) {
            state.weatherOverlay.setEnabled(false);
        }

        // Flight plan route
        if (state.flightPlan?.waypoints) {
            this.renderRoute(ctx, cx, cy, w, h, state);
        }

        // OBS course line
        if (state.obs?.active) {
            this.renderObsCourseLine(ctx, cx, cy, w, h, state);
        }

        // Traffic overlay
        if (state.map.showTraffic && state.trafficOverlay) {
            state.trafficOverlay.setEnabled(true);
            state.trafficOverlay.render(ctx, {
                latitude: state.data.latitude,
                longitude: state.data.longitude,
                altitude: state.data.altitude,
                heading: state.data.heading,
                verticalSpeed: state.data.verticalSpeed,
                groundSpeed: state.data.groundSpeed
            }, {
                range: state.map.range,
                orientation: state.map.orientation,
                width: w,
                height: h
            });
        } else if (state.trafficOverlay) {
            state.trafficOverlay.setEnabled(false);
        }

        // Aircraft symbol (always at true center)
        this.renderAircraft(ctx, w / 2, h / 2);

        // Compass rose
        this.renderCompass(ctx, w / 2, h / 2, Math.min(w, h) / 2 - 25, state);

        // Wind vector
        this.renderWindVector(ctx, 50, 50, state);

        // Bearing pointers
        if (state.map.showBearingPointers !== false) {
            this.renderBearingPointers(ctx, w / 2, h / 2, Math.min(w, h) / 2 - 30, state);
        }

        // Map orientation indicator
        this.renderOrientationIndicator(ctx, w - 45, 45, state);

        // Update datafields callback
        if (state.onUpdateDatafields) state.onUpdateDatafields();
    }

    // ===== HELPER =====

    getMapRotation(state) {
        switch (state.map.orientation) {
            case 'north': return 0;
            case 'track': return state.data.track || state.data.heading;
            case 'heading': return state.data.heading;
            default: return state.data.heading;
        }
    }

    // ===== RENDERING METHODS =====

    renderOrientationIndicator(ctx, x, y, state) {
        ctx.save();

        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 10, 20, 0.85)';
        ctx.fill();
        ctx.strokeStyle = '#1a3040';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.translate(x, y);
        const rotation = this.getMapRotation(state) * Math.PI / 180;
        ctx.rotate(-rotation);

        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(-5, -6);
        ctx.lineTo(0, -9);
        ctx.lineTo(5, -6);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, 16);
        ctx.lineTo(-5, 6);
        ctx.lineTo(0, 9);
        ctx.lineTo(5, 6);
        ctx.closePath();
        ctx.fill();

        ctx.rotate(rotation);
        ctx.font = 'bold 9px Consolas, monospace';
        ctx.fillStyle = '#ff3333';
        ctx.textAlign = 'center';
        ctx.fillText('N', 0, -16 + Math.cos(rotation) * 20);

        ctx.restore();

        const modeLabels = { north: 'NORTH', track: 'TRK', heading: 'HDG' };
        ctx.font = '8px Consolas, monospace';
        ctx.fillStyle = '#00ccff';
        ctx.textAlign = 'center';
        ctx.fillText(modeLabels[state.map.orientation] || 'TRK', x, y + 34);
    }

    renderObsCourseLine(ctx, cx, cy, w, h, state) {
        if (!state.obs?.active) return;

        const wp = state.flightPlan?.waypoints?.[state.activeWaypointIndex];
        if (!wp || !wp.lat || !wp.lng) return;

        ctx.save();

        const rotation = this.getMapRotation(state);
        const wpPos = this.core.latLonToCanvas(
            wp.lat, wp.lng,
            state.data.latitude, state.data.longitude,
            rotation, state.map.range,
            w, h, state.map.orientation === 'north'
        );

        const courseRad = (state.obs.course - rotation) * Math.PI / 180;
        const lineLength = Math.max(w, h) * 1.5;

        const x1 = wpPos.x - Math.sin(courseRad) * lineLength;
        const y1 = wpPos.y + Math.cos(courseRad) * lineLength;
        const x2 = wpPos.x + Math.sin(courseRad) * lineLength;
        const y2 = wpPos.y - Math.cos(courseRad) * lineLength;

        ctx.beginPath();
        ctx.setLineDash([8, 4]);
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(wpPos.x, wpPos.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        const arrowDist = 40;
        const arrowX = wpPos.x - Math.sin(courseRad) * arrowDist;
        const arrowY = wpPos.y + Math.cos(courseRad) * arrowDist;

        ctx.beginPath();
        ctx.fillStyle = '#ff00ff';
        const arrowSize = 8;
        ctx.moveTo(
            arrowX - Math.sin(courseRad) * arrowSize,
            arrowY + Math.cos(courseRad) * arrowSize
        );
        ctx.lineTo(
            arrowX + Math.cos(courseRad) * arrowSize / 2,
            arrowY + Math.sin(courseRad) * arrowSize / 2
        );
        ctx.lineTo(
            arrowX - Math.cos(courseRad) * arrowSize / 2,
            arrowY - Math.sin(courseRad) * arrowSize / 2
        );
        ctx.closePath();
        ctx.fill();

        ctx.font = 'bold 11px Consolas, monospace';
        ctx.fillStyle = '#ff00ff';
        ctx.textAlign = 'center';
        ctx.fillText(`OBS ${state.obs.course.toString().padStart(3, '0')}°`, cx, 25);

        if (state.obs.holdingPattern) {
            this.renderHoldingPattern(ctx, wpPos, w, h, state);
        }

        ctx.restore();
    }

    renderHoldingPattern(ctx, wpPos, w, h, state) {
        const legNm = (state.obs.legTime / 60) * 3;
        const legPixels = this.core.nmToPixels(legNm, state.map.range, Math.min(w, h));
        const turnRadius = legPixels * 0.3;

        const rotation = this.getMapRotation(state);
        const courseRad = (state.obs.course - rotation) * Math.PI / 180;
        const isRightTurn = state.obs.turnDirection === 'R';

        ctx.save();
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);

        const perpAngle = isRightTurn ? courseRad - Math.PI / 2 : courseRad + Math.PI / 2;
        const offsetX = Math.sin(perpAngle) * turnRadius * 2;
        const offsetY = -Math.cos(perpAngle) * turnRadius * 2;

        const inboundEnd = { x: wpPos.x, y: wpPos.y };
        const inboundStart = {
            x: wpPos.x + Math.sin(courseRad) * legPixels,
            y: wpPos.y - Math.cos(courseRad) * legPixels
        };

        const outboundStart = {
            x: inboundEnd.x + offsetX,
            y: inboundEnd.y + offsetY
        };
        const outboundEnd = {
            x: inboundStart.x + offsetX,
            y: inboundStart.y + offsetY
        };

        ctx.beginPath();

        ctx.moveTo(inboundStart.x, inboundStart.y);
        ctx.lineTo(inboundEnd.x, inboundEnd.y);

        const turn1CenterX = (inboundEnd.x + outboundStart.x) / 2;
        const turn1CenterY = (inboundEnd.y + outboundStart.y) / 2;
        const turn1StartAngle = isRightTurn ? courseRad - Math.PI : courseRad;
        const turn1EndAngle = isRightTurn ? courseRad : courseRad + Math.PI;

        ctx.arc(turn1CenterX, turn1CenterY, turnRadius,
            turn1StartAngle - Math.PI / 2,
            turn1EndAngle - Math.PI / 2,
            !isRightTurn
        );

        ctx.lineTo(outboundEnd.x, outboundEnd.y);

        const turn2CenterX = (outboundEnd.x + inboundStart.x) / 2;
        const turn2CenterY = (outboundEnd.y + inboundStart.y) / 2;

        ctx.arc(turn2CenterX, turn2CenterY, turnRadius,
            turn1EndAngle - Math.PI / 2,
            turn1StartAngle - Math.PI / 2,
            !isRightTurn
        );

        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = '9px Consolas, monospace';
        ctx.fillStyle = '#ff00ff';
        ctx.textAlign = 'center';
        const labelX = (inboundStart.x + outboundEnd.x) / 2;
        const labelY = (inboundStart.y + outboundEnd.y) / 2;
        ctx.fillText(`HOLD ${state.obs.turnDirection}`, labelX, labelY);

        ctx.restore();
    }

    renderWindVector(ctx, x, y, state) {
        const windDir = state.data.windDirection || 0;
        const windSpd = state.data.windSpeed || 0;

        if (windSpd < 1) return;

        ctx.save();

        ctx.beginPath();
        ctx.arc(x, y, 28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 10, 20, 0.85)';
        ctx.fill();
        ctx.strokeStyle = '#1a3040';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.translate(x, y);

        const mapRotation = this.getMapRotation(state);
        const arrowAngle = (windDir - mapRotation) * Math.PI / 180;

        ctx.rotate(arrowAngle);

        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(0, 12);
        ctx.stroke();

        ctx.fillStyle = '#00ccff';
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(-6, -10);
        ctx.lineTo(6, -10);
        ctx.closePath();
        ctx.fill();

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

        ctx.font = 'bold 10px Consolas, monospace';
        ctx.fillStyle = '#00ccff';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(windDir)}°`, x, y + 42);
        ctx.fillText(`${Math.round(windSpd)}kt`, x, y + 54);
    }

    renderFuelRangeRing(ctx, cx, cy, w, h, state) {
        const fuelTotal = state.data.fuelTotal || 0;
        const fuelFlow = state.data.fuelFlow || 1;
        const groundSpeed = state.data.groundSpeed || 100;

        const enduranceHours = fuelTotal / fuelFlow;
        const rangeNm = enduranceHours * groundSpeed;

        if (rangeNm > state.map.range * 2) return;
        if (rangeNm < 5) return;

        const pixelsPerNm = Math.min(w, h) / 2 / state.map.range;
        const ringRadius = rangeNm * pixelsPerNm;

        ctx.save();

        ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);

        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);

        const labelAngle = -Math.PI / 4;
        const labelX = cx + Math.cos(labelAngle) * ringRadius;
        const labelY = cy + Math.sin(labelAngle) * ringRadius;

        ctx.font = 'bold 10px Consolas, monospace';
        ctx.fillStyle = 'rgba(255, 165, 0, 0.9)';
        ctx.textAlign = 'left';

        const labelText = `FUEL ${Math.round(rangeNm)}nm`;
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillStyle = 'rgba(0, 10, 20, 0.8)';
        ctx.fillRect(labelX + 4, labelY - 10, textWidth + 6, 14);

        ctx.fillStyle = '#ffa500';
        ctx.fillText(labelText, labelX + 7, labelY);

        ctx.restore();
    }

    renderRangeRings(ctx, cx, cy, w, h, state) {
        const range = state.map.range;
        const pixelsPerNm = Math.min(w, h) / 2 / range;
        const declutterLevel = state.declutterLevel || 0;

        ctx.strokeStyle = 'rgba(40, 80, 100, 0.6)';
        ctx.lineWidth = 1;

        let interval;
        if (range <= 5) interval = 1;
        else if (range <= 10) interval = 2;
        else if (range <= 25) interval = 5;
        else if (range <= 50) interval = 10;
        else interval = 25;

        for (let r = interval; r <= range; r += interval) {
            const radius = r * pixelsPerNm;

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.stroke();

            if (declutterLevel < 1) {
                ctx.font = '9px Consolas, monospace';
                ctx.fillStyle = 'rgba(80, 160, 200, 0.8)';
                ctx.textAlign = 'left';
                ctx.fillText(`${r}`, cx + radius + 3, cy + 3);
            }
        }

        if (declutterLevel < 1) {
            ctx.strokeStyle = 'rgba(40, 80, 100, 0.3)';
            ctx.setLineDash([4, 8]);

            const rotation = this.getMapRotation(state) * Math.PI / 180;
            const maxRadius = range * pixelsPerNm;

            ctx.beginPath();
            ctx.moveTo(cx + Math.sin(rotation) * maxRadius, cy - Math.cos(rotation) * maxRadius);
            ctx.lineTo(cx - Math.sin(rotation) * maxRadius, cy + Math.cos(rotation) * maxRadius);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(rotation) * maxRadius, cy + Math.sin(rotation) * maxRadius);
            ctx.lineTo(cx - Math.cos(rotation) * maxRadius, cy - Math.sin(rotation) * maxRadius);
            ctx.stroke();

            ctx.setLineDash([]);
        }
    }

    renderBearingPointers(ctx, cx, cy, radius, state) {
        const mapRotation = this.getMapRotation(state);

        if (state.nav1 && state.nav1.signal > 10) {
            const bearing = state.nav1.radial + 180;
            this.drawBearingPointer(ctx, cx, cy, radius, bearing - mapRotation, '#00ffff', 'single', '1');
        }

        if (state.nav2 && state.nav2.signal > 10) {
            const bearing = state.nav2.radial + 180;
            this.drawBearingPointer(ctx, cx, cy, radius, bearing - mapRotation, '#ffffff', 'double', '2');
        }

        if ((!state.nav1?.signal || state.nav1.signal < 10) && state.activeWaypoint) {
            const bearing = this.core.calculateBearing(
                state.data.latitude, state.data.longitude,
                state.activeWaypoint.lat, state.activeWaypoint.lon
            );
            this.drawBearingPointer(ctx, cx, cy, radius, bearing - mapRotation, '#ff00ff', 'single', 'W');
        }
    }

    drawBearingPointer(ctx, cx, cy, radius, angle, color, style, label) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle * Math.PI / 180);

        const innerRadius = radius - 20;
        const outerRadius = radius + 5;

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;

        if (style === 'single') {
            ctx.beginPath();
            ctx.moveTo(0, -outerRadius);
            ctx.lineTo(-6, -outerRadius + 12);
            ctx.lineTo(6, -outerRadius + 12);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(0, -outerRadius + 12);
            ctx.lineTo(0, -innerRadius);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, innerRadius);
            ctx.lineTo(0, outerRadius - 10);
            ctx.stroke();
        } else {
            const offset = 3;

            ctx.beginPath();
            ctx.moveTo(-offset, -outerRadius);
            ctx.lineTo(-offset, -innerRadius);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(offset, -outerRadius);
            ctx.lineTo(offset, -innerRadius);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, -outerRadius - 5);
            ctx.lineTo(-8, -outerRadius + 8);
            ctx.lineTo(8, -outerRadius + 8);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(-offset, innerRadius);
            ctx.lineTo(-offset, outerRadius - 10);
            ctx.moveTo(offset, innerRadius);
            ctx.lineTo(offset, outerRadius - 10);
            ctx.stroke();
        }

        ctx.font = 'bold 9px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, 0, -innerRadius + 15);

        ctx.restore();
    }

    renderRoute(ctx, cx, cy, w, h, state) {
        const pixelsPerNm = Math.min(w, h) / 2 / state.map.range;
        const waypoints = state.flightPlan.waypoints;
        const rotation = this.getMapRotation(state);
        const activeIdx = state.activeWaypointIndex || 0;
        const declutterLevel = state.declutterLevel || 0;

        // Cache waypoint positions - only recalculate when aircraft moves significantly
        const cacheKey = `${Math.round(state.data.latitude * 100)},${Math.round(state.data.longitude * 100)},${state.map.range},${Math.round(rotation)}`;

        if (this._lastCacheKey !== cacheKey) {
            this._waypointCache.clear();
            this._lastCacheKey = cacheKey;
        }

        const positions = waypoints.map(wp => {
            if (!wp.lat || !wp.lng) return null;

            // Check cache first
            const wpKey = `${wp.lat},${wp.lng}`;
            if (!this._waypointCache.has(wpKey)) {
                const pos = this.core.latLonToCanvas(
                    wp.lat, wp.lng,
                    state.data.latitude, state.data.longitude,
                    rotation, state.map.range,
                    w, h, state.map.orientation === 'north'
                );
                this._waypointCache.set(wpKey, pos);
            }
            return this._waypointCache.get(wpKey);
        });

        // Completed legs (dimmed)
        if (activeIdx > 0) {
            ctx.strokeStyle = 'rgba(128, 0, 128, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < activeIdx; i++) {
                if (!positions[i]) continue;
                if (!started) {
                    ctx.moveTo(positions[i].x, positions[i].y);
                    started = true;
                } else {
                    ctx.lineTo(positions[i].x, positions[i].y);
                }
            }
            if (positions[activeIdx]) {
                ctx.lineTo(positions[activeIdx].x, positions[activeIdx].y);
            }
            ctx.stroke();
        }

        // Future legs
        if (activeIdx < waypoints.length - 1) {
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            let started = false;
            for (let i = activeIdx; i < waypoints.length; i++) {
                if (!positions[i]) continue;
                if (!started) {
                    ctx.moveTo(positions[i].x, positions[i].y);
                    started = true;
                } else {
                    ctx.lineTo(positions[i].x, positions[i].y);
                }
            }
            ctx.stroke();
        }

        // Active leg glow
        if (activeIdx > 0 && positions[activeIdx - 1] && positions[activeIdx]) {
            ctx.strokeStyle = 'rgba(255, 0, 255, 0.3)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(positions[activeIdx - 1].x, positions[activeIdx - 1].y);
            ctx.lineTo(positions[activeIdx].x, positions[activeIdx].y);
            ctx.stroke();

            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(positions[activeIdx - 1].x, positions[activeIdx - 1].y);
            ctx.lineTo(positions[activeIdx].x, positions[activeIdx].y);
            ctx.stroke();
        }

        // DTK line from aircraft to active waypoint
        if (positions[activeIdx] && state.gps?.dtk) {
            const dtkAngle = (state.gps.dtk - rotation) * Math.PI / 180;
            const lineLength = Math.min(w, h) * 0.8;

            ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.sin(dtkAngle) * lineLength, cy - Math.cos(dtkAngle) * lineLength);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Waypoint symbols
        waypoints.forEach((wp, index) => {
            if (!positions[index]) return;
            const isActive = index === activeIdx;
            const isCompleted = index < activeIdx;
            this.renderWaypoint(ctx, positions[index].x, positions[index].y, wp.ident, isActive, isCompleted, declutterLevel);
        });
    }

    renderWaypoint(ctx, x, y, ident, isActive, isCompleted, declutterLevel) {
        let color;
        if (isActive) {
            color = '#ff00ff';
        } else if (isCompleted) {
            color = 'rgba(128, 128, 128, 0.5)';
        } else {
            color = '#00aaff';
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 6);
        ctx.lineTo(x - 5, y);
        ctx.closePath();
        ctx.fill();

        if (isActive) {
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (ident && (!isCompleted || (declutterLevel || 0) < 2)) {
            ctx.fillStyle = isActive ? '#ff00ff' : (isCompleted ? '#888888' : '#00ff00');
            ctx.font = isActive ? 'bold 11px Consolas, monospace' : '10px Consolas, monospace';
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

    renderCompass(ctx, cx, cy, radius, state) {
        const rotation = this.getMapRotation(state);

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
}
