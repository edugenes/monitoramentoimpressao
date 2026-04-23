@echo off
REM ======================================================================
REM  Lista as ultimas liberacoes e permite excluir uma pelo ID.
REM
REM  Uso:
REM    - Rode este .bat
REM    - Ele mostra as ultimas 20 liberacoes com os IDs
REM    - Digite o ID que quer excluir
REM    - Confirma e exclui
REM ======================================================================

setlocal EnableDelayedExpansion
cd /d C:\Aplicacoes\Impressao\backend
if errorlevel 1 goto erro_cd

echo.
echo ============================================================
echo  EXCLUIR LIBERACAO DE COTA
echo ============================================================

node scripts\excluir-liberacao.js
if errorlevel 1 goto erro

echo.
set /p ID_LIB=Digite o ID da liberacao a excluir (ou ENTER para cancelar): 

if "!ID_LIB!"=="" (
  echo Cancelado.
  goto fim
)

echo.
echo ============================================================
echo  Preview da exclusao (ID=!ID_LIB!)
echo ============================================================
node scripts\excluir-liberacao.js --id !ID_LIB!
if errorlevel 1 goto fim

echo.
set /p CONFIRMA=Tem certeza que quer EXCLUIR? Digite  SIM  para confirmar: 

if /I not "!CONFIRMA!"=="SIM" (
  echo Cancelado. Nada foi excluido.
  goto fim
)

echo.
echo ============================================================
echo  Executando exclusao...
echo ============================================================
node scripts\excluir-liberacao.js --id !ID_LIB! --force
if errorlevel 1 goto erro

echo.
echo ============================================================
echo  CONCLUIDO. Abra o frontend em /liberacoes (Ctrl+F5) para
echo  confirmar que a linha sumiu.
echo ============================================================
goto fim

:erro_cd
echo ERRO: nao consegui acessar C:\Aplicacoes\Impressao\backend
goto fim

:erro
echo.
echo ERRO durante a execucao. Confira as mensagens acima.

:fim
echo.
pause
endlocal
