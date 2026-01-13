$processes = Get-Process | Where-Object { $_.Path -like '*ChasePlane*' -or $_.Path -like '*p42-util-chaseplane*' }
foreach ($p in $processes) {
    Write-Output "Name: $($p.ProcessName)"
    Write-Output "Path: $($p.Path)"
    Write-Output "---"
}
if ($processes.Count -eq 0) {
    Write-Output "No ChasePlane processes found"
}
