$desktop = "C:\Users\Stone-PC\Desktop"

# Create folders
$folders = @("Tasks", "Claude", "Hive")
foreach ($f in $folders) {
    $path = Join-Path $desktop $f
    if (!(Test-Path $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
        Write-Host "Created: $f" -ForegroundColor Green
    } else {
        Write-Host "Exists: $f" -ForegroundColor Yellow
    }
}

# Move Task shortcuts
$taskFiles = @(
    "Task - Add.lnk",
    "Task - Complete.lnk",
    "Task - Status.lnk",
    "tasks.bat"
)
foreach ($file in $taskFiles) {
    $src = Join-Path $desktop $file
    if (Test-Path $src) {
        Move-Item $src "$desktop\Tasks" -Force
        Write-Host "  Moved: $file -> Tasks/"
    }
}

# Move Claude shortcuts
$claudeFiles = @(
    "Claude.lnk",
    "Claude - bible-summary.bat",
    "claude-silverstream.bat - Shortcut.lnk",
    "GTN750 Claude.lnk",
    "gtn750.bat",
    "kinship.bat"
)
foreach ($file in $claudeFiles) {
    $src = Join-Path $desktop $file
    if (Test-Path $src) {
        Move-Item $src "$desktop\Claude" -Force
        Write-Host "  Moved: $file -> Claude/"
    }
}

# Move Hive shortcuts
$hiveFiles = @(
    "Hive Manager.lnk",
    "hive-new.bat - Shortcut.lnk",
    "open-session.bat - Shortcut.lnk"
)
foreach ($file in $hiveFiles) {
    $src = Join-Path $desktop $file
    if (Test-Path $src) {
        Move-Item $src "$desktop\Hive" -Force
        Write-Host "  Moved: $file -> Hive/"
    }
}

Write-Host "`nDesktop organized!" -ForegroundColor Cyan
