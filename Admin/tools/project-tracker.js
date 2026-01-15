#!/usr/bin/env node
/**
 * Project Task & Feature Tracker
 * Tracks work across projects by day, time, phase
 * Run before coding to see status and log new work
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const TRACKER_FILE = path.join(__dirname, 'tracker-data.json');

// Default structure
const DEFAULT_DATA = {
    projects: {
        'LLM-DevOSWE': { color: 'blue', description: 'SimWidget Engine framework' },
        'kittbox-web': { color: 'red', description: 'KittBox web application' }
    },
    phases: ['planning', 'development', 'testing', 'review', 'completed'],
    tasks: []
};

// Load or create tracker data
function loadData() {
    if (fs.existsSync(TRACKER_FILE)) {
        return JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
    }
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    return DEFAULT_DATA;
}

function saveData(data) {
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(data, null, 2));
}

// Format date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit'
    });
}

// Display status report
function showStatus(data) {
    console.log('\n' + '='.repeat(60));
    console.log('  PROJECT TRACKER - Status Report');
    console.log('  ' + new Date().toLocaleString());
    console.log('='.repeat(60) + '\n');

    // Group tasks by project
    for (const [projectName, projectInfo] of Object.entries(data.projects)) {
        const projectTasks = data.tasks.filter(t => t.project === projectName);
        const active = projectTasks.filter(t => t.phase !== 'completed');
        const completed = projectTasks.filter(t => t.phase === 'completed');

        console.log(`[${projectInfo.color.toUpperCase()}] ${projectName}`);
        console.log(`  ${projectInfo.description}`);
        console.log(`  Active: ${active.length} | Completed: ${completed.length}`);
        console.log();

        // Show active tasks by phase
        for (const phase of data.phases.filter(p => p !== 'completed')) {
            const phaseTasks = active.filter(t => t.phase === phase);
            if (phaseTasks.length > 0) {
                console.log(`  [${phase.toUpperCase()}]`);
                phaseTasks.forEach(t => {
                    console.log(`    - ${t.title}`);
                    console.log(`      Added: ${formatDate(t.created)} ${formatTime(t.created)}`);
                    if (t.notes) console.log(`      Notes: ${t.notes}`);
                });
                console.log();
            }
        }

        // Show recent completed (last 5)
        const recentCompleted = completed
            .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
            .slice(0, 3);

        if (recentCompleted.length > 0) {
            console.log('  [RECENTLY COMPLETED]');
            recentCompleted.forEach(t => {
                console.log(`    ✓ ${t.title} (${formatDate(t.completedAt)})`);
            });
            console.log();
        }

        console.log('-'.repeat(60));
    }

    // Today's activity
    const today = new Date().toDateString();
    const todayTasks = data.tasks.filter(t =>
        new Date(t.created).toDateString() === today ||
        (t.completedAt && new Date(t.completedAt).toDateString() === today)
    );

    if (todayTasks.length > 0) {
        console.log('\n[TODAY\'S ACTIVITY]');
        todayTasks.forEach(t => {
            const status = t.phase === 'completed' ? '✓' : '○';
            console.log(`  ${status} ${t.project}: ${t.title}`);
        });
    }

    console.log('\n');
}

// Interactive menu
async function interactiveMenu(data) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log('\n[ACTIONS]');
    console.log('  1. Add new task');
    console.log('  2. Update task phase');
    console.log('  3. Complete a task');
    console.log('  4. Add project');
    console.log('  5. View full history');
    console.log('  Q. Quit');

    const choice = await question('\nChoice: ');

    switch (choice.toLowerCase()) {
        case '1': {
            console.log('\nProjects:', Object.keys(data.projects).join(', '));
            const project = await question('Project: ');
            if (!data.projects[project]) {
                console.log('Unknown project');
                break;
            }
            const title = await question('Task title: ');
            const phase = await question(`Phase (${data.phases.join('/')}): `) || 'planning';
            const notes = await question('Notes (optional): ');

            data.tasks.push({
                id: Date.now(),
                project,
                title,
                phase,
                notes: notes || null,
                created: new Date().toISOString(),
                completedAt: null
            });
            saveData(data);
            console.log('\n✓ Task added!');
            break;
        }
        case '2': {
            const active = data.tasks.filter(t => t.phase !== 'completed');
            if (active.length === 0) {
                console.log('No active tasks');
                break;
            }
            console.log('\nActive tasks:');
            active.forEach((t, i) => console.log(`  ${i + 1}. [${t.project}] ${t.title} (${t.phase})`));

            const idx = parseInt(await question('Task number: ')) - 1;
            if (idx < 0 || idx >= active.length) break;

            const newPhase = await question(`New phase (${data.phases.join('/')}): `);
            if (data.phases.includes(newPhase)) {
                active[idx].phase = newPhase;
                if (newPhase === 'completed') {
                    active[idx].completedAt = new Date().toISOString();
                }
                saveData(data);
                console.log('\n✓ Phase updated!');
            }
            break;
        }
        case '3': {
            const active = data.tasks.filter(t => t.phase !== 'completed');
            if (active.length === 0) {
                console.log('No active tasks');
                break;
            }
            console.log('\nActive tasks:');
            active.forEach((t, i) => console.log(`  ${i + 1}. [${t.project}] ${t.title}`));

            const idx = parseInt(await question('Complete task number: ')) - 1;
            if (idx >= 0 && idx < active.length) {
                active[idx].phase = 'completed';
                active[idx].completedAt = new Date().toISOString();
                saveData(data);
                console.log('\n✓ Task completed!');
            }
            break;
        }
        case '4': {
            const name = await question('Project name: ');
            const color = await question('Color (blue/red/green/purple/yellow): ');
            const description = await question('Description: ');
            data.projects[name] = { color, description };
            saveData(data);
            console.log('\n✓ Project added!');
            break;
        }
        case '5': {
            console.log('\n[FULL HISTORY]');
            const sorted = [...data.tasks].sort((a, b) =>
                new Date(b.created) - new Date(a.created)
            );
            sorted.forEach(t => {
                const status = t.phase === 'completed' ? '✓' : '○';
                console.log(`${status} ${formatDate(t.created)} [${t.project}] ${t.title} (${t.phase})`);
            });
            break;
        }
    }

    rl.close();
}

// CLI entry point
async function main() {
    const args = process.argv.slice(2);
    const data = loadData();

    if (args.includes('--add')) {
        // Quick add: node project-tracker.js --add "LLM-DevOSWE" "Task title" "phase"
        const [, project, title, phase] = args;
        if (project && title) {
            data.tasks.push({
                id: Date.now(),
                project,
                title,
                phase: phase || 'planning',
                notes: null,
                created: new Date().toISOString(),
                completedAt: null
            });
            saveData(data);
            console.log(`✓ Added: [${project}] ${title}`);
        }
        return;
    }

    if (args.includes('--complete')) {
        // Quick complete by partial title match
        const searchTerm = args[args.indexOf('--complete') + 1];
        const task = data.tasks.find(t =>
            t.phase !== 'completed' &&
            t.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (task) {
            task.phase = 'completed';
            task.completedAt = new Date().toISOString();
            saveData(data);
            console.log(`✓ Completed: ${task.title}`);
        } else {
            console.log('Task not found');
        }
        return;
    }

    if (args.includes('--json')) {
        console.log(JSON.stringify(data, null, 2));
        return;
    }

    // Default: show status then menu
    showStatus(data);

    if (!args.includes('--status')) {
        await interactiveMenu(data);
    }
}

main().catch(console.error);
