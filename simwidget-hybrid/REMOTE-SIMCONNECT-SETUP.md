# Remote SimConnect Setup Guide

Configure SimGlass to connect to MSFS 2024 running on a different PC.

## Network Setup

**Server PC** (ROCK-PC): 192.168.1.192 - Runs SimGlass server
**Sim PC** (ai-pc): 192.168.1.162 - Runs MSFS 2024

---

## Configuration

### 1. On Sim PC (ai-pc) - Enable Remote SimConnect

**Edit SimConnect.xml**:
```
C:\Users\[Username]\AppData\Roaming\Microsoft Flight Simulator\SimConnect.xml
```

**Add network configuration**:
```xml
<?xml version="1.0" encoding="Windows-1252"?>
<SimBase.Document Type="SimConnect" version="1,0">
    <Descr>SimConnect Server Configuration</Descr>
    <Filename>SimConnect.xml</Filename>
    <SimConnect.Comm>
        <Descr>Static IP4 port</Descr>
        <Protocol>IPv4</Protocol>
        <Scope>global</Scope>
        <Port>500</Port>
        <MaxClients>64</MaxClients>
        <MaxRecvSize>4096</MaxRecvSize>
        <DisableNagle>1</DisableNagle>
    </SimConnect.Comm>
</SimBase.Document>
```

**Key settings**:
- `<Scope>global</Scope>` - Allows network connections (not just localhost)
- `<Port>500</Port>` - Default SimConnect port
- `<MaxClients>64</MaxClients>` - Allow multiple connections

**Restart MSFS** after creating/editing this file.

---

### 2. On Sim PC (ai-pc) - Firewall Rule

**Allow SimConnect through Windows Firewall**:

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "SimConnect TCP 500" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 500 `
    -Action Allow `
    -Profile Any
```

Or manually:
- Windows Security → Firewall → Advanced Settings
- Inbound Rules → New Rule
- Port → TCP 500
- Allow connection
- All profiles (Domain, Private, Public)

---

### 3. On Server PC (ROCK-PC) - Configure SimGlass

**Already done!** Updated `config.json`:
```json
"simconnect": {
  "remoteHost": "192.168.1.162",
  "remotePort": 500
}
```

---

### 4. Restart SimGlass Server

```powershell
# Stop current server
taskkill /F /PID [PID]

# Or stop all node processes (be careful!)
Get-Process node | Where-Object {$_.Path -like "*simwidget*"} | Stop-Process

# Start server with remote config
cd C:\LLM-DevOSWE\simwidget-hybrid\backend
node server.js
```

**Server will now attempt to connect to** `192.168.1.162:500`

---

## Verification

### Check Connection

**On server PC**:
```bash
curl http://localhost:8080/api/status | findstr "connected"
# Should show: "connected": true
```

**Test remote connection**:
```bash
# From server PC, test if port 500 is reachable on sim PC
Test-NetConnection -ComputerName 192.168.1.162 -Port 500
```

### Logs

**Server console will show**:
```
✓ SimConnect attempting connection to 192.168.1.162:500
✓ SimConnect connected to remote MSFS
✓ Streaming 106 SimVars from remote simulator
```

Or if failed:
```
⚠️ SimConnect connection failed (timeout/refused)
⚠️ Falling back to mock mode
```

---

## Troubleshooting

### Connection Timeout

**Cause**: Firewall blocking or SimConnect not configured

**Fix**:
1. Verify firewall rule on sim PC
2. Check SimConnect.xml exists and has `<Scope>global</Scope>`
3. Restart MSFS after editing SimConnect.xml
4. Test port: `Test-NetConnection 192.168.1.162 -Port 500`

### Connection Refused

**Cause**: MSFS not running or SimConnect not listening

**Fix**:
1. Start MSFS 2024 on sim PC (ai-pc)
2. Load into cockpit
3. Check if SimConnect.xml is being read (look in MSFS logs)
4. Verify port 500 is listening: `netstat -an | findstr :500`

### Data Still Mock

**Cause**: Connected but no data flowing

**Fix**:
1. Check server logs for SimConnect errors
2. Verify MSFS is actually in-flight (not just on menu)
3. Try toggling a simple control (gear) to test bidirectional
4. Restart server with verbose logging

---

## Network Diagram

```
Remote Browser/Device
        ↓
   HTTP/WebSocket
        ↓
SimGlass Server (ROCK-PC: 192.168.1.192:8080)
        ↓
   SimConnect Network Protocol
        ↓
SimConnect Port 500 (ai-pc: 192.168.1.162:500)
        ↓
  MSFS 2024 Running
```

---

## Alternative: Run Server on Sim PC

**Simpler option**: Move SimGlass server to the same PC as MSFS

1. Copy `simwidget-hybrid/` to ai-pc
2. Start server on ai-pc
3. Access from any device: `http://192.168.1.162:8080`
4. Local SimConnect (no network config needed)

**Advantages**:
- No network SimConnect configuration
- Lower latency
- Easier troubleshooting
- Same remote access capability

---

## Quick Test

```powershell
# On server PC (ROCK-PC), test if sim PC port 500 is open
Test-NetConnection -ComputerName 192.168.1.162 -Port 500 -InformationLevel Detailed
```

**If TcpTestSucceeded: True** → SimConnect is listening
**If TcpTestSucceeded: False** → Need to configure SimConnect.xml or firewall

Let me know the result and I'll help troubleshoot!
