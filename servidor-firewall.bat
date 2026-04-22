@echo off
setlocal EnableDelayedExpansion
title HSE - Liberar Firewall (portas 3000 e 3001)
color 0A

echo ============================================================
echo  LIBERAR ACESSO PELA REDE NO FIREWALL DO WINDOWS
echo ============================================================
echo.

net session >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERRO] Esta janela NAO esta em modo Administrador.
    echo.
    echo   Feche esta janela.
    echo   Clique com o BOTAO DIREITO em  servidor-firewall.bat
    echo   e escolha  "Executar como administrador".
    echo.
    goto fim
)

echo [OK] Modo Administrador confirmado.
echo.

echo [1/4] Removendo regras antigas (se existirem)...
powershell -NoProfile -Command "Remove-NetFirewallRule -DisplayName 'HSE-Frontend-3000' -ErrorAction SilentlyContinue; Remove-NetFirewallRule -DisplayName 'HSE-Backend-3001' -ErrorAction SilentlyContinue"

echo.
echo [2/4] Criando regra para porta 3000 (frontend)...
powershell -NoProfile -Command "New-NetFirewallRule -DisplayName 'HSE-Frontend-3000' -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Any | Out-Null"
if errorlevel 1 (
    color 0C
    echo [ERRO] Falha ao criar regra para porta 3000.
    goto fim
)
echo [OK] Porta 3000 liberada.

echo.
echo [3/4] Criando regra para porta 3001 (backend)...
powershell -NoProfile -Command "New-NetFirewallRule -DisplayName 'HSE-Backend-3001' -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Any | Out-Null"
if errorlevel 1 (
    color 0C
    echo [ERRO] Falha ao criar regra para porta 3001.
    goto fim
)
echo [OK] Porta 3001 liberada.

echo.
echo [4/4] Confirmando regras criadas...
echo.
echo ------------------------------------------------------------
powershell -NoProfile -Command "Get-NetFirewallRule -DisplayName 'HSE-Frontend-3000','HSE-Backend-3001' | Select-Object DisplayName,Enabled,Direction,Action,Profile | Format-Table -AutoSize"
echo ------------------------------------------------------------

echo.
echo ============================================================
echo  REGRAS DE FIREWALL CRIADAS!
echo ============================================================
echo.
echo  IP(s) deste servidor nesta rede:
echo ------------------------------------------------------------
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object IPAddress,InterfaceAlias | Format-Table -AutoSize"
echo ------------------------------------------------------------
echo.
echo  Acesso de outro PC:  http://IP_DO_SERVIDOR:3000
echo.

:fim
echo.
echo Pressione qualquer tecla para fechar . . .
pause >nul
endlocal
