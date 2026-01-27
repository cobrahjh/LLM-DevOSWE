#!/usr/bin/env python3
"""
Stop Hook - Session Sync + Limitless Memory Auto-Capture
Runs when Claude Code session ends.

1. Backs up CLAUDE.md and STANDARDS.md to Relay knowledge DB
2. Detects doc changes since last session and stores new content
   as searchable Limitless Memory entries
3. Logs session metadata for historical tracking
"""

import json
import sys
import os
import hashlib
import urllib.request
import urllib.error
import subprocess
import re
from datetime import datetime

CLAUDE_MD_PATH = 'C:/LLM-DevOSWE/CLAUDE.md'
STANDARDS_MD_PATH = 'C:/LLM-DevOSWE/STANDARDS.md'
SERVICE_REGISTRY_PATH = 'C:/LLM-DevOSWE/SERVICE-REGISTRY.md'
HASH_CACHE_PATH = 'C:/LLM-DevOSWE/Admin/hooks/.session-hash-cache.json'
RELAY_BASE = 'http://localhost:8600'

TRACKED_DOCS = [
    (CLAUDE_MD_PATH, 'claude_md', 'CLAUDE.md'),
    (STANDARDS_MD_PATH, 'standards_md', 'STANDARDS.md'),
    (SERVICE_REGISTRY_PATH, 'service_registry', 'SERVICE-REGISTRY.md'),
]


def file_hash(path):
    try:
        with open(path, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()
    except:
        return None


def read_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except:
        return None


def load_hash_cache():
    try:
        with open(HASH_CACHE_PATH, 'r') as f:
            return json.load(f)
    except:
        return {}


def save_hash_cache(cache):
    try:
        os.makedirs(os.path.dirname(HASH_CACHE_PATH), exist_ok=True)
        with open(HASH_CACHE_PATH, 'w') as f:
            json.dump(cache, f, indent=2)
    except:
        pass


def relay_request(method, path, body=None):
    try:
        url = RELAY_BASE + path
        data = json.dumps(body).encode('utf-8') if body else None
        req = urllib.request.Request(
            url, data=data,
            headers={'Content-Type': 'application/json', 'User-Agent': 'HiveHook/1.0'},
            method=method
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except:
        return None


def backup_to_relay(file_path, file_type):
    try:
        content = read_file(file_path)
        if not content:
            return False

        data = json.dumps({
            'type': file_type,
            'content': content,
            'hash': file_hash(file_path),
            'timestamp': datetime.now().isoformat(),
            'source': 'session-sync-hook'
        }).encode('utf-8')

        req = urllib.request.Request(
            f'{RELAY_BASE}/api/knowledge/backup',
            data=data,
            headers={'Content-Type': 'application/json', 'User-Agent': 'HiveHook/1.0'},
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True
    except:
        return False


def extract_new_sections(old_content, new_content):
    """Find lines added in new_content that weren't in old_content."""
    if not old_content:
        return []  # First run — don't treat entire file as new

    old_lines = set(old_content.splitlines())
    new_lines = new_content.splitlines()

    added = []
    current_block = []

    for line in new_lines:
        if line not in old_lines and line.strip():
            current_block.append(line)
        else:
            if current_block:
                block_text = '\n'.join(current_block).strip()
                if len(block_text) > 20:  # Skip trivial changes
                    added.append(block_text)
                current_block = []

    # Flush remaining
    if current_block:
        block_text = '\n'.join(current_block).strip()
        if len(block_text) > 20:
            added.append(block_text)

    return added


def categorize_content(text):
    """Guess a memory category from content keywords."""
    lower = text.lower()
    if any(w in lower for w in ['port ', 'service', 'nssm', 'endpoint']):
        return 'service'
    if any(w in lower for w in ['rule:', 'never ', 'always ', 'must ', 'mandatory']):
        return 'rule'
    if any(w in lower for w in ['bug', 'fix', 'incident', 'crash', 'error']):
        return 'incident'
    if any(w in lower for w in ['pattern', 'convention', 'standard']):
        return 'pattern'
    if any(w in lower for w in ['192.168', 'ssh', 'network', 'ip ']):
        return 'infrastructure'
    if any(w in lower for w in ['persona', 'voice', 'identity']):
        return 'persona'
    return 'general'


def store_memory(content, category, tags, importance, session_id, source):
    return relay_request('POST', '/api/memory', {
        'content': content,
        'category': category,
        'tags': tags,
        'importance': importance,
        'session_id': session_id,
        'source': source
    })


def get_git_changes():
    """Get list of files changed in the working tree (staged + unstaged)."""
    try:
        result = subprocess.run(
            ['git', 'diff', '--name-only', 'HEAD'],
            capture_output=True, text=True, timeout=5,
            cwd='C:/LLM-DevOSWE'
        )
        if result.returncode == 0:
            return [f.strip() for f in result.stdout.strip().splitlines() if f.strip()]
    except:
        pass
    return []


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        input_data = {}

    session_id = input_data.get('session_id', 'unknown')
    results = []

    # --- Phase 1: Knowledge backup (existing behavior) ---
    backed_up = []
    for path, file_type, name in TRACKED_DOCS:
        if os.path.exists(path):
            if backup_to_relay(path, file_type):
                backed_up.append(name)

    if backed_up:
        results.append(f"Backed up: {', '.join(backed_up)}")

    # --- Phase 2: Detect doc changes and auto-capture to Limitless Memory ---
    hash_cache = load_hash_cache()
    memories_stored = 0

    for path, file_type, name in TRACKED_DOCS:
        if not os.path.exists(path):
            continue

        current_hash = file_hash(path)
        cached_hash = hash_cache.get(path)

        if current_hash == cached_hash:
            continue  # No change since last session

        # File changed — extract new content
        current_content = read_file(path)
        if not current_content:
            continue

        # Get old content from cache (stored as separate file)
        old_content_path = HASH_CACHE_PATH.replace('.json', f'.{file_type}.txt')
        old_content = read_file(old_content_path)

        new_sections = extract_new_sections(old_content, current_content)

        for section in new_sections:
            # Skip sections that are too long (likely code blocks)
            if len(section) > 1000:
                section = section[:1000] + '...'

            category = categorize_content(section)
            store_memory(
                content=f"[Auto-captured from {name}] {section}",
                category=category,
                tags=['auto-capture', 'session-sync', file_type],
                importance=6,
                session_id=session_id,
                source=f'session-sync:{name}'
            )
            memories_stored += 1

        # Update cache
        hash_cache[path] = current_hash
        try:
            with open(old_content_path, 'w', encoding='utf-8') as f:
                f.write(current_content)
        except:
            pass

    save_hash_cache(hash_cache)

    if memories_stored > 0:
        results.append(f"Auto-captured {memories_stored} new memories")

    # --- Phase 3: Session end marker ---
    git_changes = get_git_changes()
    changed_summary = ', '.join(git_changes[:10]) if git_changes else 'none'

    store_memory(
        content=f"Session {session_id} ended. Files changed: {changed_summary}. Memories captured: {memories_stored}.",
        category='session',
        tags=['session-end', 'auto-capture'],
        importance=3,
        session_id=session_id,
        source='session-sync-hook'
    )
    results.append(f"Session {session_id[:8]}... logged")

    if results:
        print(f"Session sync: {' | '.join(results)}")

    sys.exit(0)


if __name__ == '__main__':
    main()
