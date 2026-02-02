$ports = @(3002,8080,8500,8585,8590,8600,8701,8750,8771,8800,8810,8820,8850,8860,8899)
foreach ($p in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "OK: $p" -ForegroundColor Green
    } else {
        Write-Host "DOWN: $p" -ForegroundColor Red
    }
}
