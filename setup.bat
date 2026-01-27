@echo off
REM ============================================
REM Hive Bootstrap - Install all service dependencies
REM Run this after a fresh clone or when services crash with "Cannot find module"
REM ============================================

echo [Setup] Installing dependencies for all Hive services...
echo.

set ROOT=%~dp0

echo [1/10] Relay Service...
cd /d "%ROOT%Admin\relay" && call npm install --production >nul 2>&1 && echo   OK || echo   FAILED

echo [2/10] Orchestrator...
cd /d "%ROOT%Admin\orchestrator" && call npm install --production >nul 2>&1 && echo   OK || echo   FAILED

echo [3/10] SimWidget Backend...
cd /d "%ROOT%simwidget-hybrid\backend" && call npm install --production >nul 2>&1 && echo   OK || echo   FAILED

echo [4/10] Agent (Kitt)...
cd /d "%ROOT%Admin\agent" && call npm install --production >nul 2>&1 && echo   OK || echo   FAILED

echo [5/10] Remote Support...
cd /d "%ROOT%Admin\remote-support" && call npm install --production >nul 2>&1 && echo   OK || echo   FAILED

echo [6/10] Hive Oracle...
cd /d "%ROOT%Admin\hive-oracle" && call npm install --production >nul 2>&1 && echo   OK || echo   FAILED

echo [7/10] Hive Brain...
cd /d "%ROOT%Admin\hive-brain" && call npm install --production >nul 2>&1 && echo   OK || echo   FAILED

echo [8/10] Master Mind...
cd /d "%ROOT%Admin\master-mind" && call npm install --production >nul 2>&1 && echo   OK || echo   FAILED

echo [9/10] MCP Bridge...
cd /d "%ROOT%Admin\mcp-bridge" && call npm install --production >nul 2>&1 && echo   OK || echo   FAILED

echo [10/10] Hive Dashboard...
cd /d "%ROOT%Admin\hive-dashboard" && call npm install --production >nul 2>&1 && echo   OK || echo   FAILED

echo.
echo [Setup] Done! All service dependencies installed.
echo [Setup] Run start-all-servers.bat to start the Hive.
cd /d "%ROOT%"
