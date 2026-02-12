# Verify WASM Camera Module is Loaded and Working
# Run this AFTER restarting MSFS (so the WASM module loads)

Write-Host "=== WASM Camera Verification Script ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check MSFS is running
Write-Host "[1/6] Checking if MSFS is running..." -ForegroundColor Yellow
$msfs = Get-Process -Name "FlightSimulator*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($msfs) {
    Write-Host "  OK - MSFS is running: $($msfs.ProcessName) (PID: $($msfs.Id))" -ForegroundColor Green
} else {
    Write-Host "  ERROR - MSFS is not running" -ForegroundColor Red
    exit 1
}

# 2. Check WASM package installed
Write-Host "[2/6] Checking WASM package installation..." -ForegroundColor Yellow
$communityPath = "$env:APPDATA\Microsoft Flight Simulator\Packages\Community"
$packagePath = Join-Path $communityPath "simwidget-camera"
if (Test-Path $packagePath) {
    $wasmFile = Join-Path $packagePath "modules\simwidget_camera.wasm"
    if (Test-Path $wasmFile) {
        $size = (Get-Item $wasmFile).Length
        Write-Host "  OK - WASM package installed: simwidget_camera.wasm ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "  ERROR - WASM file not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ERROR - Package folder not found at: $packagePath" -ForegroundColor Red
    exit 1
}

# 3. Check Lorby AAO connection
Write-Host "[3/6] Checking Lorby AAO connection..." -ForegroundColor Yellow
try {
    $lorby = Invoke-WebRequest -Uri "http://localhost:43380/webapi?conn=1" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    if ($lorby.Content -match "OK") {
        Write-Host "  OK - Lorby AAO WebAPI connected" -ForegroundColor Green
    } else {
        Write-Host "  WARNING - Lorby AAO responded but not OK: $($lorby.Content)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ERROR - Cannot connect to Lorby AAO on port 43380" -ForegroundColor Red
    Write-Host "    Make sure Lorby Axis and Ohs is running" -ForegroundColor Yellow
    exit 1
}

# 4. Read SIMWIDGET_CAM_READY LVar
Write-Host "[4/6] Reading SIMWIDGET_CAM_READY LVar..." -ForegroundColor Yellow
try {
    $readyUrl = "http://localhost:43380/webapi?lvar=SIMWIDGET_CAM_READY"
    $ready = Invoke-WebRequest -Uri $readyUrl -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    $readyValue = [double]$ready.Content

    if ($readyValue -eq 1.0) {
        Write-Host "  OK - WASM module is READY (value: $readyValue)" -ForegroundColor Green
    } else {
        Write-Host "  WARNING - WASM module NOT ready yet (value: $readyValue)" -ForegroundColor Yellow
        Write-Host "    Expected: 1.0 (ready), Got: $readyValue" -ForegroundColor Yellow
        Write-Host "    The WASM module may not have initialized yet" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ERROR - Cannot read SIMWIDGET_CAM_READY LVar" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Gray
}

# 5. Check SimWidget server status
Write-Host "[5/6] Checking SimWidget server WASM camera status..." -ForegroundColor Yellow
try {
    $status = Invoke-WebRequest -Uri "http://localhost:8080/api/wasm-camera/status" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    $statusData = $status.Content | ConvertFrom-Json

    Write-Host "  Response:" -ForegroundColor Cyan
    Write-Host "    ready: $($statusData.ready)" -ForegroundColor $(if ($statusData.ready) { "Green" } else { "Yellow" })
    Write-Host "    status: $($statusData.status)" -ForegroundColor Cyan
    Write-Host "    modes: $($statusData.modes | ConvertTo-Json -Compress)" -ForegroundColor Cyan

    if ($statusData.ready) {
        Write-Host "  OK - Server confirms WASM module is ready!" -ForegroundColor Green
    } else {
        Write-Host "  WARNING - Server reports WASM not ready yet" -ForegroundColor Yellow
        Write-Host "    Wait 10 seconds for polling interval to update" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ERROR - Cannot reach SimWidget server" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Gray
}

# 6. Send test flyby command
Write-Host "[6/6] Sending test flyby command..." -ForegroundColor Yellow
try {
    $cmd = @{ action = "flyby"; smooth = 75 } | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/wasm-camera" `
        -Method POST `
        -Body $cmd `
        -ContentType "application/json" `
        -TimeoutSec 5 `
        -UseBasicParsing `
        -ErrorAction Stop

    $responseData = $response.Content | ConvertFrom-Json

    if ($responseData.success) {
        Write-Host "  OK - Flyby command sent successfully!" -ForegroundColor Green
        Write-Host "    Action: $($responseData.action)" -ForegroundColor Cyan
        Write-Host "    Command value: $($responseData.command)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  CHECK MSFS NOW - Camera should have moved to flyby view!" -ForegroundColor Yellow -BackgroundColor Black
    } else {
        Write-Host "  ERROR - Command failed: $($responseData.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "  ERROR - Failed to send command" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Verification Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  - If WASM module shows ready=true, the integration is working!" -ForegroundColor White
Write-Host "  - If camera moved in MSFS, the LVar commands are working!" -ForegroundColor White
Write-Host "  - If ready=false, try waiting 10 seconds and run this script again" -ForegroundColor White
Write-Host ""
Write-Host "LVar Details:" -ForegroundColor Yellow
Write-Host "  SIMWIDGET_CAM_READY  = 1 when module loaded (0 when not)" -ForegroundColor Gray
Write-Host "  SIMWIDGET_CAM_CMD    = Command trigger (1=cinematic, 2=flyby, 3=tower)" -ForegroundColor Gray
Write-Host "  SIMWIDGET_CAM_STATUS = Current camera mode" -ForegroundColor Gray
Write-Host "  SIMWIDGET_CAM_SMOOTH = Smoothing value 0-100" -ForegroundColor Gray
