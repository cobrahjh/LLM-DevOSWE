#!/usr/bin/env python3
"""
Stop Hook - Session Sync
Runs when Claude finishes responding to sync memory and state
"""

import json
import sys
import os
import hashlib
import urllib.request
import urllib.error
from datetime import datetime

CLAUDE_MD_PATH = 'C:/LLM-DevOSWE/CLAUDE.md'
STANDARDS_MD_PATH = 'C:/LLM-DevOSWE/STANDARDS.md'

def file_hash(path):
    """Get SHA256 hash of file"""
    try:
        with open(path, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()
    except:
        return None

def backup_to_relay(file_path, file_type):
    """Backup file to Relay knowledge database"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        data = json.dumps({
            'type': file_type,
            'content': content,
            'hash': file_hash(file_path),
            'timestamp': datetime.now().isoformat(),
            'source': 'session-sync-hook'
        }).encode('utf-8')

        req = urllib.request.Request(
            'http://localhost:8600/api/knowledge/backup',
            data=data,
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'HiveHook/1.0'
            },
            method='POST'
        )

        with urllib.request.urlopen(req, timeout=10) as resp:
            return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # Endpoint doesn't exist yet - silently skip
            return False
        return False
    except:
        return False

def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        input_data = {}

    session_id = input_data.get('session_id', 'unknown')

    # Check if files have changed (could compare to cached hash)
    # For now, just attempt backup on every session end

    backed_up = []

    if os.path.exists(CLAUDE_MD_PATH):
        if backup_to_relay(CLAUDE_MD_PATH, 'claude_md'):
            backed_up.append('CLAUDE.md')

    if os.path.exists(STANDARDS_MD_PATH):
        if backup_to_relay(STANDARDS_MD_PATH, 'standards_md'):
            backed_up.append('STANDARDS.md')

    # Output is shown in verbose mode
    if backed_up:
        print(f"Session sync: backed up {', '.join(backed_up)}")

    sys.exit(0)

if __name__ == '__main__':
    main()
