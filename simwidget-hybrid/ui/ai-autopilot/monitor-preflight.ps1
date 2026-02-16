# AI Autopilot PREFLIGHT Command Monitor (PowerShell)
# Watches for SET_AIRCRAFT_READY command in real-time

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  AI Autopilot PREFLIGHT Monitor" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Monitoring: http://192.168.1.42:8080/api/ai-autopilot/state"
Write-Host "Waiting for PREFLIGHT phase and SET_AIRCRAFT_READY command..."
Write-Host ""
Write-Host "Instructions:" -ForegroundColor Yellow
Write-Host "1. Load MSFS 2024 in cold & dark (engine off, chocks visible)"
Write-Host "2. Enable AI Autopilot via browser or API"
Write-Host "3. Watch this terminal for command activity"
Write-Host ""
Write-Host "Press Ctrl+C to stop monitoring"
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$prevPhase = ""
$foundReady = $false

while ($true) {
    try {
        # Fetch current state
        $response = Invoke-RestMethod -Uri "http://192.168.1.42:8080/api/ai-autopilot/state" -ErrorAction Stop

        $phase = $response.phase
        $enabled = $response.enabled
        $commandLog = $response.commandLog

        # Check if phase changed
        if ($phase -ne $prevPhase) {
            $timestamp = Get-Date -Format "HH:mm:ss"
            if ($phase -eq "PREFLIGHT") {
                Write-Host "[$timestamp] 🛫 PREFLIGHT phase started - watching for SET_AIRCRAFT_READY..." -ForegroundColor Green
            } elseif ($phase -eq "TAXI") {
                Write-Host "[$timestamp] 🚕 TAXI phase - PREFLIGHT complete" -ForegroundColor Green
            } else {
                Write-Host "[$timestamp] Phase: $phase" -ForegroundColor Gray
            }
            $prevPhase = $phase
        }

        # Show last 5 commands
        Write-Host "`rCommands: " -NoNewline -ForegroundColor DarkGray
        $recentCommands = $commandLog | Select-Object -First 5
        foreach ($cmd in $recentCommands) {
            if ($cmd.type -eq "SET_AIRCRAFT_READY") {
                Write-Host "$($cmd.type) " -NoNewline -ForegroundColor Green
            } else {
                Write-Host "$($cmd.type) " -NoNewline -ForegroundColor DarkGray
            }
        }

        # Check for SET_AIRCRAFT_READY
        $readyCmd = $commandLog | Where-Object { $_.type -eq "SET_AIRCRAFT_READY" } | Select-Object -First 1
        if ($readyCmd -and -not $foundReady) {
            Write-Host ""
            Write-Host ""
            Write-Host "=========================================" -ForegroundColor Green
            Write-Host "  ✅ SET_AIRCRAFT_READY DETECTED!" -ForegroundColor Green
            Write-Host "=========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Command details:" -ForegroundColor Yellow
            Write-Host "  Type: $($readyCmd.type)"
            Write-Host "  Value: $($readyCmd.value)"
            Write-Host "  Description: $($readyCmd.description)"
            Write-Host "  Time: $(Get-Date -UnixTimeSeconds ($readyCmd.time/1000) -Format 'HH:mm:ss')"
            Write-Host ""
            Write-Host "Check MSFS for ground equipment removal:" -ForegroundColor Yellow
            Write-Host "  - Chocks removed from wheels"
            Write-Host "  - Wheel covers disappeared"
            Write-Host "  - Pitot cover gone"
            Write-Host "  - Ground power disconnected"
            Write-Host ""
            Write-Host "Full command history (last 10):" -ForegroundColor Cyan
            $commandLog | Select-Object -First 10 | ForEach-Object -Begin { $i = 1 } -Process {
                $marker = if ($_.type -eq "SET_AIRCRAFT_READY") { "→" } else { " " }
                $color = if ($_.type -eq "SET_AIRCRAFT_READY") { "Green" } else { "White" }
                Write-Host ("{0,2}. {1} {2,-20} - {3}" -f $i, $marker, $_.type, $_.description) -ForegroundColor $color
                $i++
            }
            Write-Host ""
            $foundReady = $true
        }

    } catch {
        $timestamp = Get-Date -Format "HH:mm:ss"
        Write-Host "[$timestamp] ⚠️  Server not responding..." -ForegroundColor Red
    }

    Start-Sleep -Milliseconds 500
}
