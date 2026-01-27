# SimWidget Engine - Project Standards & Conventions
**Version:** 1.7.0
**Last Updated:** 2026-01-27

This document captures proven patterns, timing defaults, and lessons learned throughout development. **Always reference this before implementing new features.**

---

## 🕐 Timing Defaults

**UI polling (gamepad/input):** `100ms`
- Balance between responsiveness and CPU usage

**Debounce after toggle:** `100-200ms`
- Prevents UI flicker during state changes

**WebSocket reconnect:** `3000ms`
- Allows service recovery without spam

**TCP timeout:** `2000ms`
- Fast enough for responsiveness, long enough for reliability

**SimConnect data request:** `100ms`
- Matches sim frame rate roughly

**Config file watch delay:** `100ms`
- Allows file write to complete

## 🪟 Windows-Specific Patterns

### PowerShell vs CMD vs Bash
- **Always use PowerShell** for Windows automation
- Use semicolons `;` not `&&` for command chaining in PowerShell
- Example: `powershell -Command "cd C:\path; node server.js"`

### Path Conventions
- **Never use spaces** in directory names → causes execution failures
- Use underscores: `SimWidget_Engine` not `SimWidget Engine`
- Always use absolute paths for reliability
- Escape paths in PowerShell: `"C:\Path With Spaces\file.js"`

### Network/URL Conventions
- **User-facing URLs:** Always use the actual IP address (`192.168.1.192`)
- **Internal health checks:** `localhost` is acceptable for same-machine service-to-service calls (e.g., Orchestrator health checks)
- **Console log startup banners:** Show both localhost and LAN IP
- Dev machine IP: `192.168.1.192` (ROCK-PC)
- This ensures consistency across all devices (phone, other PCs, etc.)
- Example: `http://192.168.1.192:8585/` not `http://localhost:8585/`
- All documentation, code, and UI links must use IP addresses

### Process Management
```powershell
# Stop process
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Start detached
Start-Process -FilePath "node" -ArgumentList "server.js" -WindowStyle Hidden
```

### Windows Services (node-windows)
All Node.js services **must** be installed as Windows Services for production:

**Required Files:**
```
service-dir/
├── daemon/
│   ├── servicename.exe       # WinSW wrapper (generated)
│   ├── servicename.xml       # Service config
│   └── servicename.exe.config
├── service-install.js        # Installer script
├── service-uninstall.js      # Uninstaller script
└── server.js                 # Main service code
```

**Service Naming Convention:**

- **Main Server** → `simwidgetmainserver.exe` (Port 8080)
- **Agent (Kitt)** → `simwidgetagent.exe` (Port 8585)
- **Master O** → `simwidgetmastero.exe` (Port 8500)
- **Relay** → `simwidgetrelay.exe` (Port 8600)
- **Claude Bridge** → `simwidgetclaudebridge.exe` (Port 8601)
- **Remote Support** → `simwidgetremotesupport.exe` (Port 8590)
- **KeySender** → `simwidgetkeysender` (No Port)

**Service Commands:**
```bash
# Install service (run as admin)
cd service-dir && node service-install.js

# Control via sc.exe
sc query simwidgetservicename.exe
net start simwidgetservicename.exe
net stop simwidgetservicename.exe

# Direct WinSW control
cd daemon && ./servicename.exe install|start|stop|uninstall
```

**Service Account:** Always use `LocalSystem` in XML:
```xml
<serviceaccount>
    <username>LocalSystem</username>
</serviceaccount>
```

**Never use scripts to run services in production.** Scripts are for development only.

### Windows OpenSSH Setup (Lessons Learned)

**Problem:** Setting up SSH key authentication on Windows is notoriously difficult due to strict permission requirements.

**Key Learnings:**

1. **StrictModes is enabled by default** - Windows SSH server checks file permissions strictly
2. **Admin users use different key file** - `C:\ProgramData\ssh\administrators_authorized_keys` instead of `~/.ssh/authorized_keys`
3. **`__PROGRAMDATA__` token may not work** - Use absolute paths like `C:/ProgramData/ssh/administrators_authorized_keys`
4. **Authenticated Users permission breaks auth** - Remove from `C:\ProgramData\ssh` folder
5. **Key passphrase vs Windows password** - If prompted for "passphrase", the key has a passphrase set; regenerate with `-N '""'` for no passphrase

**Working Configuration (Password Auth - Recommended for Windows):**

```powershell
# On the TARGET machine (the one you're SSHing INTO):

# 1. Create dedicated SSH user with simple password
net user sshuser YourPassword123 /add
net localgroup administrators sshuser /add

# 2. Enable password auth in sshd_config
# Edit C:\ProgramData\ssh\sshd_config:
#   PasswordAuthentication yes

# 3. Restart SSH service
Restart-Service sshd
```

**Key Auth Setup (If you really want it):**

```powershell
# On SOURCE machine - generate key with NO passphrase
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\id_ed25519 -N '""'

# On TARGET machine - for admin users:
# 1. Comment out Match Group administrators in sshd_config
# 2. Add key to user's .ssh/authorized_keys
mkdir C:\Users\USERNAME\.ssh
Set-Content C:\Users\USERNAME\.ssh\authorized_keys -Value "ssh-ed25519 AAAA... user@host" -Encoding ASCII
icacls C:\Users\USERNAME\.ssh\authorized_keys /inheritance:r /grant "USERNAME:(R)" /grant "SYSTEM:(R)"
Restart-Service sshd
```

**Common Errors:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Permission denied (publickey)` | Key not in authorized_keys or wrong permissions | Check file path, permissions, and key fingerprint match |
| `Enter passphrase for key` | Key has passphrase | Regenerate key with `-N '""'` or enter passphrase |
| `Connection reset` | PubkeyAuthentication disabled | Uncomment `PubkeyAuthentication yes` in sshd_config |
| `Invalid user` | Wrong username | Check actual username with `whoami` on target |

**Hive SSH Access:**

| Direction | Account | Auth | Command |
|-----------|---------|------|---------|
| ROCK-PC → ai-pc | hjhar | Key | `ssh hjhar@192.168.1.162` |
| ai-pc → ROCK-PC | hjhariSSH | Password (0812) | `ssh hjhariSSH@192.168.1.192` |

### Service Lifecycle Management (NSSM)

**Problem:** Services running in terminal windows clutter the desktop, can be accidentally closed, and don't auto-start on boot.

**Solution:** Use NSSM (Non-Sucking Service Manager) for all Hive services.

#### Service Lifecycle Stages

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   CREATE    │───►│  REGISTER   │───►│    RUN      │───►│   REMOVE    │
│  (develop)  │    │   (nssm)    │    │ (background)│    │ (decomm)    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

#### 1. CREATE - Developing a New Service

```javascript
// service.js - Minimum viable service
const PORT = 8XXX;  // Get assigned port from SERVICE-REGISTRY.md
const http = require('http');

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'healthy', service: 'MyService' }));
    }
});

server.listen(PORT, () => {
    console.log(`[MyService] Started on port ${PORT}`);
});
```

**Checklist before registering:**
- [ ] Service has `/health` endpoint
- [ ] Port assigned in SERVICE-REGISTRY.md
- [ ] Tested manually with `node service.js`
- [ ] No hardcoded paths (use `__dirname` or config)

#### 2. REGISTER - Add to NSSM

```powershell
# Install service (run as Admin)
nssm install HiveServiceName "C:\Program Files\nodejs\node.exe" "C:\path\to\service.js"

# Configure (optional but recommended)
nssm set HiveServiceName AppDirectory "C:\path\to"
nssm set HiveServiceName DisplayName "Hive Service Name"
nssm set HiveServiceName Description "What this service does"
nssm set HiveServiceName Start SERVICE_AUTO_START

# Start the service
nssm start HiveServiceName
```

**Naming Convention:** `Hive[ServiceName]` (e.g., HiveOracle, HiveRelay, HiveImmortal)

#### 3. RUN - Managing Running Services

```powershell
# Check status
nssm status HiveServiceName

# Start/Stop/Restart
nssm start HiveServiceName
nssm stop HiveServiceName
nssm restart HiveServiceName

# View all Hive services
nssm list | findstr Hive

# Check logs (if configured)
nssm get HiveServiceName AppStdout
```

#### 4. REMOVE - Decommissioning a Service

```powershell
# Stop first
nssm stop HiveServiceName

# Remove from NSSM
nssm remove HiveServiceName confirm

# Clean up
# - Remove from SERVICE-REGISTRY.md
# - Remove from start-all-servers.bat (if present)
# - Archive or delete source files
```

#### Current Hive Services (Orchestrator-Managed)

The Master Orchestrator (:8500) manages 16 services with health watchdog and auto-restart:

| ID | Service | Port | Priority | Path |
|----|---------|------|----------|------|
| oracle | Oracle | 3002 | 0 | C:\LLM-Oracle\oracle.js |
| simwidget | SimWidget Main | 8080 | 1 | simwidget-hybrid\backend\server.js |
| agent | Agent (Kitt) | 8585 | 2 | Admin\agent\agent-server.js |
| relay | Relay | 8600 | 3 | Admin\relay\relay-service.js |
| remote | Remote Support | 8590 | 4 | Admin\remote-support\service.js |
| bridge | Claude Bridge | 8601 | 5 | Admin\claude-bridge\bridge-server.js |
| keysender | KeySender | - | 6 | KeySenderService (native) |
| hivemind | Hive-Mind | 8701 | 7 | Admin\hive-mind\hive-mind-server.js |
| terminalhub | Terminal Hub | 8771 | 8 | Admin\terminal-hub\terminal-hub-server.js |
| hivebrain | Hive Brain Admin | 8800 | 9 | Admin\hive-brain\server.js |
| hiveoracle | Hive Oracle | 8850 | 10 | Admin\hive-oracle\server.js |
| hivebraindiscovery | Hive-Brain Discovery | 8810 | 11 | Admin\hive-brain\hive-brain.js |
| mastermind | Master-Mind | 8820 | 12 | Admin\master-mind\master-mind.js |
| hivemesh | Hive-Mesh | 8750 | 13 | C:\DevClaude\Hivemind\mesh\mesh.js |
| mcpbridge | MCP-Bridge | 8860 | 14 | Admin\mcp-bridge\server.js |
| dashboard | Dashboard | 8899 | 15 | Admin\hive-dashboard\server.js |

#### NSSM Services (Standalone)

| Service | Port | Status | Path |
|---------|------|--------|------|
| HiveImmortal | - | Auto | C:\DevClaude\Hivemind\bootstrap\immortal.js |
| HiveCaddy | 443 | Auto | Caddy reverse proxy |
| HiveSmartPoller | - | Auto | Admin\relay\smart-poller.js |

#### Golden Rules

1. **Never run services in terminal windows** - Always use NSSM or Orchestrator
2. **Test before registering** - Run manually first, fix all errors
3. **Always add health endpoint** - Enables monitoring and auto-restart
4. **Update SERVICE-REGISTRY.md** - Single source of truth for all services
5. **Use descriptive names** - `HiveOracle` not `svc1`
6. **Set auto-start** - Services should survive reboots
7. **Close duplicate windows** - If you see a terminal running a registered service, close it
8. **Run setup.bat after fresh clone** - Installs all npm dependencies

#### Orchestrator Watchdog Pattern (Lessons Learned)

**Health Check Connection Leak:** Always drain HTTP response bodies in health checks:
```javascript
const req = http.get({ hostname: 'localhost', port: svc.port, path: '/api/health', timeout: 5000 }, (res) => {
    res.resume(); // CRITICAL: drain response body to free connection
    resolve({ healthy: res.statusCode === 200 });
});
```

**Recovery Threshold:** Require 3 consecutive healthy checks (90s at 30s interval) before marking service as recovered. Prevents flapping alerts.

**MCP Package Namespace:** Use `@modelcontextprotocol/server-*` (not `@anthropic/mcp-server-*`). The old namespace packages were removed from npm.

**Alert Auto-Expiry:** Stale alerts should auto-expire after 24h. Recovery alerts should auto-acknowledge previous failure alerts for the same service.

#### Troubleshooting

| Issue | Solution |
|-------|----------|
| Service won't start | Check `nssm get HiveX AppStderr` for errors |
| Port already in use | Another instance running - kill it first |
| Service starts then stops | Check logs, likely missing dependency |
| Can't install service | Run PowerShell as Administrator |
| Cannot find module | Run `npm install` in service directory or `setup.bat` |
| MCP package 404 | Use `@modelcontextprotocol/server-*` namespace |
| Health check hangs | Add `res.resume()` to drain response body |

## 🎮 Gamepad API Patterns

### Stale Reference Problem
`navigator.getGamepads()` returns **stale/null references** when called from click handlers.

**Solution:** Cache device IDs during polling loop:
```javascript
let deviceIdByIndex = {};

// In polling loop:
deviceIdByIndex[gamepad.index] = gamepad.id;

// In click handler - use cached ID:
const deviceId = deviceIdByIndex[index];
```

### Change Detection (Prevent Flicker)
Only re-render when state actually changes:
```javascript
let lastState = '';
const currentState = buildStateString();
if (currentState !== lastState) {
    lastState = currentState;
    render();
}
```

## 📁 Config File Formats

### Keymaps (v3.0 format - Current)
```json
{
    "cam-001-cockpit-vfr": {
        "originalId": "cockpitVFR",   // For backward compat lookups
        "name": "Cockpit VFR",        // User-editable display name
        "key": "F10",                 // Sent to MSFS (keyboard only)
        "trigger": "",                // Activates action (keyboard or controller)
        "isDefault": true             // Protected from deletion
    }
}
```

**Reversibility:** Call `GET /api/keymaps/export/v2` to export back to v2.0 format.

### Keymaps (v2.0 format - Legacy)
```json
{
    "action": {
        "key": "BACKSPACE",
        "trigger": "BTN1"
    }
}
```

### Backward Compatibility
- `getKey(category, action)` checks both direct ID and `originalId` lookup
- Always handle both string and object formats:
```javascript
const key = typeof binding === 'object' ? binding.key : binding;
```

## 🔌 API Patterns

### Consistent Response Format
```javascript
// Success
{ success: true, data: {...} }

// Error
{ success: false, error: "Message" }

// Warning (non-fatal)
{ success: true, warning: "Message", data: {...} }
```

### Field Updates
When updating partial objects, send field name explicitly:
```javascript
{ field: 'trigger', value: 'BTN1' }
```

## 🎨 UI Standards

### All Windows/Modals MUST Be Draggable

**MANDATORY:** Every floating window, modal, panel, or dialog must be draggable by its header.

**Standard Implementation:**
```javascript
function setupDraggable(modal, handleSelector = '.modal-header, .panel-header, .dialog-header') {
    const panel = modal.querySelector('.modal-content, .panel-content, .dialog-content') || modal;
    const handle = modal.querySelector(handleSelector);
    if (!handle) return;

    let isDragging = false;
    let startX, startY, initialX, initialY;

    // Set initial positioning
    panel.style.position = 'absolute';

    handle.style.cursor = 'move';
    handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('button, input, select')) return; // Don't drag on controls
        isDragging = true;
        const rect = panel.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        initialX = rect.left;
        initialY = rect.top;

        // Remove centering transform on first drag
        panel.style.transform = 'none';
        panel.style.left = initialX + 'px';
        panel.style.top = initialY + 'px';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newX = initialX + (e.clientX - startX);
        let newY = initialY + (e.clientY - startY);

        // Keep in viewport
        newX = Math.max(0, Math.min(window.innerWidth - 100, newX));
        newY = Math.max(0, Math.min(window.innerHeight - 50, newY));

        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}
```

**CSS Requirements:**
```css
.modal-header, .panel-header, .dialog-header {
    cursor: move;
    user-select: none;
}
```

**Checklist for New Windows:**
- [ ] Header element with `cursor: move`
- [ ] `setupDraggable()` called after DOM creation
- [ ] Keep in viewport bounds
- [ ] Don't drag on buttons/inputs inside header
- [ ] Position persisted to localStorage (optional)

### All Windows MUST Be Snappable

**MANDATORY:** Every floating window, modal, or panel with drag support must also support snap-to-edge behavior.

**Snap Zones Configuration:**
```javascript
const SNAP_ZONES = {
    left:       { x: 0,   y: 0,   w: 0.5, h: 1    },  // Left half
    right:      { x: 0.5, y: 0,   w: 0.5, h: 1    },  // Right half
    topLeft:    { x: 0,   y: 0,   w: 0.5, h: 0.5  },  // Top-left quarter
    topRight:   { x: 0.5, y: 0,   w: 0.5, h: 0.5  },  // Top-right quarter
    bottomLeft: { x: 0,   y: 0.5, w: 0.5, h: 0.5  },  // Bottom-left quarter
    bottomRight:{ x: 0.5, y: 0.5, w: 0.5, h: 0.5  },  // Bottom-right quarter
    full:       { x: 0,   y: 0,   w: 1,   h: 1    }   // Full screen
};
const SNAP_THRESHOLD = 30;  // Pixels from edge to trigger snap
```

**Snap Detection Logic:**
```javascript
function getSnapZone(x, y) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Corner detection (takes priority)
    if (x < SNAP_THRESHOLD && y < SNAP_THRESHOLD) return 'topLeft';
    if (x > vw - SNAP_THRESHOLD && y < SNAP_THRESHOLD) return 'topRight';
    if (x < SNAP_THRESHOLD && y > vh - SNAP_THRESHOLD) return 'bottomLeft';
    if (x > vw - SNAP_THRESHOLD && y > vh - SNAP_THRESHOLD) return 'bottomRight';

    // Edge detection
    if (x < SNAP_THRESHOLD) return 'left';
    if (x > vw - SNAP_THRESHOLD) return 'right';
    if (y < SNAP_THRESHOLD) return 'full';  // Top edge = maximize

    return null;
}
```

**Snap Preview Overlay:**
```javascript
function showSnapPreview(zone) {
    let preview = document.getElementById('snap-preview');
    if (!preview) {
        preview = document.createElement('div');
        preview.id = 'snap-preview';
        document.body.appendChild(preview);
    }

    const z = SNAP_ZONES[zone];
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    preview.style.cssText = `
        position: fixed;
        left: ${z.x * vw}px;
        top: ${z.y * vh}px;
        width: ${z.w * vw}px;
        height: ${z.h * vh}px;
        background: rgba(74, 158, 255, 0.2);
        border: 2px solid #4a9eff;
        z-index: 9998;
        pointer-events: none;
        transition: all 0.15s ease;
    `;
    preview.style.display = 'block';
}

function hideSnapPreview() {
    const preview = document.getElementById('snap-preview');
    if (preview) preview.style.display = 'none';
}
```

**Apply Snap on Drop:**
```javascript
function applySnap(panel, zone) {
    const z = SNAP_ZONES[zone];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 10;  // Gap from screen edge

    panel.style.left = (z.x * vw + padding) + 'px';
    panel.style.top = (z.y * vh + padding) + 'px';
    panel.style.width = (z.w * vw - padding * 2) + 'px';
    panel.style.height = (z.h * vh - padding * 2) + 'px';

    // Store original size for restore
    panel.dataset.snapped = zone;
}
```

**Double-Click Header to Maximize/Restore:**
```javascript
header.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;

    if (panel.dataset.snapped === 'full') {
        // Restore to original size
        panel.style.width = panel.dataset.originalWidth || '400px';
        panel.style.height = panel.dataset.originalHeight || '300px';
        panel.style.left = '50%';
        panel.style.top = '50%';
        panel.style.transform = 'translate(-50%, -50%)';
        delete panel.dataset.snapped;
    } else {
        // Save original size and maximize
        panel.dataset.originalWidth = panel.style.width;
        panel.dataset.originalHeight = panel.style.height;
        applySnap(panel, 'full');
    }
});
```

**Integration with Drag Handler:**
```javascript
document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    // Normal drag positioning
    panel.style.left = (startLeft + e.clientX - startX) + 'px';
    panel.style.top = (startTop + e.clientY - startY) + 'px';

    // Check for snap zone
    const zone = getSnapZone(e.clientX, e.clientY);
    if (zone) {
        showSnapPreview(zone);
    } else {
        hideSnapPreview();
    }
});

document.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;

    // Apply snap if in zone
    const zone = getSnapZone(e.clientX, e.clientY);
    if (zone) {
        applySnap(panel, zone);
    }
    hideSnapPreview();
    savePosition();
});
```

**CSS Requirements:**
```css
/* Snap preview overlay */
#snap-preview {
    display: none;
    position: fixed;
    background: rgba(74, 158, 255, 0.2);
    border: 2px solid #4a9eff;
    border-radius: 8px;
    z-index: 9998;
    pointer-events: none;
    transition: all 0.15s ease;
}

/* Snapped panel styling */
.panel[data-snapped] {
    border-radius: 0;
    transition: all 0.2s ease;
}

.panel[data-snapped="full"] {
    border-radius: 0;
}
```

**Checklist for Snappable Windows:**
- [ ] Snap zones configuration defined
- [ ] `getSnapZone()` function implemented
- [ ] Preview overlay created on drag
- [ ] `applySnap()` called on mouseup when in zone
- [ ] Double-click header maximizes/restores
- [ ] Original size stored for restore
- [ ] Works with pin functionality (no snap when pinned)

### All Windows MUST Be Minimizable

**MANDATORY:** Every floating window, modal, panel, or card must have a minimize button in its header.

**Standard Implementation:**
```javascript
function setupMinimize(panel, storageKey) {
    const header = panel.querySelector('.card-header, .panel-header, .modal-header');
    const body = panel.querySelector('.card-body, .panel-body, .modal-body');
    if (!header || !body) return;

    // Add minimize button if not present
    let minBtn = header.querySelector('.minimize-btn');
    if (!minBtn) {
        minBtn = document.createElement('button');
        minBtn.className = 'minimize-btn';
        minBtn.innerHTML = '−';
        minBtn.title = 'Minimize';
        header.appendChild(minBtn);
    }

    let isMinimized = localStorage.getItem(storageKey + '-minimized') === 'true';

    function updateState() {
        body.style.display = isMinimized ? 'none' : '';
        minBtn.innerHTML = isMinimized ? '+' : '−';
        minBtn.title = isMinimized ? 'Expand' : 'Minimize';
        panel.classList.toggle('minimized', isMinimized);
        localStorage.setItem(storageKey + '-minimized', isMinimized);
    }

    minBtn.onclick = (e) => {
        e.stopPropagation();
        isMinimized = !isMinimized;
        updateState();
    };

    // Apply saved state
    updateState();
}
```

**CSS Requirements:**
```css
.minimize-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 16px;
    padding: 4px 8px;
    border-radius: 4px;
}
.minimize-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
}

/* Minimized state */
.card.minimized,
.panel.minimized {
    height: auto !important;
}
.card.minimized .card-body,
.panel.minimized .panel-body {
    display: none;
}
```

**Checklist for Minimizable Windows:**
- [ ] Minimize button (−/+) in header
- [ ] Toggle hides/shows body content
- [ ] State persisted to localStorage
- [ ] Visual indicator when minimized
- [ ] Works with drag and snap features

### Overlapping Windows - Z-Index & Accessibility

**Problem:** When floating windows overlap, minimized windows may have their expand button hidden under other windows.

**Solution:** Implement three complementary behaviors:

1. **Bring to front on click** - Any click on a floating window raises its z-index
2. **Bring to front on hover (minimized)** - Hovering a minimized window raises it
3. **Click header to expand** - Entire minimized header is clickable, not just the button

**Implementation:**
```javascript
// Z-Index Manager
let topZIndex = 100;

function bringToFront(element) {
    topZIndex++;
    element.style.zIndex = topZIndex;
}

// In setupCardDrag or similar:
// 1. Bring to front on click
card.addEventListener('mousedown', () => {
    if (card.classList.contains('floating')) {
        bringToFront(card);
    }
});

// 2. Bring to front on hover when minimized
card.addEventListener('mouseenter', () => {
    if (card.classList.contains('minimized') && card.classList.contains('floating')) {
        bringToFront(card);
    }
});

// 3. Click header to expand when minimized
header.addEventListener('click', (e) => {
    if (card.classList.contains('minimized') && !e.target.closest('button, input, select')) {
        const minBtn = header.querySelector('.minimize-btn');
        if (minBtn) minBtn.click();
    }
});
```

**CSS for visual feedback:**
```css
.card.floating.minimized .card-header {
    cursor: pointer;
    transition: background 0.15s;
}
.card.floating.minimized .card-header:hover {
    background: var(--bg-hover);
}
```

**Checklist for Overlapping Windows:**
- [ ] `bringToFront()` function available
- [ ] Click anywhere on floating card brings to front
- [ ] Hover on minimized card brings to front
- [ ] Click minimized header expands (not just button)
- [ ] Cursor changes to pointer on minimized header
- [ ] Hover highlight on minimized header

### Toggle Switch (Pure CSS, no checkbox)
Checkboxes cause event conflicts. Use div-based toggles:
```html
<div class="toggle-switch on" onclick="toggle()">
    <div class="toggle-slider"></div>
</div>
```
With `pointer-events: none` on inner elements.

### Color Scheme

- **Background:** `#1a1a2e` → `#16213e` gradient
- **Card/Panel:** `#0f172a`
- **Accent (success):** `#22c55e` / `#4ade80`
- **Accent (info):** `#3b82f6` / `#7ec8e3`
- **Warning:** `#f59e0b`
- **Error:** `#ef4444`
- **Text primary:** `#eee` / `#e2e8f0`
- **Text muted:** `#94a3b8` / `#64748b`

### 🔊 Voice UI Standards

All voice-enabled UIs must follow these patterns for consistent TTS and speech recognition.

#### Voice Settings Structure
```javascript
let voiceSettings = {
  enabled: true,           // Master TTS toggle
  voice: '',               // Selected voice name
  rate: 0.9,               // Speech rate (0.5-2.0)
  pitch: 1.0,              // Voice pitch (0.5-2.0)
  volume: 1.0,             // Volume (0-1.0)
  autoSpeak: true,         // Auto-speak responses
  autoSubmit: true,        // Auto-submit after speech
  autoSubmitDelay: 1.0,    // Seconds to wait before submit
  maxTtsLength: 800        // Skip TTS for long responses
};
```

#### TTS Best Practices
1. **Debounce streaming responses** - Wait 1s after text stops changing before speaking
2. **Cancel before speaking** - Always call `speechSynthesis.cancel()` with 100ms delay before new speech
3. **Track speaking state** - Use `onstart`/`onend`/`onerror` handlers
4. **Provide stop button** - Always give user ability to stop speech
5. **Skip long responses** - Set max character limit (default 800)
6. **Strip code blocks** - Replace ``` blocks with "code block" for cleaner speech

```javascript
function speakResponse(text) {
  if (!voiceSettings.enabled || !voiceSettings.autoSpeak) return;

  const plainText = text
    .replace(/```[\s\S]*?```/g, 'code block')
    .replace(/`[^`]+`/g, 'code');

  if (plainText.length > voiceSettings.maxTtsLength) return;

  speechSynthesis.cancel();
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    utterance.volume = voiceSettings.volume;

    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === voiceSettings.voice);
    if (voice) utterance.voice = voice;

    speechSynthesis.speak(utterance);
  }, 100);
}
```

#### Speech Recognition Best Practices
1. **Auto-submit delay** - Configurable wait after speech ends (0-5s)
2. **Show countdown** - Display "Sending in Xs..." during delay
3. **Continuous mode option** - Keep mic active for multi-turn
4. **Language setting** - Allow user to select recognition language

```javascript
recognition.onresult = (e) => {
  const text = e.results[0][0].transcript;
  document.getElementById('input').value = text;

  if (voiceSettings.autoSubmit) {
    const delay = voiceSettings.autoSubmitDelay * 1000;
    if (delay > 0) {
      showStatus('Sending in ' + voiceSettings.autoSubmitDelay + 's...');
      setTimeout(() => submit(), delay);
    } else {
      submit();
    }
  }
};
```

#### Voice Settings UI Requirements
- Voice selector dropdown (English voices prioritized)
- Rate/Pitch/Volume sliders with value display
- Auto-speak toggle
- Auto-submit toggle + delay slider
- Test Voice button
- Stop button (red, always visible during speech)
- Settings persist to localStorage

#### Default Voice (Heather)
```javascript
// Prefer UK Female voice for Heather persona
const heather = voices.find(v =>
  v.lang.startsWith('en') &&
  v.name.includes('UK') &&
  v.name.includes('Female')
);
```

## 🐛 Known Gotchas

### SimConnect Camera Events
SimConnect camera events are **unreliable**. Use keyboard shortcuts via SendKeys instead.

### vJoy + ChasePlane
vJoy integration causes input conflicts with ChasePlane. ChasePlane WebSocket (port 8652) is read-only.

### Node.js on Windows
- `&&` doesn't work in PowerShell - use `;`
- Use `shell: 'cmd'` or explicit PowerShell for complex commands

### TCP KeySender vs PowerShell
- TCP: ~5ms latency (preferred)
- PowerShell fallback: ~700ms latency
- Always try TCP first, fallback to PowerShell

## 📝 Documentation Standards

### File Headers
```javascript
/**
 * Component Name vX.X.X
 * Brief description
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\...
 * 
 * Changelog:
 * vX.X.X - Change description
 */
```

### CLAUDE.md in Each Directory
Each major directory should have a `CLAUDE.md` with:
- Purpose
- Key files
- API endpoints (if applicable)
- Dependencies

### Categorized List Prototype
When documenting lists of commands, shortcuts, or features, organize by category:

```markdown
## Section Name

### Category 1
- `item` - brief description
- `item2` - brief description

### Category 2
- `item3` - brief description
- `item4` - brief description
```

**Benefits:**
- Easier to scan and find items
- Related items grouped together
- Cleaner than one long list
- Categories self-document purpose

**Example categories for shortcuts:**
- Memory & Documentation
- Tasks & Workflow
- Communication
- Development
- Debug & Tools
- System & Screenshots

### Responsive Design Prototype
All widgets and web UIs must follow modern responsive standards:

**Required HTML:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

**Required CSS Variables:**
```css
:root {
    /* Fluid Typography with clamp() */
    --text-sm: clamp(10px, 2.5vw, 11px);
    --text-md: clamp(11px, 3vw, 13px);
    --text-lg: clamp(14px, 3.5vw, 16px);
    --text-xl: clamp(16px, 4vw, 20px);

    /* Fluid Spacing */
    --space-sm: clamp(6px, 1.5vw, 10px);
    --space-md: clamp(10px, 2.5vw, 16px);

    /* Touch Target Minimum */
    --touch-min: 44px;
}
```

**Container Queries (Component-Based):**
```css
.widget {
    container-type: inline-size;
    container-name: widget;
}

@container widget (max-width: 299px) {
    /* Small widget styles */
}

@container widget (min-width: 300px) {
    /* Medium widget styles */
}
```

**Required Features:**
- Container queries for component-based responsiveness
- Fluid typography with `clamp()`
- Touch targets minimum 44px
- Dynamic viewport units (`dvh`, `svh`)
- Safe area insets: `env(safe-area-inset-*)`
- Reduced motion support: `@media (prefers-reduced-motion)`
- High contrast support: `@media (prefers-contrast: high)`

**Reference:** `widgets/shared/glass-theme.css` v2.0.0

---

## Adding New Standards

When you discover a pattern that:
1. Solved a recurring problem
2. Took significant debugging to find
3. Is non-obvious or platform-specific

**Add it here** with:
- The pattern/value
- Why it works
- Example code if helpful

---

## 💬 Admin UI Standards

### Chat Bubble Features (v1.1.0)
Chat bubbles support:
- **Copy button (📋)** - Copies message text to clipboard
- **Dismiss button (✗)** - Toggles strikethrough/dimmed state

### Dismissed Message Styling
```css
.message-wrapper.dismissed .message {
    text-decoration: line-through;
    opacity: 0.4;
    filter: grayscale(100%);
}
```

### Message Structure
```html
<div class="message-wrapper user|assistant">
    <div class="message-actions">
        <button class="msg-action-btn" onclick="copyMessage(this)">📋</button>
        <button class="msg-action-btn" onclick="dismissMessage(this)">✗</button>
    </div>
    <div class="message user|assistant">Content</div>
</div>
```

### Service Mode Indicators
Each service row shows mode context:
- `(node)` - Dev mode (yellow)
- `(service)` - Windows Service mode (blue)

### Services & Ports

- **Master (8500)** - Health watchdog, service orchestration
- **SimWidget (8080)** - Main server, SimConnect bridge
- **Agent/Kitt (8585)** - AI assistant, chat interface
- **Remote (8590)** - Remote support access
- **Relay (8600)** - Claude Desktop message relay
- **Bridge (8601)** - Claude Code CLI bridge

### Status Icon States

All status dots use consistent colors and animations:

- **online/running** - Green `#22c55e` with glow → `.online`, `.running`
- **offline/stopped** - Red `#ef4444` with subtle glow → `.offline`, `.stopped`
- **checking** - Yellow `#f59e0b` with pulse animation → `.checking`
- **starting** - Blue `#3b82f6` with blink animation → `.starting`
- **warning** - Yellow `#f59e0b` with subtle glow → `.warning`

CSS classes: `.compact-dot`, `.status-dot`, `.server-dot`

### Log Screen Standards
All log viewing screens must include:
- **Type filters** - Checkboxes to show/hide by log type (info, error, warning, etc.)
- **Sort toggle** - Newest first / Oldest first
- **Search/filter** - Text search within logs
- **Clear button** - Clear current view
- **Export button** - Download logs as file
- **Auto-scroll toggle** - Enable/disable scroll to latest

Example filter implementation:
```javascript
const LOG_TYPES = {
    info: { icon: 'ℹ️', color: '#4a9eff' },
    error: { icon: '✗', color: '#ef4444' },
    warning: { icon: '⚠', color: '#eab308' },
    success: { icon: '✓', color: '#22c55e' }
};
```

### Menu Standards & Structure

**Basic Menu Pattern:**
```css
.menu {
    position: absolute;
    background: #2a2a3e;
    border: 1px solid #333;
    border-radius: 8px;
    padding: 4px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    min-width: 140px;
}
.menu-item {
    padding: 8px 12px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
    color: #ccc;
    display: flex;
    align-items: center;
    gap: 8px;
}
.menu-item:hover { background: #3a3a4e; color: #fff; }
.menu-item.danger:hover { background: #ef4444; }
.menu-divider { height: 1px; background: #444; margin: 4px 8px; }
```

**HTML Structure:**
```html
<div class="menu" id="context-menu">
    <div class="menu-item" data-action="edit">📝 Edit</div>
    <div class="menu-item" data-action="copy">📋 Copy</div>
    <div class="menu-divider"></div>
    <div class="menu-item danger" data-action="delete">🗑 Delete</div>
</div>
```

**JavaScript Pattern:**
```javascript
// Show menu at position
function showMenu(x, y) {
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';
}

// Close on click outside
document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) menu.style.display = 'none';
});

// Close on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') menu.style.display = 'none';
});

// Handle actions via data-action
menu.querySelectorAll('.menu-item').forEach(item => {
    item.onclick = () => {
        handleAction(item.dataset.action);
        menu.style.display = 'none';
    };
});
```

**Key Conventions:**
- Use `data-action` attribute for action handlers
- Always include click-outside and Escape key to close
- Add `.danger` class for destructive actions
- Use dividers to separate destructive actions
- Position with `left/top` in pixels from event coordinates
- Include icons for visual recognition

### Submenu Pattern for Menu Options

When a menu action has multiple variants, use hover-activated submenus:

**CSS Structure:**
```css
.menu-btn.has-submenu { position: relative; }
.menu-btn.has-submenu::after {
    content: '▾';
    margin-left: 4px;
    font-size: 10px;
}
.menu-submenu {
    position: absolute;
    bottom: 100%;  /* or top: 100% for dropdown */
    left: 0;
    background: #2a2a3e;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 4px;
    min-width: 160px;
    display: none;
    z-index: 10001;
}
.menu-btn.has-submenu:hover .menu-submenu { display: block; }
.menu-submenu-item {
    padding: 8px 12px;
    cursor: pointer;
    border-radius: 4px;
}
.menu-submenu-item:hover { background: #3a3a4e; }
```

**HTML Structure:**
```html
<button class="menu-btn has-submenu">📥 Export
    <div class="menu-submenu">
        <div class="menu-submenu-item" onclick="exportAll()">Export All</div>
        <div class="menu-submenu-item" onclick="exportCurrent()">Export Current</div>
        <div class="menu-submenu-divider"></div>
        <div class="menu-submenu-item danger" onclick="exportReset()">Reset</div>
    </div>
</button>
```

**Key Points:**
- Use `position: relative` on parent, `position: absolute` on submenu
- `bottom: 100%` for upward menus, `top: 100%` for dropdowns
- Add `::after` arrow indicator for visual cue
- Include dividers for destructive actions
- Use `onclick` handlers on submenu items, not the parent button

### Popup Menu Viewport Positioning

**ALWAYS check viewport boundaries** before showing popup menus. Menus must be fully visible on screen.

```javascript
function positionMenu(menu, triggerEl) {
    const rect = triggerEl.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8; // margin from screen edge

    // Default: position below trigger
    let top = rect.bottom + 4;
    let left = rect.left;

    // Flip up if would overflow bottom
    if (top + menuRect.height > vh - gap) {
        top = rect.top - menuRect.height - 4;
    }

    // Shift left if would overflow right
    if (left + menuRect.width > vw - gap) {
        left = vw - menuRect.width - gap;
    }

    // Shift right if would overflow left
    if (left < gap) {
        left = gap;
    }

    // Clamp top to screen
    if (top < gap) {
        top = gap;
    }

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
}
```

**Rules:**
- Always measure menu dimensions AFTER making it visible (use `visibility: hidden` first if needed)
- Keep 8px minimum margin from viewport edges
- Flip direction (up/down) if menu would overflow
- Shift horizontally if near screen edge
- For context menus at cursor: use `clientX/clientY` as starting point

---

## 💡 Recommendations

### UI/UX Best Practices

- **Destructive actions** → Always require confirmation
  - Prevents accidental data loss

- **State persistence** → Use localStorage for UI state
  - Maintains user preferences across sessions

- **Loading states** → Show spinner/skeleton during async ops
  - User knows action is in progress

- **Error messages** → Display inline near the action
  - Context helps user understand issue

- **Success feedback** → Brief toast or visual highlight
  - Confirms action completed

- **Tooltips** → Add `title` attribute to interactive items
  - Helps user understand item purpose on hover

- **Task lifecycle** → Show in Active Tasks → reconcile to Recent Activity on completion
  - Full visibility of task progress and history

- **Task queuing** → Wait for current task to finish before starting new one
  - Prevents lost state, uncompleted tasks, admin overhead

- **Task verification** → Verify last task completed before starting next
  - Ensures no stuck/orphaned tasks

- **Deferred restarts** → Queue service restarts for after task completion
  - Prevents connection loss mid-task

- **Input history (arrow keys)** → Up/Down arrows recall previous inputs
  - Store history in array, track index
  - Up arrow: move back in history, populate input
  - Down arrow: move forward in history, populate input
  - On submit: push to history, reset index
  - Max 50 entries, persist to localStorage
  - Essential for chat inputs, command fields, search boxes

### Panel/Window Features

Every floating panel should include:
- **Draggable header** - `cursor: move` on header element
- **Pin/Hover toggle** - 📌 pinned vs 👆 hover mode
- **Minimize button** - Collapse to title bar only
- **Close button** - Hide panel completely
- **Position persistence** - Save left/top to localStorage

#### Pin/Hover Mode Implementation
```javascript
let isPinned = true;

function togglePin() {
    isPinned = !isPinned;
    localStorage.setItem('panel-pinned', isPinned);
    updatePinButton();
}

function updatePinButton() {
    const btn = document.getElementById('pin-btn');
    btn.textContent = isPinned ? '📌' : '👆';
    btn.title = isPinned ? 'Pinned (click for hover mode)' : 'Hover mode (click to pin)';
    btn.classList.toggle('active', isPinned);
    panel.classList.toggle('hover-mode', !isPinned);
}

// Auto-hide on mouse leave (hover mode only)
panel.onmouseleave = () => {
    if (!isPinned) hide();
};
```

#### Draggable Panel Implementation
```javascript
function setupDragPanel() {
    const header = panel.querySelector('.panel-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return; // Don't drag on buttons
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panel.style.left = (startLeft + e.clientX - startX) + 'px';
        panel.style.top = (startTop + e.clientY - startY) + 'px';
        panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) savePosition();
        isDragging = false;
    });
}
```

#### Position Persistence
```javascript
function savePosition() {
    localStorage.setItem('panel-position', JSON.stringify({
        left: panel.style.left,
        top: panel.style.top
    }));
}

function loadPosition() {
    const saved = localStorage.getItem('panel-position');
    if (saved) {
        const pos = JSON.parse(saved);
        if (pos.left) panel.style.left = pos.left;
        if (pos.top) panel.style.top = pos.top;
        panel.style.right = 'auto'; // Clear default right positioning
    }
}

### File Import Pattern

Standard pattern for importing JSON backup files:
```javascript
function importFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const imported = JSON.parse(text);

            // Validate structure
            if (!imported.requiredField) {
                showError('Invalid file format');
                return;
            }

            // Merge with existing (skip duplicates)
            for (const item of imported.items) {
                const exists = existingItems.some(i =>
                    i.id === item.id || i.text === item.text
                );
                if (!exists) {
                    item.id = generateNewId(); // Avoid ID conflicts
                    existingItems.push(item);
                }
            }

            await save();
            render();
            showSuccess(`Imported ${count} items`);
        } catch (err) {
            showError(`Import failed: ${err.message}`);
        }
    };

    input.click();
}
```

**Key Points:**
- Always validate file structure before processing
- Check for duplicates by ID and content
- Generate new IDs to avoid conflicts
- Wrap in try/catch for parse errors
- Show clear success/error feedback

### File Export Pattern

```javascript
function exportData(data, filename) {
    const backup = {
        ...data,
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
```

### Action Menus

- **Primary action** - Blue background → Execute immediately
- **Secondary action** - Default style → Execute immediately
- **Destructive action** - Red on hover + divider above → Confirm before executing
- **Multi-option action** - ▾ arrow indicator → Show submenu on hover

### localStorage State Management

**Naming Convention:**
```
{component}-{property}
Examples:
- todo-panel-pinned
- todo-panel-position
- activity-log-pinned
- todo-collapsed-sections
```

**Pattern for UI State:**
```javascript
// Save state
function saveState() {
    localStorage.setItem('component-state', JSON.stringify({
        visible: isVisible,
        minimized: isMinimized,
        position: { left: panel.style.left, top: panel.style.top }
    }));
}

// Load state (call after DOM ready)
function loadState() {
    try {
        const saved = localStorage.getItem('component-state');
        if (saved) {
            const state = JSON.parse(saved);
            if (state.visible) show();
            if (state.minimized) minimize();
            if (state.position) applyPosition(state.position);
        }
    } catch (err) {
        console.error('Failed to load state:', err);
        // Continue with defaults - don't break the app
    }
}
```

**Key Points:**
- Always wrap in try/catch (localStorage can fail)
- Use JSON.stringify/parse for objects
- Call loadState after DOM is ready
- Fail gracefully to defaults

### Form Inputs

- **Text input** - Focus border color `#4a9eff`
- **Checkbox** - Use div-based toggle (no native checkbox)
- **Select** - Style with dark theme colors
- **Textarea** - Auto-resize with content

### Keyboard Shortcuts

Always support:
- `Escape` - Close menus, dialogs, cancel operations
- `Enter` - Submit/confirm (when not in multiline input)
- `Ctrl+S` - Save (if applicable)

### Animation Timing

- **Hover transitions** - `0.15s` ease
- **Panel show/hide** - `0.2s` ease
- **Fade effects** - `0.3s` ease
- **Slide animations** - `0.2s` ease-out

### z-index Layers

- **Base panels (9999)** - Floating panels (Todo, Activity Log)
- **Menus (10000)** - Context menus, dropdowns
- **Submenus (10001)** - Nested menus
- **Modals (20000)** - Dialog overlays, image viewers
- **Toasts (30000)** - Notification messages

---

## 🔍 Debug Inspector Standards

### Quick Command Structure

Commands are organized with icons, labels, and optional submenus:

```javascript
const quickCommands = [
    { icon: '❌', label: 'Not Working', cmd: 'not working' },
    { icon: '🔧', label: 'Fix', cmd: 'fix', sub: [
        { label: 'Fix all errors', cmd: 'fix all errors' },
        { label: 'Fix and test', cmd: 'fix and test' }
    ]},
    { icon: '🎨', label: 'Design', cmd: 'design', sub: [
        { label: '── Style ──', cmd: '', disabled: true },  // Section header
        { label: 'Change colors', cmd: 'change colors' },
        { label: 'Improve layout', cmd: 'improve layout' },
        { label: '── Size ──', cmd: '', disabled: true },
        { label: 'Make smaller', cmd: 'make smaller' },
        { label: 'Make larger', cmd: 'make larger' }
    ]},
    { divider: true },  // Visual separator
    { icon: '🗑️', label: 'Remove', cmd: 'remove', danger: true }
];
```

### Command Categories

- **Quick Actions (❌🔧✅)** - Immediate fixes, status changes
- **Design (🎨)** - Visual/layout modifications
- **Code (💻)** - Refactoring, optimization
- **Analysis (🔍)** - Explain, review, understand
- **Destructive (🗑️)** - Remove, delete (use danger styling)

### Section Headers in Submenus

Use disabled items as visual section headers:
```javascript
{ label: '── Section Name ──', cmd: '', disabled: true }
```

### Rendering Quick Commands

```javascript
function renderQuickCommands(commands, container) {
    commands.forEach(cmd => {
        if (cmd.divider) {
            container.appendChild(createDivider());
            return;
        }

        const btn = document.createElement('button');
        btn.className = 'quick-cmd' + (cmd.danger ? ' danger' : '');
        btn.innerHTML = `${cmd.icon} ${cmd.label}`;

        if (cmd.sub) {
            btn.classList.add('has-submenu');
            const submenu = createSubmenu(cmd.sub);
            btn.appendChild(submenu);
        } else {
            btn.onclick = () => sendCommand(cmd.cmd);
        }

        container.appendChild(btn);
    });
}
```

### Quick Command CSS

```css
.quick-cmd {
    background: #2a2a3e;
    border: 1px solid #333;
    color: #ccc;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 4px;
}
.quick-cmd:hover { background: #3a3a4e; color: #fff; }
.quick-cmd.danger:hover { background: #ef4444; }
.quick-cmd.has-submenu { position: relative; }
.quick-cmd.has-submenu::after { content: '▾'; margin-left: 4px; }

.quick-submenu {
    position: absolute;
    bottom: 100%;
    left: 0;
    background: #2a2a3e;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 4px;
    min-width: 160px;
    display: none;
    z-index: 10001;
}
.quick-cmd.has-submenu:hover .quick-submenu { display: block; }
.quick-submenu-item { padding: 6px 10px; cursor: pointer; border-radius: 4px; }
.quick-submenu-item:hover { background: #3a3a4e; }
.quick-submenu-item.disabled {
    color: #666;
    cursor: default;
    font-weight: bold;
}
.quick-submenu-item.disabled:hover { background: transparent; }
```

### Send to External Service Pattern

When sending commands to another service (like Kitt):

```javascript
async function sendCommand(message) {
    // Try multiple methods for reliability
    let sent = false;

    // Method 1: Direct function call
    try {
        if (typeof ServiceAPI?.send === 'function') {
            await ServiceAPI.send(message);
            sent = true;
        }
    } catch (e) { console.warn('Method 1 failed:', e); }

    // Method 2: Window global
    if (!sent) {
        try {
            if (typeof window.ServiceAPI?.send === 'function') {
                await window.ServiceAPI.send(message);
                sent = true;
            }
        } catch (e) { console.warn('Method 2 failed:', e); }
    }

    // Method 3: DOM interaction fallback
    if (!sent) {
        try {
            const input = document.getElementById('service-input');
            const sendBtn = document.getElementById('service-send-btn');
            if (input && sendBtn) {
                input.value = message;
                sendBtn.click();
                sent = true;
            }
        } catch (e) { console.warn('Method 3 failed:', e); }
    }

    if (!sent) {
        showError('Could not send command');
    }
}
```

### Element Inspector Integration

```javascript
// Enable element picking
function startInspecting() {
    document.body.style.cursor = 'crosshair';

    const highlightOverlay = createHighlightOverlay();

    document.addEventListener('mouseover', (e) => {
        if (!isInspecting) return;
        highlightElement(e.target, highlightOverlay);
    });

    document.addEventListener('click', (e) => {
        if (!isInspecting) return;
        e.preventDefault();
        e.stopPropagation();
        selectElement(e.target);
        stopInspecting();
    }, { capture: true });
}

// Highlight overlay
function createHighlightOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'inspector-highlight';
    overlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        background: rgba(74, 158, 255, 0.2);
        border: 2px solid #4a9eff;
        z-index: 99999;
        transition: all 0.1s ease;
    `;
    document.body.appendChild(overlay);
    return overlay;
}
```

---

## 🌐 Debug Integration for All Webpages

All webpages should include a standardized debug panel for development and troubleshooting.

### Standard Debug Include

Add this script tag to all HTML pages:

```html
<!-- Debug Panel (remove in production) -->
<script src="/modules/debug-panel.js"></script>
```

### Minimal Debug Panel Implementation

For standalone pages (like memory-viewer.html), include this inline:

```html
<script>
// Debug Panel - Press Ctrl+Shift+D to toggle
(function() {
    let debugPanel = null;
    let isVisible = false;

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            toggleDebug();
        }
    });

    function toggleDebug() {
        if (!debugPanel) createPanel();
        isVisible = !isVisible;
        debugPanel.style.display = isVisible ? 'block' : 'none';
        if (isVisible) updateInfo();
    }

    function createPanel() {
        debugPanel = document.createElement('div');
        debugPanel.id = 'debug-panel';
        debugPanel.innerHTML = `
            <div class="debug-header">
                <span>Debug Panel</span>
                <button onclick="this.parentElement.parentElement.style.display='none'">×</button>
            </div>
            <div class="debug-content" id="debug-content"></div>
            <div class="debug-actions">
                <button onclick="location.reload()">Reload</button>
                <button onclick="localStorage.clear(); location.reload()">Clear Storage</button>
                <button onclick="console.clear()">Clear Console</button>
            </div>
        `;
        debugPanel.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 300px;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            font-family: monospace;
            font-size: 11px;
            color: #e0e0e0;
            z-index: 99999;
            display: none;
        `;
        document.body.appendChild(debugPanel);
        addDebugStyles();
    }

    function addDebugStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #debug-panel .debug-header {
                display: flex;
                justify-content: space-between;
                padding: 8px 12px;
                background: #2a2a3e;
                border-radius: 8px 8px 0 0;
                font-weight: bold;
            }
            #debug-panel .debug-header button {
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                font-size: 14px;
            }
            #debug-panel .debug-content {
                padding: 12px;
                max-height: 200px;
                overflow-y: auto;
            }
            #debug-panel .debug-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                border-bottom: 1px solid #333;
            }
            #debug-panel .debug-label { color: #888; }
            #debug-panel .debug-value { color: #4a9eff; }
            #debug-panel .debug-actions {
                display: flex;
                gap: 8px;
                padding: 8px 12px;
                border-top: 1px solid #333;
            }
            #debug-panel .debug-actions button {
                flex: 1;
                padding: 6px;
                background: #2a2a3e;
                border: 1px solid #444;
                border-radius: 4px;
                color: #ccc;
                cursor: pointer;
                font-size: 10px;
            }
            #debug-panel .debug-actions button:hover {
                background: #3a3a4e;
                color: #fff;
            }
        `;
        document.head.appendChild(style);
    }

    function updateInfo() {
        const content = document.getElementById('debug-content');
        if (!content) return;

        const info = [
            ['Page', document.title],
            ['URL', location.pathname],
            ['Viewport', `${window.innerWidth}×${window.innerHeight}`],
            ['localStorage', Object.keys(localStorage).length + ' keys'],
            ['sessionStorage', Object.keys(sessionStorage).length + ' keys'],
            ['DOM Elements', document.querySelectorAll('*').length],
            ['Scripts', document.scripts.length],
            ['Stylesheets', document.styleSheets.length]
        ];

        content.innerHTML = info.map(([label, value]) => `
            <div class="debug-row">
                <span class="debug-label">${label}</span>
                <span class="debug-value">${value}</span>
            </div>
        `).join('');
    }

    // Auto-show in development
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        console.log('[Debug] Press Ctrl+Shift+D to open debug panel');
    }
})();
</script>
```

### Debug Panel Features

- **Toggle Panel (`Ctrl+Shift+D`)** - Show/hide debug panel
- **Reload (Button)** - Refresh page
- **Clear Storage (Button)** - Clear localStorage and reload
- **Clear Console (Button)** - Clear browser console

### Debug Info to Display

```javascript
const debugInfo = [
    // Page Info
    ['Page', document.title],
    ['URL', location.pathname],
    ['Viewport', `${window.innerWidth}×${window.innerHeight}`],

    // Storage
    ['localStorage', Object.keys(localStorage).length + ' keys'],
    ['sessionStorage', Object.keys(sessionStorage).length + ' keys'],

    // DOM Stats
    ['DOM Elements', document.querySelectorAll('*').length],
    ['Scripts', document.scripts.length],
    ['Stylesheets', document.styleSheets.length],

    // Performance (if needed)
    ['Load Time', performance.timing.loadEventEnd - performance.timing.navigationStart + 'ms'],

    // Custom App Data
    ['Connected', wsConnected ? 'Yes' : 'No'],
    ['Queue', taskQueue.length]
];
```

### Integration with Kitt

For pages that connect to Kitt, add these debug actions:

```javascript
// Additional debug actions for Kitt-connected pages
const kittDebugActions = `
    <button onclick="checkKittStatus()">Kitt Status</button>
    <button onclick="resetKitt()">Reset Kitt</button>
`;

async function checkKittStatus() {
    try {
        const res = await fetch('http://localhost:8585/api/kitt/status');
        const status = await res.json();
        console.log('[Kitt Status]', status);
        alert('Kitt: ' + (status.busy ? 'Busy' : 'Available'));
    } catch (e) {
        alert('Kitt not reachable');
    }
}

async function resetKitt() {
    try {
        await fetch('http://localhost:8585/api/kitt/reset', { method: 'POST' });
        alert('Kitt reset');
    } catch (e) {
        alert('Reset failed');
    }
}
```

### Production Removal

Use build flags or environment checks to exclude debug code:

```javascript
// Only include in development
if (process.env.NODE_ENV !== 'production') {
    // Debug code here
}

// Or check hostname
if (!['localhost', '127.0.0.1'].includes(location.hostname)) {
    return; // Skip debug in production
}
```

---

### Component Review Checklist

All components should be periodically analyzed for:

- **Accessibility** - Keyboard navigable? Screen reader friendly? Color contrast OK? Focus indicators visible?
- **Feature Creep** - Does it do too much? Should it be split? Are all features actually used?
- **Redundant Info** - Duplicate displays? Unnecessary labels? Repeated data?
- **Consistency** - Matches other components? Follows standards? Uses shared styles?
- **Performance** - Unnecessary re-renders? Heavy computations? Memory leaks?
- **Mobile/Responsive** - Works on smaller screens? Touch-friendly?

**When to Review:**
- After major feature additions
- Before release milestones
- When users report confusion
- Quarterly maintenance cycles

**Review Actions:**
```
[ ] Run accessibility audit (Lighthouse, axe)
[ ] Check for unused code/features
[ ] Verify consistent styling with other components
[ ] Test keyboard navigation (Tab, Enter, Escape)
[ ] Review for redundant/duplicate information
[ ] Confirm all text is readable (contrast, size)
```

---

## 💰 Token, Cost & Memory Optimization

Best practices for saving on API tokens, reducing costs, and optimizing memory/performance while maintaining session data consistency.

### Token Optimization Strategies

- **Context Compaction (60-80% savings)** - Summarize long conversations before hitting context limit
- **Selective File Reading (40-60% savings)** - Only read files directly relevant to the task
- **Batch Operations (30-50% savings)** - Group related queries into single requests
- **Cache Common Queries (50-70% savings)** - Store frequently-accessed data locally
- **Incremental Updates (70-90% savings)** - Send only changed data, not entire documents

### Session Data Consistency

**Problem:** Context compaction loses detailed history.

**Solutions:**

1. **Memory File Pattern (CLAUDE.md)**
```markdown
## Session Memory
- Last task: [brief description]
- Key decisions: [bullet points]
- Open issues: [what's not resolved]
- Files modified: [list with line numbers]
```

2. **Checkpoint Pattern**
```javascript
// Save checkpoint before compaction
const checkpoint = {
    timestamp: Date.now(),
    currentTask: 'description',
    modifiedFiles: ['file1.js:42', 'file2.js:100'],
    pendingTodos: [...todoList],
    keyContext: 'critical info to preserve'
};
await saveCheckpoint(checkpoint);
```

3. **Structured Memory API**
```javascript
// Agent memory persistence
POST /api/memory/save
{
    "key": "session-state",
    "value": { /* structured data */ },
    "ttl": 86400  // 24 hours
}

GET /api/memory/load?key=session-state
```

### Cost-Effective API Usage

- **Use smaller models (-70% cost)** - Simple queries, code formatting
- **Limit output tokens (-30-50%)** - When you know expected response size
- **Avoid re-reading files (-20-40%)** - Cache file contents in session
- **Use search before read (-50-70%)** - Find specific content instead of reading entire files
- **Parallel tool calls (saves time)** - Independent operations in same request

### Memory Management

**Browser/Frontend:**
```javascript
// Limit stored data size
const MAX_LOG_ENTRIES = 100;
const MAX_HISTORY_ITEMS = 50;

// Prune old data
function pruneStorage(key, maxItems) {
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    if (data.length > maxItems) {
        localStorage.setItem(key, JSON.stringify(data.slice(-maxItems)));
    }
}

// Use WeakMap for temporary references (auto-GC)
const tempCache = new WeakMap();

// Clear unused event listeners
element.removeEventListener('click', handler);
element.remove();  // Don't orphan elements
```

**Node.js/Backend:**
```javascript
// Limit in-memory caches
const LRU = require('lru-cache');
const cache = new LRU({ max: 500, maxAge: 1000 * 60 * 5 });

// Stream large files instead of loading fully
const stream = fs.createReadStream(file);
stream.pipe(response);

// Clear intervals when done
const interval = setInterval(check, 1000);
// Later:
clearInterval(interval);
```

### Performance Optimization

- **DOM Updates** - Batch with `requestAnimationFrame` (-50% CPU)
- **Event Handlers** - Debounce/throttle (-30-70% calls)
- **Network** - Request deduplication (-40% requests)
- **Rendering** - Virtual scrolling for long lists (-90% DOM nodes)
- **Data** - Pagination over full loads (-80% memory)

**Debounce Pattern:**
```javascript
function debounce(fn, delay = 100) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// Usage
const saveDebounced = debounce(save, 500);
input.oninput = saveDebounced;
```

**Throttle Pattern:**
```javascript
function throttle(fn, limit = 100) {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Usage - limit scroll handler to 10fps
window.onscroll = throttle(handleScroll, 100);
```

### Data Consistency Patterns

**Optimistic Updates with Rollback:**
```javascript
async function updateWithRollback(id, newData) {
    const oldData = getData(id);

    // Optimistic update
    setData(id, newData);
    renderUI();

    try {
        await api.save(id, newData);
    } catch (error) {
        // Rollback on failure
        setData(id, oldData);
        renderUI();
        showError('Save failed, changes reverted');
    }
}
```

**Version Tracking:**
```javascript
// Include version in saved data
const data = {
    version: 3,
    lastModified: Date.now(),
    content: { ... }
};

// Check version before overwriting
async function save(data) {
    const current = await load();
    if (current.version > data.version) {
        throw new Error('Conflict: data was modified elsewhere');
    }
    data.version++;
    await storage.save(data);
}
```

**Sync Reconciliation:**
```javascript
// Merge local and remote changes
function reconcile(local, remote) {
    // Remote wins for conflicts, but preserve local-only items
    const merged = { ...local };

    for (const [key, remoteItem] of Object.entries(remote)) {
        const localItem = local[key];

        if (!localItem) {
            // New remote item
            merged[key] = remoteItem;
        } else if (remoteItem.lastModified > localItem.lastModified) {
            // Remote is newer
            merged[key] = remoteItem;
        }
        // Else: keep local (it's newer or equal)
    }

    return merged;
}
```

### Claude Code Session Tips

- **Use todo lists** - Maintains task state across compaction
- **Write to CLAUDE.md** - Persists critical decisions
- **Prefer edits over rewrites** - Smaller diffs, less tokens
- **Use grep before read** - Find specific content efficiently
- **Batch file operations** - Parallel reads save time
- **Keep responses concise** - Faster, cheaper
- **Reference line numbers** - Precise edits, less context

### Session Recovery Pattern

When resuming after compaction:
```markdown
## Recovery Checklist
1. Read CLAUDE.md for project context
2. Check todo list for pending tasks
3. Review recent git commits for changes
4. Check service status (ports 8080, 8585, 8500)
5. Resume from last documented checkpoint
```

### Cost Monitoring

```javascript
// Track API usage (if available)
const usageStats = {
    inputTokens: 0,
    outputTokens: 0,
    requests: 0,

    log(input, output) {
        this.inputTokens += input;
        this.outputTokens += output;
        this.requests++;

        // Estimate cost (example rates)
        const cost = (input * 0.003 + output * 0.015) / 1000;
        console.log(`[Cost] Request: $${cost.toFixed(4)} | Total: $${this.totalCost().toFixed(4)}`);
    },

    totalCost() {
        return (this.inputTokens * 0.003 + this.outputTokens * 0.015) / 1000;
    }
};
```

---

## 🔧 Refactoring Guidelines

Use shortcuts `rfr` (refactor from standards) or `rvw` (review/cleanup) to trigger refactoring.

### Refactoring Capabilities

- **Dead code removal** - Find and remove unused functions, variables, imports
  - When: After major feature changes

- **Code deduplication** - Extract repeated patterns into shared functions
  - When: Same logic appears 3+ times

- **Naming cleanup** - Rename variables/functions for clarity
  - When: Names are unclear or inconsistent

- **Structure improvement** - Split large files, reorganize modules
  - When: Files > 500 lines or mixed concerns

- **Pattern alignment** - Refactor to match STANDARDS.md conventions
  - When: New code or legacy cleanup

- **Performance optimization** - Identify and fix inefficient code
  - When: After profiling or visible slowness

- **Dependency cleanup** - Remove unused packages, update imports
  - When: Before releases

- **Comment cleanup** - Remove stale comments, add missing docs
  - When: Comments contradict code

### Refactoring Checklist

Before refactoring:
- [ ] Ensure tests exist (or create them first)
- [ ] Commit current state (clean rollback point)
- [ ] Identify scope - don't refactor everything at once

During refactoring:
- [ ] One change type at a time (don't mix rename + restructure)
- [ ] Run tests after each change
- [ ] Keep commits small and focused

After refactoring:
- [ ] Verify all tests pass
- [ ] Check for broken imports/references
- [ ] Update documentation if APIs changed

### Code Smell Indicators

- **Long function (> 50 lines)** → Extract helper functions
- **Deep nesting (> 3 levels)** → Early returns, extract logic
- **Magic numbers (hardcoded values)** → Extract to constants
- **God object (does too much)** → Split by responsibility
- **Feature envy (accesses other object's data)** → Move method to that object
- **Duplicate code (3+ places)** → Extract to shared function
- **Dead code (unreachable/unused)** → Delete it
- **Inconsistent naming** → Standardize names

### Safe Refactoring Patterns

**Extract Function:**
```javascript
// Before
function processOrder(order) {
    // 20 lines of validation
    // 30 lines of calculation
    // 15 lines of formatting
}

// After
function processOrder(order) {
    validateOrder(order);
    const total = calculateTotal(order);
    return formatOrder(order, total);
}
```

**Replace Magic Numbers:**
```javascript
// Before
if (retryCount > 3) { ... }
setTimeout(fn, 5000);

// After
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
if (retryCount > MAX_RETRIES) { ... }
setTimeout(fn, RETRY_DELAY_MS);
```

**Early Return:**
```javascript
// Before
function process(data) {
    if (data) {
        if (data.valid) {
            if (data.ready) {
                // actual logic
            }
        }
    }
}

// After
function process(data) {
    if (!data) return;
    if (!data.valid) return;
    if (!data.ready) return;
    // actual logic
}
```

---

## Testing Standards

### Testing Philosophy

**"Test it, don't assume it works"** - Every change should be verified before moving on.

### Testing Lessons Learned

#### LLM Backend Testing

1. **Always test chat completions endpoints** - Different models need different API formats:
   - Ollama: `/api/generate` or `/api/chat` (proprietary format)
   - LM Studio: `/v1/chat/completions` (OpenAI-compatible format)
   - Instruct models need chat format, not raw completions

2. **Health check endpoints vary by service:**
   - Ollama: `/api/tags`
   - LM Studio: `/v1/models`
   - Hive services: `/api/health` or `/api/status`

3. **Verify backend is actually being used:**
   ```bash
   curl http://localhost:3002/api/health   # Check Oracle's current backend
   ```

#### Service Integration Testing

1. **Test after configuration changes:**
   - Changed ports → Test connectivity
   - Changed backends → Verify responses work
   - Changed endpoints → Confirm data format

2. **WebSocket race conditions:**
   - Never send on WebSocket before `readyState === OPEN`
   - Use `setTimeout` with state check for reliable connection

3. **Health check frequency:**
   - Don't poll too frequently (can cause log noise)
   - Use appropriate timeouts (2-5 seconds for local, 10+ for remote)

#### UI Testing

1. **CSS z-index stacking:**
   - Overlays (like scan lines) can block clicks
   - Test clickability after adding overlay elements
   - Use `pointer-events: auto` on interactive elements

2. **Test on actual page load:**
   - Don't assume CSS works - refresh and click
   - Check multiple browsers if possible

3. **Form submission testing:**
   - Test Enter key behavior
   - Test button click
   - Verify state updates correctly

#### API Testing Checklist

Before declaring an API integration "done":
- [ ] Test success path with valid data
- [ ] Test with empty/null responses
- [ ] Test network timeout handling
- [ ] Test wrong endpoint (404) handling
- [ ] Verify response parsing works
- [ ] Check error messages are helpful

### Quick Verification Commands

```bash
# Oracle health
curl -s http://localhost:3002/api/health | jq .

# Relay status
curl -s http://localhost:8600/api/status | jq .

# LM Studio models
curl -s http://localhost:1234/v1/models | jq .

# Ollama models
curl -s http://localhost:11434/api/tags | jq .

# Test LLM response (via Oracle)
curl -s -X POST http://localhost:3002/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"test"}' | jq .answer
```

### Testing Order

1. **Unit** - Test individual functions first
2. **Integration** - Test service connections
3. **E2E** - Test full user flows
4. **Smoke** - Quick sanity check after deployment

### Known Test Gotchas

1. **Ollama model loading** - First request after model switch may take 30+ seconds
2. **Port conflicts** - Always check `netstat -ano | findstr :PORT` before assuming service is dead
3. **Browser cache** - Force refresh (`Ctrl+Shift+R`) when testing UI changes
4. **Windows services** - Use `net stop/start` not just restart for full cleanup
5. **LM Studio endpoints** - Uses OpenAI format, not Ollama format

---

## 🎮 MSFS WASM Development

### Lessons Learned (2026-01-22)

#### API Choice: Legacy vs Modern

**CRITICAL:** The MSFS SDK has multiple APIs for LVar access. The "Legacy" API is what actually works.

| API | Header | Status |
|-----|--------|--------|
| Legacy (USE THIS) | `<MSFS/Legacy/gauges.h>` | ✅ Works in MSFS 2024 |
| Modern | `<MSFS/MSFS_Vars.h>` | ❌ Does not work |

**Correct functions (gauges.h):**
- `register_named_variable()` - Register an LVar
- `get_named_variable_value()` - Read an LVar
- `set_named_variable_value()` - Write an LVar

**Wrong functions (MSFS_Vars.h):**
- `fsVarsRegisterLVar()` - Not implemented
- `fsVarsLVarGet()` - Not implemented
- `fsVarsLVarSet()` - Not implemented

#### How to Verify API Choice

**Before building, analyze working WASM modules:**
```bash
# Check what symbols working addons import
strings "path\to\working.wasm" | grep -i "register\|lvar\|variable"
```

All working addons (Lorby, MobiFlight, FBW, Flow Pro) import:
- `register_named_variable`
- `get_named_variable_value`
- `set_named_variable_value`

#### Size Sanity Check

| Size | Meaning |
|------|---------|
| < 5 KB | ❌ SDK not linked, symbols undefined |
| 100-300 KB | ✅ Minimal working module |
| 1-2 MB | ✅ Full-featured module |

If your WASM is tiny (< 5KB), the compiler allowed undefined symbols but nothing is actually linked.

#### The Mistake Pattern

**Don't assume "Legacy" means deprecated.** In MSFS SDK:
- "Legacy" = battle-tested, what everyone uses
- "Modern" = newer API that may not be fully implemented

**Always verify against working examples, not just documentation.**

#### Reference Working Addons

When in doubt, analyze these addons in `Community` folder:
- Lorby LVar Hook - Pure LVar access
- MobiFlight - Event module
- FlyByWire - Full aircraft systems

---

## 🤖 AI Development Workflow

Best practices for LLM-assisted software development, based on industry research and hive experience.

### Core Principles

1. **Planning First** - Never dive into code without a documented plan
2. **Context is King** - What the model knows determines quality
3. **Human Oversight** - AI proposes, human approves
4. **Memory Persistence** - Sessions die, knowledge must survive
5. **Quality Gates** - AI code requires review before merge

### PLANNING.md Pattern

Every significant feature/project should have a `PLANNING.md` file that serves as the "AI brain" for that work:

```markdown
# Feature: [Name]

## Context
[Brief description, why this feature exists]

## Current State
[What exists now, what's broken/missing]

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2

## Technical Approach
[High-level implementation strategy]

## Files to Modify
| File | Changes |
|------|---------|
| src/component.js | Add validation logic |
| tests/component.test.js | Add test cases |

## Verification
[How to test this works]

## Open Questions
- Question that needs human decision
```

**Benefits:**
- AI can read this to understand context in any session
- Human can review and approve approach before coding
- Serves as audit trail of decisions
- Survives context compaction

### AI Workflow Stages

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PLANNING  │───►│   CODING    │───►│   REVIEW    │───►│   DEPLOY    │
│  (AI drafts)│    │ (AI writes) │    │ (Human/AI)  │    │  (Verified) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼
  PLANNING.md        Code Files       Quality Gates      Production
```

**Stage Details:**

| Stage | AI Role | Human Role | Output |
|-------|---------|------------|--------|
| Planning | Draft approach, identify files | Approve/modify plan | PLANNING.md |
| Coding | Write implementation | Monitor, course-correct | Code changes |
| Review | Self-review, fix issues | Final approval | Clean code |
| Deploy | Generate tests, docs | Verify, merge | Released feature |

### Context Engineering

**Problem:** LLMs have limited context windows. What they see determines output quality.

**Strategies:**

1. **Structured Memory Files**
   - CLAUDE.md: Project context, rules, shortcuts
   - STANDARDS.md: Patterns, conventions, lessons
   - PLANNING.md: Current task context
   - SESSION.md: Transient session state (optional)

2. **Memory Hierarchy**
   ```
   Long-term Memory (CLAUDE.md, STANDARDS.md)
        │
        ▼
   Working Memory (PLANNING.md, current task)
        │
        ▼
   Short-term Memory (conversation context)
   ```

3. **Context Injection**
   - Always reference memory files at session start
   - Include relevant code snippets, not entire files
   - Summarize previous decisions, don't re-explain

4. **Memory Consolidation**
   - End of session: Extract learnings to memory files
   - Significant decisions → CLAUDE.md
   - New patterns → STANDARDS.md
   - Task progress → PLANNING.md

### Memory Persistence Patterns

**Problem:** Context compaction loses detail. Sessions end. Knowledge must survive.

**Solution 1: Checkpoint Pattern**
```javascript
// Before context gets full or session ends
const checkpoint = {
    timestamp: Date.now(),
    currentTask: 'Implementing user auth',
    completedSteps: ['Created schema', 'Added endpoints'],
    nextSteps: ['Add validation', 'Write tests'],
    blockers: ['Need decision on session timeout'],
    modifiedFiles: ['src/auth.js:42', 'tests/auth.test.js:15']
};
await saveToMemory('session-checkpoint', checkpoint);
```

**Solution 2: Fact Extraction**
```markdown
## Learned This Session

### Decisions Made
- Using JWT for auth (not sessions) - Harold approved 2024-01-21
- Token expiry: 24 hours

### Patterns Discovered
- Auth middleware must check `req.headers.authorization` not `req.auth`
- Use `bcrypt.compare()` not direct string comparison

### Gotchas Found
- JWT decode doesn't verify - use `jwt.verify()`
```

**Solution 3: Database Memory**
```javascript
// Relay API for persistent memory
POST /api/memory/save
{
    "key": "auth-implementation",
    "value": { /* structured data */ },
    "tags": ["auth", "security"],
    "ttl": null  // Permanent
}

GET /api/memory/search?tags=auth
```

## 🗄️ Database Standards

### SQLite as Default Backend

**Rule:** All services, webpages, and components requiring data persistence MUST use SQLite.

**Why SQLite:**
- Zero configuration - no server setup required
- Single file database - easy backup and migration
- Fast for read-heavy workloads (which most Hive services are)
- ACID compliant - data integrity guaranteed
- Works offline - no network dependency
- Cross-platform - same code works everywhere

**Implementation Pattern:**
```javascript
const Database = require('better-sqlite3');
const db = new Database('service-name.db');

// Create tables on startup
db.exec(`
    CREATE TABLE IF NOT EXISTS data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        value TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
`);
```

**Standard Locations:**
| Service | Database Path |
|---------|---------------|
| Relay | `Admin/relay/relay.db` |
| Oracle | `C:/LLM-Oracle/oracle.db` |
| Hive Brain | `Admin/hive-brain/colony.db` |
| New services | `[service-dir]/[service-name].db` |

**Package:** Use `better-sqlite3` (synchronous, fast) not `sqlite3` (async, slower).

**Exceptions:** Only use localStorage for:
- UI-only state (panel positions, collapsed states)
- Browser-side preferences
- Temporary session data

Everything else goes to SQLite.

### Quality Gates for AI Code

**Rule:** No AI-generated code goes to production without verification.

**Gate 1: Self-Review**
```
Before committing, AI should:
- [ ] Check for common errors (off-by-one, null refs)
- [ ] Verify error handling exists
- [ ] Confirm no hardcoded secrets
- [ ] Test happy path works
```

**Gate 2: Human Review**
```
Human reviewer checks:
- [ ] Does this match the approved plan?
- [ ] Is the approach appropriate?
- [ ] Any security concerns?
- [ ] Any performance concerns?
- [ ] Tests adequate?
```

**Gate 3: Integration**
```
Before merge:
- [ ] All tests pass
- [ ] No regressions in existing functionality
- [ ] Documentation updated if needed
- [ ] STANDARDS.md updated if new pattern
```

### Prompting Best Practices

**Do:**
- One task at a time (focused prompts)
- Include relevant context
- Specify output format expected
- Set constraints upfront

**Don't:**
- Ask for entire application at once
- Assume AI remembers previous sessions
- Skip verification steps
- Accept code without testing

**Effective Prompt Structure:**
```
CONTEXT: [What exists, what's the goal]
TASK: [Specific thing to do]
CONSTRAINTS: [Limits, patterns to follow, what to avoid]
OUTPUT: [Expected format, files to modify]
```

**Example:**
```
CONTEXT: We have a user auth system using JWT. Need to add refresh tokens.
TASK: Add refresh token endpoint to auth.js
CONSTRAINTS:
- Follow existing patterns in auth.js
- Refresh token expires in 7 days
- Store refresh tokens in Redis (already configured)
OUTPUT: Modified auth.js with POST /auth/refresh endpoint
```

### Session Handoff Protocol

When ending a session or expecting context compaction:

1. **Update PLANNING.md** with current progress
2. **Extract learnings** to CLAUDE.md or STANDARDS.md
3. **Save checkpoint** if mid-task
4. **Document blockers** for next session
5. **Commit work** even if incomplete (WIP commit)

**Handoff Template:**
```markdown
## Session End: [Date]

### Completed
- [x] Task 1
- [x] Task 2

### In Progress
- [ ] Task 3 (50% - stopped at validation logic)

### Next Session Should
1. Continue Task 3 from src/auth.js:142
2. Review the validation approach
3. Run full test suite

### Blockers
- Need Harold's decision on timeout value

### Files Modified This Session
- src/auth.js (lines 100-200)
- tests/auth.test.js (new file)
```

### AI Code Review Checklist

When AI generates code, verify:

**Correctness:**
- [ ] Logic matches requirements
- [ ] Edge cases handled
- [ ] Error paths covered
- [ ] No obvious bugs

**Security:**
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] No SQL/command injection
- [ ] Auth/authz enforced

**Quality:**
- [ ] Follows project patterns (STANDARDS.md)
- [ ] Naming is clear and consistent
- [ ] No dead code
- [ ] Comments explain "why" not "what"

**Performance:**
- [ ] No N+1 queries
- [ ] Appropriate caching
- [ ] No memory leaks
- [ ] Reasonable complexity

### Hive-Specific AI Guidelines

**For Oracle/Kitt/tinyAI:**
1. Always inject hive context (ports, services, state)
2. Use tool calling, don't just suggest commands
3. Check service health before operations
4. Escalate complex tasks to Claude Code
5. Log all interactions for learning

**For Claude Code sessions:**
1. Read CLAUDE.md at session start
2. Use todo lists for multi-step tasks
3. Test after every change
4. Save learnings before session ends
5. Use shortcuts (msg, mem, mst, etc.)

### Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Prompt stuffing | Too much context, model confused | Focus on relevant info only |
| No verification | Bugs reach production | Always test AI output |
| Session amnesia | Knowledge lost between sessions | Use memory files |
| Over-reliance | Human stops thinking | Human reviews all decisions |
| Under-specification | AI guesses wrong | Be explicit about requirements |
| Monolithic prompts | Giant tasks fail | Break into small steps |

### Continuous Improvement Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    AI IMPROVEMENT CYCLE                      │
│                                                              │
│  AI Works ──► Results Logged ──► Claude Reviews             │
│       ▲                               │                      │
│       │                               ▼                      │
│       └── All AI Learns ◄── Harold Approves Changes         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

1. **AI acts** - Oracle, Kitt, tinyAI perform tasks
2. **Results logged** - All interactions stored in database
3. **Claude reviews** - Analyzes logs for improvements
4. **Harold approves** - Human validates recommendations
5. **All AI learns** - Updates propagate to all agents

This ensures every AI in the hive gets smarter over time

---

## 📝 Claude Code Memory Management

Standards for managing Claude Code's memory system across sessions.

### Memory Hierarchy (Priority Order)

| Level | Location | Purpose | Shared With |
|-------|----------|---------|-------------|
| 1. Managed Policy | `C:\Program Files\ClaudeCode\CLAUDE.md` | Org-wide rules (IT/DevOps) | All users |
| 2. Project Memory | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team-shared project context | Team (via git) |
| 3. Project Rules | `./.claude/rules/*.md` | Modular topic-specific rules | Team (via git) |
| 4. User Memory | `~/.claude/CLAUDE.md` | Personal preferences (all projects) | Just you |
| 5. Local Project | `./CLAUDE.local.md` | Personal project prefs (gitignored) | Just you |

### Import Syntax

Import other files into CLAUDE.md using `@path/to/file`:

```markdown
See @README for project overview and @package.json for npm commands.

# Additional Instructions
- git workflow @docs/git-instructions.md
- personal prefs @~/.claude/my-project-instructions.md
```

**Rules:**
- Relative and absolute paths supported
- `@~/` expands to user home directory
- Imports NOT evaluated inside code blocks/spans
- Max depth: 5 recursive imports
- Check loaded files with `/memory` command

### Modular Rules (`.claude/rules/`)

Organize instructions into topic-specific files:

```
.claude/
├── CLAUDE.md              # Main project instructions
└── rules/
    ├── code-style.md      # Code style guidelines
    ├── testing.md         # Testing conventions
    ├── security.md        # Security requirements
    └── frontend/
        ├── react.md       # React-specific rules
        └── styles.md      # CSS conventions
```

**Path-Specific Rules (YAML Frontmatter):**

```markdown
---
paths:
  - "src/api/**/*.ts"
  - "lib/**/*.ts"
---

# API Development Rules

- All API endpoints must include input validation
- Use the standard error response format
```

Rules without `paths` frontmatter apply to all files.

**Glob Patterns:**

| Pattern | Matches |
|---------|---------|
| `**/*.ts` | All TypeScript files anywhere |
| `src/**/*` | All files under src/ |
| `*.md` | Markdown in project root |
| `src/**/*.{ts,tsx}` | TypeScript and TSX in src |
| `{src,lib}/**/*.ts` | TypeScript in src or lib |

### Memory Lookup Behavior

- Claude recurses UP from cwd to root, reading all CLAUDE.md files found
- Nested CLAUDE.md files (in subdirectories) loaded when Claude reads files in those subtrees
- User-level rules (`~/.claude/rules/`) loaded before project rules (lower priority)
- Symlinks supported in `.claude/rules/` for shared rules across projects

### Best Practices

**File Organization:**
- Keep rules focused (one topic per file)
- Use descriptive filenames (`testing.md` not `rules1.md`)
- Organize with subdirectories for large projects
- Use path-specific rules sparingly (only when truly file-type specific)

**Content Guidelines:**
- Be specific: "Use 2-space indentation" not "Format properly"
- Use bullet points for individual rules
- Group related rules under markdown headings
- Review and update as project evolves

**Hive Standard:**
- Main context: `CLAUDE.md` in project root
- Standards/patterns: `STANDARDS.md` in project root
- Import both in CLAUDE.md for full context
- Use `syncmem` shortcut to backup to database
