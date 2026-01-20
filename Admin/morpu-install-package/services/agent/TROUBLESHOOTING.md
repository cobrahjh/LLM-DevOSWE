# SimWidget Agent - Troubleshooting Guide
**Version:** v1.0.0  
**Last Updated:** 2026-01-09

Quick reference for common issues and instant fixes.

---

## Table of Contents
1. [UI Buttons Not Working](#ui-buttons-not-working)
2. [WebSocket Connection Issues](#websocket-connection-issues)
3. [Server Won't Start](#server-wont-start)
4. [API Key Errors](#api-key-errors)

---

## UI Buttons Not Working

### Symptoms
- Buttons don't respond to clicks
- No console errors visible (silent failure)
- Page loads but is non-interactive
- Menus don't open/close

### Cause: Escaped Template Literals
JavaScript template literals with escaped characters break the entire script block.

**Bad Code:**
```javascript
const url = \`http://\${host}:8585/api\`;
html += \`<div>\${value}</div>\`;
```

**Good Code:**
```javascript
const url = `http://${host}:8585/api`;
html += `<div>${value}</div>`;
```

### How to Find
1. Open browser DevTools (F12)
2. Check Console tab for syntax errors
3. Search file for `\$\{` or `\`` patterns:
```powershell
# PowerShell - find escaped template literals
Select-String -Path "agent-ui\*.html" -Pattern '\\\$\{' 
Select-String -Path "agent-ui\*.js" -Pattern '\\\$\{' 
```

### Fix
Replace all escaped template literals:
- `\`` → `` ` ``
- `\${` → `${`

### Prevention
- When copying code between files, watch for escape character insertion
- Use a linter that catches syntax errors
- Test UI after any JavaScript changes

---

## WebSocket Connection Issues

### Symptoms
- Status shows "Disconnected" permanently
- Chat messages don't send
- "Reconnecting..." loops forever

### Quick Checks
1. **Is the server running?**
   ```powershell
   Get-NetTCPConnection -LocalPort 8585 -ErrorAction SilentlyContinue
   ```

2. **Check server console for errors**

3. **Test API endpoint:**
   ```powershell
   Invoke-RestMethod http://localhost:8585/api/health
   ```

### Common Fixes
- Restart the Agent server
- Check `.env` file exists and has valid API key
- Verify port 8585 isn't blocked by firewall

---

## Server Won't Start

### Symptoms
- `node agent-server.js` exits immediately
- Port already in use error
- Module not found errors

### Port In Use
```powershell
# Find what's using port 8585
Get-NetTCPConnection -LocalPort 8585 | Select-Object OwningProcess
Get-Process -Id <PID>

# Kill the process
Stop-Process -Id <PID> -Force
```

### Missing Dependencies
```powershell
cd C:\LLM-DevOSWE\SimWidget_Engine\Admin\agent
npm install
```

### Missing .env File
```powershell
# Check if .env exists
Test-Path .env

# Copy from example if missing
Copy-Item .env.example .env
# Then edit .env to add your ANTHROPIC_API_KEY
```

---

## API Key Errors

### Symptoms
- "Invalid API key" in console
- Chat returns errors instead of responses
- 401 or 403 HTTP errors

### Fix
1. Open `.env` file in `Admin\agent\`
2. Verify `ANTHROPIC_API_KEY` is set correctly
3. No quotes around the key value
4. Restart server after changes

**Correct format:**
```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

**Wrong formats:**
```env
ANTHROPIC_API_KEY="sk-ant-api03-xxxxx"  # No quotes!
ANTHROPIC_API_KEY= sk-ant-api03-xxxxx   # No spaces!
```

---

## Quick Diagnostic Commands

```powershell
# Check all SimWidget services
@(8080, 8585, 8590) | ForEach-Object {
    $port = $_
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) { "Port $port : RUNNING" } else { "Port $port : STOPPED" }
}

# Test Agent API
Invoke-RestMethod http://localhost:8585/api/health

# View recent Agent logs
Get-Content "C:\LLM-DevOSWE\SimWidget_Engine\Admin\agent\logs\agent-server.log" -Tail 50

# Restart all services
& "C:\LLM-DevOSWE\SimWidget_Engine\start-all-servers.bat"
```

---

## Issue Log

| Date | Issue | Cause | Fix |
|------|-------|-------|-----|
| 2026-01-09 | UI buttons not working | Escaped template literals in index.html | Removed `\` from `\${` and backticks |

---

## File Locations

| Component | Path |
|-----------|------|
| Agent Server | `Admin\agent\agent-server.js` |
| Agent UI | `Admin\agent\agent-ui\index.html` |
| Agent Config | `Admin\agent\.env` |
| Agent Logs | `Admin\agent\logs\` |
| TODO Module | `Admin\agent\agent-ui\todo-module.js` |
| Hot Reload | `Admin\agent\hot-update\` |
