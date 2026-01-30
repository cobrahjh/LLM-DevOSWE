Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("{HOME}")
Write-Host "Sent Home key to scroll to top"
