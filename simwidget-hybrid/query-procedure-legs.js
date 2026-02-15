/**
 * Query procedure legs directly from SQLite database
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'data', 'navdb.sqlite');

console.log('🔍 Querying procedure legs from navdb.sqlite\n');

try {
    const db = new Database(dbPath, { readonly: true });

    // Get a sample approach procedure (try to get an ILS)
    let proc = db.prepare(`
        SELECT id, airport_icao, ident, type, runway, transition
        FROM procedures
        WHERE airport_icao = 'KDEN'
        AND type = 'APPROACH'
        AND ident LIKE '%ILS%'
        LIMIT 1
    `).get();

    // If no ILS, get any approach
    if (!proc) {
        proc = db.prepare(`
            SELECT id, airport_icao, ident, type, runway, transition
            FROM procedures
            WHERE airport_icao = 'KDEN'
            AND type = 'APPROACH'
            LIMIT 1
        `).get();
    }

    if (!proc) {
        console.log('No approach procedure found');
        process.exit(0);
    }

    console.log(`Procedure: ${proc.ident} (ID: ${proc.id})`);
    console.log(`Airport: ${proc.airport_icao}, Type: ${proc.type}, Runway: ${proc.runway || 'ALL'}\n`);

    // Get all legs for this procedure
    const legs = db.prepare(`
        SELECT
            seq,
            fix_ident,
            path_term,
            turn_dir,
            alt_desc,
            alt1,
            alt2,
            speed_limit,
            course,
            distance,
            rec_navaid
        FROM procedure_legs
        WHERE procedure_id = ?
        ORDER BY seq
    `).all(proc.id);

    console.log(`Total legs: ${legs.length}\n`);

    // Display all legs
    console.log('Seq  Fix      PathTerm  Alt      Speed  Course  Dist  Navaid');
    console.log('---  -------  --------  -------  -----  ------  ----  ------');
    legs.forEach(leg => {
        const altStr = leg.alt_desc && leg.alt1
            ? `${leg.alt_desc}${Math.round(leg.alt1 / 100)}`.padEnd(7)
            : ''.padEnd(7);
        const speedStr = leg.speed_limit ? leg.speed_limit.toString().padEnd(5) : ''.padEnd(5);
        const courseStr = leg.course ? leg.course.toFixed(0).padStart(3).padEnd(6) : ''.padEnd(6);
        const distStr = leg.distance ? leg.distance.toFixed(1).padEnd(4) : ''.padEnd(4);

        console.log(
            `${leg.seq.toString().padStart(3)}  ` +
            `${(leg.fix_ident || '').padEnd(7)}  ` +
            `${(leg.path_term || '??').padEnd(8)}  ` +
            `${altStr}  ` +
            `${speedStr}  ` +
            `${courseStr}  ` +
            `${distStr}  ` +
            `${leg.rec_navaid || ''}`
        );
    });

    // Analyze path terminators
    const pathTerms = {};
    legs.forEach(leg => {
        if (leg.path_term) {
            pathTerms[leg.path_term] = (pathTerms[leg.path_term] || 0) + 1;
        }
    });

    console.log('\nPath terminator breakdown:');
    Object.entries(pathTerms).forEach(([term, count]) => {
        console.log(`  ${term}: ${count}`);
    });

    // Check for potential missed approach legs
    // Missed approach typically starts with HM, HA, HF (holding patterns)
    // or CA, CF (course/fix to altitude)
    const missedIndicators = ['HM', 'HA', 'HF', 'CA', 'VM'];
    const possibleMissed = legs.filter(leg =>
        leg.path_term && missedIndicators.includes(leg.path_term)
    );

    if (possibleMissed.length > 0) {
        console.log(`\n✅ Potential missed approach legs found: ${possibleMissed.length}`);
        console.log('These legs:');
        possibleMissed.forEach(leg => {
            console.log(`  Seq ${leg.seq}: ${leg.fix_ident || 'N/A'} - ${leg.path_term}`);
        });
    } else {
        console.log('\n⚠️ No obvious missed approach indicators found');
        console.log('(Looking for HM, HA, HF, CA, VM path terminators)');
    }

    db.close();

} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
