; Auto-Continue Script v1.0
; Automatically presses 1 + Enter at intervals
; Toggle on/off with Ctrl+Alt+1
;
; Usage: Double-click to start, Ctrl+Alt+1 to toggle

#Persistent
#SingleInstance Force

global isRunning := true  ; Start ON by default
global intervalMs := 2000  ; Check every 2 seconds

; Tray menu
Menu, Tray, Tip, Auto-Continue (ON)

; Auto-start timer since isRunning defaults to true
SetTimer, SendOne, %intervalMs%
Menu, Tray, Add, Toggle (Ctrl+Alt+1), ToggleScript
Menu, Tray, Add, Set Interval, SetInterval
Menu, Tray, Add
Menu, Tray, Add, Exit, ExitScript

; Hotkey: Ctrl+Alt+1 to toggle
^!1::
ToggleScript:
    isRunning := !isRunning
    if (isRunning) {
        Menu, Tray, Tip, Auto-Continue (ON) - %intervalMs%ms
        TrayTip, Auto-Continue, ON - pressing 1 every %intervalMs%ms, 1
        SetTimer, SendOne, %intervalMs%
    } else {
        Menu, Tray, Tip, Auto-Continue (OFF)
        TrayTip, Auto-Continue, OFF, 1
        SetTimer, SendOne, Off
    }
return

SendOne:
    Send, 1
    Sleep, 100
    Send, {Enter}
return

SetInterval:
    InputBox, newInterval, Set Interval, Enter interval in milliseconds (e.g. 2000 for 2 sec):, , 300, 140, , , , , %intervalMs%
    if (!ErrorLevel && newInterval > 0) {
        intervalMs := newInterval
        if (isRunning) {
            SetTimer, SendOne, %intervalMs%
        }
        TrayTip, Auto-Continue, Interval set to %intervalMs%ms, 1
    }
return

ExitScript:
    ExitApp
return
