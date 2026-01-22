@echo off
echo ========================================
echo   GIT SYNC - Oficaz
echo ========================================
echo.

:: Verificar si hay cambios
git status --short
if errorlevel 1 (
    echo Error al verificar cambios
    pause
    exit /b 1
)

echo.
echo Agregando cambios...
git add .

echo.
echo Haciendo commit...
set /p mensaje="Escribe un mensaje de commit (o Enter para 'Update'): "
if "%mensaje%"=="" set mensaje=Update

git commit -m "%mensaje%"

echo.
echo Subiendo a GitHub...
git push

echo.
echo ========================================
echo   SYNC COMPLETADO!
echo ========================================
pause
