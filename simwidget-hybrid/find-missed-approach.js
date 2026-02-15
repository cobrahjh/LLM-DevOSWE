/**
 * Search for missed approach data in various ways
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'data', 'navdb.sqlite');

console.log('🔍 Searching for missed approach data\n');

try {
    const db = new Database(dbPath, { readonly: true });

    // Strategy 1: Look for procedures with "MISSED" in ident
    console.log('Strategy 1: Procedures with MISSED in name');
    const missedProcs = db.prepare(`
        SELECT id, airport_icao, ident, type, runway
        FROM procedures
        WHERE ident LIKE '%MISSED%'
        LIMIT 10
    `).all();
    console.log(`  Found: ${missedProcs.length} procedures`);
    if (missedProcs.length > 0) {
        missedProcs.forEach(p => {
            console.log(`    ${p.airport_icao} - ${p.type} - ${p.ident}`);
        });
    }

    // Strategy 2: Look for approaches with more than 10 legs (might include missed)
    console.log('\nStrategy 2: Long approach procedures (>10 legs)');
    const longProcs = db.prepare(`
        SELECT p.id, p.airport_icao, p.ident, p.runway, COUNT(*) as leg_count
        FROM procedures p
        JOIN procedure_legs l ON p.id = l.procedure_id
        WHERE p.type = 'APPROACH'
        GROUP BY p.id
        HAVING COUNT(*) > 10
        ORDER BY leg_count DESC
        LIMIT 5
    `).all();
    console.log(`  Found: ${longProcs.length} procedures with >10 legs`);
    if (longProcs.length > 0) {
        longProcs.forEach(p => {
            console.log(`    ${p.airport_icao} - ${p.ident} - ${p.leg_count} legs`);
        });

        // Check the longest one
        if (longProcs[0]) {
            console.log(`\n  Analyzing longest: ${longProcs[0].ident} (${longProcs[0].leg_count} legs)`);
            const legs = db.prepare(`
                SELECT seq, fix_ident, path_term, alt_desc, alt1
                FROM procedure_legs
                WHERE procedure_id = ?
                ORDER BY seq
            `).all(longProcs[0].id);

            console.log('  Seq  Fix      PathTerm  Alt');
            legs.forEach(leg => {
                const altStr = leg.alt_desc && leg.alt1
                    ? `${leg.alt_desc}${Math.round(leg.alt1 / 100)}`
                    : '';
                console.log(`  ${leg.seq.toString().padStart(3)}  ${(leg.fix_ident || '').padEnd(8)}  ${(leg.path_term || '??').padEnd(8)}  ${altStr}`);
            });
        }
    }

    // Strategy 3: Look for specific missed approach path terminators
    console.log('\nStrategy 3: Legs with missed approach path terminators');
    const missedPathTerms = ['HM', 'HA', 'HF', 'CA', 'VM', 'VI', 'FA', 'FM'];
    const missedLegs = db.prepare(`
        SELECT DISTINCT p.airport_icao, p.ident, p.id, l.path_term, COUNT(*) as count
        FROM procedure_legs l
        JOIN procedures p ON l.procedure_id = p.id
        WHERE l.path_term IN (${missedPathTerms.map(() => '?').join(',')})
        AND p.airport_icao = 'KDEN'
        GROUP BY p.id, l.path_term
        LIMIT 10
    `).all(...missedPathTerms);

    console.log(`  Found: ${missedLegs.length} procedures with missed approach path terms`);
    if (missedLegs.length > 0) {
        missedLegs.forEach(p => {
            console.log(`    ${p.airport_icao} - ${p.ident} - ${p.path_term} (${p.count}x)`);
        });
    }

    // Strategy 4: Check if CIFP stores missed in sequence ranges
    console.log('\nStrategy 4: Check sequence number patterns');
    const seqPattern = db.prepare(`
        SELECT procedure_id, MIN(seq) as min_seq, MAX(seq) as max_seq, COUNT(*) as count
        FROM procedure_legs
        WHERE procedure_id IN (
            SELECT id FROM procedures WHERE airport_icao = 'KDEN' AND type = 'APPROACH' LIMIT 5
        )
        GROUP BY procedure_id
    `).all();

    console.log('  Procedure ID  Min Seq  Max Seq  Count  Gap?');
    seqPattern.forEach(p => {
        const expectedCount = (p.max_seq - p.min_seq) / 10 + 1;
        const hasGap = p.count < expectedCount;
        console.log(`  ${p.procedure_id.toString().padStart(12)}  ${p.min_seq.toString().padStart(7)}  ${p.max_seq.toString().padStart(7)}  ${p.count.toString().padStart(5)}  ${hasGap ? 'YES - Missing seqs!' : 'No'}`);
    });

    db.close();

    console.log('\n💡 Conclusion:');
    if (missedLegs.length > 0 || longProcs.length > 0 || missedProcs.length > 0) {
        console.log('  Missed approach data EXISTS in navdb!');
    } else {
        console.log('  Missed approach data NOT found in current CIFP import.');
        console.log('  FAA CIFP may not include missed approach procedures,');
        console.log('  or the parser needs to extract them from the same record.');
    }

} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
