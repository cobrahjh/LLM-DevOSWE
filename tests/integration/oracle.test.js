/**
 * Integration Tests - Oracle Service (port 3002)
 *
 * Tests Oracle API endpoints for health, tasks, intel, memory, workspace, and more.
 * Run with: npx jest tests/integration/oracle.test.js --verbose
 *
 * Note: Requires Oracle to be running on localhost:3002.
 * Tests skip gracefully if the service is offline.
 */

const BASE = 'http://localhost:3002';
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
    if (!online) console.warn('⚠️  Oracle offline — skipping tests');
});

// Track created resources for cleanup
const createdFacts = [];
let createdTaskId = null;

afterAll(async () => {
    if (!online) return;
    for (const key of createdFacts) {
        await api(`/api/memory/facts/${key}`, { method: 'DELETE' }).catch(() => {});
    }
});

// ─── Health & Status ─────────────────────────────────────────────────────────

describe('Oracle — Health & Status', () => {
    test('GET /api/health returns healthy status', async () => {
        if (!online) return;
        const r = await api('/api/health');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
        // Oracle health returns backend info (backend, ollama status, models)
        expect(r.data).toHaveProperty('backend');
    });

    test('GET /api/briefing returns briefing data', async () => {
        if (!online) return;
        const r = await api('/api/briefing');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/model returns current model configuration', async () => {
        if (!online) return;
        const r = await api('/api/model');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });
});

// ─── Task Management ─────────────────────────────────────────────────────────

describe('Oracle — Task Management', () => {
    test('GET /api/tasks returns task list', async () => {
        if (!online) return;
        const r = await api('/api/tasks');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('POST /api/tasks creates a task', async () => {
        if (!online) return;
        const r = await api('/api/tasks', {
            method: 'POST',
            body: JSON.stringify({
                title: '__test_oracle_task__',
                description: 'Integration test task — safe to delete',
                priority: 'low'
            })
        });
        expect(r.status).toBeLessThan(500);
        if (r.ok && r.data?.id) {
            createdTaskId = r.data.id;
        }
    });

    test('GET /api/tasks/escalated returns escalated tasks', async () => {
        if (!online) return;
        const r = await api('/api/tasks/escalated');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/direct-tasks returns direct tasks', async () => {
        if (!online) return;
        const r = await api('/api/direct-tasks');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('POST /api/direct-task creates a direct task', async () => {
        if (!online) return;
        const r = await api('/api/direct-task', {
            method: 'POST',
            body: JSON.stringify({
                task: '__test_direct_task__',
                description: 'Integration test direct task'
            })
        });
        expect(r.status).toBeLessThan(500);
    });
});

// ─── Intelligence API ────────────────────────────────────────────────────────

describe('Oracle — Intelligence API', () => {
    test('GET /api/intel returns intelligence data', async () => {
        if (!online) return;
        const r = await api('/api/intel');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/intel/curated returns curated intel', async () => {
        if (!online) return;
        const r = await api('/api/intel/curated');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/intel/briefing returns intel briefing', async () => {
        if (!online) return;
        // Briefing generation can take time - use longer timeout
        const r = await fetch(`${BASE}/api/intel/briefing`, {
            signal: AbortSignal.timeout(10000),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await r.json().catch(() => null);
        expect(r.ok).toBe(true);
        expect(data).toBeDefined();
    }, 15000);

    test('GET /api/intel/briefings returns briefing list', async () => {
        if (!online) return;
        const r = await api('/api/intel/briefings');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/intel/health returns intel health', async () => {
        if (!online) return;
        const r = await api('/api/intel/health');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/intel/models returns available models', async () => {
        if (!online) return;
        const r = await api('/api/intel/models');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/intel/learned returns learned intelligence', async () => {
        if (!online) return;
        const r = await api('/api/intel/learned');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/insights returns insights', async () => {
        if (!online) return;
        const r = await api('/api/insights');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });
});

// ─── Memory Bus ──────────────────────────────────────────────────────────────

describe('Oracle — Memory Bus', () => {
    const testKey = '__test_fact_' + Date.now();

    test('GET /api/memory/facts returns facts list', async () => {
        if (!online) return;
        const r = await api('/api/memory/facts');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('POST /api/memory/facts creates a fact', async () => {
        if (!online) return;
        const r = await api('/api/memory/facts', {
            method: 'POST',
            body: JSON.stringify({ key: testKey, value: 'integration_test_value' })
        });
        expect(r.ok).toBe(true);
        createdFacts.push(testKey);
    });

    test('GET /api/memory/facts/:key retrieves the created fact', async () => {
        if (!online) return;
        const r = await api(`/api/memory/facts/${testKey}`);
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('DELETE /api/memory/facts/:key removes the fact', async () => {
        if (!online) return;
        const r = await api(`/api/memory/facts/${testKey}`, { method: 'DELETE' });
        expect(r.ok).toBe(true);
        // Remove from cleanup list since we already deleted it
        const idx = createdFacts.indexOf(testKey);
        if (idx !== -1) createdFacts.splice(idx, 1);
    });

    test('GET /api/memory/facts/:key returns 404 for missing key', async () => {
        if (!online) return;
        const r = await api('/api/memory/facts/__nonexistent_key_12345__');
        expect(r.status).toBe(404);
    });

    test('POST /api/memory/facts returns 400 without required fields', async () => {
        if (!online) return;
        const r = await api('/api/memory/facts', {
            method: 'POST',
            body: JSON.stringify({})
        });
        expect(r.status).toBe(400);
    });

    test('GET /api/memory/sessions returns memory sessions', async () => {
        if (!online) return;
        const r = await api('/api/memory/sessions');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/memory/handoffs returns handoffs', async () => {
        if (!online) return;
        const r = await api('/api/memory/handoffs');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/memory/context returns memory context', async () => {
        if (!online) return;
        const r = await api('/api/memory/context');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });
});

// ─── Workspace & Sandbox ─────────────────────────────────────────────────────

describe('Oracle — Workspace & Sandbox', () => {
    test('GET /api/workspace returns workspace info', async () => {
        if (!online) return;
        const r = await api('/api/workspace');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/sandbox returns sandbox listing', async () => {
        if (!online) return;
        const r = await api('/api/sandbox');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/sandbox/read rejects path traversal', async () => {
        if (!online) return;
        const r = await api('/api/sandbox/read?path=../../etc/passwd');
        // Should reject with 400 or 403, not succeed
        expect(r.status).toBeGreaterThanOrEqual(400);
        expect(r.status).toBeLessThan(500);
    });
});

// ─── Projects ────────────────────────────────────────────────────────────────

describe('Oracle — Projects', () => {
    test('GET /api/projects returns project list', async () => {
        if (!online) return;
        const r = await api('/api/projects');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });
});

// ─── Sessions ────────────────────────────────────────────────────────────────

describe('Oracle — Sessions', () => {
    test('GET /api/sessions returns session list', async () => {
        if (!online) return;
        const r = await api('/api/sessions');
        expect(r.ok).toBe(true);
        expect(r.data).toBeDefined();
    });

    test('GET /api/conversation/:id returns empty for nonexistent session', async () => {
        if (!online) return;
        const r = await api('/api/conversation/__nonexistent_session_12345__');
        // Oracle returns 200 with empty/null data for missing conversations
        expect(r.status).toBeLessThan(500);
    });
});

// ─── Weather ─────────────────────────────────────────────────────────────────

describe('Oracle — Weather', () => {
    test('GET /api/weather returns weather data', async () => {
        if (!online) return;
        const r = await api('/api/weather');
        expect(r.status).toBeLessThan(500);
        // May return 200 or 4xx depending on config — just ensure no server error
    });

    test('GET /api/weather/airports returns airport list', async () => {
        if (!online) return;
        const r = await api('/api/weather/airports');
        expect(r.status).toBeLessThan(500);
    });
});

// ─── Input Validation ────────────────────────────────────────────────────────

describe('Oracle — Input Validation', () => {
    test('POST /api/ask rejects empty body', async () => {
        if (!online) return;
        const r = await api('/api/ask', {
            method: 'POST',
            body: JSON.stringify({})
        }).catch(() => ({ status: 0, ok: false, data: null }));
        // Should not return 200 — either 400, connection reset, or error
        expect(r.ok).toBe(false);
    });

    test('POST /api/model rejects empty model string', async () => {
        if (!online) return;
        const r = await api('/api/model', {
            method: 'POST',
            body: JSON.stringify({ model: '' })
        }).catch(() => ({ status: 0, ok: false, data: null }));
        // Should not return 200 — either 400 or connection error
        expect(r.ok).toBe(false);
    });
});
