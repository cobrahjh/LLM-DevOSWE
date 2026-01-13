# Release vJoy device
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class VJoy {
    [DllImport("C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll")]
    public static extern void RelinquishVJD(uint rID);
    [DllImport("C:\\Program Files\\vJoy\\x64\\vJoyInterface.dll")]
    public static extern bool ResetButtons(uint rID);
}
"@

[VJoy]::ResetButtons(1)
[VJoy]::RelinquishVJD(1)
Write-Output "vJoy Device 1 released"
