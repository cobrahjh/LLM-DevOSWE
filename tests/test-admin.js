/**
 * SimWidget Test Admin CLI v1.0.0
 * 
 * Admin utilities for test scheduling and management
 * 
 * Usage:
 *   node tests/test-admin.js schedule list
 *   node tests/test-admin.js schedule add <name> <cron> [suites]
 *   node tests/test-admin.js schedule enable <name>
 *   node tests/test-admin.js schedule disable <name>
 *   node tests/test-admin.js schedule delete <name>
 *   node tests/test-admin.js history [limit]
 *   node tests/test-admin.js stats
 *   node tests/test-admin.js archive
 *   node tests/test-admin.js report <runId>
 *   node tests/test-admin.js flaky [days]
 *   node tests/test-admin.js trends [days]
 *   node tests/test-admin.js install-task
 *   node tests/test-admin.js uninstall-task
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tests\test-admin.js
 * Last Updated: 2025-01-08
 */

const TestDatabase = require('./test-db');
const SupabaseSync = require('./lib/supabase-client');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

const db = new TestDatabase();
const cloud = new SupabaseSync();

// Cron presets for easy scheduling
const CRON_PRESETS = {
    'hourly': '0 * * * *',
    'daily': '0 8 * * *',
    'twice-daily': '0 8,20 * * *',
    'weekly': '0 8 * * 1',
    'on-boot': '@reboot'
};

function printHelp() {
    console.log(`
${CYAN}${BOLD}SimWidget Test Admin v1.0.0${RESET}

${BOLD}Schedule Commands:${RESET}
  schedule list                     List all schedules
  schedule add <name> <cron> [suites]  Add schedule (cron or preset)
  schedule enable <name>            Enable a schedule
  schedule disable <name>           Disable a schedule
  schedule delete <name>            Delete a schedule

${BOLD}Cron Presets:${RESET}
  hourly      = 0 * * * *      (every hour)
  daily       = 0 8 * * *      (8am daily)
  twice-daily = 0 8,20 * * *   (8am and 8pm)
  weekly      = 0 8 * * 1      (Monday 8am)

${BOLD}History Commands:${RESET}
  history [limit]     Show recent test runs (default: 20)
  report <runId>      Show detailed report for a run
  trends [days]       Show pass/fail trends (default: 7)
  flaky [days]        Show flaky tests (default: 7)

${BOLD}Maintenance Commands:${RESET}
  stats               Show database statistics
  archive             Archive records older than 30 days
  vacuum              Compact database

${BOLD}Windows Task Scheduler:${RESET}
  install-task        Install Windows scheduled task
  uninstall-task      Remove Windows scheduled task

${BOLD}Cloud Commands (Supabase):${RESET}
  cloud status        Check cloud connection
  cloud sync          Sync local results to cloud
  cloud stats         Show cloud statistics
  cloud runs [limit]  List cloud runs for this device
  cloud devices       List all devices
  cloud trends [days] Show cloud failure trends
  cloud cleanup [days] Delete old cloud data (default: 90)

${BOLD}Examples:${RESET}
  node test-admin.js schedule add nightly daily plugins,services
  node test-admin.js schedule add hourly-check hourly
  node test-admin.js schedule add custom "30 */2 * * *" api
`);
}

// ============================================================
// SCHEDULE COMMANDS
// ============================================================

function scheduleList() {
    const schedules = db.getSchedules();
    
    if (schedules.length === 0) {
        console.log(`${YELLOW}No schedules configured${RESET}`);
        console.log(`\nAdd one with: node test-admin.js schedule add <name> <cron>`);
        return;
    }

    console.log(`\n${CYAN}${BOLD}Configured Schedules${RESET}\n`);
    console.log('┌────────────────┬─────────────────┬──────────┬─────────────────────┬─────────────────────┐');
    console.log('│ Name           │ Cron            │ Status   │ Last Run            │ Next Run            │');
    console.log('├────────────────┼─────────────────┼──────────┼─────────────────────┼─────────────────────┤');
    
    for (const s of schedules) {
        const status = s.enabled ? `${GREEN}Enabled${RESET} ` : `${RED}Disabled${RESET}`;
        const lastRun = s.last_run ? s.last_run.substring(0, 19).replace('T', ' ') : '-';
        const nextRun = s.next_run ? s.next_run.substring(0, 19).replace('T', ' ') : '-';
        console.log(`│ ${s.name.padEnd(14)} │ ${s.cron.padEnd(15)} │ ${status} │ ${lastRun.padEnd(19)} │ ${nextRun.padEnd(19)} │`);
    }
    
    console.log('└────────────────┴─────────────────┴──────────┴─────────────────────┴─────────────────────┘');
    console.log(`\nSuites: ${schedules.map(s => `${s.name}=${s.suites}`).join(', ')}`);
}

function scheduleAdd(name, cronOrPreset, suites = '*') {
    if (!name || !cronOrPreset) {
        console.log(`${RED}Usage: schedule add <name> <cron|preset> [suites]${RESET}`);
        return;
    }

    const cron = CRON_PRESETS[cronOrPreset] || cronOrPreset;
    
    db.upsertSchedule(name, cron, suites, true);
    console.log(`${GREEN}✓${RESET} Schedule '${name}' added`);
    console.log(`  Cron: ${cron}`);
    console.log(`  Suites: ${suites}`);
    console.log(`\n${YELLOW}Note:${RESET} Run 'install-task' to activate Windows Task Scheduler`);
}

function scheduleEnable(name) {
    db.toggleSchedule(name, true);
    console.log(`${GREEN}✓${RESET} Schedule '${name}' enabled`);
}

function scheduleDisable(name) {
    db.toggleSchedule(name, false);
    console.log(`${YELLOW}✓${RESET} Schedule '${name}' disabled`);
}

function scheduleDelete(name) {
    db.deleteSchedule(name);
    console.log(`${RED}✓${RESET} Schedule '${name}' deleted`);
}

// ============================================================
// HISTORY COMMANDS
// ============================================================

function showHistory(limit = 20) {
    const runs = db.getRecentRuns(parseInt(limit));
    
    if (runs.length === 0) {
        console.log(`${YELLOW}No test runs recorded${RESET}`);
        return;
    }

    console.log(`\n${CYAN}${BOLD}Recent Test Runs${RESET}\n`);
    console.log('┌────┬─────────────────────┬────────┬────────┬─────────┬──────────┬──────────┐');
    console.log('│ ID │ Timestamp           │ Passed │ Failed │ Skipped │ Duration │ Trigger  │');
    console.log('├────┼─────────────────────┼────────┼────────┼─────────┼──────────┼──────────┤');
    
    for (const r of runs) {
        const ts = r.timestamp.substring(0, 19).replace('T', ' ');
        const passedColor = r.failed > 0 ? RED : GREEN;
        const duration = r.duration_ms ? `${r.duration_ms}ms` : '-';
        console.log(`│ ${String(r.id).padStart(2)} │ ${ts} │ ${passedColor}${String(r.passed).padStart(6)}${RESET} │ ${String(r.failed).padStart(6)} │ ${String(r.skipped).padStart(7)} │ ${duration.padStart(8)} │ ${r.trigger.padEnd(8)} │`);
    }
    
    console.log('└────┴─────────────────────┴────────┴────────┴─────────┴──────────┴──────────┘');
}

function showReport(runId) {
    const run = db.getRunDetails(parseInt(runId));
    
    if (!run) {
        console.log(`${RED}Run #${runId} not found${RESET}`);
        return;
    }

    console.log(`\n${CYAN}${BOLD}Test Run #${run.id}${RESET}`);
    console.log(`Timestamp: ${run.timestamp}`);
    console.log(`Duration: ${run.duration_ms}ms`);
    console.log(`Trigger: ${run.trigger}`);
    console.log(`\nResults: ${GREEN}${run.passed} passed${RESET}, ${RED}${run.failed} failed${RESET}, ${YELLOW}${run.skipped} skipped${RESET}\n`);

    if (run.results.length === 0) {
        console.log('No individual test results recorded');
        return;
    }

    let currentCategory = '';
    for (const r of run.results) {
        if (r.category !== currentCategory) {
            currentCategory = r.category;
            console.log(`\n${BOLD}${currentCategory}${RESET}`);
        }

        const icon = r.status === 'passed' ? `${GREEN}✓${RESET}` : 
                     r.status === 'failed' ? `${RED}✗${RESET}` : 
                     `${YELLOW}○${RESET}`;
        console.log(`  ${icon} ${r.name} (${r.duration_ms}ms)`);
        
        if (r.error_message) {
            console.log(`    ${RED}Error: ${r.error_message}${RESET}`);
        }
    }
}

function showTrends(days = 7) {
    const trends = db.getFailureTrends(parseInt(days));
    
    if (trends.length === 0) {
        console.log(`${YELLOW}No data for the last ${days} days${RESET}`);
        return;
    }

    console.log(`\n${CYAN}${BOLD}Pass/Fail Trends (${days} days)${RESET}\n`);
    
    for (const t of trends) {
        const total = t.passed + t.failed;
        const passRate = total > 0 ? Math.round((t.passed / total) * 100) : 0;
        const bar = '█'.repeat(Math.round(passRate / 5)) + '░'.repeat(20 - Math.round(passRate / 5));
        const color = passRate >= 80 ? GREEN : passRate >= 50 ? YELLOW : RED;
        console.log(`${t.date} │ ${color}${bar}${RESET} ${passRate}% (${t.passed}/${total}) [${t.runs} runs]`);
    }
}

function showFlaky(days = 7) {
    const flaky = db.getFlakyTests(parseInt(days));
    
    if (flaky.length === 0) {
        console.log(`${GREEN}No flaky tests detected in the last ${days} days${RESET}`);
        return;
    }

    console.log(`\n${CYAN}${BOLD}Flaky Tests (${days} days)${RESET}\n`);
    console.log('Tests that sometimes pass and sometimes fail:\n');
    
    for (const t of flaky) {
        const rate = Math.round((t.failures / t.total_runs) * 100);
        console.log(`${YELLOW}⚠${RESET} ${t.test_id}`);
        console.log(`  ${t.passes} passes, ${t.failures} failures (${rate}% failure rate)`);
    }
}

// ============================================================
// MAINTENANCE COMMANDS
// ============================================================

function showStats() {
    const stats = db.getStats();
    
    console.log(`\n${CYAN}${BOLD}Database Statistics${RESET}\n`);
    console.log(`Total runs:     ${stats.runs}`);
    console.log(`Total results:  ${stats.results}`);
    console.log(`Schedules:      ${stats.schedules}`);
    console.log(`Oldest run:     ${stats.oldestRun || 'N/A'}`);
    console.log(`Newest run:     ${stats.newestRun || 'N/A'}`);
    console.log(`Backup files:   ${stats.backupCount}`);
    console.log(`Database size:  ${(stats.dbSize / 1024).toFixed(2)} KB`);
}

function archive() {
    console.log('Archiving records older than 30 days...');
    const result = db.archiveOldRecords();
    
    if (result.archived === 0) {
        console.log(`${GREEN}✓${RESET} No records to archive`);
    } else {
        console.log(`${GREEN}✓${RESET} Archived ${result.archived} runs to ${result.file}`);
    }
}

function vacuum() {
    db.vacuum();
    console.log(`${GREEN}✓${RESET} Database compacted`);
}

// ============================================================
// WINDOWS TASK SCHEDULER
// ============================================================

function installTask() {
    const scriptPath = path.join(__dirname, 'test-scheduler.js');
    const nodePath = process.execPath;
    
    // Create scheduled task using PowerShell
    const taskXml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers>
    <CalendarTrigger>
      <Repetition>
        <Interval>PT1H</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <StartBoundary>2025-01-01T00:00:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Actions Context="Author">
    <Exec>
      <Command>"${nodePath}"</Command>
      <Arguments>"${scriptPath}"</Arguments>
      <WorkingDirectory>${__dirname}</WorkingDirectory>
    </Exec>
  </Actions>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
</Task>`;

    const xmlPath = path.join(__dirname, 'task-config.xml');
    fs.writeFileSync(xmlPath, taskXml);
    
    const cmd = `schtasks /create /tn "SimWidget-TestRunner" /xml "${xmlPath}" /f`;
    
    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            console.log(`${RED}Failed to install task:${RESET} ${stderr}`);
        } else {
            console.log(`${GREEN}✓${RESET} Windows Task 'SimWidget-TestRunner' installed`);
            console.log('  Runs hourly, checks configured schedules');
        }
        fs.unlinkSync(xmlPath);
    });
}

function uninstallTask() {
    exec('schtasks /delete /tn "SimWidget-TestRunner" /f', (err, stdout, stderr) => {
        if (err) {
            console.log(`${YELLOW}Task not found or already removed${RESET}`);
        } else {
            console.log(`${GREEN}✓${RESET} Windows Task 'SimWidget-TestRunner' removed`);
        }
    });
}

// ============================================================
// CLOUD COMMANDS (SUPABASE)
// ============================================================

async function cloudStatus() {
    console.log(`\n${CYAN}${BOLD}Cloud Connection Status${RESET}\n`);
    console.log(`Device ID: ${cloud.deviceId}`);
    
    const result = await cloud.checkConnection();
    
    if (result.connected) {
        console.log(`Status: ${GREEN}Connected${RESET}`);
    } else {
        console.log(`Status: ${RED}Not Connected${RESET}`);
        console.log(`Reason: ${result.reason}`);
        console.log(`\nEnsure .env.supabase has correct SUPABASE_URL and SUPABASE_ANON_KEY`);
    }
}

async function cloudSync() {
    console.log(`\n${CYAN}${BOLD}Syncing to Cloud${RESET}\n`);
    
    const result = await cloud.syncToCloud(db);
    
    if (result.success) {
        console.log(`${GREEN}✓${RESET} Synced ${result.synced} of ${result.total} runs`);
    } else {
        console.log(`${RED}✗${RESET} Sync failed: ${result.reason}`);
    }
}

async function cloudStats() {
    console.log(`\n${CYAN}${BOLD}Cloud Statistics${RESET}\n`);
    
    const result = await cloud.getCloudStats();
    
    if (result.success) {
        const s = result.stats;
        console.log(`Total Runs:    ${s.totalRuns}`);
        console.log(`Total Results: ${s.totalResults}`);
        console.log(`Total Passed:  ${GREEN}${s.totalPassed}${RESET}`);
        console.log(`Total Failed:  ${RED}${s.totalFailed}${RESET}`);
        console.log(`Pass Rate:     ${s.passRate}%`);
        console.log(`Devices:       ${s.devices}`);
    } else {
        console.log(`${RED}Error:${RESET} ${result.reason}`);
    }
}

async function cloudRuns(limit = 20) {
    console.log(`\n${CYAN}${BOLD}Cloud Runs (Device: ${cloud.deviceId})${RESET}\n`);
    
    const result = await cloud.getCloudRuns(parseInt(limit));
    
    if (result.success && result.runs.length > 0) {
        console.log('┌──────────────────────────────────────┬─────────────────────┬────────┬────────┐');
        console.log('│ ID                                   │ Timestamp           │ Passed │ Failed │');
        console.log('├──────────────────────────────────────┼─────────────────────┼────────┼────────┤');
        
        for (const run of result.runs) {
            const ts = new Date(run.timestamp).toISOString().replace('T', ' ').substring(0, 19);
            const passed = String(run.passed || 0).padStart(6);
            const failed = String(run.failed || 0).padStart(6);
            const passedColor = run.passed > 0 ? GREEN : '';
            const failedColor = run.failed > 0 ? RED : '';
            console.log(`│ ${run.id.substring(0, 36)} │ ${ts} │ ${passedColor}${passed}${RESET} │ ${failedColor}${failed}${RESET} │`);
        }
        
        console.log('└──────────────────────────────────────┴─────────────────────┴────────┴────────┘');
    } else if (result.success) {
        console.log(`${YELLOW}No cloud runs found${RESET}`);
    } else {
        console.log(`${RED}Error:${RESET} ${result.reason}`);
    }
}

async function cloudDevices() {
    console.log(`\n${CYAN}${BOLD}Cloud Devices${RESET}\n`);
    
    const result = await cloud.getDevices();
    
    if (result.success) {
        console.log(`Current device: ${CYAN}${result.current}${RESET}\n`);
        
        for (const device of result.devices) {
            const marker = device === result.current ? ` ${GREEN}(this)${RESET}` : '';
            console.log(`  • ${device}${marker}`);
        }
        
        console.log(`\nTotal: ${result.devices.length} device(s)`);
    } else {
        console.log(`${RED}Error:${RESET} ${result.reason}`);
    }
}

async function cloudTrends(days = 7) {
    console.log(`\n${CYAN}${BOLD}Cloud Trends (${days} days)${RESET}\n`);
    
    const result = await cloud.getCloudTrends(parseInt(days));
    
    if (result.success) {
        const dates = Object.keys(result.trends).sort();
        
        if (dates.length === 0) {
            console.log(`${YELLOW}No data in the last ${days} days${RESET}`);
            return;
        }
        
        for (const date of dates) {
            const d = result.trends[date];
            const total = d.passed + d.failed;
            const passBar = '█'.repeat(Math.round((d.passed / Math.max(total, 1)) * 20));
            const failBar = '░'.repeat(20 - passBar.length);
            console.log(`${date}: ${GREEN}${passBar}${RESET}${RED}${failBar}${RESET} P:${d.passed} F:${d.failed} R:${d.runs}`);
        }
    } else {
        console.log(`${RED}Error:${RESET} ${result.reason}`);
    }
}

async function cloudCleanup(days = 90) {
    console.log(`\n${CYAN}${BOLD}Cloud Cleanup${RESET}\n`);
    console.log(`Deleting runs older than ${days} days...`);
    
    const result = await cloud.cleanupOldData(parseInt(days));
    
    if (result.success) {
        console.log(`${GREEN}✓${RESET} Deleted ${result.deleted} old runs`);
    } else {
        console.log(`${RED}Error:${RESET} ${result.reason}`);
    }
}

// ============================================================
// MAIN
// ============================================================

const args = process.argv.slice(2);
const command = args[0];
const subCommand = args[1];

if (!command || command === 'help' || command === '--help') {
    printHelp();
    process.exit(0);
}

switch (command) {
    case 'schedule':
        switch (subCommand) {
            case 'list': scheduleList(); break;
            case 'add': scheduleAdd(args[2], args[3], args[4]); break;
            case 'enable': scheduleEnable(args[2]); break;
            case 'disable': scheduleDisable(args[2]); break;
            case 'delete': scheduleDelete(args[2]); break;
            default: console.log(`Unknown schedule command: ${subCommand}`);
        }
        break;
    
    case 'history': showHistory(args[1]); break;
    case 'report': showReport(args[1]); break;
    case 'trends': showTrends(args[1]); break;
    case 'flaky': showFlaky(args[1]); break;
    case 'stats': showStats(); break;
    case 'archive': archive(); break;
    case 'vacuum': vacuum(); break;
    case 'install-task': installTask(); break;
    case 'uninstall-task': uninstallTask(); break;
    
    case 'cloud':
        (async () => {
            switch (subCommand) {
                case 'status': await cloudStatus(); break;
                case 'sync': await cloudSync(); break;
                case 'stats': await cloudStats(); break;
                case 'runs': await cloudRuns(args[2]); break;
                case 'devices': await cloudDevices(); break;
                case 'trends': await cloudTrends(args[2]); break;
                case 'cleanup': await cloudCleanup(args[2]); break;
                default: console.log(`Unknown cloud command: ${subCommand}`);
            }
            db.close();
        })();
        return; // Exit early, async handler closes db
    
    default:
        console.log(`${RED}Unknown command: ${command}${RESET}`);
        printHelp();
}

db.close();
