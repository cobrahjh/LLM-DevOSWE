# Simple screenshot utility
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

$outputPath = "C:\Users\Stone-PC\OneDrive\Pictures\screenshoots\gtn750-test-$(Get-Date -Format 'yyyyMMdd-HHmmss').png"
$bitmap.Save($outputPath)

$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Screenshot saved to: $outputPath"
