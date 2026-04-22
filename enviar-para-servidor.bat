@echo off
setlocal EnableDelayedExpansion
title HSE - Enviar atualizacao para o servidor
color 0B

echo ============================================================
echo  ENVIAR ATUALIZACAO PARA O SERVIDOR (via Rede)
echo ============================================================
echo.

set "BASE_DIR=%~dp0"
set "CONFIG_FILE=%BASE_DIR%servidor-config.local"
set "SERVER_PATH="
set "SERVER_HOST="

if exist "%CONFIG_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%CONFIG_FILE%") do (
        if /i "%%a"=="SERVER_PATH" set "SERVER_PATH=%%b"
        if /i "%%a"=="SERVER_HOST" set "SERVER_HOST=%%b"
    )
)

if "!SERVER_PATH!"=="" (
    echo PRIMEIRA VEZ rodando este script.
    echo.
    echo No servidor, a pasta do projeto precisa estar compartilhada pela rede.
    echo Digite aqui o caminho UNC ate essa pasta. Exemplos:
    echo.
    echo   \\192.168.1.18\Impressao
    echo   \\SERVIDOR-HSE\Impressao
    echo.
    set /p "SERVER_PATH=Caminho do servidor: "
    if "!SERVER_PATH!"=="" (
        echo [ERRO] Caminho vazio, cancelando.
        goto fim_erro
    )
    (echo SERVER_PATH=!SERVER_PATH!) > "%CONFIG_FILE%"
    echo [OK] Configuracao salva em servidor-config.local
    echo     ^(para mudar depois, edite ou apague esse arquivo^)
    echo.
)

:: Extrai o host do UNC (primeira parte entre \\ e \) caso nao tenha sido salvo
if "!SERVER_HOST!"=="" (
    for /f "tokens=1 delims=\" %%h in ("!SERVER_PATH:~2!") do set "SERVER_HOST=%%h"
)

echo Servidor destino : !SERVER_PATH!
echo Host             : !SERVER_HOST!
echo.

:: Primeiro teste de acesso ao compartilhamento
dir "!SERVER_PATH!" >nul 2>&1
if not errorlevel 1 goto verificado

echo [AVISO] Nao consegui acessar !SERVER_PATH! direto.
echo.

:: Verifica se o host em si ja esta acessivel (outra conexao/share do mesmo servidor)
echo Verificando se voce ja tem conexao com o servidor !SERVER_HOST!...
net use 2>nul | findstr /i "\\\\!SERVER_HOST!" >nul 2>&1
if not errorlevel 1 (
    color 0E
    echo.
    echo [DIAGNOSTICO] Voce JA tem conexao com !SERVER_HOST! usando suas credenciais
    echo atuais do Windows ^(por exemplo, um drive de rede mapeado^).
    echo.
    echo Isso significa que o problema NAO e autenticacao.
    echo O compartilhamento  !SERVER_PATH!  provavelmente NAO EXISTE no servidor
    echo ou seu usuario nao tem permissao de leitura nele.
    echo.
    echo Compartilhamentos atuais do servidor:
    echo ------------------------------------------------------------
    net view "\\!SERVER_HOST!" 2>nul
    echo ------------------------------------------------------------
    echo.
    echo SOLUCAO: entre por RDP em !SERVER_HOST! como Administrador
    echo e execute no PowerShell:
    echo.
    echo   New-SmbShare -Name "Impressao" -Path "C:\Aplicacoes\Impressao" ^^
    echo     -FullAccess "Administradores" -ChangeAccess "Todos"
    echo.
    echo Depois rode este script novamente.
    goto fim_erro
)

echo Nenhuma conexao existente com !SERVER_HOST!.
echo.
set /p "AUTH=Deseja autenticar agora com usuario/senha do servidor? (S/N): "
if /i "!AUTH!"=="S" goto fazer_auth
if /i "!AUTH!"=="SIM" goto fazer_auth
color 0C
echo.
echo [ERRO] Sem acesso ao servidor. Verifique:
echo   1 - A pasta C:\Aplicacoes\Impressao foi COMPARTILHADA no servidor?
echo       ^(botao direito ^> Propriedades ^> Compartilhamento^)
echo   2 - Voce esta na rede 192.168.1.x?
echo   3 - Firewall do servidor libera SMB/porta 445?
goto fim_erro

:fazer_auth
echo.
echo Informe os dados de acesso ao servidor Windows.
echo ^(a senha NAO fica salva em arquivo, so em cache do Windows^)
echo.
set /p "SERVER_USER=Usuario (ex: Administrador ou DOMINIO\usuario): "
if "!SERVER_USER!"=="" (
    echo [ERRO] Usuario vazio.
    goto fim_erro
)

echo.
echo [1/2] Desconectando conexoes antigas para !SERVER_HOST!...
:: O Windows nao permite 2 conexoes pro mesmo servidor com usuarios diferentes.
:: Precisamos derrubar qualquer conexao existente antes de autenticar de novo.
for /f "tokens=2" %%r in ('net use 2^>nul ^| findstr /i /c:"\\\\!SERVER_HOST!"') do (
    net use "%%r" /delete /y >nul 2>&1
)
:: Se nao pegou pelo for acima, tenta explicito nos caminhos mais comuns
net use "\\!SERVER_HOST!"         /delete /y >nul 2>&1
net use "\\!SERVER_HOST!\IPC$"    /delete /y >nul 2>&1
net use "\\!SERVER_HOST!\C$"      /delete /y >nul 2>&1
net use "!SERVER_PATH!"           /delete /y >nul 2>&1

:: Apaga credenciais salvas no Gerenciador de Credenciais para esse host
cmdkey /delete:"!SERVER_HOST!" >nul 2>&1
cmdkey /delete:"TERMSRV/!SERVER_HOST!" >nul 2>&1

echo [OK] Conexoes antigas removidas.
echo.
echo [2/2] Autenticando. Digite a senha quando pedir e tecle Enter.
echo.
net use "!SERVER_PATH!" /user:"!SERVER_USER!" /persistent:yes
if errorlevel 1 (
    color 0C
    echo.
    echo [ERRO] Falhou ao autenticar. Causas possiveis:
    echo   - Usuario ou senha incorretos
    echo   - Se o servidor e Windows Server em workgroup, use:  !SERVER_HOST!\usuario
    echo     Ex:                                                192.168.1.18\Administrador
    echo   - Se esta em dominio, use:  DOMINIO\usuario
    echo.
    echo Se o erro foi 1219 de novo, ha alguma conexao persistente
    echo ^(drive mapeado Z:, Y:, etc.^). Rode em outro cmd:
    echo   net use
    echo   ^(veja a lista e desconecte manualmente^)
    goto fim_erro
)
echo.
echo [OK] Autenticado.
echo.

:: Segundo teste de acesso
dir "!SERVER_PATH!" >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERRO] Mesmo autenticado, nao consegui listar a pasta.
    echo        O usuario pode nao ter permissao de leitura nela.
    goto fim_erro
)

:verificado
:: Salva host no config para futuras reconexoes
(
    echo SERVER_PATH=!SERVER_PATH!
    echo SERVER_HOST=!SERVER_HOST!
) > "%CONFIG_FILE%"

echo [OK] Acesso ao servidor confirmado.
echo.
echo Arquivos que NAO serao copiados ^(ficam preservados no servidor^):
echo   - backend\database.db, database.db-shm, database.db-wal
echo   - backend\.env
echo   - node_modules ^(reinstalado pelo servidor-atualizar.bat^)
echo   - frontend\.next ^(reconstruido pelo servidor-atualizar.bat^)
echo   - .git, servidor-config.local, atualizacao.zip
echo.

set "ROBO_OPTS=/NFL /NDL /NJH /NJS /NP /R:2 /W:5"

echo [1/8] Enviando backend\src...
robocopy "%BASE_DIR%backend\src" "!SERVER_PATH!\backend\src" /MIR %ROBO_OPTS%
if errorlevel 8 goto fim_erro

echo [2/8] Enviando backend\migrations...
robocopy "%BASE_DIR%backend\migrations" "!SERVER_PATH!\backend\migrations" /MIR %ROBO_OPTS%
if errorlevel 8 goto fim_erro

echo [3/8] Enviando backend\scripts...
robocopy "%BASE_DIR%backend\scripts" "!SERVER_PATH!\backend\scripts" /MIR %ROBO_OPTS%
if errorlevel 8 goto fim_erro

echo [4/8] Enviando arquivos de configuracao do backend...
copy /Y "%BASE_DIR%backend\package.json" "!SERVER_PATH!\backend\" >nul 2>&1
copy /Y "%BASE_DIR%backend\package-lock.json" "!SERVER_PATH!\backend\" >nul 2>&1

echo [5/8] Enviando frontend\src...
robocopy "%BASE_DIR%frontend\src" "!SERVER_PATH!\frontend\src" /MIR %ROBO_OPTS%
if errorlevel 8 goto fim_erro

echo [6/8] Enviando frontend\public...
robocopy "%BASE_DIR%frontend\public" "!SERVER_PATH!\frontend\public" /MIR %ROBO_OPTS%
if errorlevel 8 goto fim_erro

echo [7/8] Enviando arquivos de configuracao do frontend...
copy /Y "%BASE_DIR%frontend\package.json" "!SERVER_PATH!\frontend\" >nul 2>&1
copy /Y "%BASE_DIR%frontend\package-lock.json" "!SERVER_PATH!\frontend\" >nul 2>&1
copy /Y "%BASE_DIR%frontend\next.config.ts" "!SERVER_PATH!\frontend\" >nul 2>&1
copy /Y "%BASE_DIR%frontend\next-env.d.ts" "!SERVER_PATH!\frontend\" >nul 2>&1
copy /Y "%BASE_DIR%frontend\tsconfig.json" "!SERVER_PATH!\frontend\" >nul 2>&1
copy /Y "%BASE_DIR%frontend\postcss.config.mjs" "!SERVER_PATH!\frontend\" >nul 2>&1
copy /Y "%BASE_DIR%frontend\eslint.config.mjs" "!SERVER_PATH!\frontend\" >nul 2>&1

echo [8/8] Enviando scripts .bat, ecosystem.config.js e docs...
copy /Y "%BASE_DIR%ecosystem.config.js" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%servidor-instalar.bat" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%servidor-iniciar.bat" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%servidor-parar.bat" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%servidor-status.bat" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%servidor-logs.bat" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%servidor-atualizar.bat" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%servidor-autostart.bat" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%servidor-firewall.bat" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%servidor-corrigir-sqlite.bat" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%README.md" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%SERVIDOR.md" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%DOCUMENTACAO.md" "!SERVER_PATH!\" >nul 2>&1
copy /Y "%BASE_DIR%APRESENTACAO-E-GUIA-LEIGOS.md" "!SERVER_PATH!\" >nul 2>&1

color 0A
echo.
echo ============================================================
echo  ARQUIVOS ENVIADOS COM SUCESSO
echo ============================================================
echo.
echo  Destino: !SERVER_PATH!
echo.
echo  PROXIMO PASSO ^(executar NO SERVIDOR, nao aqui^):
echo.
echo  1. Entre no servidor por RDP: mstsc /v:!SERVER_HOST!
echo  2. Va na pasta C:\Aplicacoes\Impressao
echo  3. Clique com BOTAO DIREITO em  servidor-atualizar.bat
echo  4. Escolha  "Executar como administrador".
echo.
echo  Isso vai:
echo    - reinstalar as dependencias que mudaram
echo    - aplicar as migrations novas ^(banco PRESERVADO^)
echo    - reconstruir o frontend
echo    - recarregar o PM2 sem derrubar o servico
echo.
goto fim

:fim_erro
color 0C
echo.
echo [ERRO] Falha no envio. Nenhum servico no servidor foi afetado.

:fim
echo.
echo Pressione qualquer tecla para fechar . . .
pause >nul
endlocal
