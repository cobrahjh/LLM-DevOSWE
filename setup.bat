@echo off
title Hive Setup
color 0E

echo.
echo  =============================================
echo       HIVE BOOTSTRAP - Install Dependencies
echo  =============================================
echo.
echo  Run this after a fresh clone or when services
echo  crash with "Cannot find module" errors.
echo.

set ROOT=%~dp0
set COUNT=0
set TOTAL=16

:: Core services
echo  [1/%TOTAL%] Oracle...
cd /d "C:\LLM-Oracle" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [2/%TOTAL%] Relay Service...
cd /d "%ROOT%Admin\relay" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [3/%TOTAL%] Orchestrator...
cd /d "%ROOT%Admin\orchestrator" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [4/%TOTAL%] SimWidget Backend...
cd /d "%ROOT%simwidget-hybrid\backend" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [5/%TOTAL%] Agent (KittBox)...
cd /d "%ROOT%Admin\agent" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [6/%TOTAL%] Remote Support...
cd /d "%ROOT%Admin\remote-support" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [7/%TOTAL%] Claude Bridge...
cd /d "%ROOT%Admin\claude-bridge" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [8/%TOTAL%] Hive-Mind...
cd /d "%ROOT%Admin\hive-mind" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [9/%TOTAL%] Terminal Hub...
cd /d "%ROOT%Admin\terminal-hub" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [10/%TOTAL%] Hive Brain...
cd /d "%ROOT%Admin\hive-brain" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [11/%TOTAL%] Master Mind...
cd /d "%ROOT%Admin\master-mind" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [12/%TOTAL%] Hive Oracle...
cd /d "%ROOT%Admin\hive-oracle" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [13/%TOTAL%] MCP Bridge...
cd /d "%ROOT%Admin\mcp-bridge" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [14/%TOTAL%] Dashboard...
cd /d "%ROOT%Admin\hive-dashboard" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [15/%TOTAL%] VoiceAccess...
cd /d "%ROOT%Admin\voiceaccess" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

echo  [16/%TOTAL%] Intel Pollers...
cd /d "%ROOT%Admin\intel-pollers" && call npm install --production >nul 2>&1 && echo         OK || echo         FAILED

cd /d "%ROOT%"

echo.
echo  =============================================
echo       SETUP COMPLETE
echo  =============================================
echo.
echo  Next steps:
echo    1. Run start-hive.bat to start all services
echo    2. Open http://localhost:8899 for Dashboard
echo    3. Open http://localhost:8585 for KittBox
echo.
pause
