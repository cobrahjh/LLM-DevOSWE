# DLL Export Inspector
# Run: powershell -ExecutionPolicy Bypass -File dll-inspector.ps1

param(
    [string]$DllPath = "C:\Program Files\vJoy\x64\vJoyInterface.dll"
)

Write-Host "=== DLL Export Inspector ===" -ForegroundColor Cyan
Write-Host "Target: $DllPath" -ForegroundColor Yellow

if (-not (Test-Path $DllPath)) {
    Write-Host "ERROR: DLL not found!" -ForegroundColor Red
    exit 1
}

$fileInfo = Get-Item $DllPath
Write-Host "Size: $([math]::Round($fileInfo.Length / 1KB, 2)) KB"

# Try .NET first
try {
    $assembly = [System.Reflection.Assembly]::LoadFile($DllPath)
    Write-Host "`n=== .NET Exports ===" -ForegroundColor Green
    
    foreach ($type in $assembly.GetExportedTypes()) {
        Write-Host "`n[$($type.FullName)]" -ForegroundColor Cyan
        foreach ($method in $type.GetMethods()) {
            if ($method.DeclaringType -eq $type) {
                $params = ($method.GetParameters() | ForEach-Object { "$($_.ParameterType.Name) $($_.Name)" }) -join ", "
                Write-Host "  $($method.ReturnType.Name) $($method.Name)($params)"
            }
        }
    }
}
catch {
    Write-Host "`nNative DLL - use dumpbin for exports" -ForegroundColor Yellow
}
