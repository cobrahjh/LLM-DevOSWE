#Requires AutoHotkey v2.0
Persistent
TraySetIcon("shell32.dll", 23)
^Space::MsgBox("It works!")
