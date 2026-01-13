@echo off
REM SimWidget Camera WASM Build - Direct Clang v4
REM Version: 0.4.0
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
echo SimWidget Camera WASM Build v0.4
echo ============================================
echo.

REM Compile using clang-cl with /clang: prefix for clang args
echo Step 1: Compiling simwidget_camera.cpp...

"%CLANG%" ^
    /clang:--target=wasm32-unknown-wasi ^
    /clang:--sysroot="%SYSROOT%" ^
    /I "%SYSROOT%\include" ^
    /I "%SYSROOT%\include\c++\v1" ^
    /I "%SDK%\include" ^
    /D __wasi__ ^
    /D _MSFS_WASM=1 ^
    /D _STRING_H_CPLUSPLUS_98_CONFORMANCE_ ^
    /D _WCHAR_H_CPLUSPLUS_98_CONFORMANCE_ ^
    /D _LIBCPP_HAS_NO_THREADS ^
    /GR- ^
    /clang:-fno-exceptions ^
    /O2 ^
    /c ^
    /Fo"%OUT%\simwidget_camera.obj" ^
    "%SRC%\simwidget_camera.cpp" 2>&1

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo COMPILE FAILED! Error code: %ERRORLEVEL%
    pause
    exit /b 1
)

echo Compile successful!
echo.

REM Link to WASM
echo Step 2: Linking to WASM...

"%WASM_LD%" ^
    --no-entry ^
    --export-all ^
    --allow-undefined ^
    -L "%SDK%\lib" ^
    "%SDK%\lib\SimUtils.a" ^
    -o "%OUT%\simwidget_camera.wasm" ^
    "%OUT%\simwidget_camera.obj" 2>&1

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo LINK FAILED! Error code: %ERRORLEVEL%
    pause
    exit /b 1
)

echo Link successful!
echo.
echo ============================================
echo BUILD SUCCESS!
echo Output: %OUT%\simwidget_camera.wasm
echo ============================================
echo.

REM Copy to package
set PKG=%~dp0package\simwidget-camera\Modules
if not exist "%PKG%" mkdir "%PKG%"
copy /Y "%OUT%\simwidget_camera.wasm" "%PKG%\"
echo Copied to: %PKG%

pause
