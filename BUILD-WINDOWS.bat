@echo off
title Miroo NFT Tools — Windows Build Script
cd /d "%~dp0"

echo ============================================
echo   Miroo NFT Tools — Complete Build Process
echo ============================================
echo.
echo This will:
echo   1. Clone Next.js app from GitHub
echo   2. Install dependencies (both repos)
echo   3. Build Next.js standalone
echo   4. Build Electron installer
echo.
echo Time: ~5-10 minutes depending on connection
echo.
pause

:: Step 1: Clone Miroo-NFT-App if not exists
echo.
echo [1/5] Cloning Next.js app...
if not exist "next-app" (
    git clone https://github.com/sirenwontdie/Miroo-NFT-App.git next-app
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to clone Miroo-NFT-App
        pause
        exit /b 1
    )
) else (
    echo [SKIP] next-app already exists
)

:: Step 2: Install Next.js dependencies
echo.
echo [2/5] Installing Next.js dependencies...
cd next-app
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed in next-app
    cd ..
    pause
    exit /b 1
)
cd ..

:: Step 3: Build Next.js standalone
echo.
echo [3/5] Building Next.js standalone...
cd next-app
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm run build failed
    cd ..
    pause
    exit /b 1
)

if not exist ".next\standalone\server.js" (
    echo [ERROR] Standalone build output not found
    cd ..
    pause
    exit /b 1
)
echo [OK] Standalone build complete
cd ..

:: Step 4: Install Electron dependencies
echo.
echo [4/5] Installing Electron dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed in Electron wrapper
    pause
    exit /b 1
)

:: Step 5: Build Electron installer
echo.
echo [5/5] Building Electron installer...
call npm run build:win
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Electron build failed
    pause
    exit /b 1
)

:: Verify output
echo.
echo ============================================
echo   Build Complete!
echo ============================================
echo.
if exist "dist\Miroo NFT Tools Setup 1.0.0.exe" (
    echo [SUCCESS] Installer created:
    echo   Location: %~dp0dist\Miroo NFT Tools Setup 1.0.0.exe
    echo   Size: 
    dir "dist\Miroo NFT Tools Setup 1.0.0.exe" | find "Miroo"
    echo.
    echo Double-click the installer to install.
) else (
    echo [ERROR] Installer not found in dist folder
)
echo.
pause
