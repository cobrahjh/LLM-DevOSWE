# Camera Controls Troubleshooting Guide

SimWidget camera controls for MSFS 2024.

---

## Quick Diagnosis

```
GET http://localhost:8080/api/health
```

Check the `camera` section for current state and method being used.

---

## Camera Methods

SimWidget supports multiple camera control methods:

| Method | Speed | Reliability | Requirements |
|--------|-------|-------------|--------------|
| SimConnect | Instant | Excellent | MSFS running |
| vJoy | Instant | Excellent | vJoy driver installed |
| PowerShell | 200-700ms | Fair | Windows only |
| AHK | 50-100ms | Good | AutoHotKey installed |

---

## Common Issues

### 1. Camera Not Responding

**Symptoms:** Clicking camera buttons does nothing

**Check:**
```bash
curl http://localhost:8080/api/debug/keysender
```

**Solutions:**
- Verify MSFS is the active window
- Check keybindings match MSFS settings
- Restart SimWidget server

### 2. Wrong Camera View

**Symptoms:** Camera switches to unexpected view

**Cause:** Keybindings mismatch between SimWidget and MSFS

**Fix:**
1. Open Keymap Editor: `http://localhost:8080/ui/keymap-editor/`
2. Go to Camera section
3. Match keys to your MSFS camera bindings

### 3. Slow Response (PowerShell)

**Symptoms:** 500ms+ delay on camera changes

**Cause:** Using PowerShell fallback (no vJoy/AHK)

**Solutions:**

**Option A: Install vJoy (Recommended)**
1. Download from http://vjoystick.sourceforge.net/
2. Install and restart
3. SimWidget auto-detects vJoy

**Option B: Use SimConnect Events**
- Some camera views work via SimConnect (no key simulation)
- External/Cockpit toggle: Uses `VIEW_MODE` event directly

### 4. ChasePlane Integration

**Symptoms:** ChasePlane cinematic modes not triggering

**Setup:**
1. Ensure ChasePlane is running before SimWidget
2. Check AHK helper is active
3. Verify keybindings:
   - Alt+Z = Toggle Cinematic
   - Alt+X = Next Cinematic View

**Debug:**
```bash
curl http://localhost:8080/api/debug/camera
```

---

## MSFS 2024 Default Camera Keys

| Action | Default Key | SimWidget ID |
|--------|-------------|--------------|
| Cockpit View | F1 | cockpitVFR |
| External View | End | toggleExternal |
| Drone | Insert | drone |
| Next Camera | A | nextFixedCam |
| Prev Camera | Shift+A | prevFixedCam |
| Reset View | Space | resetView |
| Zoom In | = | zoomIn |
| Zoom Out | - | zoomOut |

---

## Without ChasePlane

SimWidget works without ChasePlane using native MSFS cameras:

**Supported:**
- Cockpit views (VFR, IFR, Landing)
- External/Chase view
- Drone camera
- Fixed cameras cycling
- Zoom in/out
- Camera presets (F5-F8 save, F1-F4 load)

**Not Supported (ChasePlane only):**
- Cinematic flyby modes
- Smooth camera transitions
- Auto-orbit around aircraft

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/camsys/state` | GET | Current camera state |
| `/api/camsys/cockpit` | POST | Switch to cockpit |
| `/api/camsys/external` | POST | Switch to external |
| `/api/camsys/drone` | POST | Switch to drone |
| `/api/camsys/toggle` | POST | Toggle cockpit/external |
| `/api/camsys/zoomin` | POST | Zoom in |
| `/api/camsys/zoomout` | POST | Zoom out |
| `/api/camsys/reset` | POST | Reset camera |

---

## Keybinding Conflicts

Check for conflicts:
```bash
curl http://localhost:8080/api/keymaps/conflicts
```

Common conflicts:
- `A` key used by both camera and aircraft controls
- Function keys (F1-F12) used by multiple systems

---

## Debug Mode

Enable verbose logging:
```bash
curl -X POST http://localhost:8080/api/debug/camera -H "Content-Type: application/json" -d '{"enabled":true}'
```

View action log:
```bash
curl http://localhost:8080/api/debug/camera
```

---

## Still Having Issues?

1. Check server logs in terminal
2. Verify MSFS keybindings haven't been customized
3. Test with `/api/camsys/toggle` directly
4. Report issues with debug output attached
