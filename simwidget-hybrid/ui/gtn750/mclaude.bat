@echo off
:: mclaude - Claude with permissions bypass
cd /d "%~dp0"
call "%APPDATA%\npm\claude.cmd" --dangerously-skip-permissions %*
