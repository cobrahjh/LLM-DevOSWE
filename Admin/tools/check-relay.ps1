$conn = Get-NetTCPConnection -LocalPort 8600 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    $proc = Get-Process -Id $conn.OwningProcess
    Write-Host "PID: $($proc.Id)"
    Write-Host "Name: $($proc.ProcessName)"
    Write-Host "Path: $($proc.Path)"

    # Check command line
    $wmi = Get-WmiObject Win32_Process -Filter "ProcessId = $($proc.Id)"
    Write-Host "CommandLine: $($wmi.CommandLine)"
} else {
    Write-Host "Port 8600 not listening"
}
