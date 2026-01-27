# Remote Development Setup Guide v1.0.0

Access Harold-PC dev environment from phone/anywhere.

**Path:** C:\LLM-DevOSWE\SimWidget_Engine\Admin\REMOTE-DEV-SETUP.md  
**Last Updated:** 2025-01-08

---

## Option 1: Chrome Remote Desktop (Easiest)

### Setup on Harold-PC

1. Open Chrome browser
2. Go to: https://remotedesktop.google.com/access
3. Click **Set up remote access**
4. Download and install Chrome Remote Desktop host
5. Name computer: `Harold-PC`
6. Create a PIN (6+ digits)

### Access from Phone

1. Install **Chrome Remote Desktop** app (iOS/Android)
2. Sign in with same Google account
3. Tap `Harold-PC` → Enter PIN
4. Full desktop access!

### Usage with Claude

1. Phone Screen 1: Chrome Remote Desktop (Harold-PC)
2. Phone Screen 2: Claude app (chat)
3. I provide commands → you paste/run on Harold-PC

---

## Option 2: Web Terminal (code-server)

VS Code accessible from any browser - full IDE on phone.

### Setup on Harold-PC (PowerShell Admin)

```powershell
# Install code-server
winget install coder.code-server

# Or via npm
npm install -g code-server
```

### Configure

Create config file: `C:\Users\Harold\.config\code-server\config.yaml`

```yaml
bind-addr: 0.0.0.0:8443
auth: password
password: YOUR_SECURE_PASSWORD
cert: false
```

### Start code-server

```powershell
code-server --open "C:\LLM-DevOSWE\SimWidget_Engine"
```

### Access from Phone

1. Open browser on phone
2. Go to: `http://192.168.1.192:8443` (Harold-PC IP)
3. Enter password
4. Full VS Code in browser!

### Auto-Start (Optional)

Create: `C:\LLM-DevOSWE\SimWidget_Engine\Admin\start-code-server.bat`

```batch
@echo off
code-server "C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid"
```

Add to Windows Task Scheduler for startup.

---

## Option 3: SSH + Terminal (Advanced)

### Enable OpenSSH on Harold-PC

```powershell
# PowerShell Admin
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
```

### Access from Phone

1. Install **Termius** or **JuiceSSH** app
2. Connect to: `harold@192.168.1.192`
3. Full terminal access

---

## Firewall Rules (if needed)

```powershell
# Allow code-server (port 8443)
New-NetFirewallRule -DisplayName "code-server" -Direction Inbound -Port 8443 -Protocol TCP -Action Allow

# Allow SSH (port 22)
New-NetFirewallRule -DisplayName "SSH" -Direction Inbound -Port 22 -Protocol TCP -Action Allow
```

---

## Recommended Workflow

### From Phone:

```
┌─────────────────────┐     ┌─────────────────────┐
│   Claude App        │     │  Remote Desktop     │
│   (Chat with Kit)   │ ←→  │  OR code-server     │
│                     │     │  (Run commands)     │
└─────────────────────┘     └─────────────────────┘
```

1. Chat with Claude for guidance/code
2. Switch to remote access
3. Paste commands / edit files
4. Run `sync.bat` to push to GitHub

### Quick Commands to Run Remotely:

```powershell
# Start SimWidget server
cd C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid
npm run dev

# Sync to GitHub
.\tools\sync.bat

# Run tests
npm test

# Check server status
.\tools\status.bat
```

---

## Security Notes

- Use strong passwords
- code-server: Consider enabling HTTPS for external access
- For access outside home network: Set up VPN or use Tailscale
- Chrome Remote Desktop uses Google auth (secure)

---

## Tailscale (Access from Anywhere)

Free VPN for accessing home network from anywhere.

### Setup

1. Install on Harold-PC: https://tailscale.com/download
2. Install on phone: Tailscale app
3. Sign in with same account on both
4. Harold-PC gets address like: `100.x.x.x`

### Access

From phone (on Tailscale):
- code-server: `http://100.x.x.x:8443`
- SSH: `ssh harold@100.x.x.x`

Works from anywhere - coffee shop, office, etc.
