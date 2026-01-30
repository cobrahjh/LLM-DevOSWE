Add-Type -AssemblyName System.Windows.Forms
# Ctrl+T for new tab
[System.Windows.Forms.SendKeys]::SendWait("^t")
Start-Sleep -Milliseconds 500
# Type URL
[System.Windows.Forms.SendKeys]::SendWait("https://github.com/settings/tokens/new")
Start-Sleep -Milliseconds 200
# Press Enter
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Write-Host "Opened GitHub token page"
