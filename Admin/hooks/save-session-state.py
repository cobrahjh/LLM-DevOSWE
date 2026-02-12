#!/usr/bin/env python3
"""
Stop Hook - Save Session State to HiveStore
Captures working context (git status, modified files, current task summary)
and stores it in Relay so it survives context compaction and new sessions.

Writes to: POST /api/conversations/{session_id} with role=system
Reads by:  inject-hive-context.py on SessionStart
"""

import json
import sys
import os
import subprocess
import urllib.request
import urllib.error
from datetime import datetime

RELAY_URL = 'http://localhost:8600'
REPO_ROOT = 'C:/LLM-DevOSWE/simwidget-hybrid'
MEMORY_DIR = 'C:/Users/Stone-PC/.claude/projects/C--LLM-DevOSWE/memory'
PLAN_DIR = 'C:/Users/Stone-PC/.claude/plans'
STATE_KEY = 'simglass-session-state'  # localStorage-style key in Relay


def run_git(args, cwd=REPO_ROOT):
    """Run a git command and return stdout"""
    try:
        result = subprocess.run(
            ['git'] + args,
            cwd=cwd, capture_output=True, text=True, timeout=5
        )
        return result.stdout.strip() if result.returncode == 0 else ''
    except Exception:
        return ''


def get_git_context():
    """Capture current git state"""
    branch = run_git(['branch', '--show-current'])
    status = run_git(['status', '--short'])
    log = run_git(['log', '--oneline', '-5'])
    diff_stat = run_git(['diff', '--stat', 'HEAD'])
    return {
        'branch': branch,
        'status': status[:500] if status else '',
        'recent_commits': log,
        'uncommitted_changes': diff_stat[:500] if diff_stat else ''
    }


def get_active_plan():
    """Find and read the most recent plan file"""
    try:
        if not os.path.isdir(PLAN_DIR):
            return None
        plans = [f for f in os.listdir(PLAN_DIR) if f.endswith('.md')]
        if not plans:
            return None
        # Get most recently modified
        plans.sort(key=lambda f: os.path.getmtime(os.path.join(PLAN_DIR, f)), reverse=True)
        plan_path = os.path.join(PLAN_DIR, plans[0])
        with open(plan_path, 'r', encoding='utf-8') as f:
            content = f.read()
        # Only include if it has real content (not just empty template)
        if len(content.strip()) > 50:
            return {'file': plans[0], 'content': content[:2000]}
    except Exception:
        pass
    return None


def get_memory_summary():
    """Read MEMORY.md first 50 lines for quick context"""
    try:
        mem_path = os.path.join(MEMORY_DIR, 'MEMORY.md')
        if os.path.exists(mem_path):
            with open(mem_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()[:50]
            return ''.join(lines)
    except Exception:
        pass
    return ''


def save_to_relay(session_id, state):
    """Save session state as a conversation message in Relay"""
    try:
        payload = {
            'role': 'system',
            'content': json.dumps(state, indent=2)
        }
        data = json.dumps(payload).encode('utf-8')
        url = f'{RELAY_URL}/api/conversations/{session_id}'
        req = urllib.request.Request(
            url, data=data,
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'HiveHook/1.0'
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True
    except Exception:
        return False


def save_latest_state(state):
    """Also save as a 'latest' state under a fixed session ID for easy retrieval"""
    try:
        # Use a fixed session ID so SessionStart can always find the latest
        payload = {
            'role': 'system',
            'content': json.dumps(state, indent=2)
        }
        data = json.dumps(payload).encode('utf-8')
        url = f'{RELAY_URL}/api/conversations/claude-session-latest'
        req = urllib.request.Request(
            url, data=data,
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'HiveHook/1.0'
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True
    except Exception:
        return False


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        input_data = {}

    session_id = input_data.get('session_id', 'unknown')

    # Build state snapshot
    git_ctx = get_git_context()
    plan = get_active_plan()

    state = {
        'type': 'session_state',
        'session_id': session_id,
        'timestamp': datetime.now().isoformat(),
        'git': git_ctx,
        'plan': plan,
        'working_dir': os.environ.get('CLAUDE_PROJECT_DIR', ''),
    }

    # Save to both session-specific and latest
    saved = save_to_relay(session_id, state)
    save_latest_state(state)

    if saved:
        print(f"Session state saved ({len(json.dumps(state))} bytes)")

    sys.exit(0)


if __name__ == '__main__':
    main()
