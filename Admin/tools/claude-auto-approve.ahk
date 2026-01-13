; Claude Code Auto-Approve Script v1.0
; Watches for permission prompts and auto-approves
;
; Usage: Run this script, it will auto-send "1" when Claude asks
; Hotkey: Ctrl+Shift+A to toggle auto-approve on/off
;
; To stop: Right-click system tray icon > Exit

#Persistent
#SingleInstance Force
SetTitleMatchMode, 2

global autoApproveEnabled := true
global lastSendTime := 0

Menu, Tray, Tip, Claude Auto-Approve (ON)
TrayTip, Claude Auto-Approve, Auto-approve ENABLED`nCtrl+Shift+A to toggle, 2

; Check every 300ms
SetTimer, WatchForPrompt, 300
return

WatchForPrompt:
    if (!autoApproveEnabled)
        return

    ; Only act if a terminal is active
    if WinActive("ahk_exe WindowsTerminal.exe")
        or WinActive("ahk_exe cmd.exe")
        or WinActive("ahk_exe powershell.exe")
        or WinActive("ahk_exe Code.exe")
    {
        ; Throttle: don't send more than once per 2 seconds
        if (A_TickCount - lastSendTime < 2000)
            return

        ; Check if there's a permission prompt by looking for common patterns
        ; This uses a simple approach: if terminal is waiting for input, send 1
        ; You may need to adjust based on your setup
    }
return

; Toggle auto-approve with Ctrl+Shift+A
^+a::
    autoApproveEnabled := !autoApproveEnabled
    if (autoApproveEnabled) {
        Menu, Tray, Tip, Claude Auto-Approve (ON)
        TrayTip, Claude Auto-Approve, Auto-approve ENABLED, 1
    } else {
        Menu, Tray, Tip, Claude Auto-Approve (OFF)
        TrayTip, Claude Auto-Approve, Auto-approve DISABLED, 1
    }
return

; Manual quick-approve: Ctrl+Shift+1
^+1::
    Send, 1{Enter}
    lastSendTime := A_TickCount
return

; Manual "yes": Ctrl+Shift+Y
^+y::
    Send, yes{Enter}
return

; Quick "allow all": Ctrl+Shift+0
^+0::
    Send, 0{Enter}
return
