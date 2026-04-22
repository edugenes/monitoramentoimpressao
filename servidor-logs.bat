@echo off
setlocal
title HSE - Logs em tempo real
color 0B

cd /d "%~dp0"

echo ============================================================
echo  LOGS EM TEMPO REAL - HSE
echo  Pressione Ctrl+C para sair.
echo ============================================================
echo.

where pm2 >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERRO] PM2 nao encontrado.
    echo.
    pause
    exit /b 1
)

call pm2 logs --lines 100

echo.
echo Pressione qualquer tecla para fechar . . .
pause >nul
endlocal
