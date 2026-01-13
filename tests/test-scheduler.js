/**
 * SimWidget Test Scheduler v1.0.0
 * 
 * Runs scheduled tests based on configured schedules
 * Called by Windows Task Scheduler hourly
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tests\test-scheduler.js
 * Last Updated: 2025-01-08
 */

const { spawn } = require('child_process');
const path = require('path');
const TestDatabase = require('./test-db');

const db = new TestDatabase();

/**
 * Parse cron expression and check if it should run now
 */
function shouldRunNow(cron) {
    const now = new Date();
    const [minute, hour, dayOfMonth, month, dayOfWeek] = cron.split(' ');
    
    const matches = (field, value) => {
        if (field === '*') return true;
        if (field.includes(',')) return field.split(',').includes(String(value));
        if (field.includes('/')) {
            const [, interval] = field.split('/');
            return value % parseInt(interval) === 0;
        }
        return parseInt(field) === value;
    };
    
    return matches(minute, now.getMinutes()) &&
           matches(hour, now.getHours()) &&
           matches(dayOfMonth, now.getDate()) &&
           matches(month, now.getMonth() + 1) &&
           matches(dayOfWeek, now.getDay());
}

/**
 * Calculate next run time from cron
 */
function getNextRun(cron) {
    // Simplified: just add 1 hour for hourly, 1 day for daily
    const now = new Date();
    const [minute, hour] = cron.split(' ');
    
    if (hour === '*') {
        // Hourly - next hour
        now.setHours(now.getHours() + 1);
        now.setMinutes(parseInt(minute) || 0);
    } else {
        // Daily - next day at specified time
        now.setDate(now.getDate() + 1);
        now.setHours(parseInt(hour) || 8);
        now.setMinutes(parseInt(minute) || 0);
    }
    
    return now.toISOString();
}

/**
 * Run test suite
 */
function runTests(schedule) {
    return new Promise((resolve) => {
        const args = ['tests/test-runner.js', '--db'];
        
        if (schedule.suites && schedule.suites !== '*') {
            args.push(schedule.suites);
        }
        
        console.log(`[Scheduler] Running: ${schedule.name} (${schedule.suites})`);
        
        const child = spawn('node', args, {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
        });
        
        child.on('close', (code) => {
            console.log(`[Scheduler] Completed: ${schedule.name} (exit code: ${code})`);
            resolve(code);
        });
    });
}

/**
 * Main scheduler loop
 */
async function main() {
    console.log(`\n[Scheduler] Running at ${new Date().toISOString()}`);
    
    // Run maintenance first
    const stats = db.getStats();
    if (stats.runs > 100) {
        console.log('[Scheduler] Running archive...');
        db.archiveOldRecords();
    }
    
    // Get enabled schedules
    const schedules = db.getEnabledSchedules();
    
    if (schedules.length === 0) {
        console.log('[Scheduler] No enabled schedules');
        db.close();
        return;
    }
    
    console.log(`[Scheduler] Found ${schedules.length} enabled schedules`);
    
    // Check each schedule
    for (const schedule of schedules) {
        if (shouldRunNow(schedule.cron)) {
            await runTests(schedule);
            
            // Update last/next run
            db.updateScheduleRun(
                schedule.name,
                new Date().toISOString(),
                getNextRun(schedule.cron)
            );
        } else {
            console.log(`[Scheduler] Skipping ${schedule.name} (not scheduled now)`);
        }
    }
    
    db.close();
    console.log('[Scheduler] Done\n');
}

main().catch(err => {
    console.error('[Scheduler] Error:', err);
    db.close();
    process.exit(1);
});
