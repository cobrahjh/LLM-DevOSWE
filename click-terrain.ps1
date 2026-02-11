Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MouseHelper {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint cData, int dwExtraInfo);
    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(100);
        mouse_event(0x0002, 0, 0, 0, 0); // MOUSEEVENTF_LEFTDOWN
        mouse_event(0x0004, 0, 0, 0, 0); // MOUSEEVENTF_LEFTUP
    }
}
"@

# Get screen dimensions for the browser with GTN750
$browser = Get-Process | Where-Object { $_.MainWindowTitle -match 'GTN|SimGlass' } | Select-Object -First 1

if ($browser) {
    Write-Host "Found browser: $($browser.MainWindowTitle)"

    # The TERRAIN button appears to be in the top-right area of the GTN750
    # Based on the screenshot, GTN750 is on the right side of screen
    # Screen resolution appears to be ~1920x1080
    # The TERRAIN tab is approximately at x=1100, y=120 area
    # Let me try clicking in that region

    # First click TERRAIN tab (rightmost of MAP/TRAFFIC/TERRAIN)
    [MouseHelper]::Click(1100, 120)
    Start-Sleep -Seconds 1
    Write-Host "Clicked TERRAIN tab"
} else {
    Write-Host "Browser not found - opening GTN750"
    Start-Process "http://192.168.1.42:8080/ui/gtn750/"
    Start-Sleep -Seconds 5
}

Start-Sleep -Seconds 2

# Take screenshot
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Host "Screen: $($s.Width)x$($s.Height)"
$bmp = New-Object Drawing.Bitmap $s.Width, $s.Height
$g = [Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($s.Location, [Drawing.Point]::Empty, $s.Size)
$bmp.Save('C:\LLM-DevOSWE\screenshot-harold.png')
$g.Dispose(); $bmp.Dispose()
Write-Host "Screenshot saved"
