Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

$nodeProcs = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }

if ($nodeProcs) {
    Write-Host "Minimizing $($nodeProcs.Count) node windows..."
    foreach ($proc in $nodeProcs) {
        [Win32]::ShowWindow($proc.MainWindowHandle, 6) | Out-Null  # 6 = minimize
        Write-Host "  - $($proc.MainWindowTitle)"
    }
    Write-Host "Done."
} else {
    Write-Host "No node windows found."
}
