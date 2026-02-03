@echo off
:: mclaude - Claude with permissions bypass
cd /d "%~dp0"
"C:\Users\Stone-PC\.local\bin\claude.exe" --dangerously-skip-permissions %*
