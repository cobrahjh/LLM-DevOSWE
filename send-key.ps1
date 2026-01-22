param(
    [Parameter(Mandatory=$true)]
    [string]$Key
)

Add-Type -AssemblyName System.Windows.Forms

# Parse key combinations (e.g., "SHIFT+F", "ALT+Z", "CTRL+TAB")
$parts = $Key -split '\+'
$modifiers = @()
$mainKey = $parts[-1]

for ($i = 0; $i -lt $parts.Length - 1; $i++) {
    $mod = $parts[$i].ToUpper()
    switch ($mod) {
        'SHIFT' { $modifiers += '^' }  # Actually + in SendKeys
        'CTRL'  { $modifiers += '^' }
        'ALT'   { $modifiers += '%' }
        'WIN'   { $modifiers += '^{ESC}' }  # Windows key approximation
    }
}

# Map special keys to SendKeys format
$keyMap = @{
    'BACKSPACE' = '{BACKSPACE}'
    'TAB' = '{TAB}'
    'ENTER' = '{ENTER}'
    'ESC' = '{ESC}'
    'ESCAPE' = '{ESC}'
    'SPACE' = ' '
    'PAGEUP' = '{PGUP}'
    'PAGEDOWN' = '{PGDN}'
    'END' = '{END}'
    'HOME' = '{HOME}'
    'LEFT' = '{LEFT}'
    'UP' = '{UP}'
    'RIGHT' = '{RIGHT}'
    'DOWN' = '{DOWN}'
    'INSERT' = '{INSERT}'
    'DELETE' = '{DELETE}'
    'F1' = '{F1}'
    'F2' = '{F2}'
    'F3' = '{F3}'
    'F4' = '{F4}'
    'F5' = '{F5}'
    'F6' = '{F6}'
    'F7' = '{F7}'
    'F8' = '{F8}'
    'F9' = '{F9}'
    'F10' = '{F10}'
    'F11' = '{F11}'
    'F12' = '{F12}'
    'NUMPAD0' = '{NUMPAD0}'
    'NUMPAD1' = '{NUMPAD1}'
    'NUMPAD2' = '{NUMPAD2}'
    'NUMPAD3' = '{NUMPAD3}'
    'NUMPAD4' = '{NUMPAD4}'
    'NUMPAD5' = '{NUMPAD5}'
    'NUMPAD6' = '{NUMPAD6}'
    'NUMPAD7' = '{NUMPAD7}'
    'NUMPAD8' = '{NUMPAD8}'
    'NUMPAD9' = '{NUMPAD9}'
}

# Convert main key
$sendKey = $mainKey.ToUpper()
if ($keyMap.ContainsKey($sendKey)) {
    $sendKey = $keyMap[$sendKey]
} elseif ($sendKey.Length -eq 1) {
    # Single character - use as is
    $sendKey = $sendKey.ToLower()
}

# Build modifier prefix
$modPrefix = ''
foreach ($mod in $parts[0..($parts.Length - 2)]) {
    switch ($mod.ToUpper()) {
        'SHIFT' { $modPrefix += '+' }
        'CTRL'  { $modPrefix += '^' }
        'ALT'   { $modPrefix += '%' }
    }
}

# Combine and send
$fullKey = "$modPrefix$sendKey"
[System.Windows.Forms.SendKeys]::SendWait($fullKey)

Write-Host "Sent: $Key -> $fullKey"
