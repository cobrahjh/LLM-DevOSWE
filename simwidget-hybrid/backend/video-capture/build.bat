@echo off
REM Build script for native capture executables
REM Requires Visual Studio Build Tools

REM Change to script directory
cd /d "%~dp0"

echo SimGlass Video Capture - Build Script
echo =======================================
echo.

REM Find Visual Studio
set "VCVARS="
if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" (
    set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"
)
if exist "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
    set "VCVARS=C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
)
if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
    set "VCVARS=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
)
if exist "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat" (
    set "VCVARS=C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat"
)

if "%VCVARS%"=="" (
    echo ERROR: Visual Studio not found!
    echo Install Visual Studio or Build Tools with C++ support
    exit /b 1
)

echo Using: %VCVARS%
call "%VCVARS%"

REM Create output directory
if not exist "bin" mkdir bin

REM Build TCP Capture Service (Raw)
echo.
echo Building TCP Capture Service (Raw)...
cl /EHsc /O2 /Fe:bin\capture-service.exe capture-service.cpp /link d3d11.lib dxgi.lib ole32.lib ws2_32.lib
if %errorlevel% neq 0 (
    echo FAILED: capture-service.exe
) else (
    echo SUCCESS: bin\capture-service.exe
)

REM Build TCP Capture Service (JPEG)
echo.
echo Building TCP Capture Service (JPEG)...
cl /EHsc /O2 /Fe:bin\capture-jpeg.exe capture-service-jpeg.cpp /link d3d11.lib dxgi.lib ole32.lib oleaut32.lib ws2_32.lib windowscodecs.lib
if %errorlevel% neq 0 (
    echo FAILED: capture-jpeg.exe
) else (
    echo SUCCESS: bin\capture-jpeg.exe
)

REM Build Shared Memory Capture
echo.
echo Building Shared Memory Capture...
cl /EHsc /O2 /Fe:bin\shm-capture.exe shm-capture\shm-capture.cpp /link d3d11.lib dxgi.lib
if %errorlevel% neq 0 (
    echo FAILED: shm-capture.exe
) else (
    echo SUCCESS: bin\shm-capture.exe
)

REM Cleanup obj files
del *.obj 2>nul

echo.
echo Build complete!
echo.
echo Run:
echo   bin\capture-service.exe    - TCP server on port 9998
echo   bin\shm-capture.exe [fps]  - Shared memory capture
