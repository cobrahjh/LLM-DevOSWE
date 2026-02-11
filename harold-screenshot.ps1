Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [Drawing.Point]::Empty, $bounds.Size)
$bmp.Save('C:\LLM-DevOSWE\screenshot-harold.png')
$g.Dispose()
$bmp.Dispose()
Write-Host 'Screenshot saved'
