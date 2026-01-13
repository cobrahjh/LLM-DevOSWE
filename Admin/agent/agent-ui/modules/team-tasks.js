/**
 * Team Tasks - Voice-Based Task Assignment System v1.1.0
 *
 * Manages task assignment to team members based on task type:
 * - Heather (PM): Planning, guidance, direction, documentation
 * - Shǐ zhēn xiāng (Programmer): Coding, debugging, development
 *
 * Flow:
 * 1. User gives task via voice or text
 * 2. System analyzes task type
 * 3. Assigns to appropriate team member
 * 4. Team member acknowledges with summary
 * 5. Team member asks clarifying questions if needed
 * 6. On completion, team member gives update
 *
 * Persistence:
 * - All tasks saved to relay database (SQLite)
 * - Tasks survive page refresh
 * - API: GET/POST /api/team-tasks
 *
 * Path: C:\DevOSWE\Admin\agent\agent-ui\modules\team-tasks.js
 * Last Updated: 2026-01-12
 */

const TeamTasks = (function() {
    'use strict';

    // Task queue (synced with relay database)
    const tasks = [];
    let currentTask = null;

    // Relay API configuration
    const RELAY_URL = 'http://192.168.1.42:8600';

    // ==================== RELAY PERSISTENCE ====================

    async function saveTaskToRelay(task) {
        try {
            const response = await fetch(`${RELAY_URL}/api/team-tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: task.id,
                    text: task.text,
                    summary: task.summary,
                    assignee: task.assignee,
                    assigneeName: task.assigneeName,
                    role: task.role,
                    status: task.status
                })
            });
            const result = await response.json();
            console.log('[TeamTasks] Saved to relay:', result);
            return result;
        } catch (err) {
            console.warn('[TeamTasks] Failed to save to relay:', err.message);
            return null;
        }
    }

    async function updateTaskInRelay(taskId, updates) {
        try {
            const response = await fetch(`${RELAY_URL}/api/team-tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            const result = await response.json();
            console.log('[TeamTasks] Updated in relay:', result);
            return result;
        } catch (err) {
            console.warn('[TeamTasks] Failed to update relay:', err.message);
            return null;
        }
    }

    async function completeTaskInRelay(taskId, completionSummary) {
        try {
            const response = await fetch(`${RELAY_URL}/api/team-tasks/${taskId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completionSummary })
            });
            const result = await response.json();
            console.log('[TeamTasks] Completed in relay:', result);
            return result;
        } catch (err) {
            console.warn('[TeamTasks] Failed to complete in relay:', err.message);
            return null;
        }
    }

    async function loadTasksFromRelay() {
        try {
            const response = await fetch(`${RELAY_URL}/api/team-tasks?limit=100`);
            const data = await response.json();
            if (data.tasks && data.tasks.length > 0) {
                // Clear and reload
                tasks.length = 0;
                data.tasks.forEach(t => {
                    tasks.push({
                        id: t.id,
                        text: t.text,
                        summary: t.summary,
                        assignee: t.assignee,
                        assigneeName: t.assignee_name,
                        role: t.role,
                        status: t.status,
                        createdAt: new Date(t.created_at).toISOString(),
                        questions: t.questions || [],
                        completedAt: t.completed_at ? new Date(t.completed_at).toISOString() : null,
                        completionSummary: t.completion_summary
                    });
                });
                console.log(`[TeamTasks] Loaded ${tasks.length} tasks from relay`);
            }
            return tasks;
        } catch (err) {
            console.warn('[TeamTasks] Failed to load from relay:', err.message);
            return [];
        }
    }

    async function getCompletedTasks() {
        try {
            const response = await fetch(`${RELAY_URL}/api/team-tasks?status=completed&limit=50`);
            const data = await response.json();
            return data.tasks || [];
        } catch (err) {
            console.warn('[TeamTasks] Failed to get completed tasks:', err.message);
            return [];
        }
    }

    // Team member definitions
    const TEAM = {
        heather: {
            id: 'heather',
            name: 'Heather',
            role: 'PM',
            module: () => typeof Heather !== 'undefined' ? Heather : null,
            keywords: [
                'plan', 'planning', 'schedule', 'meeting', 'review', 'document',
                'documentation', 'organize', 'coordinate', 'manage', 'strategy',
                'roadmap', 'milestone', 'priority', 'prioritize', 'status',
                'update', 'report', 'summary', 'overview', 'direction', 'guide',
                'guidance', 'help', 'question', 'clarify', 'explain', 'decide',
                'decision', 'approve', 'architecture', 'design', 'spec'
            ]
        },
        shiZhenXiang: {
            id: 'shiZhenXiang',
            name: 'Shǐ zhēn xiāng',
            role: 'Programmer',
            module: () => typeof ShiZhenXiang !== 'undefined' ? ShiZhenXiang : null,
            keywords: [
                'code', 'coding', 'program', 'programming', 'develop', 'developer',
                'build', 'fix', 'bug', 'debug', 'implement', 'create', 'function',
                'class', 'module', 'api', 'endpoint', 'database', 'query', 'test',
                'testing', 'refactor', 'optimize', 'feature', 'component', 'script',
                'deploy', 'server', 'frontend', 'backend', 'css', 'html', 'javascript',
                'node', 'react', 'error', 'crash', 'performance', 'memory'
            ]
        }
    };

    // Task templates for acknowledgment
    const acknowledgmentTemplates = {
        heather: [
            "Got it, Boss! Let me handle this. So basically, {summary}. I'll get this organized for you.",
            "Understood, Boss! {summary}. Leave it to me, I'll coordinate everything.",
            "On it! So you need {summary}. I'll put together a plan right away.",
            "Perfect, Boss! {summary}. I'll take care of the planning and get back to you.",
            "Alright Boss, {summary}. Let me work on the details and give you an update soon."
        ],
        shiZhenXiang: [
            "Okay Mr. Boss! So... {summary}. I'll try not to break anything!",
            "Got it Mr. Boss! {summary}. Let me see if I can figure this out...",
            "Wah, {summary}. Okay okay, I'll give it my best shot!",
            "Understood Mr. Boss! {summary}. Time to Google... I mean, code!",
            "Alright! {summary}. I hope I don't mess this up too badly!"
        ]
    };

    // Question templates
    const questionTemplates = {
        heather: [
            "Quick question Boss - {question}",
            "Before I proceed, {question}",
            "Just to clarify Boss, {question}",
            "One thing I want to confirm - {question}"
        ],
        shiZhenXiang: [
            "Um, Mr. Boss... {question}",
            "Wait wait, I'm confused... {question}",
            "Sorry Mr. Boss, dumb question but... {question}",
            "Before I break something, {question}"
        ]
    };

    // Completion templates
    const completionTemplates = {
        heather: [
            "All done, Boss! {summary}. Everything is ready for you.",
            "Task complete! {summary}. Let me know if you need anything else.",
            "Finished! {summary}. Another one checked off the list!",
            "Done and done, Boss! {summary}. Great progress today!"
        ],
        shiZhenXiang: [
            "Mr. Boss! It actually worked! {summary}. I'm as shocked as you are!",
            "Done! {summary}. And nothing exploded this time!",
            "Finished Mr. Boss! {summary}. Quick, save it before I touch it again!",
            "Task complete! {summary}. Did I really do that? Wow!"
        ]
    };

    // ==================== TASK DETECTION ====================

    function detectTaskType(taskText) {
        const text = taskText.toLowerCase();
        let heatherScore = 0;
        let devScore = 0;

        // Check keywords
        TEAM.heather.keywords.forEach(keyword => {
            if (text.includes(keyword)) heatherScore++;
        });

        TEAM.shiZhenXiang.keywords.forEach(keyword => {
            if (text.includes(keyword)) devScore++;
        });

        // Default to PM if unclear (they can delegate)
        if (heatherScore >= devScore) {
            return 'heather';
        }
        return 'shiZhenXiang';
    }

    function summarizeTask(taskText) {
        // Create a brief summary of the task
        let summary = taskText;

        // Trim to reasonable length
        if (summary.length > 100) {
            summary = summary.substring(0, 100) + '...';
        }

        // Clean up for speech
        summary = summary
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return summary;
    }

    // ==================== TASK ASSIGNMENT ====================

    function assignTask(taskText, options = {}) {
        const assignee = options.assignTo || detectTaskType(taskText);
        const teamMember = TEAM[assignee];
        const module = teamMember.module();

        const task = {
            id: `task-${Date.now()}`,
            text: taskText,
            summary: summarizeTask(taskText),
            assignee: assignee,
            assigneeName: teamMember.name,
            role: teamMember.role,
            status: 'assigned',
            createdAt: new Date().toISOString(),
            questions: [],
            completedAt: null
        };

        tasks.push(task);
        currentTask = task;

        console.log(`[TeamTasks] Task assigned to ${teamMember.name} (${teamMember.role}): ${task.summary}`);

        // Save to relay database
        saveTaskToRelay(task);

        // Have team member acknowledge
        acknowledgeTask(task, module);

        return task;
    }

    function acknowledgeTask(task, module) {
        const templates = acknowledgmentTemplates[task.assignee];
        const template = templates[Math.floor(Math.random() * templates.length)];
        const speech = template.replace('{summary}', task.summary);

        task.status = 'acknowledged';

        // Update status in relay
        updateTaskInRelay(task.id, { status: 'acknowledged' });

        if (module && module.speak) {
            module.speak(speech, { force: true });
        } else if (typeof VoiceEngine !== 'undefined') {
            VoiceEngine.speak(speech);
        }

        // Broadcast task assignment
        broadcastTaskUpdate(task, 'assigned');
    }

    // ==================== QUESTIONS ====================

    function askQuestion(question, task = null) {
        const activeTask = task || currentTask;
        if (!activeTask) {
            console.warn('[TeamTasks] No active task to ask question for');
            return;
        }

        const teamMember = TEAM[activeTask.assignee];
        const module = teamMember.module();
        const templates = questionTemplates[activeTask.assignee];
        const template = templates[Math.floor(Math.random() * templates.length)];
        const speech = template.replace('{question}', question);

        activeTask.questions.push({
            question,
            askedAt: new Date().toISOString(),
            answered: false
        });

        // Save question to relay
        updateTaskInRelay(activeTask.id, { question });

        if (module && module.speak) {
            module.speak(speech, { force: true });
        } else if (typeof VoiceEngine !== 'undefined') {
            VoiceEngine.speak(speech);
        }
    }

    // ==================== COMPLETION ====================

    function completeTask(completionSummary = null, task = null) {
        const activeTask = task || currentTask;
        if (!activeTask) {
            console.warn('[TeamTasks] No active task to complete');
            return;
        }

        const teamMember = TEAM[activeTask.assignee];
        const module = teamMember.module();
        const templates = completionTemplates[activeTask.assignee];
        const template = templates[Math.floor(Math.random() * templates.length)];
        const summary = completionSummary || activeTask.summary;
        const speech = template.replace('{summary}', summary);

        activeTask.status = 'completed';
        activeTask.completedAt = new Date().toISOString();
        activeTask.completionSummary = summary;

        // Save completion to relay
        completeTaskInRelay(activeTask.id, summary);

        if (module && module.speak) {
            module.speak(speech, { force: true });
        } else if (typeof VoiceEngine !== 'undefined') {
            VoiceEngine.speak(speech);
        }

        // Clear current task
        if (currentTask && currentTask.id === activeTask.id) {
            currentTask = null;
        }

        // Broadcast completion
        broadcastTaskUpdate(activeTask, 'completed');

        console.log(`[TeamTasks] Task completed by ${teamMember.name}: ${summary}`);
    }

    function giveUpdate(updateText, task = null) {
        const activeTask = task || currentTask;
        if (!activeTask) {
            console.warn('[TeamTasks] No active task for update');
            return;
        }

        const teamMember = TEAM[activeTask.assignee];
        const module = teamMember.module();

        const prefixes = {
            heather: ["Boss, quick update: ", "Just wanted to let you know Boss, ", "Update for you: "],
            shiZhenXiang: ["Mr. Boss! Update: ", "So um, Mr. Boss, ", "Progress report, Mr. Boss: "]
        };

        const prefix = prefixes[activeTask.assignee][Math.floor(Math.random() * prefixes[activeTask.assignee].length)];
        const speech = prefix + updateText;

        if (module && module.speak) {
            module.speak(speech, { force: true });
        } else if (typeof VoiceEngine !== 'undefined') {
            VoiceEngine.speak(speech);
        }
    }

    // ==================== BROADCASTING ====================

    function broadcastTaskUpdate(task, event) {
        // Broadcast to WebSocket clients if available
        if (typeof wss !== 'undefined' && wss.clients) {
            wss.clients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({
                        type: `team_task:${event}`,
                        task: {
                            id: task.id,
                            summary: task.summary,
                            assignee: task.assigneeName,
                            role: task.role,
                            status: task.status
                        }
                    }));
                }
            });
        }

        // Also trigger custom event for UI
        const customEvent = new CustomEvent('teamTaskUpdate', {
            detail: { task, event }
        });
        document.dispatchEvent(customEvent);
    }

    // ==================== VOICE INPUT HANDLER ====================

    function handleVoiceTask(transcript) {
        // Check if this is a task assignment
        const taskPhrases = [
            'assign', 'task', 'do this', 'work on', 'handle', 'take care of',
            'need you to', 'can you', 'please', 'help me', 'create', 'build',
            'fix', 'update', 'change', 'add', 'remove', 'check', 'review'
        ];

        const isTask = taskPhrases.some(phrase =>
            transcript.toLowerCase().includes(phrase)
        );

        if (isTask) {
            assignTask(transcript);
            return true;
        }

        return false;
    }

    // ==================== PUBLIC API ====================

    async function init() {
        console.log('[TeamTasks] Team task management initialized');
        console.log('[TeamTasks] Team members:');
        Object.values(TEAM).forEach(member => {
            console.log(`  - ${member.name} (${member.role})`);
        });

        // Load existing tasks from relay database
        await loadTasksFromRelay();
        console.log('[TeamTasks] Persistence enabled via relay database');
    }

    return {
        init,
        assignTask,
        completeTask,
        askQuestion,
        giveUpdate,
        handleVoiceTask,
        detectTaskType,
        getCurrentTask: () => currentTask,
        getTasks: () => [...tasks],
        getTeam: () => TEAM,
        TEAM,
        // Relay persistence functions
        getCompletedTasks,
        loadTasksFromRelay,
        RELAY_URL
    };
})();

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TeamTasks.init());
} else {
    TeamTasks.init();
}

// Export
if (typeof module !== 'undefined') module.exports = { TeamTasks };
