@echo off
title Hive Services Installer
color 0A

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  ERROR: Run as Administrator!
    echo  Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo.
echo  ========================================
echo     HIVE SERVICES INSTALLER
echo  ========================================
echo.

:: Check for NSSM
where nssm >nul 2>&1
if %errorLevel% neq 0 (
    echo  NSSM not found. Downloading...
    powershell -Command "Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile '%TEMP%\nssm.zip'"
    powershell -Command "Expand-Archive -Path '%TEMP%\nssm.zip' -DestinationPath '%TEMP%\nssm' -Force"
    copy "%TEMP%\nssm\nssm-2.24\win64\nssm.exe" "C:\Windows\System32\nssm.exe"
    echo  NSSM installed.
)

set NODE_PATH=C:\Program Files\nodejs\node.exe

echo.
echo  [1/5] Installing Oracle Service...
nssm stop HiveOracle >nul 2>&1
nssm remove HiveOracle confirm >nul 2>&1
nssm install HiveOracle "%NODE_PATH%"
nssm set HiveOracle AppParameters "oracle.js"
nssm set HiveOracle AppDirectory "C:\LLM-Oracle"
nssm set HiveOracle DisplayName "Hive Oracle"
nssm set HiveOracle Description "LLM backend service for the Hive (port 3002)"
nssm set HiveOracle Start SERVICE_AUTO_START
nssm set HiveOracle AppStdout "C:\LLM-DevOSWE\Admin\services\logs\oracle.log"
nssm set HiveOracle AppStderr "C:\LLM-DevOSWE\Admin\services\logs\oracle.error.log"
nssm set HiveOracle AppRotateFiles 1
nssm set HiveOracle AppRotateBytes 1048576
echo        Done.

echo  [2/5] Installing Relay Service...
nssm stop HiveRelay >nul 2>&1
nssm remove HiveRelay confirm >nul 2>&1
nssm install HiveRelay "%NODE_PATH%"
nssm set HiveRelay AppParameters "relay-service.js"
nssm set HiveRelay AppDirectory "C:\LLM-DevOSWE\Admin\relay"
nssm set HiveRelay DisplayName "Hive Relay"
nssm set HiveRelay Description "Message relay service for the Hive (port 8600)"
nssm set HiveRelay Start SERVICE_AUTO_START
nssm set HiveRelay AppStdout "C:\LLM-DevOSWE\Admin\services\logs\relay.log"
nssm set HiveRelay AppStderr "C:\LLM-DevOSWE\Admin\services\logs\relay.error.log"
nssm set HiveRelay AppRotateFiles 1
nssm set HiveRelay AppRotateBytes 1048576
echo        Done.

echo  [3/5] Installing KittBox Service...
nssm stop HiveKittBox >nul 2>&1
nssm remove HiveKittBox confirm >nul 2>&1
nssm install HiveKittBox "%NODE_PATH%"
nssm set HiveKittBox AppParameters "agent-server.js"
nssm set HiveKittBox AppDirectory "C:\LLM-DevOSWE\Admin\agent"
nssm set HiveKittBox DisplayName "Hive KittBox"
nssm set HiveKittBox Description "KittBox web UI service (port 8585)"
nssm set HiveKittBox Start SERVICE_AUTO_START
nssm set HiveKittBox AppStdout "C:\LLM-DevOSWE\Admin\services\logs\kittbox.log"
nssm set HiveKittBox AppStderr "C:\LLM-DevOSWE\Admin\services\logs\kittbox.error.log"
nssm set HiveKittBox AppRotateFiles 1
nssm set HiveKittBox AppRotateBytes 1048576
echo        Done.

echo  [4/5] Installing Kitt Live Service...
nssm stop HiveKittLive >nul 2>&1
nssm remove HiveKittLive confirm >nul 2>&1
nssm install HiveKittLive "%NODE_PATH%"
nssm set HiveKittLive AppParameters "server.js"
nssm set HiveKittLive AppDirectory "C:\kittbox-modules\kitt-live"
nssm set HiveKittLive DisplayName "Hive Kitt Live"
nssm set HiveKittLive Description "Kitt Live voice chat service (port 8686)"
nssm set HiveKittLive Start SERVICE_AUTO_START
nssm set HiveKittLive AppStdout "C:\LLM-DevOSWE\Admin\services\logs\kittlive.log"
nssm set HiveKittLive AppStderr "C:\LLM-DevOSWE\Admin\services\logs\kittlive.error.log"
nssm set HiveKittLive AppRotateFiles 1
nssm set HiveKittLive AppRotateBytes 1048576
echo        Done.

echo  [5/5] Installing Hive-Mind Service...
nssm stop HiveMind >nul 2>&1
nssm remove HiveMind confirm >nul 2>&1
nssm install HiveMind "%NODE_PATH%"
nssm set HiveMind AppParameters "hive-mind-server.js"
nssm set HiveMind AppDirectory "C:\LLM-DevOSWE\Admin\hive-mind"
nssm set HiveMind DisplayName "Hive Mind"
nssm set HiveMind Description "Real-time activity monitor (port 8701)"
nssm set HiveMind Start SERVICE_AUTO_START
nssm set HiveMind AppStdout "C:\LLM-DevOSWE\Admin\services\logs\hivemind.log"
nssm set HiveMind AppStderr "C:\LLM-DevOSWE\Admin\services\logs\hivemind.error.log"
nssm set HiveMind AppRotateFiles 1
nssm set HiveMind AppRotateBytes 1048576
echo        Done.

:: Create logs directory
if not exist "C:\LLM-DevOSWE\Admin\services\logs" mkdir "C:\LLM-DevOSWE\Admin\services\logs"

echo.
echo  ========================================
echo     STARTING ALL SERVICES
echo  ========================================
echo.

nssm start HiveOracle
timeout /t 2 /nobreak >nul
nssm start HiveRelay
timeout /t 1 /nobreak >nul
nssm start HiveKittBox
timeout /t 1 /nobreak >nul
nssm start HiveKittLive
timeout /t 1 /nobreak >nul
nssm start HiveMind

echo.
echo  ========================================
echo     INSTALLATION COMPLETE
echo  ========================================
echo.
echo  Services installed:
echo    - HiveOracle    (port 3002)
echo    - HiveRelay     (port 8600)
echo    - HiveKittBox   (port 8585)
echo    - HiveKittLive  (port 8686)
echo    - HiveMind      (port 8701)
echo.
echo  Manage via: services.msc
echo  Logs at: C:\LLM-DevOSWE\Admin\services\logs\
echo.
pause
