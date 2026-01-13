# SimWidget Engine - Minimum Requirements
**Version: v1.0.0**  
**Last updated: 2026-01-06**

---

## Hardware Requirements

### Minimum
| Component | Requirement |
|-----------|-------------|
| **CPU** | Intel i5-8400 / AMD Ryzen 5 2600 or equivalent |
| **RAM** | 16 GB |
| **GPU** | GTX 1060 6GB / RX 580 8GB |
| **Storage** | 500 MB free (SimWidget only) |
| **Display** | 1920x1080 minimum |
| **Network** | Required for multi-PC setup |

### Recommended
| Component | Requirement |
|-----------|-------------|
| **CPU** | Intel i7-10700 / AMD Ryzen 7 3700X or better |
| **RAM** | 32 GB |
| **GPU** | RTX 3070 / RX 6800 or better |
| **Storage** | SSD recommended |
| **Display** | 2560x1440 or multi-monitor |

---

## Software Requirements

### Required
| Software | Version | Notes |
|----------|---------|-------|
| **Windows** | 10 (1903+) or 11 | 64-bit only |
| **Microsoft Flight Simulator** | 2024 | MSFS 2020 may work with limitations |
| **Node.js** | 18.x LTS or newer | Required for server |
| **npm** | 9.x+ | Comes with Node.js |

### Optional (Enhanced Features)
| Software | Purpose |
|----------|---------|
| **ChasePlane** | Advanced camera control |
| **AutoHotkey v2** | Camera helper scripts |
| **Claude Desktop** | MCP server integration |

---

## Network Requirements

### Single PC Setup
- No network requirements
- Server and overlay run locally
- Access via `localhost:8080`

### Multi-PC Setup
| Requirement | Details |
|-------------|---------|
| **LAN Connection** | Both PCs on same network |
| **Port 8080** | Must be open/forwarded on server PC |
| **Static IP** | Recommended for server PC |
| **Firewall** | Allow Node.js through Windows Firewall |

### Port Usage
| Port | Service |
|------|---------|
| **8080** | HTTP + WebSocket server (required) |
| **8484** | Legacy WebSocket (optional) |

---

## MSFS Requirements

### SimConnect
- Automatically installed with MSFS 2024
- No additional setup required
- `node-simconnect` package handles connection

### Permissions
- MSFS must be running before starting SimWidget server
- Developer mode NOT required
- Third-party software must be allowed in MSFS settings

---

## Installation Dependencies

### npm Packages (Auto-installed)
```
express          - Web server
ws               - WebSocket support
node-simconnect  - MSFS SimConnect bridge
```

### System Dependencies
- Visual C++ Redistributable 2019+ (usually pre-installed)
- .NET Framework 4.7.2+ (for SimConnect)

---

## Browser Compatibility

### Overlay/UI
| Browser | Support |
|---------|---------|
| **Electron** | ✅ Full (built-in overlay) |
| **Chrome** | ✅ Full |
| **Edge** | ✅ Full |
| **Firefox** | ⚠️ Limited (some WebSocket issues) |

### MSFS In-Game Panel
- Uses Coherent GT (Chromium-based)
- Full compatibility with SimWidget UI

---

## Performance Considerations

### Server PC (MSFS Host)
- SimWidget server uses ~50-100 MB RAM
- CPU usage: <2% typical
- Network: ~10-50 KB/s per connected client

### Client PC (Overlay Only)
- Electron overlay: ~150-300 MB RAM
- Browser client: ~100-200 MB RAM
- Minimal CPU usage

### Update Rates
| Data Type | Default Rate | Adjustable |
|-----------|--------------|------------|
| Position/Speed | 10 Hz | Yes |
| Autopilot | 5 Hz | Yes |
| Lights/Systems | 2 Hz | Yes |
| Fuel/Engine | 1 Hz | Yes |

---

## Known Limitations

### Current Version
- Windows only (no Mac/Linux)
- MSFS 2024 primary target (2020 partial support)
- Single sim instance per server
- English UI only (currently)

### SimConnect Limitations
- Some SimVars read-only
- Event execution may have slight delay
- Connection lost if MSFS restarts

---

## Troubleshooting Checklist

### Server Won't Start
- [ ] Node.js installed and in PATH
- [ ] Port 8080 not in use (`netstat -ano | findstr 8080`)
- [ ] Run from correct directory

### SimConnect Won't Connect
- [ ] MSFS running and loaded into flight
- [ ] Not in main menu (must be in aircraft)
- [ ] node-simconnect installed (`npm install`)

### Multi-PC Connection Failed
- [ ] Firewall allows Node.js
- [ ] Correct IP address configured
- [ ] Port 8080 forwarded on router (if needed)
- [ ] Both PCs on same subnet

### Camera Controls Not Working
- [ ] ChasePlane running (if using CP mode)
- [ ] AutoHotkey v2 installed (for AHK helper)
- [ ] AHK script running (check tray)

---

## Quick Start Verification

Run this command to verify requirements:

```powershell
# Check Node.js
node --version  # Should be v18+

# Check npm
npm --version   # Should be v9+

# Check port availability
netstat -ano | findstr :8080  # Should be empty

# Test SimConnect (with MSFS running)
cd C:\LLM-DevOSWE\SimWidget_Engine\simwidget-hybrid\backend
node -e "require('node-simconnect')"  # Should not error
```

---

## Support

- **Documentation:** `C:\LLM-DevOSWE\SimWidget_Engine\docs\`
- **TODO/Issues:** `C:\LLM-DevOSWE\SimWidget_Engine\TODO.md`
- **Project Knowledge:** `C:\LLM-DevOSWE\PROJECT-KNOWLEDGE.md`
