@echo off
title Claude Code - LLM-DevOSWE
color 1F
cd /d C:\LLM-DevOSWE
echo.
echo   [LLM-DevOSWE] BLUE
echo.
claude --model opus --resume --dangerously-skip-permissions %*
pause
