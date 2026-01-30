Add-Type -AssemblyName System.Windows.Forms

# Tab to the button and press Enter
[System.Windows.Forms.SendKeys]::SendWait("{TAB}")
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Write-Host "Clicked dropdown button"
