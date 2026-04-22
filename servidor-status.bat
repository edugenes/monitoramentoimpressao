@echo off
setlocal EnableDelayedExpansion
title HSE - Status dos Servicos
color 0B

cd /d "%~dp0"

echo ============================================================
echo  STATUS DOS SERVICOS - HSE
echo ============================================================
echo.

where pm2 >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERRO] PM2 nao encontrado.
    goto fim
)

call pm2 status
echo.
echo ----- backend -----
call pm2 describe hse-backend  2>nul | findstr /C:"status" /C:"uptime" /C:"restarts" /C:"memory" /C:"pid"
echo.
echo ----- frontend -----
call pm2 describe hse-frontend 2>nul | findstr /C:"status" /C:"uptime" /C:"restarts" /C:"memory" /C:"pid"

:fim
echo.
echo Pressione qualquer tecla para fechar . . .
pause >nul
endlocal
