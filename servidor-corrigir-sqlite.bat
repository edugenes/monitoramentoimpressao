@echo off
setlocal EnableDelayedExpansion
title HSE - Corrigir better-sqlite3 para versao do Node atual
color 0E

echo ============================================================
echo  CORRIGIR better-sqlite3
echo  (use quando der erro "NODE_MODULE_VERSION xxx" no backend)
echo ============================================================
echo.

set "BASE_DIR=%~dp0"
set "BACKEND_DIR=%BASE_DIR%backend"

where node >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERRO] Node.js nao encontrado.
    goto fim
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [INFO] Node.js !NODE_VERSION! detectado

if not exist "%BACKEND_DIR%\package.json" (
    color 0C
    echo [ERRO] Pasta backend nao encontrada em %BACKEND_DIR%
    goto fim
)

echo.
echo [1/3] Removendo node_modules antigo do backend...
cd /d "%BACKEND_DIR%"
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json

echo.
echo [2/3] Reinstalando dependencias do backend...
call npm install --omit=dev
if errorlevel 1 (
    color 0C
    echo [ERRO] Falha no npm install.
    goto fim
)

echo.
echo [3/3] Recompilando better-sqlite3 para a versao atual do Node...
call npm rebuild better-sqlite3
if errorlevel 1 (
    color 0C
    echo [ERRO] Falha ao recompilar.
    goto fim
)

echo.
echo Testando carregamento do modulo...
call node -e "require('better-sqlite3'); console.log('OK: better-sqlite3 carregou corretamente.')"
if errorlevel 1 (
    color 0C
    echo [ERRO] O modulo ainda nao carrega. Verifique log acima.
    goto fim
)

echo.
echo ============================================================
echo  CORRIGIDO! Agora pode rodar  servidor-iniciar.bat
echo ============================================================

:fim
echo.
echo Pressione qualquer tecla para fechar . . .
pause >nul
endlocal
