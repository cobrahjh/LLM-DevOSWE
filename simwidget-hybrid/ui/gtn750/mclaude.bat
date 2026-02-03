@echo off
:: Claude Code launcher with permissions bypass
cd /d "%~dp0"
claude --dangerously-skip-permissions %*
