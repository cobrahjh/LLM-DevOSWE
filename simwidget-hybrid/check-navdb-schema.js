/**
 * Check navdb schema and data
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'data', 'navdb.sqlite');

console.log('🔍 Checking navdb.sqlite schema and data\n');

try {
    const db = new Database(dbPath, { readonly: true });

    // Check if database exists and has tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`Tables found: ${tables.length}`);
    tables.forEach(t => console.log(`  - ${t.name}`));

    // Check procedures table
    console.log('\n📊 Procedures statistics:');
    const procCount = db.prepare('SELECT COUNT(*) as count FROM procedures').get();
    console.log(`  Total procedures: ${procCount.count}`);

    if (procCount.count > 0) {
        // Get first procedure
        const firstProc = db.prepare('SELECT * FROM procedures LIMIT 1').get();
        console.log('\n  Sample procedure:');
        console.log(JSON.stringify(firstProc, null, 2));

        // Count by type
        const byType = db.prepare(`
            SELECT type, COUNT(*) as count
            FROM procedures
            GROUP BY type
        `).all();
        console.log('\n  By type:');
        byType.forEach(t => console.log(`    ${t.type}: ${t.count}`));

        // Count KDEN procedures
        const kdenCount = db.prepare(`
            SELECT COUNT(*) as count
            FROM procedures
            WHERE airport_icao = 'KDEN'
        `).get();
        console.log(`\n  KDEN procedures: ${kdenCount.count}`);

        if (kdenCount.count > 0) {
            const kdenProcs = db.prepare(`
                SELECT id, ident, type, runway
                FROM procedures
                WHERE airport_icao = 'KDEN'
                LIMIT 5
            `).all();
            console.log('\n  Sample KDEN procedures:');
            kdenProcs.forEach(p => {
                console.log(`    ID ${p.id}: ${p.type} - ${p.ident} - RWY ${p.runway || 'ALL'}`);
            });
        }
    }

    db.close();

} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
