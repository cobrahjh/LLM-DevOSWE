$client = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 9999)
$stream = $client.GetStream()
$writer = New-Object System.IO.StreamWriter($stream)
$reader = New-Object System.IO.StreamReader($stream)

# Test PING
$writer.WriteLine("PING")
$writer.Flush()
$response = $reader.ReadLine()
Write-Host "PING -> $response"

# Test VERSION
$writer.WriteLine("VERSION")
$writer.Flush()
$response = $reader.ReadLine()
Write-Host "VERSION -> $response"

# Test FOCUS
$writer.WriteLine("FOCUS")
$writer.Flush()
$response = $reader.ReadLine()
Write-Host "FOCUS -> $response"

# Test F10
$writer.WriteLine("F10")
$writer.Flush()
$response = $reader.ReadLine()
Write-Host "F10 -> $response"

$client.Close()
