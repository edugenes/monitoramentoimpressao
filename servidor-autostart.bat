@echo off
setlocal EnableDelayedExpansion
title HSE - Configurar Inicio Automatico (Windows)
color 0A

echo ============================================================
echo  CONFIGURAR INICIO AUTOMATICO NO WINDOWS
echo ============================================================
echo.
echo  Este script cria uma Tarefa Agendada que inicia o PM2
echo  (e portanto o sistema HSE) automaticamente quando o
echo  Windows e ligado, MESMO SEM NINGUEM FAZER LOGIN.
echo.
echo  >>> PRECISA SER EXECUTADO COMO ADMINISTRADOR <<<
echo.

net session >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERRO] Voce NAO esta como Administrador.
    echo Clique com botao direito no arquivo e escolha
    echo "Executar como administrador".
    goto fim
)

set "BASE_DIR=%~dp0"
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"

where pm2 >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERRO] PM2 nao encontrado. Rode antes: servidor-instalar.bat
    goto fim
)

echo [1/3] Salvando lista atual de processos PM2...
cd /d "%BASE_DIR%"
call pm2 save

echo.
echo [2/3] Removendo tarefa antiga (se existir)...
schtasks /delete /tn "HSE-Impressao-AutoStart" /f >nul 2>&1

echo.
echo [3/3] Criando Tarefa Agendada para iniciar com o Windows...
schtasks /create ^
  /tn "HSE-Impressao-AutoStart" ^
  /tr "cmd.exe /c cd /d \"%BASE_DIR%\" && pm2 resurrect" ^
  /sc onstart ^
  /ru "SYSTEM" ^
  /rl HIGHEST ^
  /f
if errorlevel 1 (
    color 0C
    echo [ERRO] Nao foi possivel criar a tarefa agendada.
    goto fim
)

echo.
echo ============================================================
echo  INICIO AUTOMATICO CONFIGURADO!
echo ============================================================
echo.
echo  Tarefa "HSE-Impressao-AutoStart" criada.
echo  Ela roda  pm2 resurrect  a cada boot do Windows,
echo  restaurando os processos salvos com  pm2 save.
echo.
echo  Para TESTAR sem reiniciar:
echo    schtasks /run /tn "HSE-Impressao-AutoStart"
echo.
echo  Para DESATIVAR:
echo    schtasks /delete /tn "HSE-Impressao-AutoStart" /f
echo.

:fim
echo.
echo Pressione qualquer tecla para fechar . . .
pause >nul
endlocal
