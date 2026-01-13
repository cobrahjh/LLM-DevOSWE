@echo off
REM SimWidget Camera WASM Build Script (VS2022)
REM Version: 0.1.2
REM Machine: Harold-PC

setlocal

REM Set MSFS SDK path
set MSFS_SDK=C:\MSFS 2024 SDK

REM MSBuild path
set MSBUILD="C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe"

REM Project path
set PROJECT_DIR=%~dp0
set PROJECT_FILE=%PROJECT_DIR%SimWidgetCamera.vcxproj

echo ============================================
echo SimWidget Camera WASM Build
echo ============================================
echo.
echo MSFS_SDK: %MSFS_SDK%
echo Project: %PROJECT_FILE%
echo.

REM Check if MSBuild exists
if not exist %MSBUILD% (
    echo ERROR: MSBuild not found at %MSBUILD%
    echo Please install Visual Studio 2022 with C++ tools
    pause
    exit /b 1
)

REM Check if SDK exists
if not exist "%MSFS_SDK%\WASM" (
    echo ERROR: MSFS SDK not found at %MSFS_SDK%
    pause
    exit /b 1
)

echo Building Release configuration...
echo.

%MSBUILD% "%PROJECT_FILE%" /p:Configuration=Release /p:Platform=MSFS /p:MSFS_SDK="%MSFS_SDK%" /t:Build /v:minimal

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo BUILD FAILED!
    pause
    exit /b 1
)

echo.
echo ============================================
echo Build successful!
echo Output: %PROJECT_DIR%build\simwidget_camera.wasm
echo ============================================
echo.

pause
