# Intel System Quick Start

Get your automated intelligence system running in 5 minutes.

---

## Step 1: First Run (Manual)

Test the system manually to verify everything works:

```bash
cd C:\LLM-DevOSWE\Admin\intel-pollers

# 1. Collect fresh intel (takes ~30 seconds)
node daily-intel-curator.js --collect

# 2. View what was collected
node daily-intel-curator.js --report

# 3. Check current status
node intel-consumer.js --status
```

**Expected Output:**
- ~100 items collected from 6 sources
- AI analysis with relevance scores 0-100
- Status shows approved items from previous collections

---

## Step 2: Approve Items (Dashboard)

1. Open Hive Dashboard: http://localhost:8899
2. Scroll to "Intel" section
3. Click "Approve" on items you want to track
4. Recommended: Approve items with relevance ≥70

**OR use CLI:**
```bash
# Approve by ID
node daily-intel-curator.js --approve gh-1234567

# Reject by ID
node daily-intel-curator.js --reject hn-98765
```

---

## Step 3: Test Consumption

```bash
# Preview what would be auto-queued
node intel-consumer.js --auto --dry-run

# Generate briefing
node intel-consumer.js --brief

# View the briefing
notepad intel-briefing.md

# Full consumption (briefing + auto-queue)
node intel-consumer.js --consume
```

**Expected Output:**
- Briefing file created with categorized items
- High-priority items (≥85) auto-queued to Relay
- Consumption tracked in `intel-consumed.json`

---

## Step 4: Enable Automation (Scheduled Tasks)

```powershell
# Install Windows scheduled tasks
.\schedule-intel-consumption.ps1 -Install

# Verify installation
.\schedule-intel-consumption.ps1 -Status
```

**Schedule:**
- **Intel Collection**: Every 6 hours (3 AM, 9 AM, 3 PM, 9 PM)
- **Intel Consumption**: Daily at 8 AM

**Manual trigger:**
```powershell
schtasks /run /tn "Hive-IntelCollect"
schtasks /run /tn "Hive-IntelConsume"
```

---

## Daily Workflow

### Morning (8:00 AM) - Automated
1. Briefing auto-generates from last 7 days
2. High-priority items (≥85) auto-queue to Relay
3. Check email/Slack for notifications (future feature)

### Throughout Day - Manual
1. Review new intel at http://localhost:8899
2. Approve/reject items based on relevance
3. Your approvals flow into tomorrow's briefing

### Evening (Optional)
1. Review briefing: `notepad C:\LLM-DevOSWE\Admin\intel-pollers\intel-briefing.md`
2. Check task queue: http://localhost:8600
3. Implement high-value items

---

## API Integration

### From Claude Code / Terminal
```bash
# Get consumption status
curl http://localhost:3002/api/intel/curated/consumption-status

# Generate briefing
curl "http://localhost:3002/api/intel/curated/briefing?days=7"

# Auto-queue high-priority (dry run)
curl -X POST http://localhost:3002/api/intel/curated/auto-queue \
  -H "Content-Type: application/json" \
  -d '{"threshold": 85, "dryRun": true}'

# Full consumption
curl -X POST http://localhost:3002/api/intel/curated/consume
```

### From PowerShell
```powershell
# Check status
Invoke-RestMethod http://localhost:3002/api/intel/curated/consumption-status

# Get approved items
Invoke-RestMethod "http://localhost:3002/api/intel/curated?filter=approved"

# Trigger collection
Invoke-RestMethod -Method POST http://localhost:3002/api/intel/curated/collect
```

---

## Monitoring

### Dashboard
http://localhost:8899 - Intel section shows:
- Pending items for approval
- Approved items
- AI analysis and relevance scores

### Status Check
```bash
node intel-consumer.js --status
```

Shows:
- Last briefing date
- Last auto-queue date
- Total approved items
- Unqueued high-priority count

### Task Queue
http://localhost:8600/api/tasks - Shows all queued items

---

## Customization

### Change Auto-Queue Threshold
Edit `intel-consumer.js`:
```javascript
const CONFIG = {
    autoQueueThreshold: 90,  // Change from 85 to 90
};
```

### Change Briefing Period
```bash
# Last 14 days instead of 7
node intel-consumer.js --brief --days 14
```

### Add AI Insights
```bash
# Generate briefing with LLM insights
node intel-consumer.js --brief --llm
```

### Change Collection Frequency
Edit scheduled task:
```powershell
# Open Task Scheduler
taskschd.msc

# Modify "Hive-IntelCollect" triggers
# Default: Every 6 hours
# Change to: Every 3 hours, Daily, etc.
```

---

## Troubleshooting

### No items collected
**Check Oracle is running:**
```bash
curl http://localhost:3002/api/health
```

**Check Ollama is running:**
```bash
curl http://localhost:11434/api/tags
```

**Restart Oracle:**
```powershell
nssm restart HiveOracle
```

### Briefing empty
**Approve some items first:**
- Visit http://localhost:8899
- Approve 5-10 items
- Run `node intel-consumer.js --brief`

### Auto-queue not working
**Check Relay is running:**
```bash
curl http://localhost:8600/api/health
```

**Check threshold:**
```bash
# Preview what would queue
node intel-consumer.js --auto --dry-run
```

**Lower threshold if needed:**
```bash
node intel-consumer.js --auto --threshold 75
```

### Scheduled tasks not running
**Check task status:**
```powershell
.\schedule-intel-consumption.ps1 -Status
```

**View task history:**
- Open Task Scheduler (taskschd.msc)
- Navigate to Task Scheduler Library
- Find "Hive-IntelCollect" or "Hive-IntelConsume"
- Check "History" tab

---

## What's Next?

1. **Week 1**: Let automation run, review briefings daily
2. **Week 2**: Tune thresholds based on volume
3. **Week 3**: Start implementing queued items
4. **Week 4**: Review consumption patterns, adjust filters

**Future Features:**
- Email/Slack notifications
- Claude auto-implementation
- Trend detection
- Mobile app integration

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `node daily-intel-curator.js --collect` | Fetch intel now |
| `node intel-consumer.js --brief` | Generate briefing |
| `node intel-consumer.js --auto --dry-run` | Preview auto-queue |
| `node intel-consumer.js --consume` | Full consumption |
| `node intel-consumer.js --status` | Check status |
| `.\schedule-intel-consumption.ps1 -Status` | Task status |

| URL | Purpose |
|-----|---------|
| http://localhost:8899 | Hive Dashboard (approve/reject) |
| http://localhost:8600 | Relay (task queue) |
| http://localhost:3002/api/intel/curated/consumption-status | API status |

---

**Need help?** See full documentation in [README.md](README.md)
