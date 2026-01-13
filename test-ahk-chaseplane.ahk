; Simple AHK v2 test for ChasePlane
; Run this while in MSFS with ChasePlane active

#Requires AutoHotkey v2.0
#SingleInstance Force

MsgBox("AHK ChasePlane Test`n`nPress OK, then within 3 seconds:`n- Make sure MSFS is visible`n- Watch for camera changes`n`nWill send: Alt+Z, then Alt+X, then Backspace")

Sleep(3000)

; Send Alt+Z (Toggle Cinematics)
Send("!z")
ToolTip("Sent Alt+Z")
Sleep(2000)

; Send Alt+X (Next Cinematic View)
Send("!x")
ToolTip("Sent Alt+X")
Sleep(2000)

; Send Backspace (Toggle Internal/External)
Send("{Backspace}")
ToolTip("Sent Backspace")
Sleep(1000)

ToolTip()
MsgBox("Test complete!`n`nDid ChasePlane respond to any of the keystrokes?")
ExitApp()
