@echo off
title DocSync Agent
cd /d C:\LLM-DevOSWE\Admin\docsync
echo.
echo   DocSync Agent - AI-Powered Document Sync
echo.
node docsync-agent.js %*
if "%1"=="" pause
