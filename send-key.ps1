param([string]$Key)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class KeySender {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    
    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();
    
    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    
    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);
    
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    
    // Virtual Key Codes
    public const byte VK_MENU = 0x12;      // Alt
    public const byte VK_CONTROL = 0x11;   // Ctrl
    public const byte VK_SHIFT = 0x10;     // Shift
    public const byte VK_SPACE = 0x20;     // Space
    public const byte VK_BACK = 0x08;      // Backspace
    public const byte VK_TAB = 0x09;       // Tab
    public const byte VK_RETURN = 0x0D;    // Enter
    public const byte VK_END = 0x23;       // End
    public const byte VK_HOME = 0x24;      // Home
    public const byte VK_INSERT = 0x2D;    // Insert
    public const byte VK_DELETE = 0x2E;    // Delete
    public const byte VK_LEFT = 0x25;      // Left Arrow
    public const byte VK_UP = 0x26;        // Up Arrow
    public const byte VK_RIGHT = 0x27;     // Right Arrow
    public const byte VK_DOWN = 0x28;      // Down Arrow
    
    // Function keys
    public const byte VK_F1 = 0x70;
    public const byte VK_F2 = 0x71;
    public const byte VK_F3 = 0x72;
    public const byte VK_F4 = 0x73;
    public const byte VK_F5 = 0x74;
    public const byte VK_F6 = 0x75;
    public const byte VK_F7 = 0x76;
    public const byte VK_F8 = 0x77;
    public const byte VK_F9 = 0x78;
    public const byte VK_F10 = 0x79;
    public const byte VK_F11 = 0x7A;
    public const byte VK_F12 = 0x7B;
    
    // Number keys
    public const byte VK_0 = 0x30;
    public const byte VK_1 = 0x31;
    public const byte VK_2 = 0x32;
    public const byte VK_3 = 0x33;
    public const byte VK_4 = 0x34;
    public const byte VK_5 = 0x35;
    public const byte VK_6 = 0x36;
    public const byte VK_7 = 0x37;
    public const byte VK_8 = 0x38;
    public const byte VK_9 = 0x39;
    
    // Numpad
    public const byte VK_NUMPAD0 = 0x60;
    public const byte VK_NUMPAD1 = 0x61;
    public const byte VK_NUMPAD2 = 0x62;
    public const byte VK_NUMPAD3 = 0x63;
    public const byte VK_NUMPAD4 = 0x64;
    public const byte VK_NUMPAD5 = 0x65;
    public const byte VK_NUMPAD6 = 0x66;
    public const byte VK_NUMPAD7 = 0x67;
    public const byte VK_NUMPAD8 = 0x68;
    public const byte VK_NUMPAD9 = 0x69;
    public const byte VK_ADD = 0x6B;       // Numpad +
    public const byte VK_SUBTRACT = 0x6D;  // Numpad -
    
    // Letters
    public const byte VK_A = 0x41;
    public const byte VK_F = 0x46;
    public const byte VK_S = 0x53;
    public const byte VK_X = 0x58;
    public const byte VK_Z = 0x5A;
    
    // Symbols
    public const byte VK_OEM_PLUS = 0xBB;   // = key
    public const byte VK_OEM_MINUS = 0xBD;  // - key
    
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    public const int SW_SHOW = 5;
    
    public static bool ForceForeground(IntPtr hWnd) {
        IntPtr foreground = GetForegroundWindow();
        if (foreground == hWnd) return true;
        
        uint foreThread, ourThread;
        uint foreProcess;
        foreThread = GetWindowThreadProcessId(foreground, out foreProcess);
        ourThread = GetCurrentThreadId();
        
        bool attached = false;
        if (foreThread != ourThread) {
            attached = AttachThreadInput(ourThread, foreThread, true);
        }
        
        ShowWindow(hWnd, SW_SHOW);
        BringWindowToTop(hWnd);
        SetForegroundWindow(hWnd);
        
        if (attached) {
            AttachThreadInput(ourThread, foreThread, false);
        }
        
        Thread.Sleep(50);
        return GetForegroundWindow() == hWnd;
    }
    
    public static void SendKey(byte vk, bool extended = false) {
        uint flags = extended ? KEYEVENTF_EXTENDEDKEY : 0;
        keybd_event(vk, 0, flags, UIntPtr.Zero);
        Thread.Sleep(30);
        keybd_event(vk, 0, KEYEVENTF_KEYUP | flags, UIntPtr.Zero);
    }
    
    public static void SendModifiedKey(byte modifier, byte vk, bool extended = false) {
        keybd_event(modifier, 0, 0, UIntPtr.Zero);
        Thread.Sleep(30);
        uint flags = extended ? KEYEVENTF_EXTENDEDKEY : 0;
        keybd_event(vk, 0, flags, UIntPtr.Zero);
        Thread.Sleep(30);
        keybd_event(vk, 0, KEYEVENTF_KEYUP | flags, UIntPtr.Zero);
        Thread.Sleep(30);
        keybd_event(modifier, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
    
    public static void SendDoubleModifiedKey(byte mod1, byte mod2, byte vk) {
        keybd_event(mod1, 0, 0, UIntPtr.Zero);
        Thread.Sleep(20);
        keybd_event(mod2, 0, 0, UIntPtr.Zero);
        Thread.Sleep(30);
        keybd_event(vk, 0, 0, UIntPtr.Zero);
        Thread.Sleep(30);
        keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        Thread.Sleep(20);
        keybd_event(mod2, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        Thread.Sleep(20);
        keybd_event(mod1, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@

$msfs = Get-Process | Where-Object { $_.ProcessName -match 'FlightSimulator' -or $_.ProcessName -eq 'FlightSimulator2024' } | Select-Object -First 1

# Debug output
Write-Host "DEBUG: Looking for MSFS process..."
if ($msfs) {
    Write-Host "DEBUG: Found process: $($msfs.ProcessName) (PID: $($msfs.Id))"
    Write-Host "DEBUG: MainWindowHandle: $($msfs.MainWindowHandle)"
} else {
    Write-Host "DEBUG: No MSFS process found!"
}

if ($msfs -and $msfs.MainWindowHandle -ne 0) {
    Write-Host "DEBUG: Attempting to focus window..."
    $focused = [KeySender]::ForceForeground($msfs.MainWindowHandle)
    Write-Host "DEBUG: Focus result: $focused"
    
    if (-not $focused) {
        Write-Host "Warning: Could not focus MSFS"
    }
    
    # Parse modifier+key combos
    $parts = $Key.ToUpper() -split '\+'
    
    switch ($Key.ToUpper()) {
        # Single keys
        "F1" { [KeySender]::SendKey([KeySender]::VK_F1) }
        "F2" { [KeySender]::SendKey([KeySender]::VK_F2) }
        "F3" { [KeySender]::SendKey([KeySender]::VK_F3) }
        "F4" { [KeySender]::SendKey([KeySender]::VK_F4) }
        "F5" { [KeySender]::SendKey([KeySender]::VK_F5) }
        "F6" { [KeySender]::SendKey([KeySender]::VK_F6) }
        "F7" { [KeySender]::SendKey([KeySender]::VK_F7) }
        "F8" { [KeySender]::SendKey([KeySender]::VK_F8) }
        "F9" { [KeySender]::SendKey([KeySender]::VK_F9) }
        "F10" { [KeySender]::SendKey([KeySender]::VK_F10) }
        "F11" { [KeySender]::SendKey([KeySender]::VK_F11) }
        "F12" { [KeySender]::SendKey([KeySender]::VK_F12) }
        "END" { [KeySender]::SendKey([KeySender]::VK_END, $true) }
        "HOME" { [KeySender]::SendKey([KeySender]::VK_HOME, $true) }
        "INSERT" { [KeySender]::SendKey([KeySender]::VK_INSERT, $true) }
        "DELETE" { [KeySender]::SendKey([KeySender]::VK_DELETE, $true) }
        "BACKSPACE" { [KeySender]::SendKey([KeySender]::VK_BACK) }
        "SPACE" { [KeySender]::SendKey([KeySender]::VK_SPACE) }
        "TAB" { [KeySender]::SendKey([KeySender]::VK_TAB) }
        "ENTER" { [KeySender]::SendKey([KeySender]::VK_RETURN) }
        "UP" { [KeySender]::SendKey([KeySender]::VK_UP, $true) }
        "DOWN" { [KeySender]::SendKey([KeySender]::VK_DOWN, $true) }
        "LEFT" { [KeySender]::SendKey([KeySender]::VK_LEFT, $true) }
        "RIGHT" { [KeySender]::SendKey([KeySender]::VK_RIGHT, $true) }
        "=" { [KeySender]::SendKey([KeySender]::VK_OEM_PLUS) }
        "-" { [KeySender]::SendKey([KeySender]::VK_OEM_MINUS) }
        "NUMPAD0" { [KeySender]::SendKey([KeySender]::VK_NUMPAD0) }
        "NUMPAD1" { [KeySender]::SendKey([KeySender]::VK_NUMPAD1) }
        "NUMPAD2" { [KeySender]::SendKey([KeySender]::VK_NUMPAD2) }
        "NUMPAD3" { [KeySender]::SendKey([KeySender]::VK_NUMPAD3) }
        "NUMPAD4" { [KeySender]::SendKey([KeySender]::VK_NUMPAD4) }
        "NUMPAD5" { [KeySender]::SendKey([KeySender]::VK_NUMPAD5) }
        "NUMPAD6" { [KeySender]::SendKey([KeySender]::VK_NUMPAD6) }
        "NUMPAD7" { [KeySender]::SendKey([KeySender]::VK_NUMPAD7) }
        "NUMPAD8" { [KeySender]::SendKey([KeySender]::VK_NUMPAD8) }
        "NUMPAD9" { [KeySender]::SendKey([KeySender]::VK_NUMPAD9) }
        "A" { [KeySender]::SendKey([KeySender]::VK_A) }
        "F" { [KeySender]::SendKey([KeySender]::VK_F) }
        "PAGEUP" { [KeySender]::SendKey(0x21, $true) }
        "PAGEDOWN" { [KeySender]::SendKey(0x22, $true) }
        
        # Shift combos
        "SHIFT+A" { [KeySender]::SendModifiedKey([KeySender]::VK_SHIFT, [KeySender]::VK_A) }
        "SHIFT+X" { [KeySender]::SendModifiedKey([KeySender]::VK_SHIFT, [KeySender]::VK_X) }
        "SHIFT+F1" { [KeySender]::SendModifiedKey([KeySender]::VK_SHIFT, [KeySender]::VK_F1) }
        "SHIFT+F2" { [KeySender]::SendModifiedKey([KeySender]::VK_SHIFT, [KeySender]::VK_F2) }
        "SHIFT+F3" { [KeySender]::SendModifiedKey([KeySender]::VK_SHIFT, [KeySender]::VK_F3) }
        "SHIFT+F4" { [KeySender]::SendModifiedKey([KeySender]::VK_SHIFT, [KeySender]::VK_F4) }
        "SHIFT+F5" { [KeySender]::SendModifiedKey([KeySender]::VK_SHIFT, [KeySender]::VK_F5) }
        "SHIFT+F6" { [KeySender]::SendModifiedKey([KeySender]::VK_SHIFT, [KeySender]::VK_F6) }
        "SHIFT+F7" { [KeySender]::SendModifiedKey([KeySender]::VK_SHIFT, [KeySender]::VK_F7) }
        "SHIFT+F8" { [KeySender]::SendModifiedKey([KeySender]::VK_SHIFT, [KeySender]::VK_F8) }
        
        # Alt combos
        "ALT+Z" { [KeySender]::SendModifiedKey([KeySender]::VK_MENU, [KeySender]::VK_Z) }
        "ALT+X" { [KeySender]::SendModifiedKey([KeySender]::VK_MENU, [KeySender]::VK_X) }
        "ALT+0" { [KeySender]::SendModifiedKey([KeySender]::VK_MENU, [KeySender]::VK_0) }
        "ALT+1" { [KeySender]::SendModifiedKey([KeySender]::VK_MENU, [KeySender]::VK_1) }
        "ALT+2" { [KeySender]::SendModifiedKey([KeySender]::VK_MENU, [KeySender]::VK_2) }
        "ALT+3" { [KeySender]::SendModifiedKey([KeySender]::VK_MENU, [KeySender]::VK_3) }
        "ALT+4" { [KeySender]::SendModifiedKey([KeySender]::VK_MENU, [KeySender]::VK_4) }
        "ALT+5" { [KeySender]::SendModifiedKey([KeySender]::VK_MENU, [KeySender]::VK_5) }
        "ALT+6" { [KeySender]::SendModifiedKey([KeySender]::VK_MENU, [KeySender]::VK_6) }
        "ALT+7" { [KeySender]::SendModifiedKey([KeySender]::VK_MENU, [KeySender]::VK_7) }
        "ALT+8" { [KeySender]::SendModifiedKey([KeySender]::VK_MENU, [KeySender]::VK_8) }
        "ALT+9" { [KeySender]::SendModifiedKey([KeySender]::VK_MENU, [KeySender]::VK_9) }
        
        # Ctrl combos
        "CTRL+SPACE" { [KeySender]::SendModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_SPACE) }
        "CTRL+END" { [KeySender]::SendModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_END, $true) }
        "CTRL+TAB" { [KeySender]::SendModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_TAB) }
        "CTRL+UP" { [KeySender]::SendModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_UP, $true) }
        "CTRL+DOWN" { [KeySender]::SendModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_DOWN, $true) }
        "CTRL+PAGEUP" { [KeySender]::SendModifiedKey([KeySender]::VK_CONTROL, 0x21, $true) }
        "CTRL+PAGEDOWN" { [KeySender]::SendModifiedKey([KeySender]::VK_CONTROL, 0x22, $true) }
        
        # Ctrl+Alt combos
        "CTRL+ALT+0" { [KeySender]::SendDoubleModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_MENU, [KeySender]::VK_0) }
        "CTRL+ALT+1" { [KeySender]::SendDoubleModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_MENU, [KeySender]::VK_1) }
        "CTRL+ALT+2" { [KeySender]::SendDoubleModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_MENU, [KeySender]::VK_2) }
        "CTRL+ALT+3" { [KeySender]::SendDoubleModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_MENU, [KeySender]::VK_3) }
        "CTRL+ALT+4" { [KeySender]::SendDoubleModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_MENU, [KeySender]::VK_4) }
        "CTRL+ALT+5" { [KeySender]::SendDoubleModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_MENU, [KeySender]::VK_5) }
        "CTRL+ALT+6" { [KeySender]::SendDoubleModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_MENU, [KeySender]::VK_6) }
        "CTRL+ALT+7" { [KeySender]::SendDoubleModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_MENU, [KeySender]::VK_7) }
        "CTRL+ALT+8" { [KeySender]::SendDoubleModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_MENU, [KeySender]::VK_8) }
        "CTRL+ALT+9" { [KeySender]::SendDoubleModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_MENU, [KeySender]::VK_9) }
        "CTRL+ALT+S" { [KeySender]::SendDoubleModifiedKey([KeySender]::VK_CONTROL, [KeySender]::VK_MENU, [KeySender]::VK_S) }
        
        default {
            Write-Host "Unknown key: $Key"
            exit 1
        }
    }
    
    Write-Host "Sent: $Key"
} else {
    Write-Error "MSFS window not found"
    exit 1
}
