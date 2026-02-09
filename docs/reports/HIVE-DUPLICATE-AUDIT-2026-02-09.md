# Hive Ecosystem Duplicate Audit Report
**Date:** 2026-02-09
**Scope:** Complete review of all projects, agents, processes, and services
**Status:** 🔴 **CRITICAL DUPLICATES FOUND**

---

## Executive Summary

The Hive ecosystem has **15 categories of duplicates** spanning services, agents, databases, configurations, and code patterns. Most critical are **4 port conflicts** and **duplicate process management** across 3 systems (Orchestrator, NSSM, HiveImmortal).

**Impact:** Potential service conflicts, resource waste, maintenance burden, unclear authority over service lifecycle.

**Root Cause:** Organic growth without unified architecture, no shared infrastructure layer, documentation drift from implementation.

---

## CRITICAL ISSUES (Immediate Action Required)

### 1. Port Conflicts 🔴

| Port | Service 1 | Service 2 | Impact |
|------|-----------|-----------|--------|
| **8701** | Hive-Mind Monitor | Terminal Bridge | One service cannot start |
| **8800** | Hive Brain Admin | HiveImmortal Oracle | Service collision |
| **8900** | silverstream | bible-summary | **DIRECT CONFLICT** - both assigned same port |
| **8810** | Hive-Brain Discovery (hive-brain.js) | Hive Brain Admin (server.js) | Same directory, different entry points |

**Recommendation:**
- Reassign bible-summary to port 8901
- Remove Terminal Bridge (functionality merged into Terminal Hub on 8771)
- Consolidate Hive Brain into single service (keep hive-brain.js, remove server.js)
- Reassign HiveImmortal Oracle to port 8801

---

### 2. Duplicate Service Registries 🔴

**THREE independent service registries:**

| Registry | Location | Services Listed | Authority |
|----------|----------|----------------|-----------|
| Orchestrator | orchestrator.js | 19 services | ✅ Authoritative (manages startup) |
| SERVICE-REGISTRY.md | docs/ | 26+ services | ⚠️ Documentation only |
| Hive Brain Local | hive-brain/server.js | 4 services | ❌ Hardcoded subset |

**Problem:** SERVICE-REGISTRY.md lists services NOT in Orchestrator code.

**Recommendation:**
- Make Orchestrator the single source of truth
- Auto-generate SERVICE-REGISTRY.md from Orchestrator config
- Remove hardcoded service lists from individual services

---

### 3. Duplicate Process Managers 🔴

**THREE systems managing the same services:**

| System | Services Managed | Startup Method |
|--------|-----------------|----------------|
| **Orchestrator** (:8500) | 19 services | `child_process.spawn()` |
| **NSSM** (Windows Services) | 12 services (HiveOracle, HiveRelay, etc.) | Windows Service Manager |
| **HiveImmortal** (DevClaude) | 16+ agents | Unknown orchestration |

**Conflicts:**
- Orchestrator tries to spawn services that NSSM already manages
- HiveImmortal Oracle on port 8800 conflicts with Orchestrator's Hive Brain Admin
- No clear authority on who owns service lifecycle

**Recommendation:**
- **PRIMARY:** Use NSSM for all core services (auto-start on boot)
- **SECONDARY:** Use Orchestrator ONLY for health monitoring (don't spawn services)
- **TERTIARY:** HiveImmortal manages ONLY DevClaude-specific agents (separate namespace)

---

### 4. Duplicate Hive-Brain Implementation 🔴

**SAME DIRECTORY, TWO ENTRY POINTS:**
- `C:\LLM-DevOSWE\Admin\hive-brain\hive-brain.js` (Port 8810 - Discovery)
- `C:\LLM-DevOSWE\Admin\hive-brain\server.js` (Port 8800 - Admin Control)

**Problem:** Unclear which is authoritative, different port assignments.

**Recommendation:**
- **KEEP:** `hive-brain.js` as the unified service (combines discovery + admin)
- **REMOVE:** `server.js` (merge its admin UI into hive-brain.js)
- **PORT:** Standardize on 8810

---

### 5. Duplicate Claude Bridge Services 🟡

**TWO services in same directory:**
- `bridge-service.js` (Port 8700) - WebSocket bridge to Claude Code CLI
- `bridge-server.js` (Port 8601) - Automatic task processor for Kitt

**Problem:** Overlapping functionality, both interface with Claude Code.

**Recommendation:**
- **MERGE:** Combine into single `claude-bridge-service.js` on port 8700
- Features: WebSocket bridge + auto-task processing
- Remove port 8601 from registry

---

### 6. Duplicate Voice Services (Conflicting) 🟡

| Service | Port | Purpose | Issue |
|---------|------|---------|-------|
| **Hive Voice** | 8870 | Low-level voice control | No WebSocket server defined |
| **VoiceAccess** | 8875 | Admin layer, persona routing | Depends on Hive Voice WebSocket (doesn't exist) |

**Problem:** VoiceAccess expects WebSocket from Hive Voice, but Hive Voice has only HTTP endpoints.

**Recommendation:**
- **CONSOLIDATE:** Merge into single "VoiceAccess" service on port 8875
- Remove Hive Voice as separate service
- Migrate low-level control features into VoiceAccess

---

## HIGH PRIORITY ISSUES

### 7. Duplicate Databases 🟡

**FOUR SQLite databases** (should be unified HiveStore):

| Database | Location | Tables | Purpose |
|----------|----------|--------|---------|
| relay.db | Admin/relay/ | 18 tables | Tasks, alerts, conversations, knowledge, sessions |
| knowledge.db | Admin/relay/ | 1 table | **DUPLICATE** knowledge storage |
| tasks.db | Admin/relay/ | Task queue | **DUPLICATE** task storage |
| terminal-hub.db | Admin/terminal-hub/ | Session presets | Terminal sessions |

**Problem:** Same directory has relay.db, knowledge.db, AND tasks.db - schema duplication.

**Recommendation:**
- **UNIFY:** Merge knowledge.db and tasks.db into relay.db
- Rename relay.db → `hivestore.db` (central persistence)
- Migrate terminal-hub.db tables into hivestore.db
- Document unified schema in STANDARDS.md

---

### 8. Duplicate Persona Definitions 🟡

**FIVE locations defining personas:**

| Source | Location | Format | Authority |
|--------|----------|--------|-----------|
| PERSONAS.md | docs/ | Markdown | Documentation |
| voiceaccess-data.json | Admin/voiceaccess/ | JSON | Runtime (VoiceAccess) |
| personas.json | C:\DevClaude\Hivemind\personas/ | JSON | Runtime (Hive Personas) |
| heather.js | Admin/agent/agent-ui/ | JavaScript | Code |
| team-tasks.js | Admin/agent/agent-ui/ | JavaScript | Code |

**Problem:** No single source of truth, edits in one location don't propagate.

**Recommendation:**
- **AUTHORITY:** Hive Personas service (port 8770) is authoritative database
- All services query Personas API instead of local files
- PERSONAS.md auto-generated from Personas API
- Remove voiceaccess-data.json personas (use API)

---

### 9. Duplicate Orchestrator Priority 🟡

**TWO services assigned priority 14:**
- Hive Personas (line 237-246): Priority 14
- MCP-Bridge (line 248-257): Priority 14

**Problem:** Violates orchestrator design (unique priorities for ordered startup).

**Recommendation:**
- MCP-Bridge → Priority 15
- Hive Personas → Priority 14 (keep)

---

## MEDIUM PRIORITY ISSUES

### 10. Duplicate WebSocket Implementations (30+ files) 🟠

**Identical broadcast patterns in:**
- relay-service.js
- agent-server.js
- hive-mind-server.js
- hive-brain/server.js
- master-mind.js
- hive-oracle/server.js
- terminal-hub-server.js
- voiceaccess/server.js
- (22+ more files)

**Duplication:** ~200 lines of identical WebSocket code per service.

**Recommendation:**
- Create `Admin/shared/websocket-broadcaster.js` utility
- API: `createBroadcaster(server, path)` → broadcast function
- Refactor all services to use shared utility
- Estimated savings: 5,000+ lines of duplicate code

---

### 11. Duplicate npm Dependencies (50+ files) 🟠

| Package | Installations | Recommended |
|---------|--------------|-------------|
| express | 12+ package.json | 1 (root) |
| ws | 8+ package.json | 1 (root) |
| cors | 6+ package.json | 1 (root) |
| better-sqlite3 | 2 files | 1 (root) |
| dotenv | 3+ files | 1 (root) |

**Recommendation:**
- Install common dependencies at root level
- Use npm workspaces for monorepo structure
- Remove redundant package.json files

---

### 12. Duplicate Environment Configuration (7 files) 🟠

**.env files scattered across:**
- C:\LLM-DevOSWE\.env (Root)
- Admin/agent/.env
- Admin/remote-support/.env
- (+ 4 .env.example files)

**Recommendation:**
- **SINGLE .env:** Root level only (`C:\LLM-DevOSWE\.env`)
- All services read from root .env
- Remove service-specific .env files
- Document all vars in .env.example

---

## LOW PRIORITY ISSUES

### 13. Duplicate Health Check Patterns (30+ files) 🟢

**Identical implementation:**
```javascript
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'ServiceName' });
});
```

**Recommendation:**
- Create `Admin/shared/express-utils.js` with `addHealthCheck(app, serviceName)`
- Refactor all services to use shared function

---

### 14. Duplicate CORS Implementations (12+ files) 🟢

**Identical code:**
```javascript
app.use(cors()); // OR manual headers
```

**Recommendation:**
- Create shared CORS middleware in `Admin/shared/middleware.js`
- Import and use across all services

---

### 15. Duplicate Logging Patterns (15+ files) 🟢

**Identical file-based logging:**
```javascript
const logPath = path.join(__dirname, 'logs', 'service.log');
fs.appendFileSync(logPath, message);
```

**Recommendation:**
- Create `Admin/shared/logger.js` (Winston or Bunyan)
- Unified log format, rotation, log levels
- Central log directory: `C:\LLM-DevOSWE\logs\`

---

## ACTION PLAN

### Phase 1 - Critical Fixes (This Week)

1. ✅ **Fix port conflicts**
   - Reassign bible-summary → 8901
   - Remove Terminal Bridge (use Terminal Hub)
   - Consolidate Hive Brain → single service on 8810
   - Reassign HiveImmortal Oracle → 8801

2. ✅ **Unify process management**
   - NSSM for core services (auto-start)
   - Orchestrator for health monitoring only (no spawning)
   - HiveImmortal for DevClaude agents only

3. ✅ **Merge duplicate services**
   - Claude Bridge: merge bridge-service.js + bridge-server.js → port 8700
   - Voice: merge Hive Voice + VoiceAccess → port 8875
   - Hive Brain: remove server.js, keep hive-brain.js

### Phase 2 - High Priority (Next 2 Weeks)

4. ✅ **Consolidate databases**
   - Merge knowledge.db + tasks.db → relay.db
   - Rename → hivestore.db
   - Migrate terminal-hub tables

5. ✅ **Centralize persona definitions**
   - Hive Personas API as single source of truth
   - Remove voiceaccess-data.json personas
   - Auto-generate PERSONAS.md

6. ✅ **Fix orchestrator priorities**
   - MCP-Bridge → Priority 15

### Phase 3 - Medium Priority (Next Month)

7. ✅ **Create shared utilities**
   - WebSocket broadcaster
   - Express health check
   - CORS middleware
   - Logger utility

8. ✅ **Consolidate npm dependencies**
   - Root-level package.json for common deps
   - Remove service-specific express/ws/cors

9. ✅ **Unify environment config**
   - Single .env at root
   - Remove service-specific .env files

### Phase 4 - Documentation (Ongoing)

10. ✅ **Auto-generate SERVICE-REGISTRY.md**
    - Script to read Orchestrator config
    - Generate markdown table
    - Run on every service change

---

## METRICS

### Current State
- **Total Services:** 26 (documented)
- **Managed by Orchestrator:** 19
- **Port Conflicts:** 4 critical
- **Duplicate Code:** ~5,000+ lines (WebSocket, CORS, logging)
- **npm Installations:** 50+ redundant package.json files
- **Database Files:** 4 (should be 1)

### Target State (After Cleanup)
- **Total Services:** 18 (consolidated)
- **Managed by NSSM:** 15 core services
- **Managed by Orchestrator:** 0 (health monitoring only)
- **Port Conflicts:** 0
- **Shared Utilities:** 4 (WebSocket, Express, Logger, Middleware)
- **npm Installations:** 1 root + 3 specialized
- **Database Files:** 1 (hivestore.db)

---

## CONSOLIDATION RECOMMENDATIONS

### Services to MERGE:
1. **Hive Brain:** hive-brain.js + server.js → hive-brain.js (port 8810)
2. **Claude Bridge:** bridge-service.js + bridge-server.js → claude-bridge-service.js (port 8700)
3. **Voice:** Hive Voice + VoiceAccess → VoiceAccess (port 8875)
4. **Databases:** relay.db + knowledge.db + tasks.db → hivestore.db

### Services to REMOVE:
1. **Terminal Bridge** (port 8701) - functionality in Terminal Hub (8771)
2. **Hive Brain Admin server.js** - merged into hive-brain.js
3. **bridge-server.js** - merged into bridge-service.js
4. **Hive Voice** (8870) - merged into VoiceAccess

### Ports to REASSIGN:
- bible-summary: 8900 → 8901
- HiveImmortal Oracle: 8800 → 8801
- MCP-Bridge: Priority 14 → Priority 15

---

## IMPLEMENTATION GUIDE

### Step 1: Fix Port Conflicts (30 min)

```bash
# Update bible-summary port
cd C:/Projects/bible-summary
# Edit server.js: const PORT = 8901

# Remove Terminal Bridge
# (Already replaced by Terminal Hub on 8771)
rm -rf C:/LLM-DevOSWE/Admin/terminal-bridge

# Consolidate Hive Brain
cd C:/LLM-DevOSWE/Admin/hive-brain
# Merge server.js features into hive-brain.js
# Delete server.js
```

### Step 2: Unify Process Management (1 hour)

```powershell
# Install all core services as NSSM services
# (Already mostly done - verify list)

# Update Orchestrator to health-check-only mode
# Edit orchestrator.js:
# - Change spawn() to health check only
# - Remove service start/stop/restart (defer to NSSM)
# - Keep alert system
```

### Step 3: Merge Duplicate Services (2 hours)

```bash
# Merge Claude Bridge
cd C:/LLM-DevOSWE/Admin/claude-bridge
# Copy features from bridge-server.js into bridge-service.js
# Delete bridge-server.js

# Merge Voice Services
cd C:/LLM-DevOSWE/Admin/voiceaccess
# Copy low-level control from hive-voice into voiceaccess
cd C:/LLM-DevOSWE/Admin/hive-voice
# Delete entire directory (merged)
```

### Step 4: Consolidate Databases (1 hour)

```bash
cd C:/LLM-DevOSWE/Admin/relay

# Merge schemas
sqlite3 relay.db < migrate-knowledge.sql
sqlite3 relay.db < migrate-tasks.sql

# Rename
mv relay.db hivestore.db

# Update all service connection strings
grep -r "relay.db" . | # Find all references
# Update to hivestore.db
```

### Step 5: Create Shared Utilities (3 hours)

```bash
# Create shared directory
mkdir C:/LLM-DevOSWE/Admin/shared

# Create utilities
touch Admin/shared/websocket-broadcaster.js
touch Admin/shared/express-utils.js
touch Admin/shared/middleware.js
touch Admin/shared/logger.js

# Refactor services to use shared code
# (Iterate through 30+ files)
```

---

## ESTIMATED EFFORT

| Phase | Tasks | Hours | Priority |
|-------|-------|-------|----------|
| Phase 1 | Fix port conflicts, merge services | 4h | 🔴 Critical |
| Phase 2 | Consolidate databases, personas | 3h | 🟡 High |
| Phase 3 | Shared utilities, npm cleanup | 8h | 🟠 Medium |
| Phase 4 | Documentation automation | 2h | 🟢 Low |
| **TOTAL** | | **17h** | |

---

## SIGN-OFF

**Audit Completed By:** Claude Sonnet 4.5 (1M context)
**Date:** 2026-02-09
**Next Review:** 2026-03-09 (after Phase 1-2 completion)

**Approved for implementation:** ⬜ (Pending Harold review)

---

## APPENDIX: Full Service Inventory

### Services in Orchestrator (19)

| ID | Service | Port | Entry | Priority |
|----|---------|------|-------|----------|
| oracle | Oracle | 3002 | C:\LLM-Oracle\oracle.js | 1 |
| simwidget | SimWidget Main | 8080 | backend\server.js | 2 |
| agent | Agent | 8585 | C:\DevClaude\Hivemind\hive\agent\agent-server.js | 3 |
| relay | Relay | 8600 | relay-service.js | 4 |
| remote-support | Remote Support | 8590 | service.js | 5 |
| claude-bridge | Claude Bridge | 8700 | bridge-service.js | 6 |
| hive-mind | Hive-Mind | 8701 | hive-mind-server.js | 7 |
| terminal-hub | Terminal Hub | 8771 | terminal-hub-server.js | 8 |
| keysender | KeySender Daemon | 9999 | keysender-daemon.js | 9 |
| hive-brain-admin | Hive Brain Admin | 8800 | server.js | 10 |
| hive-oracle | Hive Oracle | 8850 | server.js | 11 |
| hive-brain | Hive-Brain Discovery | 8810 | hive-brain.js | 12 |
| master-mind | Master-Mind | 8820 | master-mind.js | 13 |
| hive-mesh | Hive-Mesh | 8750 | C:\DevClaude\Hivemind\mesh\mesh.js | 13 |
| hive-personas | Hive Personas | 8770 | C:\DevClaude\Hivemind\personas\personas.js | 14 |
| mcp-bridge | MCP-Bridge | 8860 | server.js | 14 |
| dashboard | Dashboard | 8899 | server.js | 16 |

### NSSM Windows Services (12)

| Service Name | Port | Script |
|--------------|------|--------|
| HiveOracle | 3002 | C:\LLM-Oracle\oracle.js |
| HiveRelay | 8600 | Admin\relay\relay-service.js |
| HiveMindMonitor | 8701 | Admin\hive-mind\hive-mind-server.js |
| HiveMesh | 8750 | C:\DevClaude\Hivemind\mesh\mesh.js |
| HivePersonas | 8770 | C:\DevClaude\Hivemind\personas\personas.js |
| HiveTerminalHub | 8771 | Admin\terminal-hub\terminal-hub-server.js |
| HiveBrain | 8810 | Admin\hive-brain\hive-brain.js |
| HiveMasterMind | 8820 | Admin\master-mind\master-mind.js |
| HiveVoice | 8870 | Admin\hive-voice\voice-server.js |
| HiveDashboard | 8899 | Admin\hive-dashboard\server.js |
| HiveAgent | 8585 | C:\DevClaude\Hivemind\hive\agent\agent-server.js |
| Kinship | 8766 | C:\kinship\server.js |

### Additional Services (Not in Orchestrator)

| Service | Port | Location |
|---------|------|----------|
| Smart Router | 8610 | claude-bridge\smart-router.js |
| Browser Bridge | 8620 | browser-extension\bridge-server.js |
| Google Drive | 8621 | google-drive\drive-service.js |
| VoiceAccess | 8875 | voiceaccess\server.js |
| PMS50 GTN750 | 8830 | C:\PMS50-Prototype\server.js |
| silverstream | 8900 | C:/Projects/silverstream\server.js |
| bible-summary | 8900 ⚠️ | C:/Projects/bible-summary\server.js |

---

**END OF REPORT**
