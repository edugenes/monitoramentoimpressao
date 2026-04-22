@echo off
setlocal
title HSE - Forcar coleta SNMP agora
color 0B

echo ============================================================
echo  FORCAR COLETA SNMP EM TODAS AS IMPRESSORAS
echo ============================================================
echo.
echo Este script vai ler o contador atual de cada impressora via
echo SNMP e recalcular o uso do mes. Pode demorar ~1 minuto.
echo.
pause

set "BASE_DIR=%~dp0"
cd /d "%BASE_DIR%backend"

node scripts\forcar-coleta-snmp.js

echo.
echo Pressione qualquer tecla para fechar . . .
pause >nul
endlocal
