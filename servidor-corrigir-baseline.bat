@echo off
REM ======================================================================
REM  CORRIGE DE UMA VEZ SO O BASELINE DE 01/04.
REM
REM  Passos:
REM    1) Roda seed-admin (aplica a migration 006 que conserta os triggers
REM       que estavam sobrescrevendo o created_at dos baselines).
REM    2) Limpa os baselines fantasmas que foram inseridos com data errada.
REM    3) Reimporta o baseline de 01/04 com a data correta.
REM    4) Forca uma coleta SNMP para atualizar a leitura mais recente.
REM    5) Mostra o diagnostico final cruzando com os relatorios Simpress/HSE.
REM
REM  PRE-REQUISITO:
REM    Ter o arquivo baseline-abril.xlsx em C:\Aplicacoes\Impressao
REM ======================================================================

setlocal
cd /d C:\Aplicacoes\Impressao\backend
if errorlevel 1 goto erro_cd

echo.
echo ============================================================
echo  [1/4] Aplicando migration 006 (conserto dos triggers TZ)
echo ============================================================
node scripts\seed-admin.js
if errorlevel 1 goto erro

echo.
echo ============================================================
echo  [2/4] Reimportando baseline de 01/04
echo ============================================================
set BASELINE_FILE=C:\Aplicacoes\Impressao\baseline-abril.xlsx
if not exist "%BASELINE_FILE%" (
  echo ERRO: arquivo nao encontrado - %BASELINE_FILE%
  goto fim
)

if not exist node_modules\xlsx (
  echo Instalando xlsx...
  call npm install xlsx --omit=dev
)

node scripts\import-baseline-abril.js "%BASELINE_FILE%"
if errorlevel 1 goto erro

echo.
echo ============================================================
echo  [3/4] Forcando coleta SNMP para atualizar leituras atuais
echo ============================================================
node scripts\forcar-coleta-snmp.js
if errorlevel 1 goto erro

echo.
echo ============================================================
echo  [4/4] Verificando valores finais
echo ============================================================
node scripts\verificar-baseline.js

echo.
echo ============================================================
echo  CONCLUIDO. Abra o navegador, pressione Ctrl+F5 no frontend
echo  e confirme que o uso das impressoras agora reflete a
echo  realidade (53.909 no 2B, por exemplo, em vez de 1.824).
echo ============================================================
goto fim

:erro_cd
echo ERRO: nao consegui acessar C:\Aplicacoes\Impressao\backend
goto fim

:erro
echo.
echo ERRO durante a execucao. Confira as mensagens acima.

:fim
pause
endlocal
