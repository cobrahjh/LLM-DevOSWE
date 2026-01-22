#!/usr/bin/env python3
"""
SessionStart Hook - Inject Hive Context
Runs at session start to provide Hive status to Claude
"""

import json
import sys
import urllib.request
import urllib.error

def check_service(url, name):
    """Check if a service is healthy"""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'HiveHook/1.0'})
        with urllib.request.urlopen(req, timeout=3) as resp:
            return f"[OK] {name}"
    except:
        return f"[!!] {name} OFFLINE"

def get_mcp_status():
    """Get MCP Bridge status"""
    try:
        req = urllib.request.Request(
            'http://localhost:8860/api/status',
            headers={'User-Agent': 'HiveHook/1.0'}
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            summary = data.get('summary', {})
            return f"MCP: {summary.get('online', 0)}/{summary.get('total', 0)} servers online"
    except:
        return "MCP: Bridge offline"

def get_pending_messages():
    """Check for pending relay messages"""
    try:
        req = urllib.request.Request(
            'http://localhost:8600/api/messages/pending',
            headers={'User-Agent': 'HiveHook/1.0'}
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            messages = data.get('messages', [])
            if messages:
                return f"PENDING MESSAGES: {len(messages)} awaiting response"
            return None
    except:
        return None

def main():
    # Build context string
    context_parts = ["=== HIVE STATUS ==="]

    # Check core services
    services = [
        ('http://localhost:8600/api/health', 'Relay :8600'),
        ('http://localhost:3002/api/health', 'Oracle :3002'),
        ('http://localhost:8860/api/health', 'MCP Bridge :8860'),
        ('http://localhost:8500/api/health', 'Master O :8500'),
    ]

    for url, name in services:
        context_parts.append(check_service(url, name))

    # MCP status
    context_parts.append(get_mcp_status())

    # Check pending messages
    pending = get_pending_messages()
    if pending:
        context_parts.append(f"\n!!! {pending} !!!")

    # Output context (stdout is added to Claude's context)
    print('\n'.join(context_parts))
    sys.exit(0)

if __name__ == '__main__':
    main()
