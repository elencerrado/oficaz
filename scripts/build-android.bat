@echo off
Setlocal EnableDelayedExpansion

REM Script para construir y ejecutar la app Oficaz Android

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

cd /d "%~dp0.."

echo.
echo ================================
echo Building Oficaz Android App
echo ================================
echo.

REM Verificar Java
java -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java no encontrado
    exit /b 1
)

echo [1/4] Building web frontend...
call npm run build
if errorlevel 1 (
    echo ERROR: Web build failed
    exit /b 1
)
echo.

echo [2/4] Generating Android icons...
call node scripts/generate-icons.cjs
if errorlevel 1 (
    echo ERROR: Icon generation failed
    exit /b 1
)
echo.

echo [3/4] Syncing with Android...
call npx cap sync android
if errorlevel 1 (
    echo ERROR: Capacitor sync failed
    exit /b 1
)
echo.

echo [4/4] Building Android APK...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo ERROR: Android build failed
    exit /b 1
)
cd ..
echo.

echo ================================
echo Success! APK built:
echo android\app\build\outputs\apk\debug\app-debug.apk
echo ================================
echo.
