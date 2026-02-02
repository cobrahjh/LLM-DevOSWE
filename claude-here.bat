@echo off
title Claude Code - LLM-DevOSWE
color 1F
cd /d C:\LLM-DevOSWE
echo.
echo   [LLM-DevOSWE] BLUE
echo.
cmd /k "C:\LLM-DevOSWE\mclaude.bat" --model opus %*
