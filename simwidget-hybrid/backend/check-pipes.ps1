[System.IO.Directory]::GetFiles('\\.\pipe\') | Where-Object { $_ -match 'Flight|Sim' }
