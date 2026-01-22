#!/usr/bin/env python3
"""
forward-notifications.py - Notification hook for forwarding to Hive services

Forwards Claude Code notifications to:
- Relay service (for persistence and phone access)
- KittBox WebSocket (for real-time UI updates)
- Windows toast notifications (optional)

Hook event: Notification
"""

import sys
import json
import urllib.request
import urllib.error
from datetime import datetime

# Hive service endpoints
RELAY_URL = "http://localhost:8600"
KITTBOX_URL = "http://localhost:8585"

# Notification types to forward
FORWARD_TYPES = [
    "error",
    "warning",
    "task_complete",
    "task_failed",
    "message",
    "alert"
]


def send_to_relay(notification: dict) -> bool:
    """Send notification to Relay service for persistence."""
    try:
        payload = json.dumps({
            "type": "notification",
            "source": "claude-code",
            "content": notification.get("message", str(notification)),
            "level": notification.get("type", "info"),
            "timestamp": datetime.now().isoformat(),
            "metadata": notification
        }).encode('utf-8')

        req = urllib.request.Request(
            f"{RELAY_URL}/api/notifications",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status == 200

    except (urllib.error.URLError, Exception):
        return False


def send_to_kittbox(notification: dict) -> bool:
    """Send notification to KittBox for real-time display."""
    try:
        payload = json.dumps({
            "type": "claude_notification",
            "notification": notification,
            "timestamp": datetime.now().isoformat()
        }).encode('utf-8')

        req = urllib.request.Request(
            f"{KITTBOX_URL}/api/notifications",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=3) as response:
            return response.status == 200

    except (urllib.error.URLError, Exception):
        return False


def show_windows_toast(title: str, message: str, notification_type: str = "info") -> bool:
    """Show Windows toast notification (if available)."""
    try:
        # Try using PowerShell for toast notification
        import subprocess

        # Escape quotes in message
        safe_message = message.replace('"', "'")[:200]
        safe_title = title.replace('"', "'")[:50]

        ps_script = f'''
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $template = "<toast><visual><binding template='ToastText02'><text id='1'>{safe_title}</text><text id='2'>{safe_message}</text></binding></visual></toast>"
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Claude Code").Show($toast)
        '''

        subprocess.run(
            ["powershell", "-Command", ps_script],
            capture_output=True,
            timeout=5
        )
        return True

    except Exception:
        return False


def main():
    """Main entry point for Notification hook."""
    try:
        # Read hook input from stdin
        input_data = sys.stdin.read()
        hook_input = json.loads(input_data)

        # Extract notification details
        notification_type = hook_input.get("type", "info")
        message = hook_input.get("message", "")
        title = hook_input.get("title", "Claude Code")

        # Build notification object
        notification = {
            "type": notification_type,
            "title": title,
            "message": message,
            "raw": hook_input
        }

        # Forward to services
        results = {
            "relay": send_to_relay(notification),
            "kittbox": send_to_kittbox(notification)
        }

        # Show toast for errors and important notifications
        if notification_type in ["error", "warning", "alert", "task_failed"]:
            results["toast"] = show_windows_toast(title, message, notification_type)

        # Return success (notifications are best-effort)
        print(json.dumps({
            "success": True,
            "forwarded_to": [k for k, v in results.items() if v]
        }))

    except json.JSONDecodeError:
        print(json.dumps({"success": False, "error": "Invalid JSON input"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == "__main__":
    main()
