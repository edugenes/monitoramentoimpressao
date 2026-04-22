@echo off
chcp 65001 >nul 2>&1
title Monitoramento de Impressao - HSE
color 0A

echo ============================================================
echo    SISTEMA DE MONITORAMENTO DE IMPRESSAO - HSE
echo    Hospital dos Servidores do Estado
echo ============================================================
echo.

:: Verificar se o Node.js esta instalado
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [INFO] Node.js %NODE_VERSION% detectado

:: Definir diretorio base
set "BASE_DIR=%~dp0"
set "BACKEND_DIR=%BASE_DIR%backend"
set "FRONTEND_DIR=%BASE_DIR%frontend"

echo [INFO] Diretorio: %BASE_DIR%
echo.

:: Verificar se as pastas existem
if not exist "%BACKEND_DIR%\package.json" (
    echo [ERRO] Pasta backend nao encontrada em %BACKEND_DIR%
    pause
    exit /b 1
)
if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERRO] Pasta frontend nao encontrada em %FRONTEND_DIR%
    pause
    exit /b 1
)

:: Verificar dependencias do backend
if not exist "%BACKEND_DIR%\node_modules" (
    echo [SETUP] Instalando dependencias do backend...
    cd /d "%BACKEND_DIR%"
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERRO] Falha ao instalar dependencias do backend
        pause
        exit /b 1
    )
    echo.
)

:: Verificar dependencias do frontend
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [SETUP] Instalando dependencias do frontend...
    cd /d "%FRONTEND_DIR%"
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERRO] Falha ao instalar dependencias do frontend
        pause
        exit /b 1
    )
    echo.
)

:: Build de producao do frontend
if not exist "%FRONTEND_DIR%\.next\BUILD_ID" (
    echo [BUILD] Compilando frontend (primeira vez, aguarde ~30s)...
    cd /d "%FRONTEND_DIR%"
    call npx next build
    if %ERRORLEVEL% neq 0 (
        echo [ERRO] Falha ao compilar frontend
        pause
        exit /b 1
    )
    echo.
) else (
    echo [INFO] Frontend ja compilado.
)

echo.
echo ============================================================
echo  Iniciando servidores...
echo ============================================================
echo.

:: Iniciar backend
echo [BACKEND] Iniciando na porta 3001...
cd /d "%BACKEND_DIR%"
start "HSE-Backend" /min cmd /k "title HSE-Backend && node src/index.js"

:: Aguardar backend iniciar
echo [INFO] Aguardando backend...
timeout /t 4 /nobreak >nul

:: Iniciar frontend em modo producao
echo [FRONTEND] Iniciando na porta 3000...
cd /d "%FRONTEND_DIR%"
start "HSE-Frontend" /min cmd /k "title HSE-Frontend && npx next start -H 0.0.0.0 -p 3000"

:: Aguardar frontend iniciar
echo [INFO] Aguardando frontend...
timeout /t 4 /nobreak >nul

echo.
echo ============================================================
echo    SERVIDORES INICIADOS!
echo ============================================================
echo.
echo    Acesso Local:    http://localhost:3000
echo    API Backend:     http://localhost:3001/api
echo.
echo    SNMP coletando a cada 5 minutos
echo.
echo    Para PARAR: feche esta janela ou pressione qualquer tecla
echo ============================================================
echo.

pause

echo.
echo [INFO] Encerrando servidores...
taskkill /fi "WINDOWTITLE eq HSE-Backend*" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq HSE-Frontend*" /f >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do taskkill /pid %%a /f >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /pid %%a /f >nul 2>&1
echo [OK] Servidores encerrados.
timeout /t 2 /nobreak >nul
