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
| GET | `/alerts` | Query: `unacknowledged=true`, `limit`. Gestor: só setores próprios |
| GET | `/alerts/count` | Contagem rápida de alertas pendentes (badge do sino) |
| POST | `/alerts/:id/acknowledge` | Marca alerta como reconhecido |
| POST | `/alerts/acknowledge-all` | Reconhece todos os alertas acessíveis ao usuário |
| POST | `/alerts/generate` | Força reprocessamento de alertas (**admin**) |

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
