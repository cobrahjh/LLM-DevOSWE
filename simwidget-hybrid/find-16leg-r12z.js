/**
 * Find the 16-leg R12-Z procedure
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'data', 'navdb.sqlite');

console.log('🔍 Finding 16-leg R12-Z procedure\n');

try {
    const db = new Database(dbPath, { readonly: true });

    // Get all R12-Z procedures at KBIH
    const procs = db.prepare(`
        SELECT p.id, p.airport_icao, p.ident, p.type, p.runway, p.transition, COUNT(l.seq) as leg_count
        FROM procedures p
        LEFT JOIN procedure_legs l ON p.id = l.procedure_id
        WHERE p.airport_icao = 'KBIH'
        AND p.ident = 'R12-Z'
        GROUP BY p.id
        ORDER BY leg_count DESC
    `).all();

    console.log(`Found ${procs.length} R12-Z procedures:\n`);
    procs.forEach(p => {
        console.log(`  ID ${p.id}: ${p.ident} Runway=${p.runway || 'ALL'} Trans=${p.transition || 'N/A'} Legs=${p.leg_count}`);
    });

    // Get the one with 16 legs
    const proc16 = procs.find(p => p.leg_count === 16);
    if (!proc16) {
        console.log('\n❌ No 16-leg version found');
        db.close();
        process.exit(0);
    }

    console.log(`\n✅ Found 16-leg version: ID ${proc16.id}`);
    console.log(`   Runway: ${proc16.runway || 'ALL'}`);
    console.log(`   Transition: ${proc16.transition || 'N/A'}`);

    // Get its legs
    const legs = db.prepare(`
        SELECT seq, fix_ident, path_term, alt_desc, alt1
        FROM procedure_legs
        WHERE procedure_id = ?
        ORDER BY seq
    `).all(proc16.id);

    console.log(`\nAll ${legs.length} legs:`);
    console.log('Seq  Fix      PathTerm  Alt');
    legs.forEach(leg => {
        const altStr = leg.alt_desc && leg.alt1
            ? `${leg.alt_desc}${Math.round(leg.alt1 / 100)}`
            : '';
        console.log(`${leg.seq.toString().padStart(3)}  ${(leg.fix_ident || '').padEnd(8)}  ${(leg.path_term || '??').padEnd(8)}  ${altStr}`);
    });

    // Test missed approach detection
    const missedPathTerms = ['HM', 'HA', 'HF', 'VM', 'VI', 'CA', 'FA', 'FM'];
    const missedStartIdx = legs.findIndex(l =>
        l.seq >= 100 || (l.path_term && missedPathTerms.includes(l.path_term))
    );

    console.log(`\nMissed approach detection:`);
    console.log(`  Detection triggered at index: ${missedStartIdx}`);
    console.log(`  Detection reason: ${missedStartIdx >= 0 ? (legs[missedStartIdx].seq >= 100 ? `seq ${legs[missedStartIdx].seq} >= 100` : `path_term ${legs[missedStartIdx].path_term}`) : 'N/A'}`);
    console.log(`  Approach legs: ${missedStartIdx}`);
    console.log(`  Missed legs: ${legs.length - missedStartIdx}`);

    db.close();

} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
