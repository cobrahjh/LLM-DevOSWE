# Re-enable ALL flight sim devices (Thrustmaster, Saitek)
$targetVids = @('VID_044F', 'VID_06A3')
$logFile = "C:\LLM-DevOSWE\device-result.txt"
$results = @()

foreach ($vid in $targetVids) {
    $devices = Get-PnpDevice -InstanceId "*$vid*" -ErrorAction SilentlyContinue
    foreach ($dev in $devices) {
        if ($dev.Status -ne 'OK') {
            try {
                Enable-PnpDevice -InstanceId $dev.InstanceId -Confirm:$false -ErrorAction Stop
                $results += "ENABLED: $($dev.InstanceId) ($($dev.FriendlyName)) was $($dev.Status)"
            } catch {
                $results += "FAIL: $($dev.InstanceId) ($($dev.FriendlyName)) - $($_.Exception.Message)"
            }
        } else {
            $results += "OK: $($dev.InstanceId) ($($dev.FriendlyName)) - already OK"
        }
    }
}

$results | Out-File $logFile -Encoding UTF8
$results | ForEach-Object { Write-Host $_ }
