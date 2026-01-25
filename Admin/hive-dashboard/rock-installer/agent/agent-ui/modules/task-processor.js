/**
 * Task Processor Module v1.0.0
 *
 * Manages Kitt task processing with state machine, Claude activity monitoring,
 * and proper coordination to prevent race conditions.
 *
 * Path: C:\LLM-DevOSWE\Admin\agent\agent-ui\modules\task-processor.js
 * Last Updated: 2026-01-11
 *
 * State Machine:
 *   IDLE → QUEUED → WAITING_FOR_CLAUDE → CLAUDE_PROCESSING → COMPLETE/ERROR
 *
 * Features:
 *   - State machine for task lifecycle
 *   - Claude activity monitoring (detects if Claude is busy)
 *   - Task queue with priority support
 *   - Visual feedback for each state
 *   - Race condition prevention
 */

const TaskProcessor = (function() {
    'use strict';

    // ==================== TASK STATES ====================
    const TaskState = {
        IDLE: 'idle',
        QUEUED: 'queued',
        WAITING_FOR_CLAUDE: 'waiting_for_claude',
        CLAUDE_PROCESSING: 'claude_processing',
        COMPLETE: 'complete',
        ERROR: 'error',
        CANCELLED: 'cancelled'
    };

    // ==================== STATE ====================
    const state = {
        tasks: new Map(),           // taskId → task object
        queue: [],                  // Ordered task queue
        currentTask: null,          // Currently processing task
        claudeStatus: {
            busy: false,
            since: null,
            source: null,           // 'kitt', 'external', 'unknown'
            lastCheck: null
        },
        kittStatus: {
            busy: false,
            since: null,
            task: null
        },
        lastTask: null,           // Track last processed task for verification
        incompleteTaskCount: 0,   // Track incomplete tasks for corrective action
        config: {
            baseHost: location.hostname,
            pollInterval: 2000,
            claudeCheckInterval: 3000,
            maxQueueSize: 50,
            staleTaskTimeout: 30 * 60 * 1000  // 30 min
        }
    };

    // ==================== TASK CLASS ====================
    class Task {
        constructor(content, options = {}) {
            this.id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
            this.content = content;
            this.priority = options.priority || 'normal';
            this.source = options.source || 'user';
            this.state = TaskState.IDLE;
            this.createdAt = new Date().toISOString();
            this.updatedAt = this.createdAt;
            this.queuedAt = null;
            this.startedAt = null;
            this.completedAt = null;
            this.response = null;
            this.error = null;
            this.statusMessage = '';
            this.progress = 0;
            this.metadata = options.metadata || {};
        }

        setState(newState, message = '') {
            const oldState = this.state;
            this.state = newState;
            this.updatedAt = new Date().toISOString();
            this.statusMessage = message;

            // Track timing
            if (newState === TaskState.QUEUED) this.queuedAt = this.updatedAt;
            if (newState === TaskState.WAITING_FOR_CLAUDE) this.startedAt = this.updatedAt;
            if (newState === TaskState.COMPLETE || newState === TaskState.ERROR) {
                this.completedAt = this.updatedAt;
            }

            console.log(`[TaskProcessor] Task ${this.id}: ${oldState} → ${newState}${message ? ` (${message})` : ''}`);

            // Emit state change event
            TaskProcessor.emit('taskStateChange', { task: this, oldState, newState });
        }

        setProgress(progress, message = '') {
            this.progress = Math.max(0, Math.min(100, progress));
            if (message) this.statusMessage = message;
            TaskProcessor.emit('taskProgress', { task: this, progress: this.progress, message });
        }
    }

    // ==================== EVENT EMITTER ====================
    const listeners = new Map();

    function on(event, callback) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(callback);
    }

    function off(event, callback) {
        if (!listeners.has(event)) return;
        const cbs = listeners.get(event);
        const idx = cbs.indexOf(callback);
        if (idx > -1) cbs.splice(idx, 1);
    }

    function emit(event, data) {
        if (!listeners.has(event)) return;
        listeners.get(event).forEach(cb => {
            try { cb(data); } catch (e) { console.error(`[TaskProcessor] Event handler error:`, e); }
        });
    }

    // ==================== CLAUDE ACTIVITY MONITORING ====================
    let claudeCheckInterval = null;

    async function checkClaudeActivity() {
        try {
            // Check relay queue for pending items (waiting to be picked up)
            const relayRes = await fetch(`http://${state.config.baseHost}:8600/api/queue/pending`);
            const relayPending = await relayRes.json();

            // Also check relay health for overall status
            const healthRes = await fetch(`http://${state.config.baseHost}:8600/api/health`);
            const healthData = await healthRes.json();

            // Check Kitt's internal status
            const kittRes = await fetch(`http://${state.config.baseHost}:8585/api/kitt/status`);
            const kittData = await kittRes.json();

            // Relay is busy if there are items waiting for pickup OR currently being processed by consumer
            const hasPending = relayPending.count > 0 || (relayPending.processing != null);
            const hasProcessing = healthData.queue && healthData.queue.processing > 0;
            const relayBusy = hasPending || hasProcessing || kittData.busy;

            const wasBusy = state.claudeStatus.busy;
            state.claudeStatus = {
                busy: relayBusy,
                since: relayBusy ? (state.claudeStatus.since || new Date().toISOString()) : null,
                source: kittData.busy ? 'kitt' : ((hasPending || hasProcessing) ? 'relay' : null),
                lastCheck: new Date().toISOString(),
                relayQueue: healthData.queue,
                relayPending: relayPending,
                kittStatus: kittData
            };

            state.kittStatus = {
                busy: kittData.busy,
                since: kittData.since,
                task: kittData.task
            };

            // Always emit status update for UI
            emit('claudeStatusChange', state.claudeStatus);

            // Log status for debugging
            const pendingInfo = relayPending.processing ? `active: ${relayPending.processing.id?.slice(-6)}` : `pending: ${relayPending.count}`;
            console.log(`[TaskProcessor] Status: Kitt=${kittData.busy}, Relay=${hasPending} (${pendingInfo})`);

            // If Claude became available, process next task
            if (wasBusy && !state.claudeStatus.busy && state.queue.length > 0) {
                processNextTask();
            }

            return state.claudeStatus;
        } catch (err) {
            console.warn('[TaskProcessor] Claude activity check failed:', err.message);
            return state.claudeStatus;
        }
    }

    function startClaudeMonitoring() {
        if (claudeCheckInterval) return;
        claudeCheckInterval = setInterval(checkClaudeActivity, state.config.claudeCheckInterval);
        checkClaudeActivity(); // Check immediately
    }

    function stopClaudeMonitoring() {
        if (claudeCheckInterval) {
            clearInterval(claudeCheckInterval);
            claudeCheckInterval = null;
        }
    }

    // ==================== RELAY WEBSOCKET INTEGRATION ====================
    function setupRelayWebSocket() {
        if (typeof RelayWS === 'undefined') {
            console.warn('[TaskProcessor] RelayWS not available, using polling fallback');
            return;
        }

        console.log('[TaskProcessor] Setting up RelayWS event handlers');

        // Task created event
        RelayWS.on('task:created', (data) => {
            console.log('[TaskProcessor] Relay: task:created', data.id);
            // Update claude status - now busy
            state.claudeStatus.busy = true;
            state.claudeStatus.source = 'relay';
            emit('claudeStatusChange', state.claudeStatus);
        });

        // Task processing event (consumer picked up)
        RelayWS.on('task:processing', (data) => {
            console.log('[TaskProcessor] Relay: task:processing', data.id);
            // Find matching task and update state
            const task = findTaskByRelayId(data.id);
            if (task && task.state === TaskState.WAITING_FOR_CLAUDE) {
                task.setState(TaskState.CLAUDE_PROCESSING, 'Claude is working...');
                task.setProgress(50);
            }
            state.claudeStatus.busy = true;
            emit('claudeStatusChange', state.claudeStatus);
        });

        // Task completed event
        RelayWS.on('task:completed', (data) => {
            console.log('[TaskProcessor] Relay: task:completed', data.id);
            const task = findTaskByRelayId(data.id);
            if (task) {
                task.response = data.response;
                task.setState(TaskState.COMPLETE, 'Completed');
                task.setProgress(100);

                // Trigger TTS for response
                if (typeof VoiceEngine !== 'undefined' && VoiceEngine.speakResponse) {
                    VoiceEngine.speakResponse(data.response);
                }
            }

            // Check if queue is now empty
            updateClaudeStatusFromRelay();
        });

        // Task failed event
        RelayWS.on('task:failed', (data) => {
            console.log('[TaskProcessor] Relay: task:failed', data.id, data.error);
            const task = findTaskByRelayId(data.id);
            if (task) {
                task.error = data.error;
                task.setState(TaskState.ERROR, data.error);
            }
            updateClaudeStatusFromRelay();
        });

        // Task retrying event
        RelayWS.on('task:retrying', (data) => {
            console.log('[TaskProcessor] Relay: task:retrying', data.id, `${data.retryCount}/${data.maxRetries}`);
            const task = findTaskByRelayId(data.id);
            if (task) {
                task.setState(TaskState.WAITING_FOR_CLAUDE, `Retrying (${data.retryCount}/${data.maxRetries})`);
                task.setProgress(10);
            }
        });

        // Consumer online
        RelayWS.on('consumer:online', (data) => {
            console.log('[TaskProcessor] Consumer online:', data.consumerId);
            state.claudeStatus.busy = true;
            emit('claudeStatusChange', state.claudeStatus);
        });

        // Task updated (cross-out, notes, etc)
        RelayWS.on('task:updated', (data) => {
            console.log('[TaskProcessor] Relay: task:updated', data.id, data.action);
            const task = findTaskByRelayId(data.id);
            if (task) {
                // Refresh task from server
                checkClaudeActivity();
            }
        });

        // Task deleted
        RelayWS.on('task:deleted', (data) => {
            console.log('[TaskProcessor] Relay: task:deleted', data.id);
            const task = findTaskByRelayId(data.id);
            if (task) {
                task.setState(TaskState.CANCELLED, 'Deleted');
                relayIdMap.delete(data.id);
            }
        });

        // Tasks cleanup
        RelayWS.on('tasks:cleanup', (data) => {
            console.log('[TaskProcessor] Relay: tasks:cleanup', data);
            // Refresh all tasks
            checkClaudeActivity();
        });

        // WebSocket connected
        RelayWS.on('connected', () => {
            console.log('[TaskProcessor] RelayWS connected');
            // Reduce polling frequency since we have real-time updates
            if (claudeCheckInterval) {
                clearInterval(claudeCheckInterval);
                claudeCheckInterval = setInterval(checkClaudeActivity, 10000); // 10s fallback poll
            }
        });

        // WebSocket disconnected
        RelayWS.on('disconnected', () => {
            console.log('[TaskProcessor] RelayWS disconnected, increasing poll frequency');
            if (claudeCheckInterval) {
                clearInterval(claudeCheckInterval);
                claudeCheckInterval = setInterval(checkClaudeActivity, state.config.claudeCheckInterval);
            }
        });
    }

    // Map relay task IDs to local tasks
    const relayIdMap = new Map(); // relayId → localTaskId

    function findTaskByRelayId(relayId) {
        const localId = relayIdMap.get(relayId);
        if (localId) return state.tasks.get(localId);

        // Fallback: search by similar timing
        for (const task of state.tasks.values()) {
            if (task.metadata?.relayId === relayId) return task;
        }
        return null;
    }

    function setRelayId(localTaskId, relayId) {
        relayIdMap.set(relayId, localTaskId);
        const task = state.tasks.get(localTaskId);
        if (task) task.metadata.relayId = relayId;
    }

    async function updateClaudeStatusFromRelay() {
        try {
            const healthRes = await fetch(`http://${state.config.baseHost}:8600/api/health`);
            const health = await healthRes.json();
            const busy = (health.queue?.pending > 0) || (health.queue?.processing > 0);
            state.claudeStatus.busy = busy;
            state.claudeStatus.relayQueue = health.queue;
            emit('claudeStatusChange', state.claudeStatus);

            // Process next task if available
            if (!busy && state.queue.length > 0) {
                processNextTask();
            }
        } catch (e) {
            console.warn('[TaskProcessor] Failed to update status from relay:', e.message);
        }
    }

    // ==================== TASK QUEUE MANAGEMENT ====================
    function createTask(content, options = {}) {
        const task = new Task(content, options);
        state.tasks.set(task.id, task);
        return task;
    }

    function queueTask(task) {
        if (state.queue.length >= state.config.maxQueueSize) {
            task.setState(TaskState.ERROR, 'Queue is full');
            emit('queueFull', { task, queueSize: state.queue.length });
            return false;
        }

        task.setState(TaskState.QUEUED, `Position ${state.queue.length + 1} in queue`);

        // Insert based on priority
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const taskPriority = priorityOrder[task.priority] || 1;

        let insertIndex = state.queue.length;
        for (let i = 0; i < state.queue.length; i++) {
            const queuedPriority = priorityOrder[state.queue[i].priority] || 1;
            if (taskPriority < queuedPriority) {
                insertIndex = i;
                break;
            }
        }

        state.queue.splice(insertIndex, 0, task);

        // Update queue positions
        state.queue.forEach((t, idx) => {
            if (t.state === TaskState.QUEUED) {
                t.statusMessage = `Position ${idx + 1} in queue`;
            }
        });

        emit('taskQueued', { task, position: insertIndex + 1, queueLength: state.queue.length });

        // Try to process if Claude is available
        if (!state.claudeStatus.busy && !state.currentTask) {
            processNextTask();
        }

        return true;
    }

    function removeFromQueue(taskId) {
        const idx = state.queue.findIndex(t => t.id === taskId);
        if (idx > -1) {
            const task = state.queue.splice(idx, 1)[0];
            task.setState(TaskState.CANCELLED, 'Removed from queue');
            emit('taskRemoved', { task });
            return true;
        }
        return false;
    }

    // ==================== TASK COMPLETION VERIFICATION ====================
    function verifyLastTaskCompletion() {
        if (!state.lastTask) return { verified: true };

        const lastTask = state.lastTask;
        const completedStates = [TaskState.COMPLETE, TaskState.ERROR, TaskState.CANCELLED];

        if (completedStates.includes(lastTask.state)) {
            return { verified: true, task: lastTask };
        }

        // Task not in completed state - needs corrective action
        console.warn('[TaskProcessor] Last task not completed:', lastTask.id, lastTask.state);
        state.incompleteTaskCount++;

        return {
            verified: false,
            task: lastTask,
            reason: `Task ${lastTask.id} stuck in state: ${lastTask.state}`
        };
    }

    function takeCorrectiveAction(verification) {
        const task = verification.task;
        if (!task) return;

        console.log('[TaskProcessor] Taking corrective action for task:', task.id);

        // Mark as error if stuck
        if (task.state === TaskState.WAITING_FOR_CLAUDE || task.state === TaskState.CLAUDE_PROCESSING) {
            task.setState(TaskState.ERROR, 'Task timed out or was interrupted');
            emit('taskError', { task, error: new Error('Task incomplete - corrective action taken') });
        }

        // Clear from current if stuck there
        if (state.currentTask?.id === task.id) {
            state.currentTask = null;
        }

        emit('taskCorrected', { task, reason: verification.reason });
    }

    // ==================== TASK PROCESSING ====================
    async function processNextTask() {
        if (state.currentTask) {
            console.log('[TaskProcessor] Already processing a task');
            return;
        }

        // Verify last task completed before starting new one
        const verification = verifyLastTaskCompletion();
        if (!verification.verified) {
            console.warn('[TaskProcessor] Previous task incomplete, taking corrective action');
            takeCorrectiveAction(verification);
            // Brief delay before continuing
            await new Promise(r => setTimeout(r, 100));
        }

        if (state.queue.length === 0) {
            console.log('[TaskProcessor] Queue is empty');
            return;
        }

        // Check if Claude is available
        await checkClaudeActivity();
        if (state.claudeStatus.busy) {
            console.log('[TaskProcessor] Claude is busy, waiting...');
            return;
        }

        const task = state.queue.shift();
        state.currentTask = task;
        state.lastTask = task;  // Track for verification

        task.setState(TaskState.WAITING_FOR_CLAUDE, 'Sending to Claude...');
        task.setProgress(10, 'Connecting to relay...');

        emit('taskStarted', { task });

        try {
            // Send to relay
            const response = await sendToRelay(task);

            task.response = response;
            task.setState(TaskState.COMPLETE, 'Done');
            task.setProgress(100, 'Complete');

            emit('taskComplete', { task, response });

        } catch (err) {
            task.error = err.message;
            task.setState(TaskState.ERROR, err.message);

            emit('taskError', { task, error: err });

        } finally {
            state.currentTask = null;

            // Process next task if available
            if (state.queue.length > 0) {
                setTimeout(processNextTask, 500);
            }
        }
    }

    async function sendToRelay(task) {
        const relayUrl = `http://${state.config.baseHost}:8600`;

        // Post to relay queue
        const postRes = await fetch(`${relayUrl}/api/queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: task.content,
                sessionId: task.id,
                context: {
                    source: 'task-processor',
                    taskId: task.id,
                    priority: task.priority
                }
            })
        });

        const postData = await postRes.json();
        if (!postData.messageId) {
            throw new Error('Failed to queue message in relay');
        }

        task.metadata.relayMessageId = postData.messageId;
        task.setState(TaskState.WAITING_FOR_CLAUDE, 'Waiting for Claude Desktop...');
        task.setProgress(20, 'Message queued, waiting for pickup...');

        // Poll for response
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const TIMEOUT = 5 * 60 * 1000; // 5 min timeout for pickup
            const PROCESSING_TIMEOUT = 30 * 60 * 1000; // 30 min for processing
            let lastStatus = 'pending';

            const poll = async () => {
                const elapsed = Date.now() - startTime;

                // Check timeout
                if (lastStatus === 'pending' && elapsed > TIMEOUT) {
                    return reject(new Error('Timeout: Claude Desktop not responding'));
                }
                if (lastStatus === 'processing' && elapsed > PROCESSING_TIMEOUT) {
                    return reject(new Error('Timeout: Claude took too long'));
                }

                try {
                    const res = await fetch(`${relayUrl}/api/queue/${postData.messageId}`);
                    const data = await res.json();

                    if (data.status !== lastStatus) {
                        lastStatus = data.status;

                        if (data.status === 'processing') {
                            task.setState(TaskState.CLAUDE_PROCESSING, 'Claude is working...');
                            task.setProgress(50, 'Processing your request...');
                        }
                    }

                    if (data.status === 'completed' && data.response) {
                        task.setProgress(90, 'Response received');
                        return resolve(data.response);
                    }

                    if (data.status === 'error') {
                        return reject(new Error(data.error || 'Relay error'));
                    }

                    // Continue polling
                    const interval = data.status === 'processing' ? 2000 : 1000;
                    setTimeout(poll, interval);

                } catch (err) {
                    // Retry on network error
                    setTimeout(poll, 3000);
                }
            };

            poll();
        });
    }

    // ==================== SUBMIT TASK (MAIN ENTRY POINT) ====================
    async function submit(content, options = {}) {
        const task = createTask(content, options);

        // Check if we should queue or process immediately
        await checkClaudeActivity();

        if (state.claudeStatus.busy || state.currentTask || state.queue.length > 0) {
            // Queue the task
            queueTask(task);
        } else {
            // Process immediately
            task.setState(TaskState.QUEUED, 'Processing immediately');
            state.queue.push(task);
            processNextTask();
        }

        return task;
    }

    // ==================== CANCEL TASK ====================
    function cancel(taskId) {
        const task = state.tasks.get(taskId);
        if (!task) return false;

        if (task.state === TaskState.QUEUED) {
            return removeFromQueue(taskId);
        }

        if (task === state.currentTask) {
            // TODO: Send cancel request to relay to abort processing
            task.setState(TaskState.CANCELLED, 'Cancelled by user');
            state.currentTask = null;
            emit('taskCancelled', { task });

            // Process next task if available
            if (state.queue.length > 0) {
                setTimeout(processNextTask, 500);
            }
            return true;
        }

        return false;
    }

    // ==================== STATUS GETTERS ====================
    function getTask(taskId) {
        return state.tasks.get(taskId);
    }

    function getQueue() {
        return [...state.queue];
    }

    function getCurrentTask() {
        return state.currentTask;
    }

    function getClaudeStatus() {
        return { ...state.claudeStatus };
    }

    function getStatus() {
        return {
            currentTask: state.currentTask ? {
                id: state.currentTask.id,
                state: state.currentTask.state,
                content: state.currentTask.content.substring(0, 50),
                progress: state.currentTask.progress,
                statusMessage: state.currentTask.statusMessage
            } : null,
            queueLength: state.queue.length,
            queue: state.queue.map(t => ({
                id: t.id,
                content: t.content.substring(0, 50),
                priority: t.priority,
                state: t.state
            })),
            claude: state.claudeStatus,
            kitt: state.kittStatus
        };
    }

    // ==================== CLEANUP ====================
    function cleanupStaleTasks() {
        const now = Date.now();
        const staleThreshold = now - state.config.staleTaskTimeout;

        for (const [taskId, task] of state.tasks) {
            const taskTime = new Date(task.updatedAt).getTime();
            if (taskTime < staleThreshold &&
                (task.state === TaskState.COMPLETE || task.state === TaskState.ERROR || task.state === TaskState.CANCELLED)) {
                state.tasks.delete(taskId);
            }
        }
    }

    // ==================== FETCH HISTORICAL TASKS ====================
    async function fetchHistoricalTasks() {
        try {
            console.log('[TaskProcessor] Fetching historical tasks from relay...');
            const res = await fetch(`http://${state.config.baseHost}:8600/api/queue`);
            const data = await res.json();

            if (!data.messages || data.messages.length === 0) {
                console.log('[TaskProcessor] No historical tasks found');
                return;
            }

            console.log(`[TaskProcessor] Found ${data.messages.length} historical tasks`);

            // Process each task (most recent first, but we'll reverse to maintain order)
            const tasks = data.messages.reverse();

            for (const relayTask of tasks) {
                // Skip if we already have this task
                if (relayIdMap.has(relayTask.id)) continue;

                // Create a local task from relay data
                const task = new Task(relayTask.preview || 'Task', {
                    source: 'relay-history',
                    priority: 'normal',
                    metadata: {
                        relayId: relayTask.id,
                        sessionId: relayTask.sessionId,
                        crossed: relayTask.crossed,
                        notes: relayTask.notes
                    }
                });

                // Override timestamps with relay data
                task.createdAt = relayTask.createdAt;
                task.updatedAt = relayTask.createdAt;

                // Set appropriate state based on relay status
                switch (relayTask.status) {
                    case 'pending':
                        task.state = TaskState.WAITING_FOR_CLAUDE;
                        task.statusMessage = 'Waiting for Claude...';
                        task.progress = 20;
                        break;
                    case 'processing':
                        task.state = TaskState.CLAUDE_PROCESSING;
                        task.statusMessage = 'Claude is working...';
                        task.progress = 50;
                        break;
                    case 'completed':
                        task.state = TaskState.COMPLETE;
                        task.statusMessage = 'Completed';
                        task.progress = 100;
                        break;
                    case 'failed':
                        task.state = TaskState.ERROR;
                        task.statusMessage = 'Failed';
                        break;
                    default:
                        task.state = TaskState.QUEUED;
                        task.statusMessage = relayTask.status;
                }

                // Mark crossed tasks
                if (relayTask.crossed) {
                    task.state = TaskState.CANCELLED;
                    task.statusMessage = 'Crossed out';
                }

                // Store in maps
                state.tasks.set(task.id, task);
                relayIdMap.set(relayTask.id, task.id);

                // Emit event for UI
                console.log('[TaskProcessor] Emitting taskStateChange for:', task.id, task.state);
                emit('taskStateChange', { task, oldState: null, newState: task.state });
            }

            // Log to ActivityLog if available
            if (typeof ActivityLog !== 'undefined') {
                ActivityLog.info(`Loaded ${tasks.length} tasks from relay history`);
            }

            console.log('[TaskProcessor] Historical tasks loaded');
        } catch (err) {
            console.warn('[TaskProcessor] Failed to fetch historical tasks:', err.message);
        }
    }

    // ==================== INITIALIZATION ====================
    function init() {
        console.log('[TaskProcessor] Initializing...');
        startClaudeMonitoring();

        // Setup RelayWS for real-time events
        setupRelayWebSocket();

        // Cleanup stale tasks every 5 minutes
        setInterval(cleanupStaleTasks, 5 * 60 * 1000);

        // Initial status check and emit
        checkClaudeActivity().then(status => {
            console.log('[TaskProcessor] Initial status:', status);
        });

        // Fetch historical tasks from relay (with small delay for UI to be ready)
        setTimeout(fetchHistoricalTasks, 500);

        console.log('[TaskProcessor] Ready (with RelayWS)');
    }

    // ==================== SYNC WITH SERVER ====================
    async function syncWithServer() {
        console.log('[TaskProcessor] Syncing with server...');

        try {
            // 1. Get current server state
            const healthRes = await fetch(`http://${state.config.baseHost}:8600/api/health`);
            const health = await healthRes.json();

            // 2. Update claude status from server
            const busy = (health.queue?.pending > 0) || (health.queue?.processing > 0);
            state.claudeStatus = {
                busy: busy,
                since: busy ? (state.claudeStatus.since || new Date().toISOString()) : null,
                source: busy ? 'relay' : null,
                lastCheck: new Date().toISOString(),
                relayQueue: health.queue
            };

            // 3. Emit status update for UI
            emit('claudeStatusChange', state.claudeStatus);

            // 4. Log sync result
            console.log('[TaskProcessor] Synced:', {
                pending: health.queue?.pending || 0,
                processing: health.queue?.processing || 0,
                busy: busy
            });

            // 5. Notify UI via activity log if available
            if (typeof ActivityLog !== 'undefined') {
                ActivityLog.info(`Synced: P:${health.queue?.pending || 0} W:${health.queue?.processing || 0} - ${busy ? 'Busy' : 'Ready'}`);
            }

            return { success: true, health, busy };
        } catch (err) {
            console.error('[TaskProcessor] Sync failed:', err.message);
            return { success: false, error: err.message };
        }
    }

    // Debug helper - call from console: TaskProcessor.debug()
    function debug() {
        console.log('=== TaskProcessor Debug ===');
        console.log('Claude Status:', state.claudeStatus);
        console.log('Kitt Status:', state.kittStatus);
        console.log('Current Task:', state.currentTask);
        console.log('Queue:', state.queue);
        console.log('Tasks Map:', Array.from(state.tasks.entries()));
        return state;
    }

    // ==================== PUBLIC API ====================
    return {
        // Constants
        TaskState,

        // Core methods
        init,
        submit,
        cancel,

        // Queue management
        getTask,
        getQueue,
        getCurrentTask,
        getClaudeStatus,
        getStatus,

        // Events
        on,
        off,
        emit,

        // Claude monitoring
        checkClaudeActivity,
        startClaudeMonitoring,
        stopClaudeMonitoring,

        // Relay integration
        setRelayId,
        fetchHistoricalTasks,
        syncWithServer,

        // Debugging
        debug,
        _state: state
    };
})();

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', TaskProcessor.init);

// Export for other modules
window.TaskProcessor = TaskProcessor;
