# Disable flight sim devices (Thrustmaster, Saitek) so AI autopilot can control throttle
# Run with: schtasks /Run /TN DisableFlightDevices
# Must run as SYSTEM to have PnP device control rights
param(
    [switch]$Enable
)

$action = if ($Enable) { "Enable" } else { "Disable" }
$targetVids = @('VID_044F', 'VID_06A3')  # Thrustmaster, Saitek
$logFile = "C:\LLM-DevOSWE\device-result.txt"

$results = @()
foreach ($vid in $targetVids) {
    $devices = Get-PnpDevice -InstanceId "*$vid*" -ErrorAction SilentlyContinue
    foreach ($dev in $devices) {
        if ($Enable -and $dev.Status -ne 'OK') {
            try {
                Enable-PnpDevice -InstanceId $dev.InstanceId -Confirm:$false -ErrorAction Stop
                $results += "ENABLED: $($dev.InstanceId) ($($dev.FriendlyName))"
            } catch {
                $results += "FAIL-ENABLE: $($dev.InstanceId) - $($_.Exception.Message)"
            }
        } elseif (-not $Enable -and $dev.Status -eq 'OK') {
            try {
                Disable-PnpDevice -InstanceId $dev.InstanceId -Confirm:$false -ErrorAction Stop
                $results += "DISABLED: $($dev.InstanceId) ($($dev.FriendlyName))"
            } catch {
                $results += "FAIL-DISABLE: $($dev.InstanceId) - $($_.Exception.Message)"
            }
        } else {
            $results += "SKIP: $($dev.InstanceId) ($($dev.FriendlyName)) - already $($dev.Status)"
        }
    }
}

$results | Out-File $logFile -Encoding UTF8
$results | ForEach-Object { Write-Host $_ }
