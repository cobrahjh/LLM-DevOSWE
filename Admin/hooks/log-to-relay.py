#!/usr/bin/env python3
"""
PostToolUse Hook - Log Tool Calls to Relay
Logs all tool usage to Relay database for audit trail
"""

import json
import sys
import urllib.request
import urllib.error
from datetime import datetime

def log_to_relay(tool_name, tool_input, session_id):
    """Send tool usage log to Relay"""
    try:
        log_entry = {
            'type': 'tool_usage',
            'tool': tool_name,
            'input_summary': str(tool_input)[:200],  # Truncate for storage
            'session_id': session_id,
            'timestamp': datetime.now().isoformat(),
            'source': 'claude-code-hook'
        }

        data = json.dumps(log_entry).encode('utf-8')
        req = urllib.request.Request(
            'http://localhost:8600/api/logs',
            data=data,
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'HiveHook/1.0'
            },
            method='POST'
        )

        with urllib.request.urlopen(req, timeout=3) as resp:
            return True
    except urllib.error.HTTPError as e:
        # 404 is expected if endpoint doesn't exist yet
        if e.code == 404:
            return False
        return False
    except:
        return False

def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        # No input or invalid JSON - silently exit
        sys.exit(0)

    tool_name = input_data.get('tool_name', 'unknown')
    tool_input = input_data.get('tool_input', {})
    session_id = input_data.get('session_id', 'unknown')

    # Skip logging for certain tools to reduce noise
    skip_tools = ['Read', 'Glob', 'Grep']  # High-frequency, low-value logging

    if tool_name not in skip_tools:
        log_to_relay(tool_name, tool_input, session_id)

    # Exit 0 to allow tool to proceed
    sys.exit(0)

if __name__ == '__main__':
    main()
