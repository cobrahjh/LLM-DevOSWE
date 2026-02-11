/**
 * ATC Phraseology Data & Formatting
 * Type: data | Category: ai-autopilot
 * Path: ui/ai-autopilot/data/atc-phraseology.js
 *
 * Standard aviation phraseology for ATC ground operations.
 * Provides formatting functions for runway, callsign, frequency, altitude.
 */

const ATCPhraseology = {

    numberWords: {
        0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four',
        5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'niner'
    },

    phoneticAlphabet: {
        A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo',
        F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet',
        K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar',
        P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango',
        U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee',
        Z: 'Zulu'
    },

    runwayDesignators: { L: 'left', R: 'right', C: 'center' },

    /** "16R" → "one six right" */
    formatRunway(rwy) {
        if (!rwy) return '';
        const str = String(rwy).toUpperCase().trim();
        const match = str.match(/^(\d{1,2})([LRC]?)$/);
        if (!match) return str.toLowerCase();
        const digits = match[1].split('').map(c => ATCPhraseology.numberWords[+c] || c).join(' ');
        const des = match[2] ? ' ' + (ATCPhraseology.runwayDesignators[match[2]] || match[2]) : '';
        return digits + des;
    },

    /** "N12345" → "November one two three four five" */
    formatCallsign(cs) {
        if (!cs) return '';
        return String(cs).toUpperCase().split('').map(c => {
            if (/\d/.test(c)) return ATCPhraseology.numberWords[+c] || c;
            return ATCPhraseology.phoneticAlphabet[c] || c;
        }).join(' ');
    },

    /** 121.9 → "one two one point niner" */
    formatFrequency(freq) {
        if (!freq) return '';
        const parts = String(freq).split('.');
        const whole = parts[0].split('').map(c => ATCPhraseology.numberWords[+c] || c).join(' ');
        if (!parts[1]) return whole;
        const dec = parts[1].split('').map(c => ATCPhraseology.numberWords[+c] || c).join(' ');
        return whole + ' point ' + dec;
    },

    /** 3000 → "three thousand", 8500 → "eight thousand five hundred" */
    formatAltitude(alt) {
        if (alt == null) return '';
        const a = Math.round(alt);
        if (a >= 18000) {
            // Flight level
            const fl = Math.round(a / 100);
            return 'flight level ' + String(fl).split('').map(c => ATCPhraseology.numberWords[+c] || c).join(' ');
        }
        const thousands = Math.floor(a / 1000);
        const hundreds = Math.floor((a % 1000) / 100);
        let result = '';
        if (thousands > 0) result += ATCPhraseology.numberWords[thousands] + ' thousand';
        if (hundreds > 0) result += (result ? ' ' : '') + ATCPhraseology.numberWords[hundreds] + ' hundred';
        if (!result) result = 'zero';
        return result;
    },

    /** Build taxi instruction: "taxi to runway 16R via Alpha, Bravo" */
    formatTaxiInstruction(runway, taxiways) {
        const rwy = ATCPhraseology.formatRunway(runway);
        if (!taxiways || !taxiways.length) return `taxi to runway ${rwy}`;
        return `taxi to runway ${rwy} via ${taxiways.join(', ')}`;
    },

    /** Build takeoff clearance: "cleared for takeoff runway 16R" */
    formatTakeoffClearance(runway, wind) {
        const rwy = ATCPhraseology.formatRunway(runway);
        let msg = `cleared for takeoff runway ${rwy}`;
        if (wind) msg += `, wind ${ATCPhraseology.numberWords[Math.floor(wind.dir / 100)] || ''}${Math.round(wind.dir % 100)} at ${Math.round(wind.speed)}`;
        return msg;
    }
};

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ATCPhraseology;
} else if (typeof window !== 'undefined') {
    window.ATCPhraseology = ATCPhraseology;
}
