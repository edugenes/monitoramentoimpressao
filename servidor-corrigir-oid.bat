@echo off
REM ======================================================================
REM  CORRIGE O OID SNMP PARA CAPTURAR O CONTADOR "A4 EQUIVALENTE" (correto)
REM  em vez do "engine count" (que inclui calibracao, teste, duplex duplo).
REM
REM  Passos:
REM    1) Reinicia o backend via pm2 para carregar o novo snmpService.js
REM       (com selecao automatica de OID mono/color).
REM    2) Garante que o baseline de 01/04 esteja importado corretamente.
REM    3) Apaga todas as leituras SNMP de abril (exceto baseline), que foram
REM       feitas com o OID antigo (engine count) e estao com valores inflados.
REM    4) Forca uma coleta SNMP usando o OID correto.
REM    5) Mostra o relatorio final de uso vs cota.
REM
REM  PRE-REQUISITOS:
REM    - C:\Aplicacoes\Impressao\baseline-abril.xlsx (relatorio Simpress de marco)
REM    - pm2 rodando o processo hse-backend
REM ======================================================================

setlocal
cd /d C:\Aplicacoes\Impressao\backend
if errorlevel 1 goto erro_cd

echo.
echo ============================================================
echo  [1/4] Reiniciando backend via pm2 (carrega o OID novo)
echo ============================================================
call pm2 reload hse-backend
if errorlevel 1 (
  echo [AVISO] pm2 reload falhou. Tentando restart...
  call pm2 restart hse-backend
)
timeout /t 3 /nobreak >nul

echo.
echo ============================================================
echo  [2/4] Garantindo baseline de 01/04 importado
echo ============================================================
set BASELINE_FILE=C:\Aplicacoes\Impressao\baseline-abril.xlsx
if not exist "%BASELINE_FILE%" (
  echo ERRO: arquivo nao encontrado - %BASELINE_FILE%
  echo Copie o relatorio Simpress de marco para esse caminho e rode de novo.
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
echo  [3/4] Apagando leituras antigas e coletando com OID correto
echo ============================================================
node scripts\aplicar-correcao-oid.js
if errorlevel 1 goto erro

echo.
echo ============================================================
echo  [4/4] Verificando valores finais
echo ============================================================
node scripts\verificar-baseline.js

echo.
echo ============================================================
echo  CONCLUIDO. Abra o navegador, pressione Ctrl+F5 no frontend
echo  e confirme que os numeros agora refletem o contador
echo  "Imprimir + Copiar + Fax" da interface da impressora
echo  (equivalente ao relatorio Simpress).
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
