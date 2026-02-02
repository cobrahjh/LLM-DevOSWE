$path = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($path -match 'LLM-DevOSWE') {
    Write-Host "OK: C:\LLM-DevOSWE is in user PATH" -ForegroundColor Green
} else {
    Write-Host "NOT FOUND in PATH" -ForegroundColor Red
}
