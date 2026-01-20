@echo off
title Sync Hive to Morpu-PC
color 0B

echo.
echo  ========================================
echo     SYNC HIVE SERVICES TO MORPU-PC
echo  ========================================
echo.

:: Configuration - UPDATE THIS
set MORPU_USER=hive
set MORPU_IP=192.168.1.XXX

echo  Target: %MORPU_USER%@%MORPU_IP%
echo.

if "%MORPU_IP%"=="192.168.1.XXX" (
    echo  ERROR: Please edit this script and set MORPU_IP
    echo  Edit: %~f0
    pause
    exit /b 1
)

echo  [1/5] Syncing Oracle...
scp -r C:\LLM-Oracle %MORPU_USER%@%MORPU_IP%:/opt/hive/oracle

echo  [2/5] Syncing Relay...
scp -r C:\LLM-DevOSWE\Admin\relay %MORPU_USER%@%MORPU_IP%:/opt/hive/relay

echo  [3/5] Syncing Agent (KittBox)...
scp -r C:\LLM-DevOSWE\Admin\agent %MORPU_USER%@%MORPU_IP%:/opt/hive/agent

echo  [4/5] Syncing Hive-Mind...
scp -r C:\LLM-DevOSWE\Admin\hive-mind %MORPU_USER%@%MORPU_IP%:/opt/hive/hive-mind

echo  [5/5] Setting permissions...
ssh %MORPU_USER%@%MORPU_IP% "sudo chown -R hive:hive /opt/hive"

echo.
echo  ========================================
echo     SYNC COMPLETE
echo  ========================================
echo.
echo  Next: SSH to morpu-pc and run:
echo    cd /opt/hive/relay ^&^& npm install
echo    cd /opt/hive/agent ^&^& npm install
echo    cd /opt/hive/oracle ^&^& npm install
echo    cd /opt/hive/hive-mind ^&^& npm install
echo    sudo systemctl start hive-oracle hive-relay hive-kittbox hive-mind
echo.
pause
