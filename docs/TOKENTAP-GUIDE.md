# Tokentap - LLM Token Usage Monitor

**Formerly known as Sherlock**

Real-time monitoring and visualization of LLM API token usage for cost tracking and optimization.

---

## What is Tokentap?

Tokentap is a Python CLI tool that intercepts LLM API traffic and displays token usage in a real-time terminal dashboard. It acts as an HTTP proxy between your application and LLM providers (Anthropic, OpenAI, etc.), capturing and analyzing all API calls.

### Key Features

- 📊 **Real-time Dashboard** - Live token usage visualization
- 💰 **Cost Tracking** - Monitor API costs in real-time
- 📈 **Fuel Gauge** - Color-coded progress (green→yellow→red)
- 💾 **Prompt Logging** - Saves all prompts as markdown/JSON
- 🔍 **Context Analysis** - Track context window usage
- 🚫 **No Certificates** - Works without SSL certificate configuration

---

## Installation

**Requirements:** Python 3.10+

```bash
pip install tokentap
```

**Verify installation:**
```bash
tokentap --help
```

---

## Usage

### Basic Workflow

**Terminal 1 - Start Dashboard:**
```bash
tokentap start
```

**Terminal 2 - Run Claude Code through proxy:**
```bash
tokentap claude
```

**How it works:**
1. Tokentap starts HTTP proxy on localhost:8080
2. Sets `ANTHROPIC_BASE_URL` to point to proxy
3. All Claude Code API calls flow through proxy
4. Dashboard shows real-time token usage

### Command Reference

| Command | Purpose |
|---------|---------|
| `tokentap start` | Launch proxy and dashboard |
| `tokentap start -p 8081` | Use custom port (default: 8080) |
| `tokentap start -l 500000` | Set token limit for gauge (default: 200,000) |
| `tokentap claude` | Run Claude Code with proxy |
| `tokentap codex` | Run OpenAI Codex with proxy |
| `tokentap run --provider anthropic <cmd>` | Run any command with proxy |

---

## Integration with Hive

### Monitoring Claude Code Sessions

**Start monitoring:**
```bash
# Terminal 1
tokentap start -l 1000000

# Terminal 2
tokentap claude
```

This tracks:
- Token usage per conversation turn
- Cumulative session tokens
- Cost estimates
- Context window usage (approaching 1M limit)

### Monitoring Oracle LLM Backend

To monitor Oracle's LLM calls (OpenAI, Anthropic, etc.):

```bash
# Terminal 1
tokentap start -p 8081

# Terminal 2
# Set Oracle to use proxy
export ANTHROPIC_BASE_URL=http://localhost:8081
export OPENAI_BASE_URL=http://localhost:8081

# Restart Oracle
cd C:\LLM-Oracle
node oracle.js
```

All Oracle LLM calls will now be monitored.

### Monitoring Multiple Services

Run multiple Tokentap instances on different ports:

```bash
# Claude Code monitoring (port 8080)
tokentap start

# Oracle monitoring (port 8081)
tokentap start -p 8081

# Hive Agent monitoring (port 8082)
tokentap start -p 8082
```

---

## Dashboard Features

### Real-time Display

```
┌─ Token Usage ─────────────────────────────┐
│ [████████████░░░░░░░░] 65% (650K/1M)      │
│                                            │
│ Recent Requests:                           │
│ 15:23:45 anthropic claude-4.5  12,543     │
│ 15:24:01 anthropic claude-4.5   8,127     │
│ 15:24:15 anthropic claude-4.5  15,892     │
│                                            │
│ Last Prompt:                               │
│ "Implement automated intel consumption..." │
└────────────────────────────────────────────┘
```

### Color Coding

- 🟢 **Green** (0-50%) - Safe zone
- 🟡 **Yellow** (50-80%) - Approaching limit
- 🔴 **Red** (80-100%) - Near token limit

### Session Summary

On exit (Ctrl+C), shows:
- Total tokens consumed
- Total requests made
- Average tokens per request
- Time elapsed

---

## Saved Logs

Tokentap saves all intercepted traffic to a user-selected directory:

**Files created:**
- `request_YYYYMMDD_HHMMSS.md` - Prompt text (markdown)
- `request_YYYYMMDD_HHMMSS.json` - Full API payload
- `response_YYYYMMDD_HHMMSS.json` - API response

**Use cases:**
- Review expensive prompts
- Analyze token usage patterns
- Debug API issues
- Audit LLM conversations

---

## Hive Use Cases

### 1. Cost Optimization

Track which Hive services consume the most tokens:
- Oracle LLM backend
- Copilot glass
- Voice transcription
- Intel briefing generation

**Action:** Optimize prompts for high-usage services.

### 2. Context Window Management

Monitor Claude Code sessions approaching 1M token limit:
- Real-time fuel gauge shows 65% = 650K tokens used
- Warning at 80% (800K tokens)
- Plan context compression before hitting limit

### 3. Prompt Engineering

Review saved logs to:
- Identify verbose prompts
- Find redundant context
- Optimize system prompts
- Reduce unnecessary tokens

### 4. API Cost Tracking

Calculate monthly costs by:
1. Monitor total tokens per day
2. Calculate cost: `tokens * $0.015 / 1M` (Claude 4.5 input)
3. Track trends over time
4. Set budget alerts

### 5. Multi-Agent Coordination

When running multiple AI agents:
- Track tokens per agent
- Identify chatty agents
- Balance workload
- Prevent runaway token consumption

---

## Configuration

### Custom Port

Avoid conflicts with other services:
```bash
tokentap start -p 9090
tokentap run --provider anthropic -p 9090 claude
```

### Token Limit

Set appropriate context limit:
```bash
# Claude 4.5 (1M context)
tokentap start -l 1000000

# Claude 4.6 Opus (1M context)
tokentap start -l 1000000

# GPT-4 (128K context)
tokentap start -l 128000
```

### Log Directory

Choose save location when prompted:
```
Where should tokentap save logs?
> C:\LLM-DevOSWE\logs\tokentap\
```

---

## Troubleshooting

### Port Already in Use

```bash
# Error: Address already in use
# Solution: Use different port
tokentap start -p 8085
```

### Proxy Not Working

**Check environment variable:**
```bash
echo $ANTHROPIC_BASE_URL
# Should show: http://localhost:8080
```

**Set manually if needed:**
```bash
export ANTHROPIC_BASE_URL=http://localhost:8080
claude
```

### Dashboard Not Updating

1. Verify proxy is running (Terminal 1)
2. Ensure Claude Code uses proxy (Terminal 2)
3. Make an API call to test
4. Check for errors in proxy terminal

---

## Best Practices

### Daily Monitoring

**Morning routine:**
```bash
# Start Tokentap before Claude Code session
tokentap start -l 1000000 &
tokentap claude
```

### Weekly Review

1. Analyze saved logs
2. Identify high-token prompts
3. Optimize expensive operations
4. Calculate weekly costs

### Budget Alerts

Monitor fuel gauge:
- Green zone: Normal operation
- Yellow zone: Review session context
- Red zone: Consider compressing or resetting

### Multi-Session Tracking

Create separate log directories per project:
```bash
tokentap start  # Saves to: ~/tokentap-logs/hive/
tokentap start  # Saves to: ~/tokentap-logs/simglass/
```

---

## Integration with Hive Dashboard

**Future enhancement:**
Create Hive Dashboard widget showing:
- Real-time token usage across all services
- Daily/weekly/monthly costs
- Top token consumers
- Budget tracking and alerts

**Implementation:**
1. Parse Tokentap JSON logs
2. Aggregate metrics per service
3. Display in Hive Dashboard at http://localhost:8899
4. Set up alerts via Relay

---

## Performance Impact

- **Latency:** ~10-20ms added per request (negligible)
- **Memory:** ~50MB for proxy process
- **CPU:** Minimal (<1% on modern systems)
- **Disk:** Log files (~1KB per request)

**Recommendation:** Safe to run continuously for all LLM work.

---

## Supported Providers

| Provider | Command | Status |
|----------|---------|--------|
| Anthropic (Claude) | `tokentap claude` | ✅ Fully supported |
| OpenAI (Codex) | `tokentap codex` | ✅ Fully supported |
| Google (Gemini) | `tokentap gemini` | ⚠️ Blocked by OAuth issue |

---

## Example Session

```bash
# Terminal 1: Start monitoring
$ tokentap start -l 1000000
Tokentap proxy started on http://localhost:8080
Token limit: 1,000,000
Logs saved to: C:\LLM-DevOSWE\logs\tokentap\

[Dashboard shows 0% usage initially]

# Terminal 2: Run Claude Code
$ tokentap claude
Claude Code v1.5.0
>

# Dashboard updates in real-time as you work
[████░░░░░░] 40% (400K/1M)  <- After 1 hour of coding

# Exit Claude Code (Ctrl+D)
# Dashboard shows session summary:

Session Summary:
- Duration: 1h 23m
- Total tokens: 423,891
- Requests: 47
- Avg per request: 9,019
- Estimated cost: $6.36

Logs saved to:
  C:\LLM-DevOSWE\logs\tokentap\2026-02-09\
```

---

## Quick Reference

```bash
# Start monitoring
tokentap start

# Run Claude Code with monitoring
tokentap claude

# Custom port
tokentap start -p 8081

# High context limit (Claude 4.5/4.6)
tokentap start -l 1000000

# Monitor any command
tokentap run --provider anthropic <command>
```

---

## Resources

- **GitHub**: https://github.com/jmuncor/tokentap
- **PyPI**: https://pypi.org/project/tokentap/
- **Issues**: https://github.com/jmuncor/tokentap/issues

---

**Last Updated**: 2026-02-09
**Status**: ✅ Installed and ready for use
**Location**: `C:\Python314\Lib\site-packages\tokentap\`
