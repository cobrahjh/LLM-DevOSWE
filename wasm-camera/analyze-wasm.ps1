$wasmPath = $args[0]
$bytes = [System.IO.File]::ReadAllBytes($wasmPath)
$text = [System.Text.Encoding]::ASCII.GetString($bytes)
$matches = [regex]::Matches($text, '[a-zA-Z_][a-zA-Z0-9_]{4,}')
$unique = $matches | ForEach-Object { $_.Value } | Sort-Object -Unique | Where-Object { $_ -match 'register|variable|lvar|named|MSFS' }
$unique
