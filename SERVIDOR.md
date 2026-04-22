# Guia de Instalação no Servidor (Windows)

Este documento explica como colocar o **Sistema de Monitoramento de Impressão HSE** para rodar **24/7** em um servidor Windows, de forma que:

- Os serviços fiquem no ar mesmo se ninguém estiver logado.
- Se o backend ou o frontend travar, ele se reinicia sozinho.
- Se o servidor for reiniciado (reboot / queda de energia), o sistema volta sozinho.

Toda a gerência é feita pelo **PM2**, um gerenciador de processos muito usado em produção Node.js.

---

## 1. Pré-requisitos no servidor

1. **Windows Server** (ou Windows 10/11) com acesso administrativo.
2. **Node.js LTS** (20.x ou superior) instalado — baixar em <https://nodejs.org>.
3. Portas **3000** (frontend) e **3001** (backend) liberadas no firewall interno.
4. Acesso à rede onde as impressoras respondem por **SNMP (UDP/161)**.

> Para liberar as portas no firewall do Windows, execute
> **`servidor-firewall.bat` como Administrador** (botão direito → "Executar como
> administrador"). Ele cria automaticamente as regras de entrada TCP 3000 e 3001.

---

## 2. Copiar o projeto

Copie a pasta inteira do projeto para o servidor, por exemplo:

```
C:\Aplicacoes\Impressao\
```

> ⚠️ **IMPORTANTE:** **NÃO** copie as pastas `node_modules`, `.next` e nem os arquivos
> `package-lock.json`. Elas contêm binários nativos compilados para o Node.js do
> computador de origem (ex: `better-sqlite3.node`). Se forem copiadas, o backend falha
> ao iniciar com um erro do tipo:
> ```
> Error: The module '...better_sqlite3.node' was compiled against a different Node.js
> version using NODE_MODULE_VERSION 115. This version of Node.js requires
> NODE_MODULE_VERSION 137.
> ```
>
> Se isso acontecer, rode **`servidor-corrigir-sqlite.bat`** — ele apaga e recompila
> automaticamente.

Apague antes de copiar (ou logo depois, direto no servidor):

```cmd
rmdir /s /q backend\node_modules
rmdir /s /q frontend\node_modules
rmdir /s /q frontend\.next
del backend\package-lock.json
del frontend\package-lock.json
```

---

## 3. Instalação (uma única vez)

No servidor, dentro da pasta do projeto, execute:

```
servidor-instalar.bat
```

Esse script faz tudo automaticamente:

1. Verifica o Node.js.
2. Instala as dependências do backend (`npm install --omit=dev`).
3. Aplica as migrations do banco e cria o usuário **admin** padrão (senha: `admin123`).
4. Instala as dependências do frontend.
5. Compila o frontend para produção (`next build`).
6. Instala o **PM2** globalmente.

> ⚠️ **Troque a senha do admin** após o primeiro acesso, entrando em **Usuários → editar admin**.

---

## 4. Liberar firewall (primeira vez)

Antes de acessar o sistema de outros computadores da rede, execute
**`servidor-firewall.bat` como Administrador**. Ele cria as regras para as portas
3000 e 3001 nos perfis **Domínio, Particular e Público**.

Se preferir manual:

```cmd
netsh advfirewall firewall add rule name="HSE-Frontend" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="HSE-Backend"  dir=in action=allow protocol=TCP localport=3001
```

## 5. Iniciar os serviços

```
servidor-iniciar.bat
```

Isso liga backend e frontend via PM2 e abre um **painel ao vivo** que atualiza
automaticamente a cada 3 segundos, mostrando status, uptime e os links de acesso.

```
============================================================
  HSE - MONITORAMENTO DE IMPRESSAO
  Painel ao vivo (atualiza a cada 3s)
============================================================

  Acesso local   : http://localhost:3000
  Acesso na rede : http://192.168.1.50:3000
  API backend    : porta 3001

  [id 0] hse-backend   online  uptime 2m    restart 0
  [id 1] hse-frontend  online  uptime 2m    restart 0
============================================================
```

Você pode fechar essa janela a qualquer momento (`Ctrl+C` ou `X`) — **os serviços
continuam rodando**, pois quem os mantém vivos é o daemon do PM2.

---

## 6. Iniciar automaticamente com o Windows

Para que o sistema volte no ar depois de qualquer reboot:

1. Clique com **botão direito** em `servidor-autostart.bat`.
2. Escolha **"Executar como administrador"**.

O script cria uma **Tarefa Agendada** chamada `HSE-Impressao-AutoStart`, que ao ligar o servidor executa `pm2 resurrect` (restaurando os processos salvos pelo `pm2 save`).

Para testar sem reiniciar:

```cmd
schtasks /run /tn "HSE-Impressao-AutoStart"
```

Para desligar o auto-start:

```cmd
schtasks /delete /tn "HSE-Impressao-AutoStart" /f
```

---

## 7. Comandos do dia-a-dia

| O que fazer                          | Script / Comando                 |
|--------------------------------------|----------------------------------|
| Ver status                           | `servidor-status.bat`            |
| Ver logs em tempo real               | `servidor-logs.bat`              |
| Parar tudo                           | `servidor-parar.bat`             |
| Reiniciar tudo                       | `pm2 reload ecosystem.config.js` |
| Aplicar atualização de código        | `servidor-atualizar.bat`         |
| Reiniciar só o backend               | `pm2 restart hse-backend`        |
| Reiniciar só o frontend              | `pm2 restart hse-frontend`       |
| Limpar log (se ficou muito grande)   | `pm2 flush`                      |

Os logs também ficam em arquivos dentro da pasta `logs/`:

- `logs/backend-out.log` e `logs/backend-error.log`
- `logs/frontend-out.log` e `logs/frontend-error.log`

---

## 8. Atualizar o sistema (novas versões)

Existem **duas formas** de trazer o código novo para o servidor. Use a que for mais conveniente.

### 8.1 Setup único: compartilhar a pasta do projeto pela rede (recomendado)

Isso permite que o desenvolvedor envie atualizações direto do PC dele, sem pendrive/RDP só para copiar arquivos.

**No servidor (uma única vez):**

1. Abra o **Explorador de Arquivos** e localize a pasta do projeto (ex.: `C:\HSE\Impressao`).
2. Clique com o **botão direito** → **Propriedades** → aba **Compartilhamento** → botão **Compartilhamento Avançado**.
3. Marque **"Compartilhar esta pasta"**.
4. Em **Permissões**, adicione o usuário de rede que o desenvolvedor usa e dê permissão de **Leitura e Alteração** (não precisa de Controle Total).
5. Anote o nome do compartilhamento — fica `\\NOME-DO-SERVIDOR\Impressao` (ou o nome que você usar).

**Dica:** se preferir, em vez de abrir por nome, pode acessar por IP: `\\192.168.x.x\Impressao`.

### 8.2 Fluxo normal de atualização (dia-a-dia)

No **PC do desenvolvedor** (onde o código é editado):

1. Clique duas vezes em **`enviar-para-servidor.bat`**.
2. **Da primeira vez** ele pergunta o caminho UNC do servidor (ex.: `\\SERVIDOR-HSE\Impressao`). Isso fica salvo em `servidor-config.local` (ignorado pelo git) para as próximas.
3. Ele usa **Robocopy** para sincronizar só o que mudou, **preservando automaticamente**:
   - `backend/database.db`, `database.db-shm`, `database.db-wal` (banco inteiro)
   - `backend/.env`
   - `node_modules` (backend e frontend — serão reinstalados no servidor)
   - `frontend/.next` (reconstruído no servidor)

No **servidor** (depois que o envio terminar, uma mensagem verde aparece na tela do desenvolvedor):

1. Entre por **RDP** (ou direto no teclado do servidor).
2. Na pasta do projeto, clique com **botão direito** em **`servidor-atualizar.bat`** → **"Executar como administrador"**.
3. Ele faz, em sequência:
   - `npm install --omit=dev` + `npm rebuild better-sqlite3` no backend
   - `node scripts/seed-admin.js` → aplica migrations novas **de forma idempotente** (não apaga nada existente)
   - `npm install` + limpa `.next` + `npx next build` no frontend
   - `pm2 reload ecosystem.config.js` → **zero-downtime**, o sistema não fica fora do ar
4. No final mostra o `pm2 status` com backend e frontend **online**.

### 8.3 Alternativa manual (sem pasta compartilhada)

Se não puder compartilhar a pasta por política da rede:

1. No PC do desenvolvedor, gere um `.zip` com tudo **menos** `node_modules`, `.next`, `*.db*`, `.env`, `.git`:
   ```powershell
   Compress-Archive -DestinationPath atualizacao.zip -Path `
     backend\src, backend\migrations, backend\scripts, backend\package.json, backend\package-lock.json, `
     frontend\src, frontend\public, frontend\package.json, frontend\package-lock.json, `
     frontend\next.config.ts, frontend\tsconfig.json, frontend\postcss.config.mjs, frontend\eslint.config.mjs, `
     ecosystem.config.js, servidor-*.bat, *.md
   ```
2. Copie o `.zip` para o servidor (RDP, pendrive, e-mail interno).
3. Extraia **por cima** da pasta do projeto, respondendo "Sim para todos" ao sobrescrever.
4. Rode `servidor-atualizar.bat` como administrador.

> ⚠️ **NUNCA** apague `backend/database.db`, `backend/database.db-shm` e `backend/database.db-wal` — eles contêm todos os dados do sistema (impressoras, cotas, leituras SNMP, usuários, alertas).

---

## 9. Backup do banco de dados

Como o sistema usa SQLite, o banco é apenas arquivos dentro de `backend/`.

Um backup simples (feito enquanto o sistema está rodando):

```cmd
copy backend\database.db  C:\Backups\HSE\database-%DATE:~-4%%DATE:~3,2%%DATE:~0,2%.db
```

Pode ser agendado via **Tarefa Agendada** do Windows diariamente.
Para restaurar: pare os serviços, substitua o `database.db` pelo backup e inicie de novo.

---

## 10. Variáveis de ambiente (opcional)

Você pode criar um arquivo `backend/.env` para sobrescrever configurações:

```env
PORT=3001
TZ=America/Recife
JWT_SECRET=troque-por-uma-chave-longa-e-secreta
JWT_EXPIRES=24h
```

E, se o frontend for acessado por um domínio/IP diferente, `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://IP-DO-SERVIDOR:3001/api
```

Depois de alterar o `.env.local`, precisa rodar `servidor-atualizar.bat` para o frontend pegar a nova URL.

---

## 11. Problemas comuns

| Sintoma                                         | Causa provável / Solução                                                                 |
|-------------------------------------------------|------------------------------------------------------------------------------------------|
| `EADDRINUSE 3000` ou `3001`                     | Já há outro processo na porta. `netstat -ano \| findstr :3000` e `taskkill /PID X /F`. |
| Frontend abre mas não comunica com backend      | Firewall bloqueando 3001 ou `NEXT_PUBLIC_API_URL` errado. Ver item 10.                    |
| Acessa `localhost` mas não pela rede            | Rodar `servidor-firewall.bat` **como Administrador**. Verificar o IP do servidor com `ipconfig`. |
| SNMP falhando em todas as impressoras           | Firewall/antivírus do servidor bloqueando UDP/161 saída. Liberar no firewall.            |
| PM2 não inicia junto com Windows                | Rodar `servidor-autostart.bat` **como Administrador**. Confirmar com `schtasks /query`.  |
| Perdeu a senha do admin                         | Rodar `node backend/scripts/seed-admin.js` (não sobrescreve se existir) ou alterar direto no DB via DB Browser for SQLite. |
| `Error ... NODE_MODULE_VERSION xxx` no backend  | `node_modules` foi copiado de outra máquina/versão do Node. Rode **`servidor-corrigir-sqlite.bat`**. |
