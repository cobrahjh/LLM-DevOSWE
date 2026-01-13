# 🚀 SimWidget Engine - Complete Setup Guide

## What We've Built

### 1. **Core Engine** (Basic)
- SimConnect server that bridges MSFS to WebSocket
- Electron transparent overlay
- Flow Pro compatible API

### 2. **AI Co-Pilot** 
- Claude API integration for intelligent chat
- Voice recognition (speak commands!)
- Context-aware responses (knows your aircraft state)

### 3. **MCP Server** (NEW!)
- Lets Claude Desktop DIRECTLY control your sim
- No overlay needed - just chat with Claude!

---

## 🎮 Option A: Use MCP Server with Claude Desktop

**This is the EASIEST way** - Claude Desktop can control your sim directly!

### Setup:

1. **Install dependencies:**
```bash
cd "C:\LLM-DevOSWE\SimWidget Engine\mcp-server"
npm install
```

2. **Add to Claude Desktop config:**

Find your config file:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add this:
```json
{
  "mcpServers": {
    "simconnect": {
      "command": "node",
      "args": ["C:/LLM-DevOSWE/SimWidget Engine/mcp-server/index.js"]
    }
  }
}
```

3. **Restart Claude Desktop**

4. **Start MSFS**

5. **Talk to Claude!**
   - "What's my altitude?"
   - "Turn on all lights"
   - "Set autopilot altitude to 35000"
   - "Brief me for approach to KJFK"

---

## 🖥️ Option B: Use Full Overlay Engine

### Setup:

1. **Install everything:**
```bash
cd "C:\LLM-DevOSWE\SimWidget Engine"
install.bat
```

2. **Start MSFS**

3. **Run the server:**
```bash
start-server.bat
```

4. **Run the overlay:**
```bash
start-overlay.bat
```

---

## 🤖 Option C: AI Co-Pilot Chat Panel

The overlay includes an AI chat panel!

### Setup:

1. Get Claude API key from: https://console.anthropic.com/
2. Start the overlay
3. Press the 🤖 button
4. Enter your API key in settings
5. Chat with your co-pilot!

### Voice Commands:

1. Click 🎤 to start listening
2. Speak your command
3. AI processes and responds

---

## 📁 Project Structure

```
C:\LLM-DevOSWE\SimWidget Engine\
├── 📄 install.bat           ← Run this first!
├── 📄 start-server.bat      ← Start SimConnect bridge
├── 📄 start-overlay.bat     ← Start overlay window
│
├── 📁 server/               ← SimConnect WebSocket bridge
│   ├── package.json
│   └── index.js
│
├── 📁 overlay/              ← Electron transparent window
│   ├── package.json
│   ├── main.js
│   ├── preload.js
│   └── renderer/
│       ├── index.html
│       ├── engine.js        ← Widget runtime
│       ├── copilot-ui.js    ← AI chat panel
│       └── mini-widget.html
│
├── 📁 mcp-server/           ← Claude Desktop integration
│   ├── package.json
│   └── index.js
│
├── 📁 packages/
│   └── core/
│       └── agents.js        ← AI agent classes
│
└── 📁 widgets/              ← Widget plugins
    └── aircraft-control/    ← (Port our widget here)
```

---

## 🔧 Available Tools & Capabilities

### What Claude Can Do:

| Capability | How | Status |
|------------|-----|--------|
| Read sim data | MCP Server | ✅ Ready |
| Send commands | MCP Server | ✅ Ready |
| Search weather | Web Search | ✅ Ready |
| Chat as copilot | Claude API | ✅ Ready |
| Voice commands | Web Speech | ✅ Ready |
| Create widgets | This chat! | ✅ Ready |

### Example Commands You Can Ask Claude:

**In Claude Desktop (with MCP):**
- "Get my aircraft state"
- "What's my fuel status?"
- "Set heading to 180"
- "Toggle landing lights"

**In Overlay Chat:**
- "Brief me for the ILS 22L at JFK"
- "Am I configured for landing?"
- "What's the weather ahead?"

---

## 🌐 Real-Time Data Sources

I can search these RIGHT NOW:

- **Weather**: METAR, TAF from aviation weather sites
- **Airport Info**: Runways, frequencies, procedures
- **NOTAMs**: From FAA
- **Charts**: (Navigraph subscription required)
- **Flight Plans**: SimBrief integration possible

**Try asking me:**
- "What's the weather at KSFO?"
- "What are the ILS frequencies for runway 28R at SFO?"
- "Any NOTAMs for KLAX?"

---

## 🎯 Next Steps

### Immediate:
1. [ ] Test MCP server with Claude Desktop
2. [ ] Test overlay with MSFS running
3. [ ] Get Claude API key for co-pilot chat

### Soon:
1. [ ] Port Aircraft Control Widget to new engine
2. [ ] Add weather widget with real METAR
3. [ ] Create mini-widgets for key data

### Future:
1. [ ] SimBrief flight plan import
2. [ ] Multi-sim support (X-Plane)
3. [ ] Plugin marketplace
4. [ ] Mobile companion app

---

## ❓ Need Help?

Just ask me! I can:
- Explain how things work
- Fix bugs in the code
- Add new features
- Search for aviation info
- Answer flight sim questions

**Remember:** Add tasks to TODO.md anytime - I check it between steps!
