# Test Low-Level Keyboard Input for MSFS
# Uses SendInput API which is more likely to work with games

Write-Host "=== Low-Level Keyboard Test ===" -ForegroundColor Cyan

# Define SendInput API
$code = @"
using System;
using System.Runtime.InteropServices;

public class KeyboardInput {
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
    public static extern short VkKeyScan(char ch);

    public const uint INPUT_KEYBOARD = 1;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const uint KEYEVENTF_SCANCODE = 0x0008;
    
    // Virtual key codes
    public const ushort VK_MENU = 0x12;    // Alt key
    public const ushort VK_LMENU = 0xA4;   // Left Alt
    public const ushort VK_Z = 0x5A;
    public const ushort VK_X = 0x58;

    public static void SendKey(ushort vk, bool keyUp = false) {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_KEYBOARD;
        inputs[0].U.ki.wVk = vk;
        inputs[0].U.ki.dwFlags = keyUp ? KEYEVENTF_KEYUP : 0;
        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    public static void SendAltZ() {
        SendKey(VK_LMENU);      // Alt down
        System.Threading.Thread.Sleep(50);
        SendKey(VK_Z);          // Z down
        System.Threading.Thread.Sleep(50);
        SendKey(VK_Z, true);    // Z up
        System.Threading.Thread.Sleep(50);
        SendKey(VK_LMENU, true); // Alt up
    }

    public static void SendAltX() {
        SendKey(VK_LMENU);      // Alt down
        System.Threading.Thread.Sleep(50);
        SendKey(VK_X);          // X down
        System.Threading.Thread.Sleep(50);
        SendKey(VK_X, true);    // X up
        System.Threading.Thread.Sleep(50);
        SendKey(VK_LMENU, true); // Alt up
    }
}
"@

Add-Type -TypeDefinition $code

# Focus MSFS first
$msfs = Get-Process | Where-Object { $_.MainWindowTitle -like '*Flight Simulator*' }
if ($msfs) {
    Add-Type -AssemblyName Microsoft.VisualBasic
    [Microsoft.VisualBasic.Interaction]::AppActivate($msfs.Id)
    Start-Sleep -Milliseconds 300
    
    Write-Host "Sending Alt+Z via SendInput in 2 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    [KeyboardInput]::SendAltZ()
    Write-Host "Sent Alt+Z" -ForegroundColor Green
    
    Start-Sleep -Seconds 2
    
    Write-Host "Sending Alt+X via SendInput..." -ForegroundColor Yellow
    [Microsoft.VisualBasic.Interaction]::AppActivate($msfs.Id)
    Start-Sleep -Milliseconds 200
    [KeyboardInput]::SendAltX()
    Write-Host "Sent Alt+X" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Did it work this time?" -ForegroundColor Cyan
} else {
    Write-Host "MSFS not found!" -ForegroundColor Red
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
