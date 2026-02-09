# Intel System - Automated Intelligence Gathering & Consumption

The Hive Intel System autonomously discovers, analyzes, and consumes tech intelligence from 100+ sources.

---

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│ Daily Intel     │ ───> │ Intel Consumer   │ ───> │ Relay Task      │
│ Curator         │      │ (Auto-Queue)     │      │ Queue           │
│                 │      │                  │      │                 │
│ - Fetch sources │      │ - Generate brief │      │ - Implementation│
│ - AI analyze    │      │ - Auto-queue     │      │ - Tracking      │
│ - Score 0-100   │      │ - Track consumed │      │                 │
└─────────────────┘      └──────────────────┘      └─────────────────┘
        │                         │
        │                         │
        v                         v
┌─────────────────────────────────────────────────┐
│  intel-curated.json                             │
│  - All items (pending, approved, rejected)      │
│  - AI analysis, relevance scores                │
│  - User decisions + timestamps                  │
└─────────────────────────────────────────────────┘
```

---

## Components

### 1. Daily Intel Curator (`daily-intel-curator.js`)

**Purpose**: Fetch, analyze, and present tech intelligence for approval

**Sources** (100+ items/day):
- Hacker News (top 30 stories)
- GitHub Trending (30 repos)
- GitHub Releases (9 watched repos)
- Reddit (5 subreddits: programming, LocalLLaMA, flightsim, node, selfhosted)
- Product Hunt (15 products)
- Dev.to (20 articles)

**AI Analysis**:
- Uses Ollama (qwen2.5-coder:7b) to score relevance 0-100
- Evaluates usefulness for Hive ecosystem
- Categorizes: tool, library, release, tutorial, news, other
- Auto-recommends items scoring ≥60

**CLI Usage**:
```bash
node daily-intel-curator.js --collect              # Fetch & analyze
node daily-intel-curator.js --collect --skip-analysis  # Fast mode
node daily-intel-curator.js --report               # View pending items
node daily-intel-curator.js --approve <id>         # Approve item
node daily-intel-curator.js --reject <id>          # Reject item
```

**API Endpoints** (via Oracle :3002):
- `GET /api/intel/curated?filter=pending|approved|recommended`
- `POST /api/intel/curated/collect?skipAnalysis=true`
- `POST /api/intel/curated/:id/approve`
- `POST /api/intel/curated/:id/reject`
- `POST /api/intel/curated/:id/implement` - Queue for implementation

### 2. Intel Consumer (`intel-consumer.js`)

**Purpose**: Automated consumption of approved intel

**Features**:
1. **Briefing Generation**
   - Aggregates approved items from last N days (default: 7)
   - Groups by category (tools, libraries, releases, etc.)
   - Highlights high-priority items (relevance ≥80)
   - Optional AI-generated insights
   - Outputs markdown briefing to `intel-briefing.md`

2. **Auto-Queueing**
   - Automatically queues high-priority items (relevance ≥85)
   - Creates tasks in Relay with full context
   - Tracks queued items to avoid duplicates
   - Dry-run mode for preview

3. **Consumption Tracking**
   - Stores consumption history in `intel-consumed.json`
   - Prevents duplicate processing
   - Provides status reporting

**CLI Usage**:
```bash
# Generate briefing
node intel-consumer.js --brief                     # Last 7 days
node intel-consumer.js --brief --days 14           # Last 14 days
node intel-consumer.js --brief --llm               # Add AI insights

# Auto-queue high-priority
node intel-consumer.js --auto                      # Threshold ≥85
node intel-consumer.js --auto --threshold 90       # Custom threshold
node intel-consumer.js --auto --dry-run            # Preview only

# Full consumption
node intel-consumer.js --consume                   # Briefing + auto-queue

# Status
node intel-consumer.js --status                    # Show consumption stats
```

**API Endpoints** (via Oracle :3002):
- `GET /api/intel/curated/briefing?days=7&llm=true`
- `POST /api/intel/curated/auto-queue` - body: `{threshold: 85, dryRun: false}`
- `POST /api/intel/curated/consume` - Full consumption
- `GET /api/intel/curated/consumption-status`

### 3. Scheduled Automation (`schedule-intel-consumption.ps1`)

**Purpose**: Windows Task Scheduler setup for automated execution

**Tasks Created**:
1. **Hive-IntelCollect** - Every 6 hours (3 AM, 9 AM, 3 PM, 9 PM)
   - Runs: `node daily-intel-curator.js --collect`
   - Fetches and analyzes new intel

2. **Hive-IntelConsume** - Daily at 8 AM
   - Runs: `node intel-consumer.js --consume`
   - Generates briefing and auto-queues high-priority items

**Setup**:
```powershell
# Install tasks
.\schedule-intel-consumption.ps1 -Install

# Check status
.\schedule-intel-consumption.ps1 -Status

# Uninstall tasks
.\schedule-intel-consumption.ps1 -Uninstall

# Manual trigger
schtasks /run /tn "Hive-IntelCollect"
schtasks /run /tn "Hive-IntelConsume"
```

---

## Workflow

### Daily Routine (Automated)

1. **3 AM, 9 AM, 3 PM, 9 PM**: Intel Collection
   - Fetch from all sources
   - AI analyzes each item
   - Saves to `intel-curated.json`
   - Items await your approval

2. **8 AM**: Intel Consumption
   - Generates briefing from approved items (last 7 days)
   - Auto-queues items with relevance ≥85
   - Updates consumption tracking

3. **Throughout Day**: Manual Review
   - View pending intel in Hive Dashboard (http://localhost:8899)
   - Approve/reject items based on AI recommendations
   - Approved items flow into next day's briefing

### Manual Workflow

```bash
# Morning routine
node intel-consumer.js --consume        # Generate briefing + auto-queue
cat intel-briefing.md                   # Review briefing

# Approve high-value items
# Visit http://localhost:8899 and click approve/reject

# Queue specific item manually
curl -X POST http://localhost:3002/api/intel/curated/gh-123456/implement

# Check task queue
curl http://localhost:8600/api/tasks
```

---

## Configuration

Edit `daily-intel-curator.js`:
```javascript
const CONFIG = {
    maxItemsPerSource: 30,    // Items per source
    maxTotalItems: 100,       // Total items to process
    relevanceThreshold: 60    // Auto-recommend threshold
};
```

Edit `intel-consumer.js`:
```javascript
const CONFIG = {
    autoQueueThreshold: 85,   // Auto-queue threshold
    briefingDays: 7,          // Days to include in briefing
};
```

---

## Data Files

| File | Purpose |
|------|---------|
| `intel-curated.json` | All items with AI analysis and user decisions |
| `intel-consumed.json` | Consumption tracking (briefings, queued items) |
| `intel-briefing.md` | Latest generated briefing |

---

## Integration Points

### Hive Dashboard (http://localhost:8899)
- Intel section shows pending/approved items
- One-click approve/reject buttons
- Displays AI analysis and relevance scores

### Relay Task Queue (http://localhost:8600)
- Auto-queued items appear as tasks
- Source: "intel-curator"
- Metadata includes intelId, category
- Priority: "high" if relevance ≥80

### Daily Status Report
- Includes consumption status
- Shows unqueued high-priority count
- Tracked via `scripts/update-daily-report.js`

---

## Monitoring

### Check System Health
```bash
# Consumption status
curl http://localhost:3002/api/intel/curated/consumption-status

# Pending approvals
curl "http://localhost:3002/api/intel/curated?filter=pending"

# Task queue
curl http://localhost:8600/api/tasks

# Scheduled tasks
.\schedule-intel-consumption.ps1 -Status
```

### Logs
- Intel collection: Task Scheduler history (taskschd.msc)
- Oracle logs: Check Oracle service console
- Relay logs: Check Relay service console

---

## Example Output

### Briefing (`intel-briefing.md`)
```markdown
# Hive Intel Briefing
**Generated**: 2026-02-09 8:00 AM
**Period**: Last 7 days (12 approved items)

## Executive Summary
- **New Tools**: 3 items
- **Libraries & SDKs**: 4 items
- **Software Releases**: 5 items

⭐ **4 high-priority items** (relevance ≥ 80)

## New Tools

### 🔴 Sherlock - LLM API Traffic Monitor
**Source**: GitHub Trending | **Relevance**: 92/100

Python tool that intercepts LLM API traffic and visualizes token usage...

**Analysis**: Very useful for Hive cost tracking and debugging...

**URL**: https://github.com/...

**Status**: ✅ Queued for implementation

---
```

### Auto-Queue Output
```bash
$ node intel-consumer.js --auto

🤖 Auto-queueing items with relevance >= 85...
  Found 3 items to queue
  📋 Queueing: Sherlock - LLM Monitor (92)
     ✅ Queued successfully
  📋 Queueing: LuxTTS Voice Cloning (88)
     ✅ Queued successfully
  ⏭️  Skipping: OpenClaw AI Assistant (87) (already queued)

✅ Auto-queue complete: 2/3 items queued
```

---

## Best Practices

1. **Review daily**: Check Hive Dashboard each morning
2. **Approve strategically**: Focus on high-relevance items (≥70)
3. **Monitor queue**: Check Relay task queue weekly
4. **Tune thresholds**: Adjust auto-queue threshold based on volume
5. **Read briefings**: Weekly briefing review for strategic insights

---

## Troubleshooting

**No intel collected**:
- Check Oracle is running (port 3002)
- Verify internet connection
- Check Ollama is running (port 11434)

**Auto-queue not working**:
- Check Relay is running (port 8600)
- Verify scheduled task is enabled
- Check `intel-consumed.json` for errors

**Briefing empty**:
- Approve some items first
- Check days parameter (default: 7)
- Verify items have `decidedAt` timestamp

**API errors**:
```bash
# Restart Oracle
nssm restart HiveOracle

# Check logs
curl http://localhost:3002/api/health
```

---

## Future Enhancements

- [ ] Email briefing delivery
- [ ] Slack notifications for high-priority items
- [ ] AI-powered summaries using Claude
- [ ] Topic clustering and trend detection
- [ ] Integration with MEMORY.md auto-updates
- [ ] Mobile app notifications
- [ ] Weekly digest with implementation metrics
