# Terminal Hub Bridge - Windows Terminal
param(
    [int]$TerminalId = 0,
    [string]$HubUrl = "http://localhost:8771",
    [string]$Title = "WT Terminal"
)

$host.UI.RawUI.WindowTitle = "$Title [Hub #$TerminalId]"
$Global:HubEndpoint = "$HubUrl/api/terminals/bridge"
$Global:TermId = $TerminalId

function Send-ToHub {
    param([string]$Text)
    if (-not $Text) { return }
    try {
        # Simple JSON body construction
        $json = @{
            id = $Global:TermId
            output = $Text
        } | ConvertTo-Json -Compress

        $null = Invoke-RestMethod -Uri $Global:HubEndpoint -Method POST -Body $json -ContentType 'application/json' -TimeoutSec 3
    } catch {
        Write-Host "[Hub Error: $_]" -ForegroundColor DarkGray
    }
}

# Connect notification
Send-ToHub "=== Windows Terminal Bridge Connected ===`r`n"
Send-ToHub "Terminal ID: $TerminalId`r`n"
Send-ToHub "Working Directory: $(Get-Location)`r`n"
Send-ToHub "========================================`r`n`r`n"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " TERMINAL HUB BRIDGE - ID #$TerminalId" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " Output mirrors to Terminal Hub" -ForegroundColor Yellow
Write-Host " Type 'exit' to close" -ForegroundColor Yellow
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Interactive loop
while ($true) {
    $loc = (Get-Location).Path
    $prompt = "PS $loc> "
    Write-Host $prompt -NoNewline
    Send-ToHub $prompt

    $userCmd = Read-Host

    if ($userCmd -match '^(exit|quit)$') {
        Send-ToHub "[Session ended]`r`n"
        break
    }

    if ([string]::IsNullOrWhiteSpace($userCmd)) { continue }

    Send-ToHub "$userCmd`r`n"

    try {
        $result = Invoke-Expression $userCmd 2>&1 | Out-String
        if ($result) {
            Write-Host $result
            Send-ToHub $result
        }
    } catch {
        $errMsg = "ERROR: $($_.Exception.Message)"
        Write-Host $errMsg -ForegroundColor Red
        Send-ToHub "$errMsg`r`n"
    }
}

Write-Host "Goodbye!" -ForegroundColor Green
