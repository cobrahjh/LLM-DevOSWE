@echo off
:: mclaude - Claude with permissions bypass
:: Simple passthrough - works best when called from Windows cmd/PowerShell

"C:\Users\Stone-PC\AppData\Roaming\npm\claude.cmd" --dangerously-skip-permissions %*
