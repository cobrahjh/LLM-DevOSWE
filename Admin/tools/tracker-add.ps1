$projects = @("LLM-DevOSWE", "kittbox-web")
$phases = @("planning", "development", "testing", "review")

Write-Host "`n=== ADD NEW TASK ===" -ForegroundColor Cyan
Write-Host "`nProjects:"
for ($i = 0; $i -lt $projects.Length; $i++) {
    Write-Host "  $($i + 1). $($projects[$i])"
}
$projIdx = Read-Host "`nSelect project (1-$($projects.Length))"
$project = $projects[[int]$projIdx - 1]

$title = Read-Host "`nTask title"

Write-Host "`nPhases:"
for ($i = 0; $i -lt $phases.Length; $i++) {
    Write-Host "  $($i + 1). $($phases[$i])"
}
$phaseIdx = Read-Host "`nSelect phase (1-$($phases.Length))"
$phase = $phases[[int]$phaseIdx - 1]

Write-Host "`nAdding task..." -ForegroundColor Yellow
& node "C:\LLM-DevOSWE\Admin\tools\project-tracker.js" --add $project $title $phase

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
