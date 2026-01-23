@echo off
REM SimWidget Camera WASM - Direct Build (no VS integration needed)
REM Uses clang-cl.exe directly from MSFS SDK

setlocal

set SDK=C:\MSFS 2024 SDK
set CLANG=%SDK%\WASM\llvm\bin\clang-cl.exe
set LINKER=%SDK%\WASM\llvm\bin\wasm-ld.exe

set INCLUDES=-I"%SDK%\WASM\wasi-sysroot\include" -I"%SDK%\WASM\wasi-sysroot\include\c++\v1" -I"%SDK%\WASM\include" -I"%SDK%\SimConnect SDK\include"

set DEFINES=-D__wasi__ -D_LIBCPP_HAS_NO_THREADS -DNDEBUG
set CFLAGS=--target=wasm32-unknown-wasi -O2 -fno-exceptions -fno-rtti -c
set LDFLAGS=--no-entry --export-dynamic --allow-undefined -L"%SDK%\WASM\wasi-sysroot\lib\wasm32-wasi"

echo ============================================
echo SimWidget Camera WASM Build (Direct)
echo ============================================
echo.

REM Create build directory
if not exist build mkdir build

REM Compile
echo Compiling simwidget_camera.cpp...
"%CLANG%" %CFLAGS% %DEFINES% %INCLUDES% src\simwidget_camera.cpp -o build\simwidget_camera.o
if %ERRORLEVEL% NEQ 0 (
    echo COMPILE FAILED!
    exit /b 1
)

REM Link
echo Linking...
"%LINKER%" %LDFLAGS% build\simwidget_camera.o -o build\simwidget_camera.wasm
if %ERRORLEVEL% NEQ 0 (
    echo LINK FAILED!
    exit /b 1
)

REM Check size
for %%A in (build\simwidget_camera.wasm) do set SIZE=%%~zA
echo.
echo ============================================
echo BUILD SUCCESSFUL!
echo Output: build\simwidget_camera.wasm
echo Size: %SIZE% bytes
echo ============================================

if %SIZE% LSS 5000 (
    echo.
    echo WARNING: WASM is very small - may indicate linking issue
)
