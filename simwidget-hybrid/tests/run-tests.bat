@echo off
:: SimGlass Test Runner
:: Double-click to run all tests
:: Path: C:\LLM-DevOSWE\simwidget-hybrid\tests\run-tests.bat

cd /d "%~dp0\.."
node tests/test-runner.js %*
pause
