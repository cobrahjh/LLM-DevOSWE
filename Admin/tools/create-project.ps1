# Create new Claude Code project with full setup
# Usage: .\create-project.ps1 -Name "MyProject" -Path "C:\MyProject" -Description "What it does"
# Auto-assigns next available color from rotation

param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][string]$Path,
    [string]$Description = "New project",
    [switch]$SkipGit,
    [switch]$SkipOracle
)

# Color rotation (auto-assigned based on project count)
$colors = @(
    @{ cmd = "1F"; tab = "#0066CC"; name = "Blue" },
    @{ cmd = "4F"; tab = "#CC3300"; name = "Red" },
    @{ cmd = "2F"; tab = "#00CC66"; name = "Green" },
    @{ cmd = "5F"; tab = "#9933CC"; name = "Purple" },
    @{ cmd = "6F"; tab = "#CCCC00"; name = "Yellow" },
    @{ cmd = "3F"; tab = "#00CCCC"; name = "Cyan" }
)

# Count existing projects to pick next color
$existingProjects = @("LLM-DevOSWE", "kittbox-web")  # Known projects
$colorIndex = $existingProjects.Count % $colors.Count
$color = $colors[$colorIndex]

Write-Host ""
Write-Host "=== Creating Project: $Name ===" -ForegroundColor Cyan
Write-Host "Path: $Path"
Write-Host "Color: $($color.name) (CMD: $($color.cmd), Tab: $($color.tab))"
Write-Host ""

# Step 1: Create directory
if (!(Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    Write-Host "[OK] Created directory: $Path" -ForegroundColor Green
} else {
    Write-Host "[OK] Directory exists: $Path" -ForegroundColor Yellow
}

# Step 2: Initialize git
if (!$SkipGit) {
    if (!(Test-Path "$Path\.git")) {
        Push-Location $Path
        git init | Out-Null
        Pop-Location
        Write-Host "[OK] Initialized git repository" -ForegroundColor Green
    } else {
        Write-Host "[OK] Git already initialized" -ForegroundColor Yellow
    }
}

# Step 3: Create basic structure
$folders = @("src", "docs", "tests")
foreach ($folder in $folders) {
    $folderPath = Join-Path $Path $folder
    if (!(Test-Path $folderPath)) {
        New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
    }
}
Write-Host "[OK] Created folder structure (src, docs, tests)" -ForegroundColor Green

# Step 4: Create README
$readmePath = Join-Path $Path "README.md"
if (!(Test-Path $readmePath)) {
    $readme = @"
# $Name

$Description

## Setup

``````bash
# Clone and install
git clone <repo-url>
cd $Name
npm install
``````

## Development

Created with LLM-DevOSWE framework.
"@
    Set-Content -Path $readmePath -Value $readme -Encoding UTF8
    Write-Host "[OK] Created README.md" -ForegroundColor Green
}

# Step 5: Run Claude terminal setup
Write-Host ""
Write-Host "Setting up Claude terminal launcher..." -ForegroundColor Cyan
$setupScript = Join-Path $PSScriptRoot "setup-claude-project.ps1"
& $setupScript -Name $Name -Path $Path -Color $color.cmd -TabColor $color.tab

# Step 6: Oracle registration reminder
if (!$SkipOracle) {
    Write-Host ""
    Write-Host "=== Oracle Registration ===" -ForegroundColor Yellow
    Write-Host "Add to C:\LLM-Oracle\oracle.js PROJECTS object:"
    Write-Host ""
    Write-Host @"
'$($Name.ToLower() -replace ' ', '-')': {
    root: '$($Path -replace '\\', '/')',
    allowed: ['src', 'lib', 'docs'],
    description: '$Description'
},
"@ -ForegroundColor Gray
    Write-Host ""
    Write-Host "Then restart Oracle: net stop `"SimWidget Oracle`" && net start `"SimWidget Oracle`""
}

# Step 7: Summary
Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host "1. Terminal launcher created (claude-here.bat)"
Write-Host "2. Run create-shortcut.ps1 in $Path for desktop shortcut"
Write-Host "3. Add Windows Terminal profile from output above"
Write-Host "4. Register with Oracle if using tinyAI"
Write-Host ""
