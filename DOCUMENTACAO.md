# Documentação — Sistema de Controle de Impressão

> **Leitura sem jargão técnico e roteiro de apresentação:** veja [APRESENTACAO-E-GUIA-LEIGOS.md](APRESENTACAO-E-GUIA-LEIGOS.md).

Aplicação web para **cadastro de impressoras**, **cotas mensais por setor**, **liberações extras de páginas**, **relatórios** e **monitoramento SNMP** (contadores, toner, status). O backend é uma API REST em Node.js; o frontend é uma SPA com Next.js. Os dados ficam em **SQLite** (arquivo local).

---

## 1. Visão geral

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19, Next.js 16, Tailwind CSS, TypeScript |
| Backend | Node.js, Express 4 |
| Banco de dados | SQLite (`better-sqlite3`) |
| Autenticação | JWT (`jsonwebtoken`), senhas com `bcryptjs` |
| Monitoramento | SNMP v2c (`net-snmp`) |
| Agendamento | `node-cron` |

**Fuso horário:** o sistema é pensado para **America/Recife** (UTC−3), inclusive timestamps gravados e exibição no frontend.

**Acesso na rede:** backend e frontend podem escutar em `0.0.0.0`; o cliente da API no navegador usa o hostname da página para montar a URL do backend (ex.: `http://<seu-ip>:3001/api`).

---

## 2. Estrutura de pastas (resumo)

```
Impressao/
├── backend/
│   ├── migrations/          # SQL numerado (001, 002, …)
│   ├── scripts/             # seeds e utilitários (ex.: admin inicial)
│   ├── src/
│   │   ├── config/          # conexão SQLite
│   │   ├── controllers/
│   │   ├── jobs/            # scheduler (SNMP, fechamento mensal)
│   │   ├── middleware/      # erro, validação, autenticação
│   │   ├── routes/
│   │   └── services/
│   ├── database.db          # banco (gerado em runtime; não versionar em produção sem critério)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/             # rotas Next.js (App Router)
│   │   ├── components/
│   │   ├── contexts/        # AuthProvider
│   │   ├── hooks/
│   │   └── lib/             # api, types, dateUtils
│   └── package.json
└── DOCUMENTACAO.md          # este arquivo
```

---

## 3. Requisitos

- **Node.js** 18+ (recomendado 20 LTS)
- Navegador moderno para o frontend
- Rede com acesso às impressoras para coleta SNMP (UDP porta SNMP, normalmente 161)

---

## 4. Como executar (desenvolvimento)

### Backend

```bash
cd backend
npm install
npm run migrate    # aplica migrations SQL na ordem dos arquivos
node scripts/seed-admin.js   # se necessário: tabelas de auth + usuário admin
npm run dev        # ou: npm start
```

Por padrão o servidor sobe na porta **3001** (variável `PORT`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Por padrão o Next.js em dev escuta em **0.0.0.0** (porta 3000, conforme `package.json`).

### Produção (build)

```bash
cd frontend && npm run build && npx next start -H 0.0.0.0 -p 3000
cd backend && npm start
```

---

## 5. Variáveis de ambiente (backend)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `PORT` | Porta HTTP da API | `3001` |
| `DB_PATH` | Caminho do arquivo SQLite | `./database.db` |
| `TZ` | Fuso (Node) | `America/Recife` |
| `SNMP_COLLECT_INTERVAL` | Expressão cron da coleta SNMP | `*/5 * * * *` (a cada 5 minutos) |
| `JWT_SECRET` | Chave para assinatura de tokens (recomendado em produção) | string longa e secreta |
| `JWT_EXPIRES` | Validade do JWT | `24h` |
| `EWS_USERNAME` | Usuário admin do EWS das impressoras HP | `admin` |
| `EWS_PASSWORD` | Senha admin do EWS (única para a frota) | `********` |
| `AUTO_SYNC_ENABLED` | Liga o sync automático de Cota Local com a impressora | `false` (default) |
| `EWS_TLS_REJECT_UNAUTHORIZED` | Verifica certificado HTTPS da impressora | `false` (impressoras costumam usar self-signed) |
| `EWS_TIMEOUT_MS` | Timeout dos requests EWS | `8000` |

O frontend pode usar `NEXT_PUBLIC_API_URL` para forçar a URL base da API; se não existir, no navegador usa `http://<hostname>:3001/api`.

---

## 6. Autenticação e perfis

### Login

- **POST** `/api/auth/login` — corpo JSON: `{ "username", "password" }` (usuário no formato **usuario.sobrenome**, sem e-mail).
- Resposta: `{ token, user }` com `user.role` em `admin` ou `gestor` e `user.sectors` (IDs de setor para gestores).

### Uso da API

Todas as rotas sob `/api/*` (exceto `/api/health` e **POST** `/api/auth/login`) exigem cabeçalho:

```http
Authorization: Bearer <token>
```

### Perfis

| Perfil | Descrição |
|--------|-----------|
| **admin** | Acesso total: CRUD de impressoras, setores, cotas, liberações, usuários; ações SNMP administrativas (coleta manual forçada, fechamento de mês, rollover). |
| **gestor** | Somente leitura; dados **filtrados** pelos setores vinculados na tabela `user_sectors`. Não pode criar/editar/excluir cadastros nem registrar liberações. |

### Usuário inicial

Após rodar o script de seed (`scripts/seed-admin.js`), existe um usuário **admin** (senha padrão documentada no próprio script — alterar em produção).

### Gestão de usuários (admin)

- **GET/POST/PUT/DELETE** `/api/users` — apenas **admin**.
- Gestores recebem uma lista de `sector_ids` ao serem criados ou editados.

---

## 7. API REST — referência rápida

Base: `http://<host>:3001/api` (com token quando indicado).

### Públicas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Saúde do servidor |
| POST | `/auth/login` | Login |

### Autenticadas

| Método | Rota | Notas |
|--------|------|--------|
| GET | `/auth/me` | Dados do usuário logado + setores |
| GET/POST/PUT/DELETE | `/users` | Só **admin** |
| GET | `/printers`, `/printers/:id` | Gestor: só impressoras dos setores |
| POST/PUT/DELETE | `/printers`, `/printers/:id` | Só **admin** |
| GET | `/sectors`, `/sectors/:id` | |
| POST/PUT/DELETE | `/sectors`, `/sectors/:id` | Escrita só **admin** |
| GET | `/quotas` | Query: `period`, `printer_id`, `sector_id` |
| GET | `/quotas/:id`, `/quotas/:id/status` | |
| POST/PUT | `/quotas`, `/quotas/:id` | Só **admin** |
| GET | `/releases` | Query: `period`, `printer_id`, `sector_id` |
| POST | `/releases` | Só **admin** |
| GET | `/usage/quota/:quotaId` | |
| POST | `/usage` | Conforme implementação |
| GET | `/reports/by-sector` | Query: `period`, `week` (opcional) |
| GET | `/reports/by-printer` | Idem |
| GET | `/reports/releases` | Idem |
| GET | `/reports/summary` | Query: `period` |
| GET | `/snmp/status` | Status da última coleta, toner baixo, etc. |
| GET | `/snmp/latest` | Últimas leituras por impressora |
| GET | `/snmp/readings/:printerId` | Histórico de leituras |
| GET | `/snmp/snapshots` | Query: `period` |
| POST | `/snmp/collect` | Só **admin** (coleta manual geral) |
| POST | `/snmp/test/:id` | Teste SNMP de uma impressora |
| POST | `/snmp/close-month`, `/snmp/rollover` | Só **admin** |
| POST | `/printers/:id/sync-quota` | Força sincronização da Cota Local com a impressora (admin) |
| POST | `/printers/:id/block` | Zera créditos no EWS — bloqueia impressora agora (admin) |
| POST | `/printers/:id/unblock` | Restaura créditos (body opcional `{credits}`) e congela re-bloqueio automático por 24h (admin) |
| GET | `/printers/:id/block-events` | Histórico de eventos de sync/bloqueio (admin) |
| GET | `/alerts` | Query: `unacknowledged=true`, `limit`. Gestor: só setores próprios |
| GET | `/alerts/count` | Contagem rápida de alertas pendentes (badge do sino) |
| POST | `/alerts/:id/acknowledge` | Marca alerta como reconhecido |
| POST | `/alerts/acknowledge-all` | Reconhece todos os alertas acessíveis ao usuário |
| POST | `/alerts/generate` | Força reprocessamento de alertas (**admin**) |
| GET | `/quota-balance/overview` | KPIs da frota (alocado/usado/disponível) — usado pela tela `/balanceamento` |
| GET | `/quota-balance/by-sector` | Agregado por setor com status |
| GET | `/quota-balance/printers` | Lista detalhada com classificação de status (overflow, idle, etc.) |
| GET | `/quota-balance/divergences` | Compara banco vs HP em tempo real (lento; query EWS) |
| POST | `/quota-balance/rebalance` | Transfere páginas de `monthly_limit` entre 2 impressoras (admin) |
| GET | `/quota-proposals` | Lista resumida de propostas mensais |
| GET | `/quota-proposals/:id` ou `/period/:YYYY-MM` | Proposta completa com itens e totais |
| POST | `/quota-proposals/generate` | Gera ou regenera proposta para período (admin) |
| PUT | `/quota-proposals/:id/items/:itemId` | Edita `approved_limit` de um item (admin) |
| POST | `/quota-proposals/:id/fill-suggested` | Preenche `approved_limit` com sugestão (admin) |
| POST | `/quota-proposals/:id/approve` | Aprova; será aplicada no dia 1° automaticamente (admin) |
| POST | `/quota-proposals/:id/reject` | Rejeita (admin) |
| DELETE | `/quota-proposals/:id` | Apaga (apenas se não aplicada, admin) |

Erros comuns: **401** (sem token ou token inválido), **403** (gestor sem permissão para ação administrativa).

---

## 8. Modelo de dados (conceitual)

Principais entidades:

- **sectors** — setores (nome, responsável, etc.).
- **printers** — impressoras (nome, modelo, IP, comunidade SNMP, `sector_id`, descrição local no setor).
- **quotas** — cota mensal por impressora/setor; `period` no formato `YYYY-MM`; uso atual atualizado via SNMP.
- **releases** — liberações extras de páginas no mês (não alteram permanentemente o `monthly_limit`; o limite efetivo é cota + soma das liberações).
- **snmp_readings** — leituras de contador, toner (incluindo CMYK quando disponível), status.
- **monthly_snapshots** — fechamento mensal por impressora.
- **users** / **user_sectors** — usuários e vínculo many-to-many com setores.
- **alerts** — eventos (toner baixo/crítico, impressora offline, status de erro, cota 90% / estourada). Campos: `printer_id`, `type`, `severity`, `message`, `details` (JSON), `created_at`, `resolved_at`, `acknowledged`, `acknowledged_by`, `acknowledged_at`. Coluna `printers.last_snmp_success` é usada para detectar o estado offline.
- **printer_block_events** — histórico de sync/bloqueio da Cota Local na impressora (action: `sync` | `reset` | `manual_block` | `manual_unblock`, `credits_before`, `credits_after`, `success`, `error`, `triggered_by`).
- Colunas extras em **printers** para a Cota Local: `quota_sync_enabled`, `last_quota_sync_at`, `last_quota_sync_credits`, `last_quota_sync_error`, `manual_unblock_until`.

Relacionamentos importantes: impressora pertence a um setor; cota liga impressora + setor + período; liberações referenciam uma cota.

---

## 9. Regras de negócio (resumo)

- **Cotas:** mensais; virada automática no **dia 1** de cada mês (scheduler).
- **Uso:** preferencialmente via **contador SNMP**; o sistema atualiza `current_usage` conforme a leitura.
- **Liberações:** somam ao limite **apenas no mês corrente** para relatórios e bloqueio; não “inflam” permanentemente o `monthly_limit`.
- **Relatórios:** podem ser por mês e, opcionalmente, **por semana** dentro do mês (parâmetro `week`).
- **Gestores:** veem apenas dados cujo `sector_id` está entre os setores atribuídos ao usuário.
- **Alertas:** gerados automaticamente após cada coleta SNMP (e também pelo endpoint manual `/api/snmp/collect`). Regras:
  - `TONER_CRITICAL` quando qualquer cor (ou o toner único) fica abaixo de **10%**; `TONER_LOW` abaixo de **25%**.
  - `PRINTER_OFFLINE` quando `printers.last_snmp_success` está a mais de **15 minutos** do momento atual.
  - `PRINTER_ERROR` quando o campo `status` da última leitura contém termos como `erro`, `jam`, `papel`, `offline`, `warning`.
  - `QUOTA_EXCEEDED` quando `current_usage >= monthly_limit`; `QUOTA_WARNING` quando `current_usage >= 90%`.
  - **Deduplicação:** se já existe um alerta ativo (`resolved_at IS NULL`) do mesmo `type` para a mesma impressora, não é criado outro.
  - **Auto-resolução:** quando o problema deixa de ser detectado, o alerta ativo daquele tipo recebe `resolved_at` automaticamente.
  - **Purge:** `alerts` com `created_at` acima de **90 dias** são removidos após cada coleta.

---

## 10. Frontend — telas

| Rota | Função |
|------|--------|
| `/login` | Login (usuário + senha) |
| `/` | Dashboard (resumo, gráficos, SNMP) |
| `/impressoras` | Lista de impressoras e leituras SNMP |
| `/setores` | Cadastro de setores (**admin**) |
| `/cotas` | Cotas e progresso; liberação (**admin**) |
| `/balanceamento` | Painel de balanceamento da frota e propostas mensais com aprovação (ver seção 10.2) |
| `/liberacoes` | Histórico de liberações |
| `/monitoramento` | SNMP em tempo real e histórico |
| `/alertas` | Central de alertas (filtros, reconhecimento, mute de áudio) |
| `/relatorios` | Relatórios por setor/impressora/liberações |
| `/usuarios` | Usuários (**admin**) |

O menu lateral oculta itens para **gestor** (ex.: Setores, Usuários). O token fica em `localStorage`; expiração ou 401 redireciona para `/login`.

**Sistema de alertas no frontend:**

- `AlertsProvider` (context) faz **polling a cada 15s** em `/alerts/count` e `/alerts?unacknowledged=true` e detecta novos IDs comparando com os já vistos (salvos em `localStorage` key `hse_alerts_seen_ids`).
- `AlertBell` (na Sidebar) mostra o contador total com destaque vermelho animado quando há alertas críticos e oferece dropdown com os 20 mais recentes + atalho "Reconhecer todos".
- `AlertToaster` (fixo no canto superior direito) aparece por 8s (aviso) ou 15s (crítico) quando chega alerta novo.
- **Aviso sonoro** gerado via Web Audio API (`lib/sound.ts`) — não depende de arquivos externos. Padrões: **crítico** = 3 beeps square-wave a 1200 Hz; **aviso** = 2 beeps sine a 800 Hz; **info** = 1 beep curto a 600 Hz. Pode ser silenciado pelo sino (preferência salva em `localStorage` key `hse_alerts_muted`) — escolha local por navegador.

---

## 10.1. Sincronização de Cota Local na impressora HP (bloqueio nativo)

Em impressoras HP **LaserJet Enterprise (FutureSmart)** que expõem a página *Geral › Configuração de cota local* no EWS (com Ação=Parar e contas `Guest`/`Others`/`Administrator`, exibidas em PT-BR como Convidado/Outros/Administrador), o sistema mantém os **créditos** dessas contas em sincronia com a cota mensal:

```
limite_a_aplicar = max(0, monthly_limit + soma_liberacoes - current_usage)
```

> Esse valor é o **LIMITE** (quota total) escrito no campo `EditMonoPrintSidesCreditsField`. A impressora calcula internamente `current = limite - uso_acumulado` e bloqueia quando current ≤ 0.

**Quando a impressora é sincronizada**:
- Após cada coleta SNMP (via `snmpService.updateQuotaUsage`)
- Após criar uma liberação (via `releaseService.create`)
- Na virada do mês (rollover do scheduler — chama `printerControlService.resetMonth`)
- Manualmente via `POST /api/printers/:id/sync-quota`

**Como funciona** (validado em HP LaserJet Enterprise FutureSmart, dois layouts de firmware diferentes):

1. **Login**: `POST /hp/device/SignIn/Index` com `agentIdSelect=hp_EmbeddedPin_v1`, `PinDropDown=AdminItem`, `PasswordTextBox=<senha>` + CSRFToken capturado de GET prévio.
2. **Leitura**: `GET /hp/device/LocalQuotaConfiguration/Index` → parser suporta **três layouts** de HTML emitidos por firmwares distintos da mesma família FutureSmart:
   - **Layout A** (firmware OneHP antigo): `<td id="Guest_MonoPrintCredits">307 of 400</td>` com id por usuário.
   - **Layout B** (firmware recente, "Combinar créditos" **OFF** — cota separada para cópia/impressão): `<td class="Def_MonoPrintCredits">46 of 300</td>` com classe genérica. A conta é identificada pela ordem dentro de `<tbody id="UserQuotaTableBody">`, casando cada `<tr id="UserQuota_N">` com o `<input id="UserCreditDetailSelectN" value="<conta>"/>` correspondente.
   - **Layout C** (firmware recente, "Combinar créditos" **ON** — cota unificada cópia+impressão, default em multifuncionais como E52645/E78635): `<td class="Def_MonoPrintCredits">0 of 0</td>` (zerado!) e o valor real fica em `<td class="a_CombinedMonoCredits">340 of 348</td>`.
   - O parser tenta Layout A primeiro; se ficar sem dados, cai em Layout B/C, dando preferência a `a_CombinedMonoCredits` quando ele existir e `Def_MonoPrintCredits` estiver zerado. Empiricamente, na frota HSE, ~10% Layout A, ~5% Layout B, ~85% Layout C (descoberto rodando `probe-ews-cotalocal.js --all`).
3. **Editar conta**:
   - `POST /hp/device/LocalQuotaConfiguration/Save` com `UserCreditDetailSelect{N}=<conta>` e `UserQuotaInfoEditButton=Edit...` → recebe `302` para `/hp/device/UserQuotaInfoEdit/Index?id=<uuid>`
   - GET dessa URL para captar novo CSRF
   - `POST /hp/device/UserQuotaInfoEdit/Save` com `EditMonoPrintSidesCreditsField=<novo_limite>`, `LimitReachedAction=Stop`, `FormButtonSubmit=OK`
4. **Reset mensal**: similar, mas com `UserQuotaInfoResetButton=Reset...` → confirma com `FormResetConfirmationButton=Reset` em `/hp/device/UserQuotaInfoReset/Save`. Reset zera o uso acumulado e volta `current = limit`.
5. **Mensagem do painel**: SNMP SET de "COTA ESGOTADA - PROCURE TI" é tentado em paralelo, best-effort.

**Apenas Guest e Others** são tocados — `Administrator` nunca é alterado pelo serviço (`ACCOUNTS_TO_SYNC` em `printerControlService.js`).

**Aliases**: o cliente aceita os nomes em PT-BR (Convidado/Outros/Administrador) e mapeia para os IDs internos em inglês usados pelo firmware (Guest/Others/Administrator), funcionando independentemente do idioma do EWS.

**Habilitar**:
1. Definir `EWS_USERNAME`, `EWS_PASSWORD` e `AUTO_SYNC_ENABLED=true` no `.env` do backend.
2. Em cada impressora HP, garantir que a página "Configuração de cota local" exista no EWS (Geral › Configuração de cota local) e que o serviço local de cota esteja **habilitado** na página *Configurações de cota* (`/hp/device/QuotaServer/Index`).
3. Em cada impressora HP, ativar o toggle "Sincronizar Cota Local com a impressora" no formulário de edição (admin).
4. Rodar `node scripts/probe-ews-cotalocal.js --all` para verificar quais IPs da frota são compatíveis (mostra saldos atuais e erros de login).
5. Forçar primeiro sync via botão **"Sincronizar Cota Local"** na lista de impressoras.

**Smoke test individual**:
```bash
node scripts/test-cotalocal.js <ip>                      # so leitura (seguro)
node scripts/test-cotalocal.js <ip> --write Guest=350    # altera limite
node scripts/test-cotalocal.js <ip> --reset Guest        # reset (volta ao limite cheio)
```

**Bloqueio/desbloqueio manual**: na coluna "Cota Local" da lista de impressoras, ícones de cadeado permitem zerar/restaurar créditos imediatamente. O desbloqueio manual congela o re-bloqueio automático por 24h (campo `manual_unblock_until`).

**Limitações**:
- Apenas a linha **HP LaserJet Enterprise (FutureSmart)** com a página *LocalQuotaConfiguration* foi validada. Modelos mais antigos (LaserJet Pro, M-series antigos) podem ter um EWS diferente — rodar `probe-ews-cotalocal.js` para identificar incompatibilidades antes do rollout.
- Se a senha do EWS estiver diferente em alguma impressora, o sync falha apenas para essa unidade (erro registrado em `printer_block_events.error`).
- Operador com acesso físico pode entrar pelo painel e desabilitar "Local Quota Service" em *Configurações de cota* — o próximo sync ainda funciona, mas o bloqueio só passa a valer depois que o serviço for reativado.

---

## 10.2. Balanceamento de Cotas e Propostas Mensais (governança)

A tela `/balanceamento` é o painel executivo do consumo da frota e o local onde o admin gera, edita e aprova **propostas mensais de cota** que são aplicadas automaticamente no dia 1° do mês alvo.

### 10.2.1. Modos de operação

A tela tem duas abas:

- **Visão Atual** (qualquer dia): KPIs da frota (alocado / usado / disponível), **bloco de Cotas Contratadas por Tipo** (Mono / Mono MFP / Color, cada um com pool próprio acordado com a Simpress, pois o custo por página é diferente — ver `printer_types.monthly_pool`), agregação por setor, listas de impressoras estouradas e ociosas, tabela completa filtrável e ferramenta de **remanejamento manual** entre impressoras (transfere páginas do `monthly_limit` de A para B preservando o teto total).
- **Proposta Mensal** (qualquer dia): geração de proposta para o próximo mês, edição linha-a-linha do `approved_limit`, fluxo de aprovação/rejeição, **totalização por tipo de impressora vs pool contratado** (alerta visual quando aprovado ultrapassa o teto contratado em qualquer tipo) e histórico de propostas anteriores.

> **Importante:** as cotas são tratadas separadamente por tipo de impressora porque o custo de página de uma Color é muito diferente de uma Mono. Por isso o **remanejamento entre impressoras de tipos diferentes é bloqueado** no backend (`quotaBalanceService.rebalance` retorna 400 com mensagem `"tipos diferentes: ..."`), e o modal só lista impressoras compatíveis no destino.

### 10.2.2. Algoritmo de sugestão (`quotaProposalService.suggestLimit`)

Para cada impressora ativa:
1. Coleta `total_pages` dos últimos 3 meses fechados em `monthly_snapshots`.
2. Adiciona o uso parcial do mês corrente (`quotas.current_usage`) como referência adicional se > 0.
3. Calcula a média das amostras válidas.
4. Aplica margem de **+10%** para folga.
5. Arredonda para múltiplo de **50** mais próximo (`suggested_limit`).

Casos especiais:
- **Sem histórico** (impressora nova): `suggested_limit = current_limit`. Razão: `"Sem historico - mantem limite atual"`.
- **Uso médio = 0** (ociosa há 3 meses): `suggested_limit = max(100, current_limit * 0.5)`. Razão: `"Uso medio = 0 (ociosa) - sugere 50% do limite atual"`.
- **Uso normal**: razão registrada como `"Media Xp (Nm) +10% margem"`.

O `approved_limit` é deixado `NULL` por padrão; isso significa "usar a sugestão". Admin pode editar item-a-item ou clicar **"Aplicar sugestões"** para preencher tudo de uma vez. Cada edição reverte o status para `draft` (precisa aprovar de novo).

### 10.2.3. Tabelas de banco

- `quota_proposals(id, period UNIQUE, status, generated_at, generated_by_user_id, approved_by_user_id, approved_at, rejected_at, applied_at, notes)` — uma proposta por período. Status: `draft | pending | approved | rejected | applied`.
- `quota_proposal_items(id, proposal_id FK, printer_id FK, current_limit, current_usage, avg_3m, suggested_limit, approved_limit, reason)` — um item por impressora ativa.

Migração: `migrations/010_quota_proposals.sql`, idempotente via `seed-admin.js`.

### 10.2.4. Integração com `resetMonth` (cron mensal)

No dia 1°, 00:01, o `scheduler.js` chama `printerControlService.resetMonth({ triggeredBy: 'rollover' })`, que agora:

1. **Antes de tocar HPs**, chama `quotaProposalService.applyApprovedProposal(periodAtual)`. Se há proposta `approved` para o período:
   - Para cada item, faz UPSERT em `quotas` (period = novo, monthly_limit = `approved_limit ?? suggested_limit`, current_usage = 0).
   - Marca a proposta como `applied`.
2. Se **não há** proposta aprovada, mantém o comportamento anterior (cria as novas linhas em `quotas` sem alterar limites).
3. Em seguida, executa `resetUserQuota` em todas as HPs com `quota_sync_enabled = 1` e empurra os novos `monthly_limit` via EWS.

### 10.2.5. Endpoints REST

- `GET /api/quota-balance/overview` — KPIs da frota.
- `GET /api/quota-balance/by-sector` — agregado por setor.
- `GET /api/quota-balance/printers` — lista detalhada com filtros (status, search).
- `GET /api/quota-balance/divergences?only_sync_enabled=true&sample=true` — banco vs HP em tempo real (consulta EWS, lento).
- `POST /api/quota-balance/rebalance` — admin transfere páginas de `monthly_limit` entre impressoras.
- `GET /api/quota-proposals` — lista de propostas (resumo).
- `GET /api/quota-proposals/period/:YYYY-MM` — busca por período.
- `GET /api/quota-proposals/:id` — proposta completa com itens e totais.
- `POST /api/quota-proposals/generate` — admin gera (ou regenera) proposta para `body.period` (ou próximo mês se omitido).
- `PUT /api/quota-proposals/:id/items/:itemId` — admin edita `approved_limit` de um item.
- `PUT /api/quota-proposals/:id/items` — admin edita vários (`body.updates: [{itemId, approvedLimit}]`).
- `POST /api/quota-proposals/:id/fill-suggested` — preenche `approved_limit` com `suggested_limit` em itens ainda `NULL`.
- `POST /api/quota-proposals/:id/approve` — trava status como `approved`.
- `POST /api/quota-proposals/:id/reject` — marca como `rejected`.
- `DELETE /api/quota-proposals/:id` — apaga (apenas se não aplicada).

### 10.2.6. Workflow recomendado

Para o ciclo mensal:

1. **Dias 1 a 24** do mês corrente: sistema coleta normalmente; admin acompanha pela aba **Visão Atual**, ajusta liberações e remaneja se preciso.
2. **Dia 25 (ou qualquer dia)**: admin gera a proposta para o próximo mês (`POST /generate` ou botão na UI).
3. **Dias 25 a 30**: admin edita `approved_limit` por impressora (a UI mostra delta vs cota atual e variação total).
4. **Antes do dia 1°**: admin **aprova** a proposta. Status: `approved`.
5. **Dia 1°, 00:01**: cron aplica automaticamente. Status: `applied`. Limites do mês novo já refletem a estratégia validada.

Se admin **não aprovar nada** até o dia 1°, o sistema mantém os limites do mês anterior (comportamento original preservado, falha-segura).

### 10.2.7. Deploy do servidor de produção

Sequência exata para publicar esta atualização:

```bash
# No servidor
cd /caminho/para/Impressao
git pull origin main

# 1. Backend - dependencias
cd backend
npm ci

# 2. Banco - migrations idempotentes (NUNCA usa npm run migrate)
node scripts/seed-admin.js
# Saida deve incluir: "Migration 010_quota_proposals OK."

# 3. Frontend - build
cd ../frontend
npm ci
npm run build
# Deve listar /balanceamento como rota gerada

# 4. Restart com PM2 (ja configurado)
pm2 restart hse-backend
pm2 restart hse-frontend
pm2 save
```

**Verificações pós-deploy** (sem ativar nada ainda):

- Acessar `/balanceamento` no navegador, confirmar carregamento da aba "Visão Atual" com KPIs reais.
- Como admin, gerar uma proposta de teste para o próximo mês (botão "Gerar proposta...") e validar que aparece com sugestões.
- `AUTO_SYNC_ENABLED` permanece `false` no `.env`. Nenhuma HP é tocada.
- `quota_sync_enabled` permanece `0` em todas as impressoras. Nenhuma HP é tocada.

**Ativação do bloqueio automático** (após validar a proposta de governança):

1. Editar `.env` do backend: `AUTO_SYNC_ENABLED=true`. `pm2 restart hse-backend`.
2. Na tela `/impressoras` (admin), ligar `quota_sync_enabled` em **uma** impressora piloto (ex.: setor de baixo risco e sub-utilizado).
3. Acompanhar `printer_block_events` por uns dias (eventos aparecem na seção de logs e na tela de detalhes da impressora).
4. Estender para 5-10 impressoras, depois para a frota inteira.
5. No dia 1° do mês seguinte (ou primeiro mês com `AUTO_SYNC_ENABLED=true` ativo), o `resetMonth` aplicará a proposta aprovada e empurrará os novos limites para as HPs flagadas automaticamente.

---

## 11. Manutenção e backups

- **Backup:** copiar o arquivo `backend/database.db` (e, se existirem, `-wal`/`-shm` após checkpoint ou com o servidor parado para consistência total).
- **Migrations:** `npm run migrate` em `backend` executa todos os `.sql` em `migrations/` em ordem alfabética.
- **Scripts:** pasta `backend/scripts/` — seeds e utilitários pontuais; ler cada script antes de executar em produção.

---

## 12. Segurança (recomendações)

- Definir `JWT_SECRET` forte em produção e **não** commitar `.env`.
- Alterar senha do usuário padrão **admin** após o primeiro acesso.
- Restringir firewall: apenas redes confiáveis na API e nas impressoras.
- SNMP com comunidade `public` é comum em ambiente interno; em redes sensíveis, avaliar ACLs e comunidades restritas.

---

## 13. Suporte e extensão

- Novos endpoints: seguir o padrão `routes` → `controller` → `service` → `db`.
- Novas colunas: criar migration `00X_nome.sql` e documentar.
- Dúvidas sobre OIDs SNMP: consultar `backend/src/services/snmpService.js`.

---

*Documento gerado para acompanhar o projeto Controle de Impressão. Ajuste datas e versões conforme o repositório evoluir.*
