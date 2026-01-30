# Organize Windows into Virtual Desktops
# Desktop 1: Claude Code (terminals)
# Desktop 2: Browsers & UIs
# Desktop 3: Service consoles

param(
    [switch]$Setup,      # Create desktops and move windows
    [switch]$Dev,        # Switch to Desktop 1 (dev)
    [switch]$UI,         # Switch to Desktop 2 (browsers)
    [switch]$Services    # Switch to Desktop 3 (services)
)

# Check if VirtualDesktop module is installed
$vdModule = Get-Module -ListAvailable -Name VirtualDesktop
if (-not $vdModule) {
    Write-Host "Installing VirtualDesktop module..." -ForegroundColor Yellow
    Install-Module -Name VirtualDesktop -Scope CurrentUser -Force -AllowClobber
    Import-Module VirtualDesktop
} else {
    Import-Module VirtualDesktop -ErrorAction SilentlyContinue
}

# Title patterns checked FIRST (priority over process name)
# Format: pattern = desktop number
$titlePatterns = @{
    "node "      = 3    # WindowsTerminal running node → Services
    "npm "       = 3    # npm scripts → Services
    "electron"   = 3    # Electron apps → Services
}

# Process name patterns for each desktop (fallback)
$desktopConfig = @{
    1 = @{
        Name = "Dev"
        Patterns = @(
            "WindowsTerminal",
            "powershell",
            "pwsh",
            "cmd",
            "Code",           # VS Code
            "claude"          # Claude Code terminal
        )
    }
    2 = @{
        Name = "UI"
        Patterns = @(
            "chrome",
            "firefox",
            "msedge",
            "brave",
            "opera"
        )
    }
    3 = @{
        Name = "Services"
        Patterns = @(
            "node",
            "electron",
            "conhost"         # Console host windows
        )
    }
}

function Get-VisibleWindows {
    Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    using System.Text;
    using System.Collections.Generic;

    public class WindowHelper {
        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll")]
        private static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        public static List<Tuple<IntPtr, string, string>> GetWindows() {
            var windows = new List<Tuple<IntPtr, string, string>>();
            EnumWindows((hWnd, lParam) => {
                if (IsWindowVisible(hWnd)) {
                    int length = GetWindowTextLength(hWnd);
                    if (length > 0) {
                        StringBuilder sb = new StringBuilder(length + 1);
                        GetWindowText(hWnd, sb, sb.Capacity);
                        uint pid;
                        GetWindowThreadProcessId(hWnd, out pid);
                        try {
                            var proc = System.Diagnostics.Process.GetProcessById((int)pid);
                            windows.Add(Tuple.Create(hWnd, sb.ToString(), proc.ProcessName));
                        } catch { }
                    }
                }
                return true;
            }, IntPtr.Zero);
            return windows;
        }
    }
"@ -ErrorAction SilentlyContinue

    return [WindowHelper]::GetWindows()
}

function Show-CurrentWindows {
    Write-Host "`nVisible Windows:" -ForegroundColor Cyan
    Write-Host ("-" * 80)
    $windows = Get-VisibleWindows
    foreach ($w in $windows) {
        $title = if ($w.Item2.Length -gt 50) { $w.Item2.Substring(0, 47) + "..." } else { $w.Item2 }
        Write-Host ("{0,-20} | {1}" -f $w.Item3, $title)
    }
    Write-Host ("-" * 80)
}

function Move-WindowsToDesktops {
    Write-Host "`nOrganizing windows into virtual desktops..." -ForegroundColor Green

    # Ensure we have enough desktops
    $desktops = Get-DesktopList -ErrorAction SilentlyContinue
    $desktopCount = if ($desktops) { $desktops.Count } else { 1 }

    while ($desktopCount -lt 3) {
        New-Desktop | Out-Null
        $desktopCount++
        Write-Host "  Created Desktop $desktopCount" -ForegroundColor Yellow
    }

    # Get all visible windows
    $windows = Get-VisibleWindows

    foreach ($w in $windows) {
        $hwnd = $w.Item1
        $title = $w.Item2
        $process = $w.Item3
        $matched = $false

        # First: Check title patterns (higher priority)
        foreach ($pattern in $titlePatterns.Keys) {
            if ($title -like "*$pattern*") {
                $deskNum = $titlePatterns[$pattern]
                try {
                    $desktop = Get-Desktop -Index ($deskNum - 1)
                    Move-Window -Desktop $desktop -Hwnd $hwnd -ErrorAction SilentlyContinue
                    $shortTitle = if ($title.Length -gt 40) { $title.Substring(0, 37) + "..." } else { $title }
                    Write-Host "  [$($desktopConfig[$deskNum].Name)] $process - $shortTitle" -ForegroundColor Cyan
                    $matched = $true
                } catch { }
                break
            }
        }

        # Second: Check process name patterns (fallback)
        if (-not $matched) {
            foreach ($deskNum in $desktopConfig.Keys) {
                $config = $desktopConfig[$deskNum]
                foreach ($pattern in $config.Patterns) {
                    if ($process -like "*$pattern*") {
                        try {
                            $desktop = Get-Desktop -Index ($deskNum - 1)
                            Move-Window -Desktop $desktop -Hwnd $hwnd -ErrorAction SilentlyContinue
                            $shortTitle = if ($title.Length -gt 40) { $title.Substring(0, 37) + "..." } else { $title }
                            Write-Host "  [$($config.Name)] $process - $shortTitle" -ForegroundColor Gray
                            $matched = $true
                        } catch { }
                        break
                    }
                }
                if ($matched) { break }
            }
        }
    }

    Write-Host "`nDone! Use Win+Ctrl+Arrow to switch desktops." -ForegroundColor Green
}

function Switch-ToDesktop {
    param([int]$Index)
    try {
        $desktop = Get-Desktop -Index ($Index - 1)
        Switch-Desktop -Desktop $desktop
        Write-Host "Switched to Desktop $Index ($($desktopConfig[$Index].Name))" -ForegroundColor Green
    } catch {
        Write-Host "Failed to switch desktop. Use Win+Ctrl+Arrow instead." -ForegroundColor Yellow
    }
}

# Main execution
if ($Setup) {
    Show-CurrentWindows
    Move-WindowsToDesktops
}
elseif ($Dev) {
    Switch-ToDesktop -Index 1
}
elseif ($UI) {
    Switch-ToDesktop -Index 2
}
elseif ($Services) {
    Switch-ToDesktop -Index 3
}
else {
    Write-Host @"

  Desktop Organizer
  =================

  Usage:
    .\organize-desktops.ps1 -Setup      # Create desktops & move windows
    .\organize-desktops.ps1 -Dev        # Switch to Desktop 1 (terminals)
    .\organize-desktops.ps1 -UI         # Switch to Desktop 2 (browsers)
    .\organize-desktops.ps1 -Services   # Switch to Desktop 3 (services)

  Desktop Layout:
    Desktop 1 (Dev):      Terminals, VS Code, Claude Code
    Desktop 2 (UI):       Chrome, Firefox, Edge, Brave
    Desktop 3 (Services): Windows with "node " in title, Electron apps

  Keyboard Shortcuts:
    Win+Ctrl+D        Create new desktop
    Win+Ctrl+Left     Switch to previous desktop
    Win+Ctrl+Right    Switch to next desktop
    Win+Tab           View all desktops
    Win+Ctrl+F4       Close current desktop

"@ -ForegroundColor Cyan

    Show-CurrentWindows
}
