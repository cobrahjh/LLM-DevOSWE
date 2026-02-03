@echo off
:: mclaude - Claude with permissions bypass
:: Simple passthrough - works best when called from Windows cmd/PowerShell

"C:\Users\Stone-PC\.local\bin\claude.exe" --dangerously-skip-permissions %*
