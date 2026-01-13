@echo off
REM SimWidget Camera WASM Build Script - Direct Clang
REM Version: 0.2.0
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
echo SimWidget Camera WASM Build (Direct Clang)
echo ============================================

REM Compile to object file
echo Compiling...
"%CLANG%" ^
    --target=wasm32-unknown-wasi ^
    --sysroot="%SYSROOT%" ^
    -I"%SDK%\include" ^
    -I"%SDK%\include\MSFS" ^
    -I"%SDK%\include\MSFS\Legacy" ^
    -D__wasi__ ^
    -D_MSFS_WASM=1 ^
    -D_STRING_H_CPLUSPLUS_98_CONFORMANCE_ ^
    -D_WCHAR_H_CPLUSPLUS_98_CONFORMANCE_ ^
    -D_LIBCPP_HAS_NO_THREADS ^
    -O2 ^
    -fno-exceptions ^
    -fno-rtti ^
    -c ^
    -o "%OUT%\simwidget_camera.o" ^
    "%SRC%\simwidget_camera.cpp"

if %ERRORLEVEL% NEQ 0 (
    echo COMPILE FAILED!
    pause
    exit /b 1
)

REM Link to WASM
echo Linking...
"%WASM_LD%" ^
    --no-entry ^
    --export-all ^
    --allow-undefined ^
    -L"%SDK%\lib" ^
    "%SDK%\lib\SimUtils.a" ^
    -o "%OUT%\simwidget_camera.wasm" ^
    "%OUT%\simwidget_camera.o"

if %ERRORLEVEL% NEQ 0 (
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
echo Copied to package.

pause
