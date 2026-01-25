; Desktop Search Widget - Always Visible
; Mini floating search bar for Windows 11
#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

; Config
global WIDGET_WIDTH := 320
global WIDGET_HEIGHT := 44
global searchGui := ""
global resultsGui := ""
global results := []
global selectedIndex := 1

; Quick commands
global commands := Map()
commands["calc"] := {name: "Calculator", run: "calc.exe"}
commands["cmd"] := {name: "Command Prompt", run: "cmd.exe"}
commands["notepad"] := {name: "Notepad", run: "notepad.exe"}
commands["explorer"] := {name: "File Explorer", run: "explorer.exe"}
commands["settings"] := {name: "Settings", run: "ms-settings:"}
commands["task"] := {name: "Task Manager", run: "taskmgr.exe"}
commands["term"] := {name: "Terminal", run: "wt.exe"}
commands["code"] := {name: "VS Code", run: "code"}
commands["chrome"] := {name: "Chrome", run: "chrome.exe"}
commands["edge"] := {name: "Edge", run: "msedge.exe"}
commands["paint"] := {name: "Paint", run: "mspaint.exe"}
commands["snip"] := {name: "Snipping Tool", run: "snippingtool.exe"}
commands["lock"] := {name: "Lock PC", run: "rundll32.exe user32.dll,LockWorkStation"}
commands["sleep"] := {name: "Sleep", run: "rundll32.exe powrprof.dll,SetSuspendState 0,1,0"}

; Tray menu
TraySetIcon("shell32.dll", 23)
A_TrayMenu.Delete()
A_TrayMenu.Add("Show Widget", (*) => ShowWidget())
A_TrayMenu.Add("Hide Widget", (*) => HideWidget())
A_TrayMenu.Add()
A_TrayMenu.Add("Add to Startup", AddStartup)
A_TrayMenu.Add()
A_TrayMenu.Add("Exit", (*) => ExitApp())

AddStartup(*) {
    shell := ComObject("WScript.Shell")
    lnk := shell.CreateShortcut(A_Startup "\SearchWidget.lnk")
    lnk.TargetPath := A_AhkPath
    lnk.Arguments := '"' A_ScriptFullPath '"'
    lnk.Save()
    MsgBox("Added to startup!")
}

; Create the always-visible widget
ShowWidget() {
    global searchGui, WIDGET_WIDTH, WIDGET_HEIGHT

    if (searchGui != "") {
        searchGui.Show()
        return
    }

    ; Position: top-center of screen
    x := (A_ScreenWidth - WIDGET_WIDTH) / 2
    y := 10

    searchGui := Gui("+AlwaysOnTop -Caption +Border +ToolWindow")
    searchGui.BackColor := "1a1a2e"

    ; Search icon and input
    searchGui.SetFont("s12 cffffff", "Segoe UI")
    searchGui.Add("Text", "x10 y10 w24 h24 c667eea", "🔍")

    edit := searchGui.Add("Edit", "x38 y8 w" (WIDGET_WIDTH - 85) " h28 Background2a2a3e cffffff -E0x200 veditWidget")
    edit.SetFont("s11", "Segoe UI")
    edit.OnEvent("Change", OnWidgetSearch)
    edit.OnEvent("Focus", OnWidgetFocus)

    ; Close button
    closeBtn := searchGui.Add("Text", "x" (WIDGET_WIDTH - 35) " y10 w24 h24 c888888 Center", "✕")
    closeBtn.OnEvent("Click", (*) => HideWidget())

    searchGui.Show("x" x " y" y " w" WIDGET_WIDTH " h" WIDGET_HEIGHT " NoActivate")

    ; Make it draggable
    OnMessage(0x201, WM_LBUTTONDOWN)
}

HideWidget() {
    global searchGui, resultsGui
    if (searchGui != "")
        searchGui.Hide()
    if (resultsGui != "")
        resultsGui.Destroy(), resultsGui := ""
}

WM_LBUTTONDOWN(wParam, lParam, msg, hwnd) {
    global searchGui
    if (searchGui != "" && hwnd = searchGui.Hwnd) {
        PostMessage(0xA1, 2, 0, , searchGui)  ; Allow dragging
    }
}

OnWidgetFocus(ctrl, *) {
    ; Show results dropdown when focused
}

OnWidgetSearch(ctrl, *) {
    global resultsGui, results, selectedIndex, commands, searchGui, WIDGET_WIDTH

    query := StrLower(ctrl.Value)
    results := []
    selectedIndex := 1

    ; Close existing results
    if (resultsGui != "") {
        try resultsGui.Destroy()
        resultsGui := ""
    }

    if (query = "")
        return

    ; Build results
    if (SubStr(query, 1, 1) = "?") {
        webQuery := SubStr(query, 2)
        if (webQuery != "")
            results.Push({name: "Google: " webQuery, run: "https://www.google.com/search?q=" webQuery})
    } else {
        for key, cmd in commands {
            if (InStr(StrLower(key), query) || InStr(StrLower(cmd.name), query))
                results.Push({name: cmd.name, run: cmd.run})
        }
        if (results.Length = 0)
            results.Push({name: "Search: " query, run: "https://www.google.com/search?q=" query})
    }

    if (results.Length = 0)
        return

    ; Get widget position
    try {
        searchGui.GetPos(&wx, &wy, &ww, &wh)
    } catch {
        wx := (A_ScreenWidth - WIDGET_WIDTH) / 2
        wy := 10
        wh := 44
    }

    ; Create results dropdown
    resultsGui := Gui("+AlwaysOnTop -Caption +Border +ToolWindow")
    resultsGui.BackColor := "1e1e2e"
    resultsGui.SetFont("s11 cffffff", "Segoe UI")

    yPos := 10
    Loop results.Length {
        i := A_Index
        item := results[i]
        bgColor := (i = 1) ? "2a2a3e" : "1e1e2e"
        txtColor := (i = 1) ? "ffffff" : "bbbbbb"
        txt := resultsGui.Add("Text", "x10 y" yPos " w" (WIDGET_WIDTH - 20) " h26 c" txtColor " Background" bgColor " vresult" i, "  " item.name)
        txt.OnEvent("Click", RunResult.Bind(i))
        yPos += 30
    }

    dropdownHeight := yPos + 5
    resultsGui.Show("x" wx " y" (wy + wh + 2) " w" WIDGET_WIDTH " h" dropdownHeight)
}

RunResult(index, *) {
    global results, resultsGui, searchGui

    if (index > 0 && index <= results.Length) {
        cmd := results[index]

        if (resultsGui != "")
            resultsGui.Destroy(), resultsGui := ""

        ; Clear search box
        searchGui["editWidget"].Value := ""

        try Run(cmd.run)
    }
}

; Keyboard shortcuts
#HotIf WinActive("ahk_class AutoHotkeyGUI")
Escape:: {
    global resultsGui, searchGui
    if (resultsGui != "")
        resultsGui.Destroy(), resultsGui := ""
    searchGui["editWidget"].Value := ""
}

Enter:: {
    global results, resultsGui, searchGui, selectedIndex
    if (results.Length > 0) {
        cmd := results[selectedIndex]
        if (resultsGui != "")
            resultsGui.Destroy(), resultsGui := ""
        searchGui["editWidget"].Value := ""
        try Run(cmd.run)
    }
}

Up:: {
    global selectedIndex, results
    if (results.Length > 0) {
        selectedIndex--
        if (selectedIndex < 1)
            selectedIndex := results.Length
        UpdateResultsHighlight()
    }
}

Down:: {
    global selectedIndex, results
    if (results.Length > 0) {
        selectedIndex++
        if (selectedIndex > results.Length)
            selectedIndex := 1
        UpdateResultsHighlight()
    }
}
#HotIf

UpdateResultsHighlight() {
    global resultsGui, selectedIndex, results
    if (resultsGui = "")
        return
    for i, item in results {
        try resultsGui["result" i].Opt("c" (i = selectedIndex ? "ffffff" : "aaaaaa"))
    }
}

; Hotkey to toggle widget
^Space::ToggleWidget()

ToggleWidget() {
    global searchGui
    if (searchGui = "" || !WinExist("ahk_id " searchGui.Hwnd)) {
        ShowWidget()
    } else if (!WinActive("ahk_id " searchGui.Hwnd)) {
        searchGui.Show()
        WinActivate("ahk_id " searchGui.Hwnd)
    } else {
        HideWidget()
    }
}

; Start with widget visible
ShowWidget()
