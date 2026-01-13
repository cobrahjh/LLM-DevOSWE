# vJoy Button Controller for ChasePlane
# SimWidget_Engine - Harold-PC
# v1.0.0 - Last updated: 2026-01-06

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("TCM", "NCV", "PCV", "VTG", "DRN", "RST")]
    [string]$Command
)

# Button mappings for ChasePlane
$ButtonMap = @{
    "TCM" = 1  # Toggle Cinematic Mode
    "NCV" = 2  # Next Cinematic View
    "PCV" = 3  # Previous Cinematic View
    "VTG" = 4  # View Toggle (Internal/External)
    "DRN" = 5  # Drone Toggle
    "RST" = 6  # Reset View
}

$DeviceId = 1
$ButtonId = $ButtonMap[$Command]
$HoldTime = 100

# Load vJoy interface via P/Invoke
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class VJoy {
    [DllImport("C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll")]
    public static extern bool vJoyEnabled();
    
    [DllImport("C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll")]
    public static extern int GetVJDStatus(uint rID);
    
    [DllImport("C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll")]
    public static extern bool AcquireVJD(uint rID);
    
    [DllImport("C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll")]
    public static extern void RelinquishVJD(uint rID);
    
    [DllImport("C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll")]
    public static extern bool SetBtn(bool Value, uint rID, byte nBtn);
    
    [DllImport("C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll")]
    public static extern bool ResetButtons(uint rID);
}
"@

try {
    # Check vJoy is enabled
    if (-not [VJoy]::vJoyEnabled()) {
        Write-Error "vJoy driver not enabled"
        exit 1
    }
    
    # Check device status: 0=Own, 1=Free, 2=Busy, 3=Missing
    $status = [VJoy]::GetVJDStatus($DeviceId)
    
    if ($status -eq 1) {
        # Free - acquire it
        $acquired = [VJoy]::AcquireVJD($DeviceId)
        if (-not $acquired) {
            Write-Error "Failed to acquire vJoy device $DeviceId"
            exit 1
        }
    } elseif ($status -ne 0) {
        # Not owned by us and not free
        Write-Error "vJoy device $DeviceId not available (status: $status)"
        exit 1
    }
    
    # Press button
    [VJoy]::SetBtn($true, $DeviceId, [byte]$ButtonId)
    
    # Hold for duration
    Start-Sleep -Milliseconds $HoldTime
    
    # Release button
    [VJoy]::SetBtn($false, $DeviceId, [byte]$ButtonId)
    
    Write-Output "OK: Button $ButtonId ($Command) pressed"
    
} catch {
    Write-Error "vJoy error: $_"
    exit 1
}
