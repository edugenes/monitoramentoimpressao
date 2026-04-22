@echo off
REM ======================================================================
REM  Aplica correcao de cota conforme o relatorio HSE ATUALIZADO:
REM
REM    ERGOMETRIA 2    300 -> 4000
REM
REM  (as demais cotas ja estavam corretas conforme confirmacao da gestao)
REM ======================================================================

setlocal
cd /d C:\Aplicacoes\Impressao\backend
if errorlevel 1 goto erro_cd

echo.
echo ============================================================
echo  Aplicando cota oficial do relatorio HSE
echo ============================================================
node scripts\aplicar-cotas-hse.js
if errorlevel 1 goto erro

echo.
echo ============================================================
echo  CONCLUIDO. Abra o frontend (Ctrl+F5) e confirme a cota
echo  em /cotas e /monitoramento.
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
