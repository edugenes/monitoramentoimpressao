@echo off
setlocal EnableDelayedExpansion
title HSE - Parar Servicos
color 0E

echo ============================================================
echo  PARANDO SERVICOS (PM2) - HSE
echo ============================================================
echo.

cd /d "%~dp0"

where pm2 >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERRO] PM2 nao esta instalado.
    goto fim
)

call pm2 stop ecosystem.config.js
call pm2 save >nul

echo.
call pm2 status
echo.
echo [OK] Servicos parados.

:fim
echo.
echo Pressione qualquer tecla para fechar . . .
pause >nul
endlocal
