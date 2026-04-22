@echo off
setlocal EnableDelayedExpansion
title HSE - Importar baseline de contadores
color 0B

echo ============================================================
echo  IMPORTAR BASELINE DE CONTADORES (DIA 01/04/2026)
echo ============================================================
echo.
echo Este script vai:
echo   1. Instalar o pacote xlsx (se ainda nao estiver instalado)
echo   2. Ler o arquivo "relatorio SIMPRESS marco 2026.xlsx"
echo   3. Importar os contadores do dia 01/04 como baseline
echo   4. Recalcular o uso do mes de cada impressora
echo.
echo O banco de dados NAO sera apagado. Um backup sera salvo antes.
echo O servico NAO sera reiniciado.
echo.
pause

set "BASE_DIR=%~dp0"
set "BACKEND_DIR=%BASE_DIR%backend"
set "XLSX_NAME=relatorio SIMPRESS marco 2026.xlsx"

:: Procura o XLSX - tenta varios nomes possiveis (com e sem acento)
set "XLSX_PATH="
if exist "%BASE_DIR%relatorio SIMPRESS março 2026.xlsx" set "XLSX_PATH=%BASE_DIR%relatorio SIMPRESS março 2026.xlsx"
if exist "%BASE_DIR%relatorio SIMPRESS marco 2026.xlsx" set "XLSX_PATH=%BASE_DIR%relatorio SIMPRESS marco 2026.xlsx"
if exist "%BASE_DIR%baseline-abril.xlsx" set "XLSX_PATH=%BASE_DIR%baseline-abril.xlsx"

if "!XLSX_PATH!"=="" (
    color 0C
    echo.
    echo [ERRO] Nao encontrei o arquivo XLSX do relatorio.
    echo.
    echo Procurei por:
    echo   %BASE_DIR%relatorio SIMPRESS março 2026.xlsx
    echo   %BASE_DIR%relatorio SIMPRESS marco 2026.xlsx
    echo   %BASE_DIR%baseline-abril.xlsx
    echo.
    echo Coloque o arquivo nesta pasta e rode o script de novo.
    goto fim_erro
)

echo Arquivo encontrado: !XLSX_PATH!
echo.

cd /d "%BACKEND_DIR%"

echo [1/2] Garantindo que o pacote xlsx esta instalado...
call npm install --no-audit --no-fund --loglevel=error xlsx
if errorlevel 1 (
    color 0C
    echo [ERRO] Falha ao instalar o pacote xlsx.
    goto fim_erro
)

echo.
echo [2/2] Rodando importacao de baseline...
echo.
call node scripts\import-baseline-abril.js "!XLSX_PATH!"
if errorlevel 1 (
    color 0C
    echo.
    echo [ERRO] Falha durante a importacao. Veja as mensagens acima.
    goto fim_erro
)

color 0A
echo.
echo ============================================================
echo  IMPORTACAO CONCLUIDA COM SUCESSO
echo ============================================================
echo.
echo Os valores de uso do mes ja estao corrigidos no banco.
echo Abra o sistema no navegador para conferir as cotas atualizadas.
echo.
echo O backup do banco esta em:
dir /B "%BACKEND_DIR%\database.backup.*.db" 2>nul
echo.
goto fim

:fim_erro
echo.
echo Nenhuma alteracao ficou pendente. Se um backup foi criado,
echo voce pode restaura-lo copiando database.backup.*.db para database.db
echo ^(com o PM2 parado^).

:fim
echo.
echo Pressione qualquer tecla para fechar . . .
pause >nul
endlocal
