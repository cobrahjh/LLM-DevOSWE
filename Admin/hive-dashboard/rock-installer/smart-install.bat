@echo off
setlocal enabledelayedexpansion
title Hive Universal Installer

echo ========================================
echo   HIVE UNIVERSAL INSTALLER
echo   Turnkey Auto-Detection System
echo ========================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [*] Detecting system configuration...
echo.

:: Detect what's available
set HAS_DOCKER=0
set HAS_NODE=0
set HAS_WSL=0
set HAS_GIT=0

:: Check Docker
docker --version >nul 2>&1
if %errorLevel% equ 0 (
    set HAS_DOCKER=1
    for /f "tokens=3" %%v in ('docker --version') do set DOCKER_VER=%%v
    echo [+] Docker: Found v%DOCKER_VER%
) else (
    echo [-] Docker: Not installed
)

:: Check Node.js
node --version >nul 2>&1
if %errorLevel% equ 0 (
    set HAS_NODE=1
    for /f "tokens=1" %%v in ('node --version') do set NODE_VER=%%v
    echo [+] Node.js: Found %NODE_VER%
) else (
    echo [-] Node.js: Not installed
)

:: Check WSL
wsl --status >nul 2>&1
if %errorLevel% equ 0 (
    set HAS_WSL=1
    echo [+] WSL: Available
) else (
    echo [-] WSL: Not available
)

:: Check Git
git --version >nul 2>&1
if %errorLevel% equ 0 (
    set HAS_GIT=1
    echo [+] Git: Found
) else (
    echo [-] Git: Not installed
)

echo.
echo ========================================

:: Decision tree
if %HAS_DOCKER%==1 (
    echo [*] Using Docker mode (recommended)
    goto :DOCKER_INSTALL
)

if %HAS_NODE%==1 (
    echo [*] Using Node.js mode
    goto :NODE_INSTALL
)

if %HAS_WSL%==1 (
    echo [*] Using WSL mode
    goto :WSL_INSTALL
)

:: Nothing available - need to install something
echo.
echo [!] No runtime detected. Installing Node.js...
goto :INSTALL_NODE

:INSTALL_NODE
echo.
echo [*] Downloading Node.js installer...

:: Download Node.js using PowerShell
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.10.0/node-v20.10.0-x64.msi' -OutFile '%TEMP%\node-installer.msi'}"

if exist "%TEMP%\node-installer.msi" (
    echo [*] Installing Node.js silently...
    msiexec /i "%TEMP%\node-installer.msi" /qn /norestart

    :: Refresh PATH
    set "PATH=%PATH%;C:\Program Files\nodejs"

    echo [+] Node.js installed!
    del "%TEMP%\node-installer.msi"

    set HAS_NODE=1
    goto :NODE_INSTALL
) else (
    echo [!] Failed to download Node.js
    echo [!] Please install Node.js manually from https://nodejs.org
    pause
    exit /b 1
)

:DOCKER_INSTALL
echo.
echo [*] Starting Docker installation...
cd /d "%~dp0"

:: Check if docker-compose.yml exists
if not exist "docker-compose.yml" (
    echo [!] docker-compose.yml not found
    goto :NODE_INSTALL
)

echo [*] Pulling images and starting services...
docker compose up -d

if %errorLevel% equ 0 (
    echo.
    echo [*] Opening firewall ports...
    netsh advfirewall firewall add rule name="Hive Services" dir=in action=allow protocol=TCP localport=3002,8585,8600,8701 >nul 2>&1
    echo [+] Firewall configured
    echo.
    echo ========================================
    echo   HIVE INSTALLED SUCCESSFULLY (Docker)
    echo ========================================
    echo.
    echo Services running:
    echo   - Oracle:     http://localhost:3002
    echo   - Relay:      http://localhost:8600
    echo   - Agent:      http://localhost:8585
    echo   - Hive-Mind:  http://localhost:8701
    echo.
    echo To stop:  docker compose down
    echo To logs:  docker compose logs -f
    echo.
) else (
    echo [!] Docker failed, falling back to Node.js...
    goto :NODE_INSTALL
)
goto :END

:NODE_INSTALL
echo.
echo [*] Starting Node.js installation...
cd /d "%~dp0"

:: Install dependencies for each service
echo [*] Installing Oracle dependencies...
if exist "oracle\package.json" (
    cd oracle && npm install --silent && cd ..
)

echo [*] Installing Relay dependencies...
if exist "relay\package.json" (
    cd relay && npm install --silent && cd ..
)

echo [*] Installing Agent dependencies...
if exist "agent\package.json" (
    cd agent && npm install --silent && cd ..
)

echo [*] Installing Hive-Mind dependencies...
if exist "hive-mind\package.json" (
    cd hive-mind && npm install --silent && cd ..
)

:: Start services
echo.
echo [*] Starting services...
start "Hive-Oracle" cmd /c "cd /d %~dp0oracle && node index.js"
timeout /t 2 /nobreak >nul
start "Hive-Relay" cmd /c "cd /d %~dp0relay && node index.js"
timeout /t 2 /nobreak >nul
start "Hive-Agent" cmd /c "cd /d %~dp0agent && node index.js"
timeout /t 2 /nobreak >nul
start "Hive-Mind" cmd /c "cd /d %~dp0hive-mind && node index.js"

echo.
echo [*] Opening firewall ports...
netsh advfirewall firewall add rule name="Hive Services" dir=in action=allow protocol=TCP localport=3002,8585,8600,8701 >nul 2>&1
echo [+] Firewall configured
echo.
echo ========================================
echo   HIVE INSTALLED SUCCESSFULLY (Node.js)
echo ========================================
echo.
echo Services starting:
echo   - Oracle:     http://localhost:3002
echo   - Relay:      http://localhost:8600
echo   - Agent:      http://localhost:8585
echo   - Hive-Mind:  http://localhost:8701
echo.
goto :END

:WSL_INSTALL
echo.
echo [*] Starting WSL installation...
wsl bash -c "cd /mnt/c/LLM-DevOSWE/Admin/hive-universal-install && ./install.sh"
goto :END

:END
echo.
echo [*] Installation complete!
echo.
pause
