#!/bin/bash
# AI Autopilot PREFLIGHT Command Monitor
# Watches for SET_AIRCRAFT_READY command in real-time

echo "========================================="
echo "  AI Autopilot PREFLIGHT Monitor"
echo "========================================="
echo ""
echo "Monitoring: http://192.168.1.42:8080/api/ai-autopilot/state"
echo "Waiting for PREFLIGHT phase and SET_AIRCRAFT_READY command..."
echo ""
echo "Instructions:"
echo "1. Load MSFS 2024 in cold & dark (engine off, chocks visible)"
echo "2. Enable AI Autopilot via browser or API"
echo "3. Watch this terminal for command activity"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo ""
echo "========================================="
echo ""

# Previous values for change detection
prev_phase=""
prev_log_count=0

while true; do
    # Fetch current state
    response=$(curl -s http://192.168.1.42:8080/api/ai-autopilot/state 2>/dev/null)

    if [ -z "$response" ]; then
        echo "[$(date +%H:%M:%S)] ⚠️  Server not responding..."
        sleep 2
        continue
    fi

    # Extract phase and command log
    phase=$(echo "$response" | grep -o '"phase":"[^"]*"' | cut -d'"' -f4)
    enabled=$(echo "$response" | grep -o '"enabled":[^,]*' | cut -d':' -f2)

    # Check if phase changed
    if [ "$phase" != "$prev_phase" ]; then
        if [ "$phase" = "PREFLIGHT" ]; then
            echo "[$(date +%H:%M:%S)] 🛫 PREFLIGHT phase started - watching for SET_AIRCRAFT_READY..."
        elif [ "$phase" = "TAXI" ]; then
            echo "[$(date +%H:%M:%S)] 🚕 TAXI phase - PREFLIGHT complete"
        else
            echo "[$(date +%H:%M:%S)] Phase: $phase"
        fi
        prev_phase="$phase"
    fi

    # Parse command log (last 5 entries)
    echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    log = data.get('commandLog', [])

    # Show last 5 commands
    for cmd in log[:5]:
        time_ms = cmd.get('time', 0)
        cmd_type = cmd.get('type', 'UNKNOWN')
        value = cmd.get('value', '')
        desc = cmd.get('description', '')

        # Highlight SET_AIRCRAFT_READY
        if cmd_type == 'SET_AIRCRAFT_READY':
            print(f\"  ✅ {cmd_type:20s} value={value} - {desc}\")
        else:
            print(f\"     {cmd_type:20s} value={value} - {desc}\")
except:
    pass
" 2>/dev/null

    # Check for SET_AIRCRAFT_READY specifically
    if echo "$response" | grep -q 'SET_AIRCRAFT_READY'; then
        echo ""
        echo "========================================="
        echo "  ✅ SET_AIRCRAFT_READY DETECTED!"
        echo "========================================="
        echo ""
        echo "Check MSFS for ground equipment removal:"
        echo "  - Chocks should be removed from wheels"
        echo "  - Wheel covers should disappear"
        echo "  - Pitot cover should be gone"
        echo "  - Ground power disconnected"
        echo ""

        # Show full command log
        echo "Full command history (last 10):"
        echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    log = data.get('commandLog', [])
    for i, cmd in enumerate(log[:10], 1):
        cmd_type = cmd.get('type', 'UNKNOWN')
        desc = cmd.get('description', '')
        marker = '→' if cmd_type == 'SET_AIRCRAFT_READY' else ' '
        print(f\"{i:2d}. {marker} {cmd_type:20s} - {desc}\")
except:
    pass
" 2>/dev/null

        echo ""
        echo "Monitor will continue running. Press Ctrl+C to exit."
        echo ""
    fi

    sleep 0.5
done
