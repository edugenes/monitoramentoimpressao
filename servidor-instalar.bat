@echo off
setlocal EnableDelayedExpansion
title HSE - Instalacao no Servidor
color 0A

echo ============================================================
echo  INSTALACAO / PRIMEIRA EXECUCAO - SERVIDOR
echo  Sistema de Monitoramento de Impressao - HSE
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERRO] Node.js nao encontrado.
    echo Instale a versao LTS em https://nodejs.org e rode este .bat de novo.
    goto fim_erro
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [INFO] Node.js !NODE_VERSION! detectado

set "BASE_DIR=%~dp0"
set "BACKEND_DIR=%BASE_DIR%backend"
set "FRONTEND_DIR=%BASE_DIR%frontend"

if not exist "%BACKEND_DIR%\package.json" (
    color 0C
    echo [ERRO] Pasta backend nao encontrada em %BACKEND_DIR%
    goto fim_erro
)
if not exist "%FRONTEND_DIR%\package.json" (
    color 0C
    echo [ERRO] Pasta frontend nao encontrada em %FRONTEND_DIR%
    goto fim_erro
)

if not exist "%BASE_DIR%logs" mkdir "%BASE_DIR%logs"

echo.
echo [1/6] Instalando dependencias do backend...
cd /d "%BACKEND_DIR%"
if exist "node_modules\better-sqlite3" (
    echo [INFO] node_modules ja existe, removendo para forcar reinstalacao
    echo        compativel com a versao atual do Node.js neste servidor...
    rmdir /s /q node_modules 2>nul
    del /q package-lock.json 2>nul
)
call npm install --omit=dev
if errorlevel 1 goto fim_erro

echo.
echo [2/6] Garantindo que modulos nativos estao compilados para este Node.js...
call npm rebuild better-sqlite3
if errorlevel 1 goto fim_erro

echo.
echo [3/6] Aplicando migrations e criando usuario admin (se nao existir)...
call node scripts/seed-admin.js
if errorlevel 1 goto fim_erro

echo.
echo [4/6] Instalando dependencias do frontend...
cd /d "%FRONTEND_DIR%"
if exist "node_modules" if not exist "node_modules\next" (
    rmdir /s /q node_modules 2>nul
    del /q package-lock.json 2>nul
)
call npm install
if errorlevel 1 goto fim_erro

echo.
echo [5/6] Compilando frontend para producao (next build)...
if exist ".next" rmdir /s /q .next 2>nul
call npx next build
if errorlevel 1 goto fim_erro

echo.
echo [6/6] Instalando PM2 globalmente...
cd /d "%BASE_DIR%"
call npm install -g pm2
if errorlevel 1 goto fim_erro

echo.
echo ============================================================
echo  INSTALACAO CONCLUIDA COM SUCESSO!
echo ============================================================
echo.
echo  Proximos passos:
echo    1. servidor-iniciar.bat                 (subir os servicos)
echo    2. servidor-autostart.bat  (como ADMIN) (iniciar com Windows)
echo.
echo  Acesso apos ligar: http://IP_DO_SERVIDOR:3000
echo.
goto fim

:fim_erro
color 0C
echo.
echo [ERRO] Falha durante a instalacao. Verifique a mensagem acima.

:fim
echo.
echo Pressione qualquer tecla para fechar . . .
pause >nul
endlocal
