@echo off
echo ====================================
echo SSL Certificate Generator
echo ====================================
echo.

REM Check if OpenSSL is available
where openssl >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: OpenSSL is not installed or not in PATH
    echo.
    echo Install OpenSSL for Windows:
    echo   1. Download from https://slproweb.com/products/Win32OpenSSL.html
    echo   2. Or install via: winget install OpenSSL.Light
    echo   3. Or via: choco install openssl
    echo.
    pause
    exit /b 1
)

REM Create certs directory if not exists
if not exist "%~dp0certs" mkdir "%~dp0certs"

echo Generating self-signed SSL certificate...
echo.

REM Generate private key and certificate
openssl req -x509 -newkey rsa:4096 ^
    -keyout "%~dp0certs\server.key" ^
    -out "%~dp0certs\server.crt" ^
    -days 365 ^
    -nodes ^
    -subj "/CN=localhost/O=SimWidget/OU=Agent" ^
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.1.42"

if %errorlevel% equ 0 (
    echo.
    echo ====================================
    echo SUCCESS! SSL certificates generated:
    echo   Key:  %~dp0certs\server.key
    echo   Cert: %~dp0certs\server.crt
    echo ====================================
    echo.
    echo To enable SSL, add to .env:
    echo   SSL_ENABLED=true
    echo.
    echo HTTPS will be available on port 8586
    echo.
) else (
    echo.
    echo ERROR: Failed to generate certificates
)

pause
