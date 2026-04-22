@echo off
chcp 65001 >nul 2>&1
title Recompilar Frontend - HSE
color 0E

echo [BUILD] Recompilando frontend...
cd /d "%~dp0frontend"
call npx next build

echo.
echo [OK] Build concluido! Reinicie o iniciar.bat para aplicar.
pause
