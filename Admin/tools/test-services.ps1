$services = @(
    @{Name="Oracle"; Port=3002},
    @{Name="SimWidget"; Port=8080},
    @{Name="Agent"; Port=8585},
    @{Name="Relay"; Port=8600},
    @{Name="Remote"; Port=8590},
    @{Name="Bridge"; Port=8601},
    @{Name="KeySender"; Port=9999},
    @{Name="HiveMind"; Port=8701},
    @{Name="TerminalHub"; Port=8771},
    @{Name="HiveBrain"; Port=8810},
    @{Name="HiveOracle"; Port=8850},
    @{Name="Discovery"; Port=8811},
    @{Name="MasterMind"; Port=8820},
    @{Name="HiveMesh"; Port=8750},
    @{Name="Personas"; Port=8770},
    @{Name="MCP"; Port=8860},
    @{Name="Dashboard"; Port=8899},
    @{Name="VoiceAccess"; Port=8875},
    @{Name="HiveVoice"; Port=8800}
)

foreach ($svc in $services) {
    $start = Get-Date
    try {
        $result = Invoke-RestMethod -Uri "http://localhost:$($svc.Port)/api/health" -TimeoutSec 3 -ErrorAction SilentlyContinue
        $elapsed = ((Get-Date) - $start).TotalMilliseconds
        Write-Host "$($svc.Name): OK (${elapsed}ms)" -ForegroundColor Green
    } catch {
        $elapsed = ((Get-Date) - $start).TotalMilliseconds
        Write-Host "$($svc.Name): FAIL (${elapsed}ms)" -ForegroundColor Red
    }
}
