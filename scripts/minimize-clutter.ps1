# Minimize non-essential windows to reduce clutter
# Keeps terminal windows visible, minimizes everything else

param(
    [switch]$All,           # Minimize ALL windows
    [switch]$Browsers,      # Minimize only browsers
    [switch]$Services,      # Minimize service/node windows
    [switch]$Restore,       # Restore all minimized windows
    [switch]$List           # List all windows
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;

public class WinAPI {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    public const int SW_MINIMIZE = 6;
    public const int SW_RESTORE = 9;

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static List<Tuple<IntPtr, string, string, bool>> GetAllWindows() {
        var windows = new List<Tuple<IntPtr, string, string, bool>>();
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
                        bool minimized = IsIconic(hWnd);
                        windows.Add(Tuple.Create(hWnd, sb.ToString(), proc.ProcessName, minimized));
                    } catch { }
                }
            }
            return true;
        }, IntPtr.Zero);
        return windows;
    }
}
"@

# Patterns to KEEP visible (don't minimize these)
$keepVisible = @(
    "WindowsTerminal",
    "powershell",
    "pwsh",
    "cmd",
    "claude"
)

# Browser patterns
$browserPatterns = @(
    "chrome",
    "firefox",
    "msedge",
    "brave",
    "opera"
)

# Service/background app patterns
$servicePatterns = @(
    "node",
    "electron",
    "conhost"
)

function Get-Windows {
    return [WinAPI]::GetAllWindows()
}

function Minimize-Window($hwnd) {
    [WinAPI]::ShowWindow($hwnd, [WinAPI]::SW_MINIMIZE) | Out-Null
}

function Restore-Window($hwnd) {
    [WinAPI]::ShowWindow($hwnd, [WinAPI]::SW_RESTORE) | Out-Null
}

function Show-Windows {
    Write-Host "`nVisible Windows:" -ForegroundColor Cyan
    Write-Host ("-" * 80)
    Write-Host ("{0,-20} {1,-8} {2}" -f "Process", "State", "Title") -ForegroundColor Gray
    Write-Host ("-" * 80)

    $windows = Get-Windows
    foreach ($w in $windows) {
        $state = if ($w.Item4) { "[min]" } else { "[vis]" }
        $stateColor = if ($w.Item4) { "DarkGray" } else { "White" }
        $title = if ($w.Item2.Length -gt 45) { $w.Item2.Substring(0, 42) + "..." } else { $w.Item2 }
        Write-Host ("{0,-20} " -f $w.Item3) -NoNewline
        Write-Host ("{0,-8} " -f $state) -ForegroundColor $stateColor -NoNewline
        Write-Host $title
    }
    Write-Host ("-" * 80)
}

function Minimize-ByPattern {
    param(
        [string[]]$Patterns,
        [string]$Category
    )

    $windows = Get-Windows
    $count = 0

    foreach ($w in $windows) {
        $hwnd = $w.Item1
        $process = $w.Item3
        $isMinimized = $w.Item4

        if (-not $isMinimized) {
            foreach ($pattern in $Patterns) {
                if ($process -like "*$pattern*") {
                    Minimize-Window $hwnd
                    Write-Host "  Minimized: $process" -ForegroundColor Gray
                    $count++
                    break
                }
            }
        }
    }

    Write-Host "Minimized $count $Category windows" -ForegroundColor Green
}

function Minimize-AllExceptTerminals {
    $windows = Get-Windows
    $count = 0

    foreach ($w in $windows) {
        $hwnd = $w.Item1
        $process = $w.Item3
        $isMinimized = $w.Item4

        # Skip if already minimized
        if ($isMinimized) { continue }

        # Check if should keep visible
        $keep = $false
        foreach ($pattern in $keepVisible) {
            if ($process -like "*$pattern*") {
                $keep = $true
                break
            }
        }

        if (-not $keep) {
            Minimize-Window $hwnd
            Write-Host "  Minimized: $process" -ForegroundColor Gray
            $count++
        }
    }

    Write-Host "`nMinimized $count windows. Terminals kept visible." -ForegroundColor Green
}

function Restore-AllWindows {
    $windows = Get-Windows
    $count = 0

    foreach ($w in $windows) {
        if ($w.Item4) {  # Is minimized
            Restore-Window $w.Item1
            $count++
        }
    }

    Write-Host "Restored $count windows" -ForegroundColor Green
}

# Main
if ($List) {
    Show-Windows
}
elseif ($All) {
    Write-Host "Minimizing all non-terminal windows..." -ForegroundColor Yellow
    Minimize-AllExceptTerminals
}
elseif ($Browsers) {
    Write-Host "Minimizing browsers..." -ForegroundColor Yellow
    Minimize-ByPattern -Patterns $browserPatterns -Category "browser"
}
elseif ($Services) {
    Write-Host "Minimizing service windows..." -ForegroundColor Yellow
    Minimize-ByPattern -Patterns $servicePatterns -Category "service"
}
elseif ($Restore) {
    Write-Host "Restoring all windows..." -ForegroundColor Yellow
    Restore-AllWindows
}
else {
    Write-Host @"

  Window Clutter Manager
  ======================

  Usage:
    .\minimize-clutter.ps1 -All        # Minimize everything except terminals
    .\minimize-clutter.ps1 -Browsers   # Minimize only browsers
    .\minimize-clutter.ps1 -Services   # Minimize node/electron windows
    .\minimize-clutter.ps1 -Restore    # Restore all minimized windows
    .\minimize-clutter.ps1 -List       # List all windows

  Protected (never minimized):
    - WindowsTerminal, PowerShell, cmd, Claude Code

  Quick keyboard alternative:
    Win+D         = Show desktop (minimize all)
    Win+D again   = Restore all

"@ -ForegroundColor Cyan

    Show-Windows
}
