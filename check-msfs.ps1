Get-Process | Where-Object { 
    $_.ProcessName -match 'Flight' -or 
    $_.ProcessName -match 'MSFS' -or 
    $_.ProcessName -match 'Simulator' 
} | Select-Object ProcessName, Id, MainWindowHandle, MainWindowTitle | Format-List
