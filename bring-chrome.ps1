Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
}
"@

$proc = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1

if ($proc) {
    Write-Host "Found Chrome: $($proc.MainWindowTitle)"
    [Win32]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null
    [Win32]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
    [Win32]::MoveWindow($proc.MainWindowHandle, 100, 100, 1200, 800, $true) | Out-Null
    Write-Host "Window moved"
} else {
    Write-Host "Chrome not found"
}
