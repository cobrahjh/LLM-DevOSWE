/**
 * FSUIPC Events.txt Parser
 * Version: 1.0.0
 * Last Updated: 2025-01-08
 * Path: C:\LLM-DevOSWE\tools\fsuipc-events-parser.js
 * 
 * Parses FSUIPC7 events.txt into a searchable database.
 * Source: C:\FSUIPC7\events.txt (22,359 lines)
 */

const fs = require('fs');
const path = require('path');

const EVENTS_FILE = 'C:\\FSUIPC7\\events.txt';
const OUTPUT_DIR = 'C:\\DevOSWE\\data';

class FSUIPCEventsParser {
    constructor() {
        this.events = [];
        this.categories = new Map();
        this.vendors = new Map();
        this.aircraft = new Map();
        this.systems = new Map();
    }

    /**
     * Parse the events.txt file
     */
    parse(filePath = EVENTS_FILE) {
        console.log(`Parsing: ${filePath}`);
        
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        let currentVendor = 'Unknown';
        let currentAircraft = 'Generic';
        let currentSystem = 'General';
        let lineNum = 0;
        
        for (const line of lines) {
            lineNum++;
            const trimmed = line.trim();
            
            // Skip empty lines
            if (!trimmed) continue;
            
            // Category comment line: //Vendor/Aircraft/System
            if (trimmed.startsWith('//')) {
                const parts = trimmed.substring(2).split('/');
                if (parts.length >= 2) {
                    currentVendor = parts[0].trim();
                    currentAircraft = parts[1]?.trim() || 'Generic';
                    currentSystem = parts[2]?.trim() || 'General';
                    
                    // Track categories
                    this.addToSet(this.vendors, currentVendor);
                    this.addToSet(this.aircraft, currentAircraft);
                    this.addToSet(this.systems, currentSystem);
                    
                    const categoryKey = `${currentVendor}/${currentAircraft}/${currentSystem}`;
                    if (!this.categories.has(categoryKey)) {
                        this.categories.set(categoryKey, []);
                    }
                }
                continue;
            }
            
            // Event line: EventName#RPN_Script
            if (trimmed.includes('#')) {
                const [name, script] = trimmed.split('#', 2);
                if (name && script) {
                    const event = {
                        id: this.events.length,
                        name: name.trim(),
                        script: script.trim(),
                        vendor: currentVendor,
                        aircraft: currentAircraft,
                        system: currentSystem,
                        line: lineNum,
                        // Extract referenced variables
                        lvars: this.extractLVars(script),
                        hvars: this.extractHVars(script),
                        kvars: this.extractKVars(script),
                        avars: this.extractAVars(script)
                    };
                    
                    this.events.push(event);
                    
                    const categoryKey = `${currentVendor}/${currentAircraft}/${currentSystem}`;
                    if (this.categories.has(categoryKey)) {
                        this.categories.get(categoryKey).push(event.id);
                    }
                }
            }
        }
        
        console.log(`Parsed ${this.events.length} events`);
        console.log(`  Vendors: ${this.vendors.size}`);
        console.log(`  Aircraft: ${this.aircraft.size}`);
        console.log(`  Systems: ${this.systems.size}`);
        
        return this;
    }

    addToSet(map, key) {
        if (!map.has(key)) {
            map.set(key, 0);
        }
        map.set(key, map.get(key) + 1);
    }

    extractLVars(script) {
        const matches = script.match(/L:([^,\s\)]+)/g) || [];
        return [...new Set(matches.map(m => m.substring(2)))];
    }

    extractHVars(script) {
        const matches = script.match(/H:([^,\s\)]+)/g) || [];
        return [...new Set(matches.map(m => m.substring(2)))];
    }

    extractKVars(script) {
        const matches = script.match(/K:([^,\s\)]+)/g) || [];
        return [...new Set(matches.map(m => m.substring(2)))];
    }

    extractAVars(script) {
        const matches = script.match(/A:([^,]+),([^,\s\)]+)/g) || [];
        return [...new Set(matches.map(m => m.substring(2)))];
    }

    /**
     * Search events by name or script content
     */
    search(query, options = {}) {
        const q = query.toLowerCase();
        const {
            vendor = null,
            aircraft = null,
            system = null,
            limit = 50
        } = options;

        return this.events.filter(e => {
            // Filter by category
            if (vendor && !e.vendor.toLowerCase().includes(vendor.toLowerCase())) return false;
            if (aircraft && !e.aircraft.toLowerCase().includes(aircraft.toLowerCase())) return false;
            if (system && !e.system.toLowerCase().includes(system.toLowerCase())) return false;
            
            // Search in name and script
            return e.name.toLowerCase().includes(q) || 
                   e.script.toLowerCase().includes(q);
        }).slice(0, limit);
    }

    /**
     * Get events by aircraft
     */
    getByAircraft(aircraftName) {
        return this.events.filter(e => 
            e.aircraft.toLowerCase().includes(aircraftName.toLowerCase())
        );
    }

    /**
     * Get events by system
     */
    getBySystem(systemName) {
        return this.events.filter(e => 
            e.system.toLowerCase().includes(systemName.toLowerCase())
        );
    }

    /**
     * Get all unique LVars
     */
    getAllLVars() {
        const lvars = new Set();
        this.events.forEach(e => e.lvars.forEach(l => lvars.add(l)));
        return Array.from(lvars).sort();
    }

    /**
     * Get all unique HVars
     */
    getAllHVars() {
        const hvars = new Set();
        this.events.forEach(e => e.hvars.forEach(h => hvars.add(h)));
        return Array.from(hvars).sort();
    }

    /**
     * Get all unique KVars
     */
    getAllKVars() {
        const kvars = new Set();
        this.events.forEach(e => e.kvars.forEach(k => kvars.add(k)));
        return Array.from(kvars).sort();
    }

    /**
     * Export to JSON database
     */
    exportJSON(outputPath) {
        const data = {
            version: '1.0.0',
            generated: new Date().toISOString(),
            source: EVENTS_FILE,
            stats: {
                totalEvents: this.events.length,
                vendors: this.vendors.size,
                aircraft: this.aircraft.size,
                systems: this.systems.size,
                uniqueLVars: this.getAllLVars().length,
                uniqueHVars: this.getAllHVars().length,
                uniqueKVars: this.getAllKVars().length
            },
            vendors: Object.fromEntries(this.vendors),
            aircraft: Object.fromEntries(this.aircraft),
            systems: Object.fromEntries(this.systems),
            events: this.events
        };

        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log(`Exported to: ${outputPath}`);
        return outputPath;
    }

    /**
     * Export summary/index for quick lookups
     */
    exportIndex(outputPath) {
        const index = {
            version: '1.0.0',
            generated: new Date().toISOString(),
            lvars: this.getAllLVars(),
            hvars: this.getAllHVars(),
            kvars: this.getAllKVars(),
            categories: Object.fromEntries(
                Array.from(this.categories.entries()).map(([k, v]) => [k, v.length])
            ),
            eventNames: this.events.map(e => ({
                id: e.id,
                name: e.name,
                aircraft: e.aircraft,
                system: e.system
            }))
        };

        fs.writeFileSync(outputPath, JSON.stringify(index, null, 2));
        console.log(`Exported index to: ${outputPath}`);
        return outputPath;
    }

    /**
     * Export aircraft-specific events
     */
    exportAircraftEvents(aircraftName, outputPath) {
        const events = this.getByAircraft(aircraftName);
        const data = {
            aircraft: aircraftName,
            generated: new Date().toISOString(),
            count: events.length,
            events: events
        };

        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log(`Exported ${events.length} events for ${aircraftName}`);
        return outputPath;
    }
}

// ═══════════════════════════════════════════════════════════
// CLI INTERFACE
// ═══════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  FSUIPC Events Parser');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const parser = new FSUIPCEventsParser();
    
    // Parse events file
    parser.parse();

    console.log('\n--- Statistics ---');
    console.log(`Total Events: ${parser.events.length}`);
    console.log(`\nTop 10 Vendors:`);
    Array.from(parser.vendors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([v, c]) => console.log(`  ${v}: ${c} events`));

    console.log(`\nTop 10 Aircraft:`);
    Array.from(parser.aircraft.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([a, c]) => console.log(`  ${a}: ${c} events`));

    console.log(`\nTop 10 Systems:`);
    Array.from(parser.systems.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([s, c]) => console.log(`  ${s}: ${c} events`));

    // Export files
    console.log('\n--- Exporting ---');
    
    const fullDbPath = path.join(OUTPUT_DIR, 'fsuipc-events-full.json');
    parser.exportJSON(fullDbPath);

    const indexPath = path.join(OUTPUT_DIR, 'fsuipc-events-index.json');
    parser.exportIndex(indexPath);

    // Export popular aircraft
    const popularAircraft = ['Comanche', 'A320', 'A32NX', 'CJ4', 'Citation', 'Cessna'];
    for (const aircraft of popularAircraft) {
        const events = parser.getByAircraft(aircraft);
        if (events.length > 0) {
            const acPath = path.join(OUTPUT_DIR, `fsuipc-events-${aircraft.toLowerCase()}.json`);
            parser.exportAircraftEvents(aircraft, acPath);
        }
    }

    // Sample searches
    console.log('\n--- Sample Searches ---');
    
    console.log('\nSearch: "autopilot"');
    const apResults = parser.search('autopilot', { limit: 5 });
    apResults.forEach(e => console.log(`  [${e.aircraft}] ${e.name}`));

    console.log('\nSearch: "light" in Comanche');
    const lightResults = parser.search('light', { aircraft: 'Comanche', limit: 5 });
    lightResults.forEach(e => console.log(`  [${e.system}] ${e.name}`));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Export Complete!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\nFiles created in: ${OUTPUT_DIR}`);
}

// Export for module use
module.exports = { FSUIPCEventsParser };

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}
