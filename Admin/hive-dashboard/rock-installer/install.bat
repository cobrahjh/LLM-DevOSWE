@echo off
setlocal enabledelayedexpansion
title Hive Installer for Rock-PC
color 0B

echo.
echo ========================================
echo   HIVE NODE INSTALLER - ROCK-PC
echo ========================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: Set install directory
set INSTALL_DIR=C:\Hive
set MASTER_IP=192.168.1.42

echo [*] Installing to %INSTALL_DIR%
echo [*] Master node: %MASTER_IP%
echo.

:: Create directory
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Check Node.js
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [*] Node.js not found. Installing...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi' -OutFile '%TEMP%\node-installer.msi'}"
    msiexec /i "%TEMP%\node-installer.msi" /qn /norestart
    set "PATH=%PATH%;C:\Program Files\nodejs"
    del "%TEMP%\node-installer.msi"
    echo [+] Node.js installed!
) else (
    for /f "tokens=1" %%v in ('node --version') do echo [+] Node.js: %%v
)

:: Copy services
echo.
echo [*] Copying services...
xcopy /E /I /Y "%~dp0oracle" "%INSTALL_DIR%\oracle" >nul
xcopy /E /I /Y "%~dp0relay" "%INSTALL_DIR%\relay" >nul
xcopy /E /I /Y "%~dp0agent" "%INSTALL_DIR%\agent" >nul
xcopy /E /I /Y "%~dp0hive-mind" "%INSTALL_DIR%\hive-mind" >nul
xcopy /E /I /Y "%~dp0shared" "%INSTALL_DIR%\shared" >nul
echo [+] Services copied

:: Configure relay to point to master
echo.
echo [*] Configuring connection to master node...
echo {"master": "%MASTER_IP%", "node_name": "rock-pc"} > "%INSTALL_DIR%\relay\config.json"

:: Install npm dependencies
echo.
echo [*] Installing dependencies (this may take a while)...
cd /d "%INSTALL_DIR%\oracle" && call npm install --silent 2>nul
cd /d "%INSTALL_DIR%\relay" && call npm install --silent 2>nul
cd /d "%INSTALL_DIR%\agent" && call npm install --silent 2>nul
cd /d "%INSTALL_DIR%\hive-mind" && call npm install --silent 2>nul
echo [+] Dependencies installed

:: Open firewall
echo.
echo [*] Configuring firewall...
netsh advfirewall firewall add rule name="Hive Oracle" dir=in action=allow protocol=TCP localport=3002 >nul 2>&1
netsh advfirewall firewall add rule name="Hive Relay" dir=in action=allow protocol=TCP localport=8600 >nul 2>&1
netsh advfirewall firewall add rule name="Hive Agent" dir=in action=allow protocol=TCP localport=8585 >nul 2>&1
netsh advfirewall firewall add rule name="Hive Mind" dir=in action=allow protocol=TCP localport=8701 >nul 2>&1
echo [+] Firewall configured

:: Create startup script
echo.
echo [*] Creating startup script...
(
echo @echo off
echo title Hive Services
echo cd /d C:\Hive\relay
echo start "Hive-Relay" node index.js
echo timeout /t 2 /nobreak ^>nul
echo cd /d C:\Hive\agent
echo start "Hive-Agent" node index.js
echo timeout /t 2 /nobreak ^>nul
echo cd /d C:\Hive\hive-mind
echo start "Hive-Mind" node index.js
echo echo Hive services started!
) > "%INSTALL_DIR%\start-hive.bat"

:: Add to startup folder
copy "%INSTALL_DIR%\start-hive.bat" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\" >nul
echo [+] Added to Windows startup

:: Start services now
echo.
echo [*] Starting services...
call "%INSTALL_DIR%\start-hive.bat"

echo.
echo ========================================
echo   HIVE INSTALLED SUCCESSFULLY!
echo ========================================
echo.
echo Services running on rock-pc:
echo   - Relay:     http://rock-pc:8600
echo   - Agent:     http://rock-pc:8585
echo   - Hive-Mind: http://rock-pc:8701
echo.
echo Master node: http://%MASTER_IP%:3002
echo.
echo To stop: Close the service windows
echo To start: Run C:\Hive\start-hive.bat
echo.
pause
