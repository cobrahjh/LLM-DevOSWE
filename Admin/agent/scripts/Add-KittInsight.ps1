# Add-KittInsight.ps1
# PowerShell wrapper for Kitt's Insights Management System

param(
    [Parameter(Mandatory=$true)]
    [string]$Content,
    
    [Parameter(Mandatory=$false)]
    [string]$TodoId,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')]
    [string]$Priority = 'MEDIUM',
    
    [Parameter(Mandatory=$false)]
    [switch]$ShowReport,
    
    [Parameter(Mandatory=$false)]
    [switch]$List
)

$ScriptPath = Join-Path $PSScriptRoot "kitt-insights.js"

if ($ShowReport) {
    node $ScriptPath "report"
}
elseif ($List) {
    node $ScriptPath "list"
}
else {
    $args = @("add", $Content)
    if ($TodoId) { $args += $TodoId }
    if ($Priority) { $args += $Priority }
    
    node $ScriptPath $args
    Write-Host "Insight added successfully!" -ForegroundColor Green
    
    # Show recent insights
    Write-Host "`nRecent insights:" -ForegroundColor Cyan
    node $ScriptPath "list" | Select-Object -Last 3
}

# Examples:
# .\Add-KittInsight.ps1 -Content "This is a critical system observation" -Priority CRITICAL
# .\Add-KittInsight.ps1 -Content "Task analysis and recommendations" -TodoId "1768021659044" -Priority HIGH
# .\Add-KittInsight.ps1 -ShowReport
# .\Add-KittInsight.ps1 -List