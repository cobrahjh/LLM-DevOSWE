; Windows 11 Style Search Bar - AHK v2
; Hotkey: Ctrl+Space
#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

; Tray icon
TraySetIcon("shell32.dll", 23)
A_TrayMenu.Delete()
A_TrayMenu.Add("Open (Ctrl+Space)", (*) => ShowSearch())
A_TrayMenu.Add()
A_TrayMenu.Add("Add to Startup", AddStartup)
A_TrayMenu.Add()
A_TrayMenu.Add("Exit", (*) => ExitApp())

AddStartup(*) {
    shell := ComObject("WScript.Shell")
    lnk := shell.CreateShortcut(A_Startup "\QuickSearch.lnk")
    lnk.TargetPath := A_AhkPath
    lnk.Arguments := '"' A_ScriptFullPath '"'
    lnk.Save()
    MsgBox("Added to startup!")
}

; Config
global SEARCH_WIDTH := 600
global SEARCH_HEIGHT := 400
global searchGui := ""
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

; Hotkey
^Space::ShowSearch()

ShowSearch() {
    global searchGui, results, selectedIndex

    if (searchGui != "") {
        try searchGui.Destroy()
        searchGui := ""
        return
    }

    results := []
    selectedIndex := 1

    searchGui := Gui("+AlwaysOnTop -Caption +Border")
    searchGui.BackColor := "1a1a2e"
    searchGui.SetFont("s11 cffffff", "Segoe UI")

    searchGui.Add("Text", "x15 y15 w570 h25 c888888", "Type to search...")
    edit := searchGui.Add("Edit", "x15 y40 w570 h32 Background2a2a3e cffffff veditSearch")
    edit.OnEvent("Change", DoSearch)

    lv := searchGui.Add("ListView", "x15 y85 w570 h300 Background1e1e2e cffffff -Hdr vlvResults", ["Name", "Action"])
    lv.ModifyCol(1, 350)
    lv.ModifyCol(2, 200)
    lv.OnEvent("DoubleClick", RunSelected)

    for key, cmd in commands {
        lv.Add("", cmd.name, key)
        results.Push(cmd)
    }

    x := (A_ScreenWidth - SEARCH_WIDTH) / 2
    y := (A_ScreenHeight - SEARCH_HEIGHT) / 3
    searchGui.Show("x" x " y" y " w" SEARCH_WIDTH " h" SEARCH_HEIGHT)
    edit.Focus()
}

DoSearch(ctrl, *) {
    global searchGui, results, selectedIndex, commands

    query := StrLower(ctrl.Value)
    results := []
    selectedIndex := 1

    lv := searchGui["lvResults"]
    lv.Delete()

    if (query = "") {
        for key, cmd in commands {
            lv.Add("", cmd.name, key)
            results.Push(cmd)
        }
        return
    }

    if (SubStr(query, 1, 1) = "?") {
        webQuery := SubStr(query, 2)
        if (webQuery != "") {
            lv.Add("", "Google: " webQuery, "web")
            results.Push({name: "Google", run: "https://www.google.com/search?q=" webQuery})
        }
        return
    }

    for key, cmd in commands {
        if (InStr(StrLower(key), query) || InStr(StrLower(cmd.name), query)) {
            lv.Add("", cmd.name, key)
            results.Push(cmd)
        }
    }

    if (results.Length = 0) {
        lv.Add("", "Search: " query, "web")
        results.Push({name: "Search", run: "https://www.google.com/search?q=" query})
    }
}

RunSelected(ctrl, row) {
    global searchGui, results
    if (row > 0 && row <= results.Length) {
        cmd := results[row]
        searchGui.Destroy()
        searchGui := ""
        try Run(cmd.run)
    }
}

#HotIf WinActive("ahk_class AutoHotkeyGUI")
Escape:: {
    global searchGui
    if (searchGui != "") {
        searchGui.Destroy()
        searchGui := ""
    }
}

Enter:: {
    global searchGui, results, selectedIndex
    if (results.Length > 0 && selectedIndex <= results.Length) {
        cmd := results[selectedIndex]
        searchGui.Destroy()
        searchGui := ""
        try Run(cmd.run)
    }
}

Up:: {
    global selectedIndex, results, searchGui
    if (results.Length > 0) {
        selectedIndex--
        if (selectedIndex < 1)
            selectedIndex := results.Length
        searchGui["lvResults"].Modify(selectedIndex, "Select Focus Vis")
    }
}

Down:: {
    global selectedIndex, results, searchGui
    if (results.Length > 0) {
        selectedIndex++
        if (selectedIndex > results.Length)
            selectedIndex := 1
        searchGui["lvResults"].Modify(selectedIndex, "Select Focus Vis")
    }
}
#HotIf
