@echo off
REM Build all WASM prototypes and compare sizes
REM Run on Harold-PC with MSFS 2024 SDK installed

setlocal

set SDK=C:\MSFS 2024 SDK\WASM
set CLANG=%SDK%\llvm\bin\clang.exe
set WASM_LD=%SDK%\llvm\bin\wasm-ld.exe
set SYSROOT=%SDK%\wasi-sysroot

set SRC=%~dp0
set OUT=%~dp0..\build\prototypes

if not exist "%OUT%" mkdir "%OUT%"

echo ============================================
echo SimWidget Camera WASM Prototypes Builder
echo ============================================
echo.

REM Common compile flags
set CFLAGS=--target=wasm32-unknown-wasi --sysroot="%SYSROOT%" -I "%SYSROOT%\include" -I "%SDK%\include" -D __wasi__ -D _MSFS_WASM=1 -fno-exceptions -O2 -c

REM Common link flags
set LDFLAGS=--no-entry --export-all --allow-undefined -L "%SDK%\lib" "%SDK%\lib\libmsfs.a"

echo Building prototypes...
echo.

for %%f in ("%SRC%proto*.cpp") do (
    echo Building %%~nf...

    "%CLANG%" %CFLAGS% -o "%OUT%\%%~nf.obj" "%%f" 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo   FAILED: Compile error
    ) else (
        "%WASM_LD%" %LDFLAGS% -o "%OUT%\%%~nf.wasm" "%OUT%\%%~nf.obj" 2>&1
        if %ERRORLEVEL% NEQ 0 (
            echo   FAILED: Link error
        ) else (
            for %%s in ("%OUT%\%%~nf.wasm") do echo   SUCCESS: %%~zs bytes
        )
    )
    echo.
)

echo ============================================
echo Build Complete - Size Comparison:
echo ============================================
dir /b /s "%OUT%\*.wasm" | sort
for %%f in ("%OUT%\*.wasm") do (
    echo %%~nxf: %%~zf bytes
)
echo.
echo Reference sizes:
echo   Lorby LVar Hook: ~1,000,000 bytes
echo   Flow Pro Module: ~1,780,000 bytes
echo   MobiFlight:      ~1,800,000 bytes
echo.

pause
