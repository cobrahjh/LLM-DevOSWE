# Discover ChasePlane API
# Scans for open ports and checks ChasePlane installation

Write-Host "=== ChasePlane API Discovery ===" -ForegroundColor Cyan
Write-Host ""

# 1. Find ChasePlane installation path
Write-Host "Step 1: Finding ChasePlane installation..." -ForegroundColor Yellow
$cpPaths = @(
    "$env:LOCALAPPDATA\Programs\Parallel 42\ChasePlane",
    "$env:PROGRAMFILES\Parallel 42\ChasePlane",
    "${env:PROGRAMFILES(x86)}\Parallel 42\ChasePlane",
    "$env:APPDATA\Parallel 42\ChasePlane"
)

$foundPath = $null
foreach ($p in $cpPaths) {
    if (Test-Path $p) {
        $foundPath = $p
        Write-Host "  Found: $p" -ForegroundColor Green
        break
    }
}

if (-not $foundPath) {
    Write-Host "  Standard paths not found, searching..." -ForegroundColor Yellow
    $search = Get-ChildItem -Path "C:\", "$env:LOCALAPPDATA", "$env:APPDATA" -Filter "*ChasePlane*" -Directory -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($search) {
        $foundPath = $search.FullName
        Write-Host "  Found: $foundPath" -ForegroundColor Green
    }
}

# 2. List files in ChasePlane folder
if ($foundPath) {
    Write-Host ""
    Write-Host "Step 2: ChasePlane folder contents:" -ForegroundColor Yellow
    Get-ChildItem $foundPath -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  $($_.Name)" -ForegroundColor Gray
    }
    
    # Look for config files
    Write-Host ""
    Write-Host "Config/API files:" -ForegroundColor Yellow
    Get-ChildItem $foundPath -Include "*.json","*.xml","*.config","*.ini","api*","plugin*","sdk*" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  $($_.FullName)" -ForegroundColor Cyan
    }
}

# 3. Find ChasePlane process and check listening ports
Write-Host ""
Write-Host "Step 3: Finding ChasePlane process and ports..." -ForegroundColor Yellow

$cpProcess = Get-Process | Where-Object { 
    $_.Path -like '*ChasePlane*' -or 
    $_.Path -like '*Parallel*42*' -or
    $_.Path -like '*p42*'
}

if ($cpProcess) {
    Write-Host "  Process: $($cpProcess.ProcessName) (PID: $($cpProcess.Id))" -ForegroundColor Green
    Write-Host "  Path: $($cpProcess.Path)" -ForegroundColor Gray
    
    # Get ports used by ChasePlane
    Write-Host ""
    Write-Host "Ports used by this process:" -ForegroundColor Yellow
    netstat -ano | Select-String $cpProcess.Id | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Cyan
    }
} else {
    Write-Host "  ChasePlane process not found" -ForegroundColor Red
    Write-Host "  Make sure ChasePlane is running!" -ForegroundColor Yellow
}

# 4. Scan common API ports
Write-Host ""
Write-Host "Step 4: Testing common API ports..." -ForegroundColor Yellow
$testPorts = @(8080, 8081, 9000, 9001, 3000, 5000, 5001, 42000, 42042, 4242, 19099, 500, 8000)

foreach ($port in $testPorts) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $port)
        if ($tcp.Connected) {
            Write-Host "  Port $port - OPEN" -ForegroundColor Green
            $tcp.Close()
        }
    } catch {
        # Port not open
    }
}

# 5. Check for websocket or HTTP on likely ports
Write-Host ""
Write-Host "Step 5: Testing HTTP endpoints..." -ForegroundColor Yellow
$httpPorts = @(8080, 9000, 5000, 42000, 42042, 19099)
foreach ($port in $httpPorts) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$port" -TimeoutSec 2 -ErrorAction SilentlyContinue
        Write-Host "  http://localhost:$port - Response: $($response.StatusCode)" -ForegroundColor Green
    } catch {
        if ($_.Exception.Message -match "Unable to connect") {
            # Not listening
        } else {
            Write-Host "  http://localhost:$port - Something there! Error: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "=== Discovery Complete ===" -ForegroundColor Cyan
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
