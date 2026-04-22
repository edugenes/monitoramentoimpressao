@echo off
setlocal EnableDelayedExpansion
title HSE - Atualizar / Recompilar
color 0E

echo ============================================================
echo  ATUALIZAR SISTEMA - HSE
echo  (execute apos copiar novo codigo para o servidor)
echo ============================================================

set "BASE_DIR=%~dp0"
set "BACKEND_DIR=%BASE_DIR%backend"
set "FRONTEND_DIR=%BASE_DIR%frontend"

echo.
echo [1/6] Parando backend PM2 (libera arquivos travados p/ recompilar)...
call pm2 stop hse-backend >nul 2>&1
:: Nao abortamos se falhar - pode ser que ainda nem esteja rodando.
:: Pequena espera para o SO liberar handles de arquivo.
timeout /t 2 /nobreak >nul

echo.
echo [2/6] Atualizando dependencias do backend...
cd /d "%BACKEND_DIR%"
call npm install --omit=dev
if errorlevel 1 goto fim_erro

echo.
echo     Rebuild do better-sqlite3 para a versao do Node atual...
call npm rebuild better-sqlite3
if errorlevel 1 (
    echo.
    echo [AVISO] Rebuild falhou. Tentando abordagem mais agressiva...
    call pm2 delete hse-backend >nul 2>&1
    timeout /t 3 /nobreak >nul
    if exist "node_modules\better-sqlite3\build" rmdir /s /q "node_modules\better-sqlite3\build" 2>nul
    call npm rebuild better-sqlite3
    if errorlevel 1 goto fim_erro
)

echo.
echo [3/6] Aplicando migrations (idempotente - preserva banco)...
call node scripts/seed-admin.js
if errorlevel 1 goto fim_erro

echo.
echo [4/6] Subindo backend de volta...
cd /d "%BASE_DIR%"
call pm2 describe hse-backend >nul 2>&1
if errorlevel 1 (
    call pm2 start ecosystem.config.js --only hse-backend
) else (
    call pm2 restart hse-backend
)
if errorlevel 1 goto fim_erro

echo.
echo [5/6] Atualizando dependencias e recompilando frontend...
cd /d "%FRONTEND_DIR%"
call npm install
if errorlevel 1 goto fim_erro
if exist ".next" rmdir /s /q .next 2>nul
call npx next build
if errorlevel 1 goto fim_erro

echo.
echo [6/6] Recarregando frontend PM2...
cd /d "%BASE_DIR%"
call pm2 describe hse-frontend >nul 2>&1
if errorlevel 1 (
    call pm2 start ecosystem.config.js --only hse-frontend
) else (
    call pm2 reload hse-frontend
)
if errorlevel 1 goto fim_erro

call pm2 save >nul

color 0A
echo.
echo ============================================================
echo  ATUALIZACAO CONCLUIDA COM SUCESSO
echo ============================================================
echo.
call pm2 status
echo.
echo Banco de dados preservado. Teste acessando http://localhost:3000
goto fim

:fim_erro
color 0C
echo.
echo [ERRO] Falha na atualizacao.
echo.
echo Vou tentar subir os servicos mesmo assim ^(para nao ficar fora do ar^)...
call pm2 start ecosystem.config.js 2>nul
call pm2 status
echo.
echo Se o backend nao subir, consulte os logs:
echo   pm2 logs hse-backend --lines 50

:fim
echo.
echo Pressione qualquer tecla para fechar . . .
pause >nul
endlocal
