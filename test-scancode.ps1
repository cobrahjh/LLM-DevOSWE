# Test scancode-based keyboard input for ChasePlane
# Scancodes bypass some game input filtering

Write-Host "=== Scancode Keyboard Test ===" -ForegroundColor Cyan

$code = @"
using System;
using System.Runtime.InteropServices;

public class ScanInput {
    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type;
        public InputUnion U;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion {
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    public static extern uint MapVirtualKey(uint uCode, uint uMapType);

    public const uint INPUT_KEYBOARD = 1;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const uint KEYEVENTF_SCANCODE = 0x0008;
    
    // Scancodes (hardware-level)
    public const ushort SCAN_LALT = 0x38;
    public const ushort SCAN_Z = 0x2C;
    public const ushort SCAN_X = 0x2D;
    public const ushort SCAN_BACKSPACE = 0x0E;

    public static void SendScanKey(ushort scan, bool keyUp) {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_KEYBOARD;
        inputs[0].U.ki.wVk = 0;  // No virtual key - pure scancode
        inputs[0].U.ki.wScan = scan;
        inputs[0].U.ki.dwFlags = KEYEVENTF_SCANCODE | (keyUp ? KEYEVENTF_KEYUP : 0);
        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    public static void SendAltZ_Scancode() {
        SendScanKey(SCAN_LALT, false);   // Alt down
        System.Threading.Thread.Sleep(30);
        SendScanKey(SCAN_Z, false);       // Z down
        System.Threading.Thread.Sleep(30);
        SendScanKey(SCAN_Z, true);        // Z up
        System.Threading.Thread.Sleep(30);
        SendScanKey(SCAN_LALT, true);     // Alt up
    }

    public static void SendAltX_Scancode() {
        SendScanKey(SCAN_LALT, false);   // Alt down
        System.Threading.Thread.Sleep(30);
        SendScanKey(SCAN_X, false);       // X down
        System.Threading.Thread.Sleep(30);
        SendScanKey(SCAN_X, true);        // X up
        System.Threading.Thread.Sleep(30);
        SendScanKey(SCAN_LALT, true);     // Alt up
    }

    public static void SendBackspace_Scancode() {
        SendScanKey(SCAN_BACKSPACE, false);  // Backspace down
        System.Threading.Thread.Sleep(30);
        SendScanKey(SCAN_BACKSPACE, true);   // Backspace up
    }
}
"@

Add-Type -TypeDefinition $code

# Focus MSFS
$msfs = Get-Process | Where-Object { $_.MainWindowTitle -like '*Flight Simulator*' }
if ($msfs) {
    Add-Type -AssemblyName Microsoft.VisualBasic
    [Microsoft.VisualBasic.Interaction]::AppActivate($msfs.Id)
    Start-Sleep -Milliseconds 300
    
    Write-Host "Found MSFS: $($msfs.MainWindowTitle)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Sending Alt+Z via SCANCODE in 2 seconds..." -ForegroundColor Yellow
    Write-Host "(This bypasses some input filtering)" -ForegroundColor Gray
    Start-Sleep -Seconds 2
    
    [ScanInput]::SendAltZ_Scancode()
    Write-Host "Sent Alt+Z (scancode)" -ForegroundColor Green
    
    Start-Sleep -Seconds 2
    
    Write-Host "Sending Alt+X via SCANCODE..." -ForegroundColor Yellow
    [Microsoft.VisualBasic.Interaction]::AppActivate($msfs.Id)
    Start-Sleep -Milliseconds 200
    [ScanInput]::SendAltX_Scancode()
    Write-Host "Sent Alt+X (scancode)" -ForegroundColor Green
    
    Start-Sleep -Seconds 2
    
    Write-Host "Sending Backspace (toggle internal/external)..." -ForegroundColor Yellow
    [Microsoft.VisualBasic.Interaction]::AppActivate($msfs.Id)
    Start-Sleep -Milliseconds 200
    [ScanInput]::SendBackspace_Scancode()
    Write-Host "Sent Backspace (scancode)" -ForegroundColor Green
    
} else {
    Write-Host "MSFS not found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Did ChasePlane respond this time?" -ForegroundColor Cyan
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
