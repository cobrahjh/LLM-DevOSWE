/**
 * Integration Tests - Relay Service (port 8600)
 *
 * Tests Relay API endpoints for task queue, consumers, alerts, sessions, and more.
 * Run with: npx jest tests/integration/relay.test.js --verbose
 *
 * Note: Requires Relay to be running on localhost:8600.
 * Tests skip gracefully if the service is offline.
 */

const BASE = 'http://localhost:8600';
const TIMEOUT = 5000;

jest.setTimeout(15000);

async function api(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        signal: AbortSignal.timeout(TIMEOUT),
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    return { status: res.status, data: await res.json().catch(() => null), ok: res.ok };
}

let online = false;

beforeAll(async () => {
    const r = await api('/api/health').catch(() => ({ ok: false }));
    online = r.ok;
    if (!online) console.warn('⚠️  Relay offline — skipping tests');
});

// Track created resources for cleanup
const createdQueueIds = [];
const createdTeamTaskIds = [];
const createdAlertIds = [];
const createdSessionIds = [];
let registeredConsumerId = null;

afterAll(async () => {
    if (!online) return;
    for (const id of createdQueueIds) {
        await api(`/api/queue/${id}?force=true`, { method: 'DELETE' }).catch(() => {});
    }
    for (const id of createdTeamTaskIds) {
        await api(`/api/team-tasks/${id}`, { method: 'DELETE' }).catch(() => {});
    }
    for (const id of createdSessionIds) {
        await api(`/api/sessions/${id}`, { method: 'DELETE' }).catch(() => {});
    }
    if (registeredConsumerId) {
        await api('/api/consumer/unregister', {
            method: 'POST',
            body: JSON.stringify({ consumerId: registeredConsumerId })
        }).catch(() => {});
    }
});

// ─── Health & Status ─────────────────────────────────────────────────────────

describe('Relay — Health & Status', () => {
    test('GET /api/health returns healthy with queue stats', async () => {
        if (!online) return;
        const r = await api('/api/health');
        expect(r.ok).toBe(true);
        expect(r.data).toHaveProperty('status', 'ok');
        expect(r.data).toHaveProperty('service');
    });

    test('GET / returns service info', async () => {
        if (!online) return;
        const r = await api('/');
        expect(r.ok).toBe(true);
    });
});

// ─── Task Queue - Core Flow ─────────────────────────────────────────────────

describe('Relay — Task Queue', () => {
    let testQueueId = null;

    test('POST /api/queue creates a queue item', async () => {
        if (!online) return;
        const r = await api('/api/queue', {
            method: 'POST',
            body: JSON.stringify({
                message: '__test_relay_queue__ — integration test, safe to delete',
                source: 'integration-test',
                target: 'test-consumer'
            })
        });
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
        testQueueId = r.data?.messageId || r.data?.id || r.data?.taskId;
        if (testQueueId) createdQueueIds.push(testQueueId);
    });

    test('GET /api/queue returns queue list', async () => {
        if (!online) return;
        const r = await api('/api/queue');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/queue/:id returns specific queue item', async () => {
        if (!online) return;
        if (!testQueueId) return;
        const r = await api(`/api/queue/${testQueueId}`);
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/queue/pending returns pending items', async () => {
        if (!online) return;
        const r = await api('/api/queue/pending');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('DELETE /api/queue/:id removes queue item', async () => {
        if (!online) return;
        if (!testQueueId) return;
        const r = await api(`/api/queue/${testQueueId}?force=true`, { method: 'DELETE' });
        expect(r.ok).toBe(true);
        // Remove from cleanup list
        const idx = createdQueueIds.indexOf(testQueueId);
        if (idx !== -1) createdQueueIds.splice(idx, 1);
    });

    test('POST /api/queue/respond responds to queue item', async () => {
        if (!online) return;
        // Create a fresh item for respond test
        const create = await api('/api/queue', {
            method: 'POST',
            body: JSON.stringify({
                message: '__test_respond__ — integration test',
                source: 'integration-test'
            })
        });
        const respondId = create.data?.messageId;
        if (!respondId) return;
        createdQueueIds.push(respondId);
        const r = await api('/api/queue/respond', {
            method: 'POST',
            body: JSON.stringify({ messageId: respondId, response: 'test-ack' })
        });
        expect(r.status).toBeLessThan(500);
    });

    test('GET /api/queue/review returns review data or 404', async () => {
        if (!online) return;
        const r = await api('/api/queue/review');
        // Review endpoint may return 404 if no items need review
        expect(r.status).toBeLessThan(500);
    });

    test('POST /api/queue/cleanup runs queue cleanup', async () => {
        if (!online) return;
        const r = await api('/api/queue/cleanup', { method: 'POST' });
        expect(r.ok).toBe(true);
    });

    test('POST /api/queue returns 400 without required fields', async () => {
        if (!online) return;
        const r = await api('/api/queue', {
            method: 'POST',
            body: JSON.stringify({})
        });
        expect(r.status).toBe(400);
    });

    test('GET /api/queue/:id returns 404 for nonexistent item', async () => {
        if (!online) return;
        const r = await api('/api/queue/__nonexistent_99999__');
        expect(r.status).toBe(404);
    });
});

// ─── Messages ────────────────────────────────────────────────────────────────

describe('Relay — Messages', () => {
    test('GET /api/messages/pending returns pending messages', async () => {
        if (!online) return;
        const r = await api('/api/messages/pending');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });
});

// ─── Task History & Review ───────────────────────────────────────────────────

describe('Relay — Task History & Review', () => {
    test('GET /api/tasks/history returns task history', async () => {
        if (!online) return;
        const r = await api('/api/tasks/history');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/tasks/dead-letters returns dead letter queue', async () => {
        if (!online) return;
        const r = await api('/api/tasks/dead-letters');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/dead-letters returns dead letters', async () => {
        if (!online) return;
        const r = await api('/api/dead-letters');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/queue/review returns review data or 404', async () => {
        if (!online) return;
        const r = await api('/api/queue/review');
        // Review endpoint may return 404 if no items need review
        expect(r.status).toBeLessThan(500);
    });
});

// ─── Consumers ───────────────────────────────────────────────────────────────

describe('Relay — Consumers', () => {
    const testConsumer = '__test_consumer_' + Date.now();

    test('GET /api/consumers returns consumer list', async () => {
        if (!online) return;
        const r = await api('/api/consumers');
        expect(r.ok).toBe(true);
        expect(r.data).toHaveProperty('consumers');
        expect(Array.isArray(r.data.consumers)).toBe(true);
    });

    test('POST /api/consumer/register registers a consumer', async () => {
        if (!online) return;
        const r = await api('/api/consumer/register', {
            method: 'POST',
            body: JSON.stringify({
                consumerId: testConsumer,
                name: 'Integration Test Consumer',
                capabilities: ['test']
            })
        });
        expect(r.ok).toBe(true);
        registeredConsumerId = testConsumer;
    });

    test('POST /api/consumer/heartbeat sends heartbeat', async () => {
        if (!online) return;
        if (!registeredConsumerId) return;
        const r = await api('/api/consumer/heartbeat', {
            method: 'POST',
            body: JSON.stringify({ consumerId: registeredConsumerId })
        });
        expect(r.ok).toBe(true);
    });

    test('POST /api/consumer/unregister unregisters consumer', async () => {
        if (!online) return;
        if (!registeredConsumerId) return;
        const r = await api('/api/consumer/unregister', {
            method: 'POST',
            body: JSON.stringify({ consumerId: registeredConsumerId })
        });
        expect(r.ok).toBe(true);
        registeredConsumerId = null;
    });

    test('POST /api/consumer/register returns 400 without consumerId', async () => {
        if (!online) return;
        const r = await api('/api/consumer/register', {
            method: 'POST',
            body: JSON.stringify({})
        });
        expect(r.status).toBe(400);
    });
});

// ─── File Lock ───────────────────────────────────────────────────────────────

describe('Relay — File Lock', () => {
    test('GET /api/filelock returns lock status', async () => {
        if (!online) return;
        const r = await api('/api/filelock');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });
});

// ─── Team Tasks ──────────────────────────────────────────────────────────────

describe('Relay — Team Tasks', () => {
    let testTeamTaskId = null;

    test('POST /api/team-tasks creates a team task', async () => {
        if (!online) return;
        const r = await api('/api/team-tasks', {
            method: 'POST',
            body: JSON.stringify({
                text: '__test_team_task__ — integration test, safe to delete',
                assignee: 'test-agent'
            })
        });
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
        testTeamTaskId = r.data?.id;
        if (testTeamTaskId) createdTeamTaskIds.push(testTeamTaskId);
    });

    test('GET /api/team-tasks returns team task list', async () => {
        if (!online) return;
        const r = await api('/api/team-tasks');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/team-tasks/:id returns specific team task', async () => {
        if (!online) return;
        if (!testTeamTaskId) return;
        const r = await api(`/api/team-tasks/${testTeamTaskId}`);
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('PATCH /api/team-tasks/:id updates team task', async () => {
        if (!online) return;
        if (!testTeamTaskId) return;
        const r = await api(`/api/team-tasks/${testTeamTaskId}`, {
            method: 'PATCH',
            body: JSON.stringify({ description: 'Updated by integration test' })
        });
        expect(r.ok).toBe(true);
    });

    test('POST /api/team-tasks/:id/complete marks task complete', async () => {
        if (!online) return;
        if (!testTeamTaskId) return;
        const r = await api(`/api/team-tasks/${testTeamTaskId}/complete`, {
            method: 'POST',
            body: JSON.stringify({ result: 'Completed by integration test' })
        });
        expect(r.ok).toBe(true);
    });

    test('DELETE /api/team-tasks/:id deletes team task', async () => {
        if (!online) return;
        if (!testTeamTaskId) return;
        const r = await api(`/api/team-tasks/${testTeamTaskId}`, { method: 'DELETE' });
        expect(r.ok).toBe(true);
        const idx = createdTeamTaskIds.indexOf(testTeamTaskId);
        if (idx !== -1) createdTeamTaskIds.splice(idx, 1);
    });

    test('GET /api/team-tasks/stats/summary returns summary stats', async () => {
        if (!online) return;
        const r = await api('/api/team-tasks/stats/summary');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('POST /api/team-tasks returns 400 without required fields', async () => {
        if (!online) return;
        const r = await api('/api/team-tasks', {
            method: 'POST',
            body: JSON.stringify({})
        });
        expect(r.status).toBe(400);
    });
});

// ─── Alerts ──────────────────────────────────────────────────────────────────

describe('Relay — Alerts', () => {
    let testAlertId = null;

    test('POST /api/alerts creates an alert', async () => {
        if (!online) return;
        const r = await api('/api/alerts', {
            method: 'POST',
            body: JSON.stringify({
                title: '__test_alert__ — integration test, safe to delete',
                source: 'integration-test',
                severity: 'info'
            })
        });
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
        testAlertId = r.data?.id;
        if (testAlertId) createdAlertIds.push(testAlertId);
    });

    test('GET /api/alerts returns alert list', async () => {
        if (!online) return;
        const r = await api('/api/alerts');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/alerts filters by severity', async () => {
        if (!online) return;
        const r = await api('/api/alerts?severity=info');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/alerts/summary returns 24h summary', async () => {
        if (!online) return;
        const r = await api('/api/alerts/summary');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('POST /api/alerts/:id/ack acknowledges alert', async () => {
        if (!online) return;
        if (!testAlertId) return;
        const r = await api(`/api/alerts/${testAlertId}/ack`, { method: 'POST' });
        expect(r.ok).toBe(true);
    });

    test('POST /api/alerts returns 400 without required fields', async () => {
        if (!online) return;
        const r = await api('/api/alerts', {
            method: 'POST',
            body: JSON.stringify({})
        });
        expect(r.status).toBe(400);
    });
});

// ─── Sessions (HiveStore) ───────────────────────────────────────────────────

describe('Relay — Sessions', () => {
    let testSessionId = null;

    test('POST /api/sessions creates a session', async () => {
        if (!online) return;
        const r = await api('/api/sessions', {
            method: 'POST',
            body: JSON.stringify({
                name: '__test_session_' + Date.now(),
                type: 'test'
            })
        });
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
        testSessionId = r.data?.id || r.data?.sessionId;
        if (testSessionId) createdSessionIds.push(testSessionId);
    });

    test('GET /api/sessions returns session list', async () => {
        if (!online) return;
        const r = await api('/api/sessions');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/sessions/:id returns specific session', async () => {
        if (!online) return;
        if (!testSessionId) return;
        const r = await api(`/api/sessions/${testSessionId}`);
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('PATCH /api/sessions/:id updates session', async () => {
        if (!online) return;
        if (!testSessionId) return;
        const r = await api(`/api/sessions/${testSessionId}`, {
            method: 'PATCH',
            body: JSON.stringify({ name: '__test_session_updated__' })
        });
        expect(r.ok).toBe(true);
    });

    test('POST /api/sessions/:id/end ends session', async () => {
        if (!online) return;
        if (!testSessionId) return;
        const r = await api(`/api/sessions/${testSessionId}/end`, { method: 'POST' });
        expect(r.ok).toBe(true);
    });

    test('DELETE /api/sessions/:id deletes session', async () => {
        if (!online) return;
        if (!testSessionId) return;
        const r = await api(`/api/sessions/${testSessionId}`, { method: 'DELETE' });
        expect(r.ok).toBe(true);
        const idx = createdSessionIds.indexOf(testSessionId);
        if (idx !== -1) createdSessionIds.splice(idx, 1);
    });

    test('GET /api/sessions/:id returns 404 for nonexistent session', async () => {
        if (!online) return;
        const r = await api('/api/sessions/__nonexistent_session_99999__');
        expect(r.status).toBe(404);
    });
});

// ─── Knowledge & Intel ───────────────────────────────────────────────────────

describe('Relay — Knowledge & Intel', () => {
    test('GET /api/knowledge/status returns knowledge status', async () => {
        if (!online) return;
        const r = await api('/api/knowledge/status');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/knowledge/list/:type returns items for valid type', async () => {
        if (!online) return;
        const r = await api('/api/knowledge/list/claude_md');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/knowledge/list/:type handles invalid type', async () => {
        if (!online) return;
        const r = await api('/api/knowledge/list/__invalid_type__');
        // Should return 400 or empty result, not 500
        expect(r.status).toBeLessThan(500);
    });

    test('GET /api/intel/db returns intel database', async () => {
        if (!online) return;
        const r = await api('/api/intel/db');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });
});
