# SimGlass Fuel WASM Deployment Script
# Deploys to MSFS 2024 Community folder

param(
    [string]$Username = $env:USERNAME,
    [switch]$Remote,
    [string]$RemoteHost = "192.168.1.42",
    [string]$RemoteUser = "hjhar"
)

$PackageName = "simglass-fuel"
$SourcePath = $PSScriptRoot

# Determine target path
if ($Remote) {
    Write-Host "Deploying to remote MSFS on $RemoteHost..." -ForegroundColor Cyan
    $TempZip = "$env:TEMP\$PackageName.zip"

    # Create package
    Write-Host "Creating package..." -ForegroundColor Yellow
    if (Test-Path $TempZip) { Remove-Item $TempZip -Force }
    Compress-Archive -Path "$SourcePath\*" -DestinationPath $TempZip -Force

    # Copy to remote
    Write-Host "Copying to $RemoteHost..." -ForegroundColor Yellow
    scp $TempZip "${RemoteUser}@${RemoteHost}:/tmp/$PackageName.zip"

    # Extract on remote
    Write-Host "Installing on remote..." -ForegroundColor Yellow
    $RemotePath = "C:/Users/$RemoteUser/AppData/Local/Packages/Microsoft.FlightSimulator_8wekyb3d8bbwe/LocalCache/Packages/Community/$PackageName"
    ssh "${RemoteUser}@${RemoteHost}" "powershell -Command `"if (Test-Path '$RemotePath') { Remove-Item '$RemotePath' -Recurse -Force }; Expand-Archive -Path /tmp/$PackageName.zip -DestinationPath '$RemotePath' -Force`""

    Write-Host "`n✓ Deployed to remote MSFS" -ForegroundColor Green
} else {
    $CommunityPath = "C:\Users\$Username\AppData\Local\Packages\Microsoft.FlightSimulator_8wekyb3d8bbwe\LocalCache\Packages\Community"
    $TargetPath = Join-Path $CommunityPath $PackageName

    Write-Host "Deploying to local MSFS Community folder..." -ForegroundColor Cyan
    Write-Host "Target: $TargetPath" -ForegroundColor Gray

    # Check if Community folder exists
    if (-not (Test-Path $CommunityPath)) {
        Write-Host "ERROR: MSFS Community folder not found!" -ForegroundColor Red
        Write-Host "Expected: $CommunityPath" -ForegroundColor Yellow
        exit 1
    }

    # Remove old version
    if (Test-Path $TargetPath) {
        Write-Host "Removing old version..." -ForegroundColor Yellow
        Remove-Item $TargetPath -Recurse -Force
    }

    # Copy new version
    Write-Host "Copying files..." -ForegroundColor Yellow
    Copy-Item -Path $SourcePath -Destination $TargetPath -Recurse -Force

    # Verify installation
    $ManifestPath = Join-Path $TargetPath "manifest.json"
    if (Test-Path $ManifestPath) {
        Write-Host "`n✓ Successfully deployed!" -ForegroundColor Green
        Write-Host "`nInstalled files:" -ForegroundColor Cyan
        Get-ChildItem -Path $TargetPath -Recurse -File | Select-Object -ExpandProperty FullName | ForEach-Object {
            Write-Host "  $_" -ForegroundColor Gray
        }
    } else {
        Write-Host "`nERROR: Deployment failed - manifest.json not found" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host " SimGlass Fuel Provider Installed" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Restart MSFS 2024" -ForegroundColor White
Write-Host "2. Load any aircraft and start a flight" -ForegroundColor White
Write-Host "3. Open SimGlass Fuel Widget" -ForegroundColor White
Write-Host "4. Real fuel data should appear automatically`n" -ForegroundColor White
