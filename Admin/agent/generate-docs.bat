@echo off
:: SimWidget Documentation Generator
:: Double-click to regenerate all documentation
:: Path: C:\LLM-DevOSWE\Admin\agent\generate-docs.bat

cd /d "%~dp0\.."
node tools/generate-docs.js
pause
