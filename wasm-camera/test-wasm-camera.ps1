# WASM Camera Test Script
# Run this on the PC where MSFS 2024 is running

param(
    [string]$CommunityPath = "$env:APPDATA\Microsoft Flight Simulator\Packages\Community"
)

Write-Host "=== WASM Camera Test Script ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check MSFS is running
Write-Host "[1/7] Checking if MSFS is running..." -ForegroundColor Yellow
$msfs = Get-Process -Name "FlightSimulator" -ErrorAction SilentlyContinue
if ($msfs) {
    Write-Host "  ✓ MSFS is running (PID: $($msfs.Id))" -ForegroundColor Green
} else {
    Write-Host "  ✗ MSFS is not running. Please start MSFS first." -ForegroundColor Red
    exit 1
}

# 2. Find Community folder
Write-Host "[2/7] Locating Community folder..." -ForegroundColor Yellow
if (Test-Path $CommunityPath) {
    Write-Host "  ✓ Found: $CommunityPath" -ForegroundColor Green
} else {
    $altPath = "$env:LOCALAPPDATA\Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\LocalCache\Packages\Community"
    if (Test-Path $altPath) {
        $CommunityPath = $altPath
        Write-Host "  ✓ Found: $CommunityPath" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Cannot find Community folder" -ForegroundColor Red
        Write-Host "  Please specify with -CommunityPath parameter" -ForegroundColor Yellow
        exit 1
    }
}

# 3. Install WASM package
Write-Host "[3/7] Installing WASM package..." -ForegroundColor Yellow
$sourcePath = Join-Path $PSScriptRoot "package\simwidget-camera"
$targetPath = Join-Path $CommunityPath "simwidget-camera"

if (Test-Path $sourcePath) {
    if (Test-Path $targetPath) {
        Remove-Item $targetPath -Recurse -Force
        Write-Host "  ℹ Removed existing installation" -ForegroundColor Cyan
    }
    Copy-Item $sourcePath $targetPath -Recurse
    Write-Host "  ✓ WASM package installed to Community folder" -ForegroundColor Green
    Write-Host "    Note: Restart MSFS or reload scenery for changes to take effect" -ForegroundColor Yellow
} else {
    Write-Host "  ✗ Source package not found at: $sourcePath" -ForegroundColor Red
    exit 1
}

# 4. Check Lorby AAO
Write-Host "[4/7] Checking Lorby AAO availability..." -ForegroundColor Yellow
try {
    $lorby = Invoke-WebRequest -Uri "http://localhost:43380" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✓ Lorby AAO is running on port 43380" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Lorby AAO not responding on port 43380" -ForegroundColor Red
    Write-Host "    WASM LVar communication requires Lorby AAO" -ForegroundColor Yellow
}

# 5. Check SimWidget server
Write-Host "[5/7] Checking SimWidget server..." -ForegroundColor Yellow
try {
    $simwidget = Invoke-WebRequest -Uri "http://localhost:8080/api/status" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    Write-Host "  ✓ SimWidget server is running on port 8080" -ForegroundColor Green
} catch {
    Write-Host "  ✗ SimWidget server not responding on port 8080" -ForegroundColor Red
    Write-Host "    Start the server to test WASM camera API" -ForegroundColor Yellow
}

# 6. Test WASM camera status
Write-Host "[6/7] Testing WASM camera status..." -ForegroundColor Yellow
try {
    $wasmStatus = Invoke-WebRequest -Uri "http://localhost:8080/api/wasm-camera/status" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
    $statusData = $wasmStatus.Content | ConvertFrom-Json
    Write-Host "  ✓ WASM camera endpoint responded" -ForegroundColor Green
    Write-Host "    Status: $($statusData | ConvertTo-Json -Depth 3)" -ForegroundColor Cyan
} catch {
    Write-Host "  ⚠ WASM camera endpoint not available yet" -ForegroundColor Yellow
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Gray
}

# 7. Trigger test command
Write-Host "[7/7] Triggering test flyby command..." -ForegroundColor Yellow
try {
    $testCmd = @{ action = "flyby"; smooth = 50 } | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/wasm-camera" `
        -Method POST `
        -Body $testCmd `
        -ContentType "application/json" `
        -TimeoutSec 5 `
        -UseBasicParsing `
        -ErrorAction Stop
    Write-Host "  ✓ Command sent successfully" -ForegroundColor Green
    Write-Host "    Response: $($response.Content)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Check MSFS for camera movement!" -ForegroundColor Yellow
} catch {
    Write-Host "  ⚠ Could not send test command" -ForegroundColor Yellow
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. If you see 'Restart MSFS', close and restart the simulator"
Write-Host "  2. Load into a flight"
Write-Host "  3. Run this script again to test camera commands"
Write-Host "  4. Use the camera widget UI or API to trigger flyby/tower views"
