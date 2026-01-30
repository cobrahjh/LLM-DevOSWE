Get-Process | Where-Object {
    $_.ProcessName -match 'chrome|msedge|firefox' -and $_.MainWindowTitle
} | Select-Object ProcessName, MainWindowTitle | Format-Table -AutoSize
