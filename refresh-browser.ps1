Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("{F5}")
Write-Host "Sent F5 to refresh"
