# Lovable GTN750Xi - Deployment Steps

**Status:** WebSocket adapter ready, Lovable app configured, ready to build and deploy

---

## Quick Start (Manual Steps)

### 1. Install Dependencies

Open PowerShell or Command Prompt on **ROCK-PC**:

```powershell
cd C:\LLM-DevOSWE\lovable-gtn750xi
npm install
```

### 2. Build Production Bundle

```powershell
npm run build
```

This creates `C:\LLM-DevOSWE\lovable-gtn750xi\dist\` with compiled React app.

### 3. Copy to SimGlass UI Directory

```powershell
xcopy /E /I /Y C:\LLM-DevOSWE\lovable-gtn750xi\dist C:\LLM-DevOSWE\simwidget-hybrid\ui\gtn750xi-react
```

### 4. Deploy to Commander-PC

```powershell
powershell.exe -NoProfile -NonInteractive -Command "scp -r 'C:/LLM-DevOSWE/simwidget-hybrid/ui/gtn750xi-react' 'hjhar@192.168.1.42:C:/LLM-DevOSWE/simwidget-hybrid/ui/'; Write-Output 'done'"
```

### 5. Access Lovable GTN750Xi

Navigate to: `http://192.168.1.42:8080/ui/gtn750xi-react/`

---

## What's Already Done

✅ **WebSocket Adapter** — `backend/lovable-ws-adapter.js`
- Transforms SimGlass data → Lovable format
- Deployed to commander-pc

✅ **Server Integration** — `backend/server.js`
- Dual-format WebSocket support
- Client opt-in: `{type: 'setFormat', format: 'lovable'}`
- Deployed to commander-pc

✅ **Lovable App Configured** — `lovable-gtn750xi/`
- WebSocket URL: `ws://192.168.1.42:8080`
- Format opt-in on connect
- Ready to build

---

## Expected Result

After deployment, you'll have **three GTN750Xi variants**:

1. **V1 (Classic):** `http://192.168.1.42:8080/ui/gtn750xi/`
   - Vanilla JS, horizontal home buttons
   - Proven backend, canvas map renderer

2. **V2 (Menu Bar):** `http://192.168.1.42:8080/ui/gtn750xi/?layout=v2`
   - Vanilla JS, compact menu bar layout
   - Same backend as V1

3. **React (Lovable):** `http://192.168.1.42:8080/ui/gtn750xi-react/`
   - React + TypeScript + Tailwind
   - Modern UI, professional design
   - Uses WebSocket adapter

All three share the same SimGlass backend on port 8080.

---

## Testing After Deployment

### 1. Verify Connection

Open `http://192.168.1.42:8080/ui/gtn750xi-react/` and check browser console:

```
[WS] Client switched to Lovable format
```

Should appear in server logs on commander-pc.

### 2. Test Data Updates

Navigate to any screen and verify:
- Altitude updates from sim
- Ground speed updates
- Heading updates
- Lat/Lng updates

### 3. Test Planning Utilities

Click each utility and verify calculations:
- **VCALC:** TOD calculation with flight plan
- **Trip:** DTK/DIS/ETA calculations
- **Fuel:** Range and endurance
- **DALT:** Density altitude and TAS
- **Checklists:** Checkbox functionality

---

## Troubleshooting

**npm not found:**
- Install Node.js from https://nodejs.org/ (includes npm)
- Or use nvm: https://github.com/coreybutler/nvm-windows

**Build fails:**
- Check Node.js version: `node --version` (need v18+)
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

**WebSocket won't connect:**
- Check SimGlass server is running
- Verify server has adapter changes (restart server)
- Check browser console for errors

**Data not updating:**
- Check server logs for "Client switched to Lovable format"
- Verify /api/status shows SimConnect connected
- Check browser network tab for WebSocket messages

---

## Next Steps

**On ROCK-PC (this machine):**
1. Run the build commands above
2. Copy dist to ui/gtn750xi-react
3. Deploy to commander-pc

**I can't run npm commands from here** (npm not in PATH), but the steps are documented above.

**Would you like me to create a batch script to automate the build and deploy process?**
