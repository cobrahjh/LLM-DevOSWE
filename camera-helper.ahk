; SimWidget Camera Helper for ChasePlane
; Sends keystrokes TO MSFS by briefly activating window
; AutoHotKey v2

#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

; Command file path (server writes here)
global COMMAND_FILE := A_ScriptDir "\camera-command.txt"

; Show tray icon with status
TraySetIcon("Shell32.dll", 44)
A_IconTip := "SimWidget Camera Helper - Running"

; Clear any existing command file
if FileExist(COMMAND_FILE)
    FileDelete(COMMAND_FILE)

; Log startup
LogMsg("SimWidget Camera Helper started (Window Activate Mode)")
LogMsg("Watching: " COMMAND_FILE)

; Main loop - watch for commands
SetTimer(CheckCommand, 100)

CheckCommand() {
    global COMMAND_FILE
    
    if !FileExist(COMMAND_FILE)
        return
    
    try {
        cmd := Trim(FileRead(COMMAND_FILE))
        FileDelete(COMMAND_FILE)
        
        if (cmd != "") {
            LogMsg("Command: " cmd)
            ExecuteCommand(cmd)
        }
    } catch as e {
        LogMsg("Error: " e.Message)
    }
}

FindMSFS() {
    ; Try different ways to find MSFS
    hwnd := WinExist("ahk_exe FlightSimulator2024.exe")
    if (hwnd)
        return hwnd
    
    hwnd := WinExist("ahk_exe FlightSimulator.exe")
    if (hwnd)
        return hwnd
    
    hwnd := WinExist("Microsoft Flight Simulator")
    if (hwnd)
        return hwnd
        
    return 0
}

ExecuteCommand(cmd) {
    msfsHwnd := FindMSFS()
    
    if (!msfsHwnd) {
        LogMsg("ERROR: MSFS window not found!")
        return
    }
    
    ; Remember current window
    prevHwnd := WinExist("A")
    
    ; Activate MSFS
    WinActivate(msfsHwnd)
    WinWaitActive(msfsHwnd,, 1)
    Sleep(50)
    
    switch cmd {
        case "TCM":
            Send("!z")
            LogMsg("Sent Alt+Z (Toggle Cinematics)")
            
        case "NCV":
            Send("!x")
            LogMsg("Sent Alt+X (Next Cinematic View)")
            
        case "VIEW":
            Send("{Backspace}")
            LogMsg("Sent Backspace (Toggle View)")
            
        default:
            LogMsg("Unknown command: " cmd)
    }
    
    ; Small delay for key to register
    Sleep(50)
    
    ; Restore previous window (optional - comment out if you want MSFS to stay focused)
    ; if (prevHwnd && prevHwnd != msfsHwnd)
    ;     WinActivate(prevHwnd)
}

LogMsg(msg) {
    timestamp := FormatTime(, "HH:mm:ss")
    OutputDebug(timestamp " - " msg)
    
    try {
        FileAppend(timestamp " - " msg "`n", A_ScriptDir "\camera-helper.log")
    }
}

; Tray menu
A_TrayMenu.Delete()
A_TrayMenu.Add("SimWidget Camera Helper", (*) => "")
A_TrayMenu.Disable("SimWidget Camera Helper")
A_TrayMenu.Add()
A_TrayMenu.Add("Test Alt+Z", (*) => ExecuteCommand("TCM"))
A_TrayMenu.Add("Test Alt+X", (*) => ExecuteCommand("NCV"))
A_TrayMenu.Add("Test Backspace", (*) => ExecuteCommand("VIEW"))
A_TrayMenu.Add()
A_TrayMenu.Add("Exit", (*) => ExitApp())

TrayTip("SimWidget Camera Helper", "Running - Window Activate Mode", 1)
