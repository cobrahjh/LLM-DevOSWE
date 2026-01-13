# Probe ChasePlane API endpoints
# Test various request formats on discovered ports

Write-Host "=== ChasePlane API Probe ===" -ForegroundColor Cyan
Write-Host ""

$ports = @(42700, 42042)

foreach ($port in $ports) {
    Write-Host "=== Testing Port $port ===" -ForegroundColor Yellow
    
    # Test basic GET
    Write-Host "`nGET /:" -ForegroundColor Gray
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$port/" -Method GET -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
        Write-Host "  Status: $($r.StatusCode)" -ForegroundColor Green
        Write-Host "  Content: $($r.Content.Substring(0, [Math]::Min(500, $r.Content.Length)))" -ForegroundColor Cyan
    } catch {
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Test common API paths
    $paths = @("/api", "/api/v1", "/status", "/version", "/info", "/commands", "/camera", "/cinematics", "/views")
    foreach ($path in $paths) {
        Write-Host "`nGET $path`:" -ForegroundColor Gray
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:$port$path" -Method GET -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            Write-Host "  Status: $($r.StatusCode)" -ForegroundColor Green
            Write-Host "  Content: $($r.Content.Substring(0, [Math]::Min(300, $r.Content.Length)))" -ForegroundColor Cyan
        } catch {
            if ($_.Exception.Response) {
                $status = $_.Exception.Response.StatusCode.value__
                Write-Host "  Status: $status" -ForegroundColor Yellow
            } else {
                Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    # Test POST with JSON
    Write-Host "`nPOST / with JSON:" -ForegroundColor Gray
    try {
        $body = '{"action":"status"}'
        $r = Invoke-WebRequest -Uri "http://localhost:$port/" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        Write-Host "  Status: $($r.StatusCode)" -ForegroundColor Green
        Write-Host "  Content: $($r.Content)" -ForegroundColor Cyan
    } catch {
        if ($_.Exception.Response) {
            $status = $_.Exception.Response.StatusCode.value__
            Write-Host "  Status: $status" -ForegroundColor Yellow
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errorBody = $reader.ReadToEnd()
                Write-Host "  Body: $errorBody" -ForegroundColor Cyan
            } catch {}
        } else {
            Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # Test WebSocket upgrade
    Write-Host "`nWebSocket test:" -ForegroundColor Gray
    try {
        $headers = @{
            "Upgrade" = "websocket"
            "Connection" = "Upgrade"
            "Sec-WebSocket-Key" = "dGhlIHNhbXBsZSBub25jZQ=="
            "Sec-WebSocket-Version" = "13"
        }
        $r = Invoke-WebRequest -Uri "http://localhost:$port/" -Method GET -Headers $headers -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        Write-Host "  Status: $($r.StatusCode)" -ForegroundColor Green
    } catch {
        if ($_.Exception.Message -match "101") {
            Write-Host "  WebSocket SUPPORTED! (101 Switching Protocols)" -ForegroundColor Green
        } else {
            Write-Host "  $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n=== Probe Complete ===" -ForegroundColor Cyan
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
