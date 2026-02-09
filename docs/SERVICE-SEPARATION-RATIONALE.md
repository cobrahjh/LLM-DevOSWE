# Service Separation Rationale
**Created:** 2026-02-09
**Purpose:** Document WHY duplicate-looking services are separate (intentional vs accidental)

---

## Overview

During the Hive duplicate audit, we identified several service pairs that appeared to be duplicates. This document explains the rationale for each pair - whether separation is intentional (good architecture) or accidental (technical debt).

**Decision Framework:**
- ✅ **INTENTIONAL** = Different responsibilities, clear separation of concerns → Keep separate
- ⚠️ **QUESTIONABLE** = Overlapping functionality, unclear boundaries → Needs review
- ❌ **ACCIDENTAL** = True duplication, abandoned code → Consolidate or remove

---

## Service Pairs Analysis

### 1. Hive Brain Services

#### **Hive Brain Admin (8800) vs Hive Brain Discovery (8810)**

**Status:** ❌ **ACCIDENTAL DUPLICATION** → Recommend merge

**Analysis:**

| Aspect | Hive Brain Admin (8800) | Hive Brain Discovery (8810) |
|--------|------------------------|----------------------------|
| **File** | `server.js` | `hive-brain.js` |
| **Lines** | 388 | 457 |
| **Port** | 8800 | 8810 |
| **Features** | WebSocket, device admin UI | JSON persistence, enrollment queue |
| **Network Scan** | TCP socket probing | Ping sweep via exec() |
| **UI** | WebSocket real-time | HTTP REST API |
| **Storage** | In-memory Map | JSON file persistence |

**Dependencies:**
- Both called by: Hive Oracle (8850)
- Both call: Network scanning functions
- No cross-dependencies between them

**Original Intent:** UNKNOWN (no documentation explains why two separate services)

**Actual Usage:**
- Orchestrator runs BOTH as separate services
- Different priorities: Admin (10), Discovery (12)
- Overlapping functionality (both do device discovery)

**Recommendation:** ✅ **MERGE**

**Merge Plan:**
1. Combine best features from both:
   - WebSocket from server.js (8800)
   - JSON persistence from hive-brain.js (8810)
   - Network scanning from both (keep faster approach)
2. Unified service on port **8810** (keep Discovery name)
3. Update Hive Oracle references to single endpoint
4. Remove server.js, consolidate into hive-brain.js

**Risk:** LOW - Same caller, minimal external dependencies

**Rationale Document:**
```markdown
# Hive Brain - MERGED SERVICE

**Previous State:** Two separate services (8800, 8810)
**Current State:** Unified Discovery + Admin service (8810)

## Why was it split originally?
Unknown - no documentation found explaining the split.

## Why merge?
- Overlapping functionality (both do device discovery)
- Same caller (Hive Oracle)
- No clear separation of concerns
- Resource waste (two services, two ports, two implementations)

## What was preserved?
- WebSocket real-time updates (from 8800)
- JSON persistence (from 8810)
- Enrollment queue (from 8810)
- Best-of-both network scanning
```

---

### 2. Claude Bridge Services

#### **Claude Bridge WebSocket (8700) vs Claude Bridge Active (8601)**

**Status:** ❌ **ABANDONED CODE** → Remove 8700

**Analysis:**

| Aspect | Claude Bridge (8700) | Claude Bridge Active (8601) |
|--------|---------------------|----------------------------|
| **File** | `bridge-service.js` | `bridge-server.js` |
| **Lines** | 382 | 447 |
| **Status** | ❌ NOT RUNNING | ✅ RUNNING |
| **Architecture** | WebSocket | HTTP/Express |
| **Integration** | Standalone | Relay consumer |
| **Dependencies** | None (inactive) | Relay (8600) |

**Usage Check:**
```bash
$ curl http://localhost:8700/health
# Connection refused (not running)

$ curl http://localhost:8601/api/health
# {"status":"ok","service":"Claude Code Bridge",...}
```

**Original Intent:** WebSocket bridge prototype

**Actual Usage:**
- 8700: Never deployed to production, no active dependencies
- 8601: Production service, active Relay consumer

**Recommendation:** ✅ **REMOVE 8700**

**Removal Plan:**
1. Verify zero dependencies (already confirmed via grep)
2. Delete `bridge-service.js`
3. Update SERVICE-REGISTRY.md (already done)
4. Archive to `Admin/claude-bridge/deprecated/` for reference

**Risk:** NONE - Service not running, no dependencies

**Rationale Document:**
```markdown
# Claude Bridge - REMOVED DUPLICATE (8700)

**Removed:** 2026-02-09
**Reason:** Abandoned prototype, superseded by bridge-server.js (8601)

## Why did 8700 exist?
WebSocket bridge prototype for Claude Code CLI interaction.

## Why was it abandoned?
- HTTP/polling approach (8601) proved more reliable
- Relay consumer pattern better fits Hive architecture
- WebSocket complexity not needed for async task processing

## What remains?
- Claude Bridge Active (8601): Production service on Relay queue
- WebSocket code archived in deprecated/ for reference

## Migration Notes:
- No migration needed (8700 never used in production)
- All task processing handled by 8601
```

---

### 3. Voice Services

#### **Hive Voice (8870) vs VoiceAccess (8875)**

**Status:** ✅ **INTENTIONAL SEPARATION** → Keep separate

**Analysis:**

| Aspect | Hive Voice (8870) | VoiceAccess (8875) |
|--------|-------------------|-------------------|
| **Layer** | Low-level state | High-level routing |
| **Responsibility** | Voice input state tracking | Command routing & execution |
| **Dependencies** | Relay (8600) | Orchestrator (8500), Oracle (8850), Relay (8600), Agent (8585) |
| **State** | Listening mode, transcription | Persona management, macros, history |
| **Complexity** | Simple (1 dependency) | Complex (4+ dependencies) |

**Architecture Pattern:** **LAYERED ARCHITECTURE**

```
┌─────────────────────────────────────┐
│     VoiceAccess (8875)              │  ← High-level: Routing, personas, macros
│     - Command routing               │
│     - Persona management            │
│     - Macro execution               │
│     - History tracking              │
└──────────────┬──────────────────────┘
               │ depends on
               ▼
┌─────────────────────────────────────┐
│     Hive Voice (8870)               │  ← Low-level: State management
│     - Voice state (listening)       │
│     - Transcription cache           │
│     - Input validation              │
└─────────────────────────────────────┘
```

**Dependency Analysis:**
- VoiceAccess **DEPENDS ON** Hive Voice for state
- Hive Voice is stateless input layer
- VoiceAccess is stateful business logic layer

**Original Intent:** INTENTIONAL - Separation of concerns

**Recommendation:** ✅ **KEEP SEPARATE**

**Benefits of Separation:**
1. **Single Responsibility:** Each service has one clear purpose
2. **Testability:** Can test voice input separately from routing logic
3. **Scalability:** Can swap voice input methods without touching routing
4. **Maintainability:** Clear boundaries, easier to debug

**Risk of Merging:** HIGH
- Complex service with too many responsibilities
- Harder to test
- Harder to swap voice input providers
- Violates single responsibility principle

**Rationale Document:**
```markdown
# Voice Services - INTENTIONAL SEPARATION

**Hive Voice (8870):** Low-level voice state management
**VoiceAccess (8875):** High-level command routing

## Why are they separate?

### Layered Architecture (Good Design)
- **Input Layer:** Hive Voice handles voice input state
- **Business Layer:** VoiceAccess handles command routing

### Single Responsibility Principle
- Hive Voice: "Capture and validate voice input"
- VoiceAccess: "Route commands to appropriate services"

### Separation of Concerns
- Changing voice input provider? Only touch Hive Voice
- Adding new command routes? Only touch VoiceAccess
- Testing voice input? Hive Voice unit tests
- Testing routing logic? VoiceAccess unit tests

## Analogy
Like a web server:
- **Hive Voice = HTTP Server** (handles requests, low-level)
- **VoiceAccess = Application Router** (routes to handlers, high-level)

Merging them would be like combining nginx and your application code.

## Decision: KEEP SEPARATE ✅
This is good architecture, not duplication.
```

---

### 4. Process Management Services

#### **Orchestrator (8500) vs NSSM Windows Services**

**Status:** ✅ **COMPLEMENTARY** → Keep both

**Analysis:**

| Aspect | Orchestrator (8500) | NSSM Windows Services |
|--------|--------------------|-----------------------|
| **Purpose** | Runtime health monitoring | Boot-time service management |
| **Scope** | 12 service health checks | 12 Windows services |
| **Trigger** | Service crashes during operation | System boot, manual control |
| **Action** | Auto-restart (max 3 attempts) | Start/stop/restart via net/sc |
| **Monitoring** | 30s health polling | Windows Service Manager |

**Complementary Roles:**

```
System Boot
    ↓
┌─────────────────────────┐
│  NSSM Windows Services  │  ← Starts services on boot
│  - Auto-start enabled   │
│  - Windows Service Mgr  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Orchestrator (8500)    │  ← Monitors running services
│  - Health checks (30s)  │
│  - Auto-restart (crash) │
│  - Alert on failure     │
└─────────────────────────┘
```

**Original Intent:** INTENTIONAL - Different lifecycle phases

**Recommendation:** ✅ **KEEP BOTH**

**Why Both Are Needed:**
1. **NSSM:** Handles boot-time startup and Windows integration
2. **Orchestrator:** Handles runtime monitoring and crash recovery

**Not Duplication:**
- NSSM answers: "Is service configured to start on boot?"
- Orchestrator answers: "Is service healthy right now?"

**Rationale:**
```markdown
# Process Management - COMPLEMENTARY SERVICES

**NSSM:** Boot-time service management
**Orchestrator:** Runtime health monitoring

## Why both?

### Different Lifecycle Phases
- **Boot Time:** NSSM starts services automatically
- **Runtime:** Orchestrator monitors and restarts on crashes

### Different Responsibilities
- **NSSM:** Windows Service configuration, permissions, startup
- **Orchestrator:** Health checking, alerting, crash recovery

### Example Scenario
1. Server reboots → NSSM starts all services
2. Service crashes 2 hours later → Orchestrator detects and restarts
3. Service fails 3 times → Orchestrator alerts, stops retrying
4. Admin fixes issue → Manually restart via NSSM or Orchestrator

## Decision: KEEP BOTH ✅
They work together, not duplicate each other.
```

---

## Summary Matrix

| Service Pair | Status | Action | Risk | Rationale |
|--------------|--------|--------|------|-----------|
| Hive Brain (8800/8810) | ❌ Accidental | **MERGE** | Low | No clear separation, overlapping functionality |
| Claude Bridge (8700/8601) | ❌ Abandoned | **REMOVE 8700** | None | Not running, zero dependencies |
| Voice (8870/8875) | ✅ Intentional | **KEEP SEPARATE** | High (if merged) | Layered architecture, SRP |
| Orchestrator/NSSM | ✅ Complementary | **KEEP BOTH** | High (if merged) | Different lifecycle phases |

---

## Implementation Notes

### For CLAUDE.md Files

Each service directory should have a `CLAUDE.md` explaining:

1. **What this service does** (one sentence)
2. **Why it's separate** (if applicable)
3. **Key dependencies** (what it calls, who calls it)
4. **Key rules** (ports, configuration, restart behavior)

**Template:**
```markdown
# Service Name

**Port:** XXXX
**Purpose:** One sentence description

## Why Separate from [Related Service]?
Explanation of intentional separation, or note that it should be merged.

## Key Dependencies
- Calls: service1, service2
- Called by: service3, service4

## Key Rules
- Never change port XXXX
- Depends on [database/resource]
- [Other critical rules]
```

---

## Lessons Learned

### Good Duplication Indicators
- ✅ Clear documentation explaining separation
- ✅ Different calling patterns (different clients)
- ✅ Different data stores (own databases)
- ✅ Different lifecycle (boot vs runtime)
- ✅ Layered architecture (clean abstractions)

### Bad Duplication Indicators
- ❌ No documentation explaining why separate
- ❌ Same callers, same dependencies
- ❌ Overlapping functionality (both do same thing)
- ❌ One is abandoned/not running
- ❌ Different implementations of same logic

---

## Next Steps

**Immediate:**
1. ✅ Create separation rationale docs (this document)
2. ⏳ Add CLAUDE.md to each service directory
3. ⏳ Implement Hive Brain merge
4. ⏳ Remove Claude Bridge (8700)

**Week 2:**
1. Collect usage metrics (1 week of data)
2. Validate separation decisions with real usage patterns
3. Document any additional separations discovered

---

## Related Documents

- [HIVE-DUPLICATE-AUDIT-2026-02-09.md](reports/HIVE-DUPLICATE-AUDIT-2026-02-09.md) - Initial audit
- [SERVICE-DEPENDENCY-GRAPH.md](SERVICE-DEPENDENCY-GRAPH.md) - Dependency analysis
- [SERVICE-REGISTRY.md](../SERVICE-REGISTRY.md) - Service catalog

---

**Rationale documented - ready for implementation decisions!**
