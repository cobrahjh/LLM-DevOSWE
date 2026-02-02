Write-Host "`n=== COMPLETE TASK ===" -ForegroundColor Cyan
Write-Host "`nCurrent active tasks:" -ForegroundColor Yellow
& node "C:\LLM-DevOSWE\Admin\tools\project-tracker.js" --status

$taskName = Read-Host "`nEnter task name (or partial match)"

Write-Host "`nCompleting task..." -ForegroundColor Yellow
& node "C:\LLM-DevOSWE\Admin\tools\project-tracker.js" --complete $taskName

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
