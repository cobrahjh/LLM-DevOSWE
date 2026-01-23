# Install Hive Bridge as Windows Service on AI-PC
# Run as Administrator

$serviceName = "HiveBridge"
$nodePath = "C:\Program Files\nodejs\node.exe"
$scriptPath = "C:\Hive\services\hive-bridge.js"
$logPath = "C:\Hive\logs"

Write-Host "Installing Hive Bridge as Windows Service..." -ForegroundColor Cyan

# Check if NSSM exists
$nssm = "C:\nssm\nssm.exe"
if (-not (Test-Path $nssm)) {
    Write-Host "NSSM not found. Downloading..." -ForegroundColor Yellow

    # Download NSSM
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $zipPath = "$env:TEMP\nssm.zip"

    Invoke-WebRequest -Uri $nssmUrl -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath "C:\" -Force
    Rename-Item "C:\nssm-2.24" "C:\nssm"
    $nssm = "C:\nssm\win64\nssm.exe"
}

# Stop and remove existing service if present
& $nssm stop $serviceName 2>$null
& $nssm remove $serviceName confirm 2>$null

# Install the service
Write-Host "Creating service: $serviceName" -ForegroundColor Green
& $nssm install $serviceName $nodePath $scriptPath
& $nssm set $serviceName AppDirectory "C:\Hive\services"
& $nssm set $serviceName DisplayName "Hive Bridge - AI-PC Node"
& $nssm set $serviceName Description "Bridges LM Studio to Hive network"
& $nssm set $serviceName Start SERVICE_AUTO_START
& $nssm set $serviceName AppStdout "$logPath\hive-bridge.log"
& $nssm set $serviceName AppStderr "$logPath\hive-bridge-error.log"
& $nssm set $serviceName AppRotateFiles 1
& $nssm set $serviceName AppRotateBytes 1048576

# Start the service
Write-Host "Starting service..." -ForegroundColor Green
& $nssm start $serviceName

# Verify
Start-Sleep -Seconds 2
$status = (Get-Service $serviceName -ErrorAction SilentlyContinue).Status
Write-Host "`nService Status: $status" -ForegroundColor $(if ($status -eq 'Running') { 'Green' } else { 'Red' })

# Test health endpoint
Write-Host "`nTesting health endpoint..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3003/api/health" -TimeoutSec 5
    Write-Host "Health check: $($health.status)" -ForegroundColor Green
    Write-Host "Models: $($health.models -join ', ')" -ForegroundColor White
} catch {
    Write-Host "Health check failed: $_" -ForegroundColor Red
}

Write-Host "`nDone!" -ForegroundColor Cyan
