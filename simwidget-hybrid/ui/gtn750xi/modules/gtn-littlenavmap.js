/**
 * GTN Little Navmap Integration v1.0.0
 * .PLN flight plan import/export and UDP position sharing
 */

class GTNLittleNavMap {
    constructor(options = {}) {
        this.core = options.core || new GTNCore();
        this.flightPlan = options.flightPlan || null;
        this.serverPort = options.serverPort || 8080;

        // UDP position sharing state
        this.udpEnabled = false;
        this.udpInterval = null;
        this.udpUpdateRate = 200; // 5Hz position updates
        this.lastPosition = null;
    }

    /**
     * Import Little Navmap .pln file (XML format)
     * @param {File} file - .pln file from file input
     * @returns {Promise<Object>} Parsed flight plan
     */
    async importPln(file) {
        try {
            const text = await file.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');

            // Check for parse errors
            const parseError = xml.querySelector('parsererror');
            if (parseError) {
                throw new Error('Invalid XML format');
            }

            // Extract flight plan data from SimBase.Document structure
            const flightPlan = xml.querySelector('SimBase\\.Document');
            if (!flightPlan) {
                throw new Error('Not a valid Little Navmap .pln file');
            }

            const waypoints = [];
            const wpts = xml.querySelectorAll('ATCWaypoint');

            wpts.forEach((wpt, idx) => {
                const id = wpt.getAttribute('id') || `WPT${idx + 1}`;
                const latNode = wpt.querySelector('WorldPosition');
                if (!latNode) return;

                const coords = latNode.textContent.split(',');
                if (coords.length < 3) return;

                const lat = parseFloat(coords[0]);
                const lon = parseFloat(coords[1]);
                const alt = parseFloat(coords[2]); // altitude in meters

                const type = wpt.querySelector('ATCWaypointType')?.textContent || 'User';
                const icao = wpt.querySelector('ICAOIdent')?.textContent || id;

                waypoints.push({
                    ident: icao,
                    lat,
                    lng: lon,
                    alt: Math.round(alt * 3.28084), // convert meters to feet
                    type: this.mapLnmTypeToGtn(type),
                    name: icao
                });
            });

            // Extract departure/destination
            const departure = xml.querySelector('DepartureID')?.textContent || null;
            const destination = xml.querySelector('DestinationID')?.textContent || null;
            const cruiseAlt = xml.querySelector('CruisingAlt')?.textContent || '0';

            GTNCore.log(`[LittleNavMap] Imported ${waypoints.length} waypoints from ${file.name}`);

            return {
                waypoints,
                departure,
                destination,
                cruiseAltitude: Math.round(parseFloat(cruiseAlt) * 3.28084), // meters to feet
                source: 'LittleNavMap'
            };
        } catch (e) {
            console.error('[LittleNavMap] Import failed:', e);
            throw new Error(`Failed to import .pln: ${e.message}`);
        }
    }

    /**
     * Export GTN750 flight plan to Little Navmap .pln format
     * @param {Object} flightPlan - GTN750 flight plan
     * @param {string} filename - Output filename
     */
    exportPln(flightPlan, filename = 'flight-plan.pln') {
        if (!flightPlan || !flightPlan.waypoints || flightPlan.waypoints.length < 2) {
            throw new Error('Flight plan must have at least 2 waypoints');
        }

        const waypoints = flightPlan.waypoints;
        const departure = waypoints[0].ident || 'ORIG';
        const destination = waypoints[waypoints.length - 1].ident || 'DEST';
        const cruiseAlt = (flightPlan.cruiseAltitude || 5000) * 0.3048; // feet to meters

        // Build XML
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<SimBase.Document Type="AceXML" version="1,0">\n';
        xml += '  <Descr>AceXML Document</Descr>\n';
        xml += '  <FlightPlan.FlightPlan>\n';
        xml += `    <Title>${departure} to ${destination}</Title>\n`;
        xml += '    <FPType>VFR</FPType>\n';
        xml += '    <RouteType>Direct</RouteType>\n';
        xml += `    <CruisingAlt>${cruiseAlt.toFixed(0)}</CruisingAlt>\n`;
        xml += `    <DepartureID>${departure}</DepartureID>\n`;
        xml += '    <DepartureLLA/>\n';
        xml += `    <DestinationID>${destination}</DestinationID>\n`;
        xml += '    <DestinationLLA/>\n';
        xml += '    <Descr>Exported from GTN750</Descr>\n';
        xml += '    <DeparturePosition/>\n';
        xml += '    <DepartureName/>\n';
        xml += '    <DestinationName/>\n';
        xml += '    <AppVersion>\n';
        xml += '      <AppVersionMajor>11</AppVersionMajor>\n';
        xml += '      <AppVersionBuild>282174</AppVersionBuild>\n';
        xml += '    </AppVersion>\n';

        waypoints.forEach((wpt, idx) => {
            const altMeters = (wpt.alt || 0) * 0.3048;
            const type = this.mapGtnTypeToLnm(wpt.type);

            xml += `    <ATCWaypoint id="${wpt.ident || `WPT${idx + 1}`}">\n`;
            xml += `      <ATCWaypointType>${type}</ATCWaypointType>\n`;
            xml += `      <WorldPosition>${wpt.lat},${wpt.lng},${altMeters.toFixed(6)}</WorldPosition>\n`;
            xml += `      <SpeedMaxFP>-1</SpeedMaxFP>\n`;
            xml += `      <ICAO>\n`;
            xml += `        <ICAOIdent>${wpt.ident || ''}</ICAOIdent>\n`;
            xml += '      </ICAO>\n';
            xml += '    </ATCWaypoint>\n';
        });

        xml += '  </FlightPlan.FlightPlan>\n';
        xml += '</SimBase.Document>\n';

        // Trigger download
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        GTNCore.log(`[LittleNavMap] Exported ${waypoints.length} waypoints to ${filename}`);
    }

    /**
     * Map Little Navmap waypoint type to GTN750 type
     */
    mapLnmTypeToGtn(lnmType) {
        const mapping = {
            'Airport': 'airport',
            'VOR': 'vor',
            'NDB': 'ndb',
            'Intersection': 'fix',
            'User': 'user'
        };
        return mapping[lnmType] || 'user';
    }

    /**
     * Map GTN750 waypoint type to Little Navmap type
     */
    mapGtnTypeToLnm(gtnType) {
        const mapping = {
            'airport': 'Airport',
            'vor': 'VOR',
            'ndb': 'NDB',
            'fix': 'Intersection',
            'user': 'User'
        };
        return mapping[gtnType] || 'User';
    }

    /**
     * Start UDP position broadcasting to Little Navmap
     * Little Navmap listens on UDP port 49002 by default
     * @param {Object} options - { port: 49002, rate: 200 }
     */
    async startUdpBroadcast(options = {}) {
        const port = options.port || 49002;
        const rate = options.rate || this.udpUpdateRate;

        try {
            // Send enable request to backend
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/littlenavmap/udp/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ port, rate })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            this.udpEnabled = true;
            this.startPositionUpdates();
            GTNCore.log(`[LittleNavMap] UDP broadcast started (port ${port}, ${1000/rate}Hz)`);

            return true;
        } catch (e) {
            console.error('[LittleNavMap] Failed to start UDP broadcast:', e);
            return false;
        }
    }

    /**
     * Stop UDP position broadcasting
     */
    async stopUdpBroadcast() {
        try {
            await fetch(`http://${location.hostname}:${this.serverPort}/api/littlenavmap/udp/stop`, {
                method: 'POST'
            });

            this.udpEnabled = false;
            this.stopPositionUpdates();
            GTNCore.log('[LittleNavMap] UDP broadcast stopped');

            return true;
        } catch (e) {
            console.error('[LittleNavMap] Failed to stop UDP broadcast:', e);
            return false;
        }
    }

    /**
     * Start sending position updates
     */
    startPositionUpdates() {
        if (this.udpInterval) return;

        this.udpInterval = setInterval(() => {
            if (this.lastPosition) {
                this.sendPositionUpdate(this.lastPosition);
            }
        }, this.udpUpdateRate);
    }

    /**
     * Stop sending position updates
     */
    stopPositionUpdates() {
        if (this.udpInterval) {
            clearInterval(this.udpInterval);
            this.udpInterval = null;
        }
    }

    /**
     * Update current position (called by main pane)
     */
    updatePosition(data) {
        this.lastPosition = {
            lat: data.latitude,
            lon: data.longitude,
            alt: data.altitude,
            heading: data.heading,
            groundSpeed: data.groundSpeed,
            verticalSpeed: data.verticalSpeed || 0
        };
    }

    /**
     * Send position update to backend for UDP broadcast
     */
    async sendPositionUpdate(position) {
        if (!this.udpEnabled) return;

        try {
            await fetch(`http://${location.hostname}:${this.serverPort}/api/littlenavmap/udp/position`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(position)
            });
        } catch (e) {
            // Silent fail on position updates
        }
    }

    /**
     * Get UDP broadcast status
     */
    async getUdpStatus() {
        try {
            const response = await fetch(`http://${location.hostname}:${this.serverPort}/api/littlenavmap/udp/status`);
            return await response.json();
        } catch (e) {
            return { enabled: false };
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.stopUdpBroadcast();
        this.stopPositionUpdates();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GTNLittleNavMap;
}
