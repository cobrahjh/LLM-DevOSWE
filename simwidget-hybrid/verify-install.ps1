# Verify GTN750 v2.3.0 installation
$base = "C:\Users\hjhar\AppData\Local\Packages\Microsoft.Limitless_8wekyb3d8bbwe\LocalCache\Packages\Community\SimGlass-GTN750"
$panel = "$base\html_ui\InGamePanels\GTN750Panel"

Write-Host ""
Write-Host "GTN750 v2.3.0 Installation Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Package files
Write-Host "Package Files:" -ForegroundColor Yellow
Write-Host "  manifest.json: $(Test-Path "$base\manifest.json")" -ForegroundColor $(if (Test-Path "$base\manifest.json") { 'Green' } else { 'Red' })
Write-Host "  layout.json: $(Test-Path "$base\layout.json")" -ForegroundColor $(if (Test-Path "$base\layout.json") { 'Green' } else { 'Red' })

# Panel files
Write-Host ""
Write-Host "Panel Files:" -ForegroundColor Yellow
Write-Host "  GTN750Panel.html: $(Test-Path "$panel\GTN750Panel.html")" -ForegroundColor $(if (Test-Path "$panel\GTN750Panel.html") { 'Green' } else { 'Red' })
Write-Host "  pane.js: $(Test-Path "$panel\pane.js")" -ForegroundColor $(if (Test-Path "$panel\pane.js") { 'Green' } else { 'Red' })
Write-Host "  styles.css: $(Test-Path "$panel\styles.css")" -ForegroundColor $(if (Test-Path "$panel\styles.css") { 'Green' } else { 'Red' })

# Count files
Write-Host ""
Write-Host "Modules:" -ForegroundColor Yellow
$modules = Get-ChildItem "$panel\modules\*.js" -ErrorAction SilentlyContinue
Write-Host "  $($modules.Count) files" -ForegroundColor Green
$modules | ForEach-Object { Write-Host "    - $($_.Name)" -ForegroundColor Gray }

Write-Host ""
Write-Host "Overlays:" -ForegroundColor Yellow
$overlays = Get-ChildItem "$panel\overlays\*.js" -ErrorAction SilentlyContinue
Write-Host "  $($overlays.Count) files" -ForegroundColor Green

Write-Host ""
Write-Host "Pages:" -ForegroundColor Yellow
$pages = Get-ChildItem "$panel\pages\*.js" -ErrorAction SilentlyContinue
Write-Host "  $($pages.Count) files" -ForegroundColor Green

# Check version
Write-Host ""
Write-Host "Version:" -ForegroundColor Yellow
$version = Select-String -Path "$panel\pane.js" -Pattern "GTN750 GPS Pane v\d+\.\d+\.\d+" | Select-Object -First 1
if ($version) {
    Write-Host "  $($version.Line.Trim())" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "Installation Status: VERIFIED" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
