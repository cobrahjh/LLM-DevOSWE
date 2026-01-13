@echo off
REM SimWidget Camera WASM Build Script - Using clang-cl in Clang mode
REM Version: 0.3.0
REM Machine: Harold-PC

setlocal

set SDK=C:\MSFS 2024 SDK\WASM
set CLANG=%SDK%\llvm\bin\clang-cl.exe
set WASM_LD=%SDK%\llvm\bin\wasm-ld.exe
set SYSROOT=%SDK%\wasi-sysroot

set SRC=%~dp0src
set OUT=%~dp0build

if not exist "%OUT%" mkdir "%OUT%"

echo ============================================
echo SimWidget Camera WASM Build v0.3
echo ============================================

REM Use /clang: prefix for clang-specific flags
echo Compiling with clang-cl...
"%CLANG%" ^
    /clang:--target=wasm32-unknown-wasi ^
    /clang:--sysroot=%SYSROOT% ^
    /I "%SDK%\include" ^
    /I "%SDK%\include\MSFS" ^
    /I "%SDK%\include\MSFS\Legacy" ^
    /I "%SYSROOT%\include" ^
    /D __wasi__ ^
    /D _MSFS_WASM=1 ^
    /D _STRING_H_CPLUSPLUS_98_CONFORMANCE_ ^
    /D _WCHAR_H_CPLUSPLUS_98_CONFORMANCE_ ^
    /D _LIBCPP_HAS_NO_THREADS ^
    /GR- ^
    /EHs-c- ^
    /O2 ^
    /c ^
    /Fo"%OUT%\simwidget_camera.obj" ^
    "%SRC%\simwidget_camera.cpp"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo COMPILE FAILED!
    pause
    exit /b 1
)

echo Linking with wasm-ld...
"%WASM_LD%" ^
    --no-entry ^
    --export-all ^
    --allow-undefined ^
    -L "%SDK%\lib" ^
    "%SDK%\lib\SimUtils.a" ^
    -o "%OUT%\simwidget_camera.wasm" ^
    "%OUT%\simwidget_camera.obj"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo LINK FAILED!
    pause
    exit /b 1
)

echo.
echo SUCCESS! Output: %OUT%\simwidget_camera.wasm
echo.

set PKG=%~dp0package\simwidget-camera\Modules
if not exist "%PKG%" mkdir "%PKG%"
copy /Y "%OUT%\simwidget_camera.wasm" "%PKG%\"
echo Copied to package directory.

pause
