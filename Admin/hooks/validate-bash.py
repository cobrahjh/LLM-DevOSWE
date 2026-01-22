#!/usr/bin/env python3
"""
validate-bash.py - PreToolUse hook for Bash command security validation

Blocks dangerous commands before execution:
- Destructive file operations (rm -rf /, format, etc.)
- System-critical modifications
- Credential/key exposure risks
- Force push to main branches

Returns JSON: {"decision": "allow|block", "reason": "..."}
"""

import sys
import json
import re

# Patterns that should be BLOCKED
BLOCKED_PATTERNS = [
    # Destructive file operations
    (r'rm\s+(-[rf]+\s+)*[/\\](\s|$)', 'Deleting root directory'),
    (r'rm\s+-rf\s+/\w+\s*$', 'Deleting top-level system directory'),
    (r'rm\s+-rf\s+\*', 'Recursive delete with wildcard'),
    (r'format\s+[a-zA-Z]:', 'Formatting drive'),
    (r'mkfs\s+', 'Creating filesystem (destructive)'),
    (r'dd\s+.*of=/dev/', 'Writing directly to device'),

    # Git destructive operations
    (r'git\s+push\s+.*--force\s+.*main', 'Force push to main branch'),
    (r'git\s+push\s+.*--force\s+.*master', 'Force push to master branch'),
    (r'git\s+reset\s+--hard\s+origin', 'Hard reset to origin'),
    (r'git\s+clean\s+-fd', 'Cleaning untracked files forcefully'),

    # Credential exposure
    (r'echo\s+.*API_KEY.*\|', 'Piping API key'),
    (r'curl\s+.*-d.*password', 'Sending password in curl'),
    (r'cat\s+.*\.env\s*\|', 'Piping .env file'),

    # System modifications
    (r'chmod\s+777\s+/', 'Setting 777 permissions on root'),
    (r'chown\s+-R\s+.*:.*\s+/', 'Recursive chown on root'),
    (r'shutdown', 'System shutdown'),
    (r'reboot', 'System reboot'),
    (r'halt', 'System halt'),

    # Registry/system config (Windows)
    (r'reg\s+delete\s+HKLM', 'Deleting system registry'),
    (r'bcdedit', 'Modifying boot configuration'),

    # Network dangers
    (r'iptables\s+-F', 'Flushing firewall rules'),
    (r'netsh\s+.*firewall.*disable', 'Disabling firewall'),
]

# Patterns that should WARN but allow (logged)
WARN_PATTERNS = [
    (r'sudo\s+', 'Using sudo'),
    (r'rm\s+-rf\s+', 'Recursive force delete'),
    (r'git\s+push\s+--force', 'Force push (not to main)'),
    (r'pip\s+install\s+--user', 'User pip install'),
    (r'npm\s+install\s+-g', 'Global npm install'),
]


def validate_command(command: str) -> dict:
    """Validate a bash command for security issues."""

    command_lower = command.lower()

    # Check blocked patterns
    for pattern, reason in BLOCKED_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return {
                "decision": "block",
                "reason": f"Security: {reason}",
                "pattern": pattern
            }

    # Check warning patterns (allow but log)
    warnings = []
    for pattern, reason in WARN_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            warnings.append(reason)

    if warnings:
        return {
            "decision": "allow",
            "reason": f"Warning: {', '.join(warnings)}",
            "warnings": warnings
        }

    return {
        "decision": "allow",
        "reason": "Command passed security check"
    }


def main():
    """Main entry point for PreToolUse hook."""
    try:
        # Read hook input from stdin
        input_data = sys.stdin.read()
        hook_input = json.loads(input_data)

        # Extract tool info
        tool_name = hook_input.get("tool_name", "")
        tool_input = hook_input.get("tool_input", {})

        # Only validate Bash tool
        if tool_name != "Bash":
            print(json.dumps({"decision": "allow"}))
            return

        # Get the command
        command = tool_input.get("command", "")

        if not command:
            print(json.dumps({"decision": "allow"}))
            return

        # Validate
        result = validate_command(command)
        print(json.dumps(result))

    except json.JSONDecodeError:
        # If we can't parse input, allow by default
        print(json.dumps({"decision": "allow", "reason": "Could not parse hook input"}))
    except Exception as e:
        # On error, allow but log
        print(json.dumps({"decision": "allow", "reason": f"Hook error: {str(e)}"}))


if __name__ == "__main__":
    main()
