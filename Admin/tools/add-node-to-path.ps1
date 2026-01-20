# Add Node.js to System PATH
$nodePath = "C:\Program Files\nodejs"

# Get current system PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")

# Check if already in PATH
if ($currentPath -split ";" | Where-Object { $_ -eq $nodePath }) {
    Write-Host "Node.js is already in system PATH" -ForegroundColor Green
} else {
    # Add to PATH
    $newPath = $currentPath + ";" + $nodePath
    [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
    Write-Host "Added Node.js to system PATH: $nodePath" -ForegroundColor Green
    Write-Host "Please restart any open terminals for changes to take effect" -ForegroundColor Yellow
}

# Verify
Write-Host "`nVerifying..."
$verify = [Environment]::GetEnvironmentVariable("Path", "Machine") -split ";" | Where-Object { $_ -like "*nodejs*" }
if ($verify) {
    Write-Host "Node.js path found: $verify" -ForegroundColor Green
}
