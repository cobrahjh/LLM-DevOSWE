Write-Host "`n=== TASK STATUS ===" -ForegroundColor Cyan
& node "C:\LLM-DevOSWE\Admin\tools\project-tracker.js" --status

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
