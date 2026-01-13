# Replace "agent" with "Agent (""Kitt"")" throughout project files
# Excludes node_modules, .git, and other dependency folders

$replacements = 0
$projectRoot = "C:\LLM-DevOSWE"

# File extensions to process
$extensions = @("*.js", "*.html", "*.md", "*.json", "*.bat", "*.txt", "*.css")

# Folders to exclude
$excludePaths = @(
    "node_modules",
    ".git", 
    "packages\*",
    "*\node_modules",
    "simwidget-hybrid\node_modules"
)

Write-Host "Starting agent -> Agent (""Kitt"") replacement..." -ForegroundColor Yellow

foreach ($ext in $extensions) {
    Write-Host "Processing $ext files..." -ForegroundColor Cyan
    
    $files = Get-ChildItem -Path $projectRoot -Recurse -File -Include $ext | Where-Object {
        $exclude = $false
        foreach ($excludePath in $excludePaths) {
            if ($_.FullName -like "*$excludePath*") {
                $exclude = $true
                break
            }
        }
        return !$exclude
    }
    
    foreach ($file in $files) {
        try {
            $content = Get-Content -Path $file.FullName -Raw -ErrorAction Stop
            if ($content -and $content -match '\bagent\b') {
                $newContent = $content -replace '\bagent\b', 'Agent ("Kitt")'
                
                if ($newContent -ne $content) {
                    Set-Content -Path $file.FullName -Value $newContent -NoNewline
                    $changeCount = ([regex]::Matches($content, '\bagent\b', 'IgnoreCase')).Count
                    $replacements += $changeCount
                    Write-Host "  ✓ $($file.Name) - $changeCount replacements" -ForegroundColor Green
                }
            }
        }
        catch {
            Write-Host "  ✗ Error processing $($file.Name): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "Replacement complete! Total replacements: $replacements" -ForegroundColor Yellow
Write-Host "Note: This script uses word boundary matching (\b) to avoid replacing parts of other words." -ForegroundColor Gray