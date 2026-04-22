# Sistema de Controle de Impressão

Sistema web para controle de cotas de impressão por setor, com gestão de liberações e relatórios.

**Explicação em linguagem simples e sugestão de roteiro para apresentação:** [APRESENTACAO-E-GUIA-LEIGOS.md](APRESENTACAO-E-GUIA-LEIGOS.md) · **Documentação técnica:** [DOCUMENTACAO.md](DOCUMENTACAO.md) · **Instalação em servidor 24/7:** [SERVIDOR.md](SERVIDOR.md).

## Funcionalidades

- Cadastro de impressoras e setores
- Gestão de cotas mensais por impressora/setor
- Registro de uso de páginas
- Liberação manual de cotas extras
- Dashboard com gráficos de consumo
- Relatórios por setor e por impressora com exportação para PDF

## Tecnologias

- **Frontend:** Next.js 16 + React + TailwindCSS + Recharts
- **Backend:** Node.js + Express
- **Banco de Dados:** SQLite (via better-sqlite3)

## Requisitos

- Node.js 20+

## Instalação

### 1. Backend

```bash
cd backend
npm install
npm run migrate
npm run dev
```

O banco SQLite (`database.db`) será criado automaticamente na pasta `backend/`.

O backend rodará em `http://localhost:3001`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend rodará em `http://localhost:3000`.

## Estrutura

```
backend/
  src/
    config/       - Conexão com banco de dados
    controllers/  - Controllers das rotas
    routes/       - Definição de rotas
    services/     - Lógica de negócio
    middleware/   - Validação e error handler
  migrations/     - Scripts SQL

frontend/
  src/
    app/          - Páginas (Next.js App Router)
    components/   - Componentes reutilizáveis
    lib/          - API client, tipos e utilitários
```

## Uso

1. Cadastre as impressoras em **Impressoras**
2. Cadastre os setores em **Setores**
3. Crie cotas mensais em **Cotas** (impressora + setor + limite)
4. Registre o uso de páginas conforme necessário
5. Quando um setor atingir a cota, libere páginas extras em **Liberações**
6. Acompanhe tudo no **Dashboard** e gere **Relatórios** para a direção
