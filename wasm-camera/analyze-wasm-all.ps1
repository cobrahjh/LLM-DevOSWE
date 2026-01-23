$wasmPath = $args[0]
$bytes = [System.IO.File]::ReadAllBytes($wasmPath)
$text = [System.Text.Encoding]::ASCII.GetString($bytes)
$matches = [regex]::Matches($text, '[a-zA-Z_][a-zA-Z0-9_]{3,}')
$unique = $matches | ForEach-Object { $_.Value } | Sort-Object -Unique
$unique
