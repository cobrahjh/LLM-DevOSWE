# PM Reference Guide - SimWidget Engine

## Development Terminology Cheat Sheet

### When Requesting Changes

| **Use This** | **When You Want** | **Example** |
|--------------|-------------------|-------------|
| **Update** | Make something current with latest changes | "Update the dashboard page" |
| **Sync** | Align with backend/data changes | "Sync the UI with server status" |
| **Refresh** | Real-time data updates | "Refresh the widget telemetry" |
| **Refactor** | Restructure code (same functionality, better structure) | "Refactor the connection handling" |
| **Enhance** | Add new features/improve existing ones | "Enhance the error handling" |
| **Fix/Debug** | Resolve bugs or issues | "Fix the widget connection timeout" |
| **Implement** | Build new functionality | "Implement dark mode toggle" |
| **Optimize** | Improve performance | "Optimize the data polling" |

### SimWidget Engine Architecture Quick Reference

#### Project Structure
```
C:\LLM-DevOSWE\SimWidget_Engine\
├── simwidget-hybrid/          # Main application (port 8080)
│   ├── public/               # Frontend files
│   ├── src/                  # Backend Node.js code
│   └── package.json          # Dependencies
└── Admin/                    # Admin tools & scripts
```

#### Key Components
- **Frontend**: HTML/CSS/JavaScript (public/ folder)
- **Backend**: Node.js/Express server (src/ folder)
- **WebSocket**: Real-time communication with MSFS 2024
- **SimConnect**: Microsoft Flight Simulator integration

#### Common Development Tasks

| **Task** | **What to Ask For** |
|----------|-------------------|
| Add new widget | "Implement a new [widget type] widget" |
| Fix connection issues | "Debug the SimConnect connection handling" |
| Update UI layout | "Update the dashboard layout to include [feature]" |
| Performance issues | "Optimize the data polling frequency" |
| New data display | "Sync the UI to show [aircraft parameter]" |
| Visual improvements | "Enhance the widget styling for better readability" |

### Development Commands Reference

#### SimWidget Server Control
- `simwidget_control start` - Start the server
- `simwidget_control stop` - Stop the server  
- `simwidget_control restart` - Restart the server
- `simwidget_control status` - Check server status
- `simwidget_control test` - Run connectivity tests

#### Git Operations
- `git_sync "message"` - Commit and push changes

### Testing & Validation

#### Quick Tests to Request
1. **"Test the server connectivity"** - Verify SimWidget is running
2. **"Sync the widget data"** - Ensure real-time updates work
3. **"Update the admin dashboard"** - Refresh management interface
4. **"Debug connection status"** - Check MSFS integration

### Communication Best Practices

#### Clear Request Format
```
Action + Component + Desired Outcome
"Update the telemetry widget to display engine temperatures"
"Sync the dashboard with current flight data" 
"Fix the connection timeout in widget initialization"
```

#### Priority Indicators
- **Critical**: Breaks core functionality
- **High**: Impacts user experience  
- **Medium**: Enhancement/improvement
- **Low**: Nice-to-have features

### Troubleshooting Quick Reference

| **Issue** | **Request This** |
|-----------|------------------|
| Widgets not updating | "Debug the WebSocket connection" |
| MSFS not connecting | "Fix the SimConnect integration" |
| UI looks wrong | "Update the CSS styling" |
| Performance slow | "Optimize the data processing" |
| Server won't start | "Debug the server startup sequence" |

### Development Environment
- **OS**: Windows (Harold-PC)
- **Server Port**: 8080
- **Tools**: PowerShell, Node.js, Git
- **Target**: Microsoft Flight Simulator 2024

---
*Last Updated: [Current Date]*
*For technical questions, tag Kitt AI assistant*