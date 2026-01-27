#!/usr/bin/env python3
"""
SessionStart Hook - Inject Hive Context
Queries Hive State database for targeted context injection.
Replaces static file loading with smart, task-relevant context.
"""

import json
import sys
import urllib.request
import urllib.error
import urllib.parse

RELAY_URL = 'http://localhost:8600'

def get_hive_context(task='', scope='minimal'):
    """Query smart context endpoint"""
    try:
        params = urllib.parse.urlencode({'task': task, 'scope': scope})
        url = f'{RELAY_URL}/api/hive/context?{params}'
        req = urllib.request.Request(url, headers={'User-Agent': 'HiveHook/2.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            return data.get('context', '')
    except:
        return None

def get_pending_messages():
    """Check for pending relay messages"""
    try:
        req = urllib.request.Request(
            f'{RELAY_URL}/api/messages/pending',
            headers={'User-Agent': 'HiveHook/2.0'}
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            messages = data.get('messages', [])
            if messages:
                return f"PENDING MESSAGES: {len(messages)} awaiting response"
            return None
    except:
        return None

def fallback_status():
    """Fallback: basic health checks if Hive State DB unavailable"""
    parts = ["=== HIVE STATUS (fallback) ==="]
    services = [
        (f'{RELAY_URL}/api/health', 'Relay :8600'),
        ('http://localhost:3002/api/health', 'Oracle :3002'),
        ('http://localhost:8860/api/health', 'MCP Bridge :8860'),
        ('http://localhost:8500/api/health', 'Master O :8500'),
    ]
    for url, name in services:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'HiveHook/2.0'})
            with urllib.request.urlopen(req, timeout=3) as resp:
                parts.append(f"[OK] {name}")
        except:
            parts.append(f"[!!] {name} OFFLINE")
    return '\n'.join(parts)

def main():
    # Try to read task from stdin (Claude Code may pass session info)
    task = ''
    try:
        input_data = json.load(sys.stdin)
        task = input_data.get('task', input_data.get('prompt', ''))
    except:
        pass

    # Try smart context from Hive State DB
    context = get_hive_context(task=task, scope='minimal')

    if context:
        print(context.strip())
    else:
        # Fallback to basic health checks
        print(fallback_status())

    # Always check pending messages separately (important alert)
    pending = get_pending_messages()
    if pending:
        print(f"\n!!! {pending} !!!")

    sys.exit(0)

if __name__ == '__main__':
    main()
