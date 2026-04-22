@echo off
setlocal EnableDelayedExpansion
title HSE - Monitoramento de Impressao (painel ao vivo)
color 0A

cd /d "%~dp0"

where pm2 >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERRO] PM2 nao encontrado no PATH.
    echo Rode primeiro: servidor-instalar.bat
    echo.
    pause
    exit /b 1
)

if not exist "logs" mkdir "logs"

echo ============================================================
echo  INICIANDO SERVICOS (PM2) - HSE
echo ============================================================
call pm2 start ecosystem.config.js >nul
call pm2 save >nul 2>&1

:: descobrir IP principal do servidor para exibir
set "SERVER_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    if not defined SERVER_IP set "SERVER_IP=%%a"
)
set "SERVER_IP=%SERVER_IP: =%"

:loop
cls
echo ============================================================
echo   HSE - MONITORAMENTO DE IMPRESSAO
echo   Painel ao vivo (atualiza a cada 3s)
echo ============================================================
echo.
echo   Acesso local   : http://localhost:3000
if defined SERVER_IP echo   Acesso na rede : http://%SERVER_IP%:3000
echo   API backend    : porta 3001
echo.
echo ------------------------------------------------------------
call pm2 jlist 2>nul | findstr /v "^$" >nul
call pm2 status
echo ------------------------------------------------------------
echo.
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "Get-Date -Format \"dd/MM/yyyy HH:mm:ss\""') do set AGORA=%%a
echo   Ultima atualizacao: %AGORA%
echo.
echo   [ Ctrl+C ] sair do painel (servicos continuam rodando)
echo   [ servidor-parar.bat ] parar servicos
echo   [ servidor-logs.bat  ] ver logs detalhados
echo ============================================================

timeout /t 3 /nobreak >nul
goto loop
