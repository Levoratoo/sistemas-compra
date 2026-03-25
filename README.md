# SiteCompras MVP

Sistema web local para gestão de contratos operacionais, com backend em Express + Prisma e frontend em Next.js.

## Stack

- Frontend: Next.js 15, TypeScript, Tailwind CSS, TanStack Query, React Hook Form, Zod, Lucide
- Backend: Node.js, Express, Prisma ORM, Zod
- Banco local: SQLite
- Monorepo: npm workspaces

## Estrutura

```text
apps/
  api/
    prisma/
      schema.prisma
      migrations/
      seed.ts
    src/
      app.ts
      server.ts
      config/
      controllers/
      middlewares/
      modules/
      repositories/
      routes/
      services/
      utils/
  web/
    app/
    components/
    features/
    hooks/
    lib/
    services/
    types/
docs/
  api-testing.md
scripts/
  setup.mjs
```

## Portabilidade

- Nenhum caminho absoluto do Windows é usado no projeto.
- O banco SQLite fica em `apps/api/prisma/dev.db`.
- Os uploads ficam em `apps/api/uploads`.
- As migrations ficam em `apps/api/prisma/migrations`.
- O seed fica em `apps/api/prisma/seed.ts`.
- Os `.env` das apps são gerados a partir do `.env.example` da raiz.
- O projeto pode ser copiado inteiro para outro notebook e executado sem ajustes manuais de caminho.

## Variáveis de ambiente

Arquivo base da raiz:

```env
PORT=3000
CORS_ORIGIN=http://localhost:3001
DATABASE_URL=file:./dev.db
UPLOADS_DIR=./uploads
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

O script `npm run setup:env` gera automaticamente:

- `apps/api/.env`
- `apps/web/.env`

## Instalação local

```bash
npm install
npm run setup
```

O `setup` executa:

1. sincronização dos arquivos `.env`
2. geração do Prisma Client
3. aplicação das migrations
4. seed inicial do banco

## Execução em desenvolvimento

Subir tudo:

```bash
npm run dev
```

Subir só a API:

```bash
npm run dev:api
```

Subir só o frontend:

```bash
npm run dev:web
```

## URLs padrão

- Frontend: `http://localhost:3001`
- Backend: `http://localhost:3000`
- API REST: `http://localhost:3000/api`

## Scripts úteis

```bash
npm run setup
npm run setup:env
npm run dev
npm run dev:api
npm run dev:web
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run lint -w apps/web
```

## Fluxo principal disponível no frontend

O frontend em `apps/web` já consome a API existente em `apps/api` e cobre o fluxo principal do MVP:

- dashboard consolidado
- listagem e criação de projetos
- edição e exclusão de projetos
- dashboard por projeto
- documentos do projeto
- cargos do projeto
- itens orçados
- fornecedores
- compras reais com itens vinculados
- regras e eventos de reposição

## Páginas principais

- `/`: dashboard geral consolidado
- `/projects`: lista de projetos
- `/projects/:projectId`: visão geral do projeto
- `/projects/:projectId/documents`: documentos
- `/projects/:projectId/roles`: cargos
- `/projects/:projectId/budget-items`: itens orçados
- `/projects/:projectId/purchases`: compras
- `/projects/:projectId/replenishments`: reposições
- `/suppliers`: fornecedores

## Build e validação

Comandos validados no estado atual do projeto:

```bash
npm install
npm run setup
npm run build
npm run lint -w apps/web
```

## Backend

Rotas principais da API:

- `GET /api/dashboard/consolidated`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/projects/:id/dashboard`
- `GET /api/projects/:id/documents`
- `POST /api/projects/:id/documents`
- `GET /api/projects/:id/roles`
- `POST /api/projects/:id/roles`
- `PUT /api/roles/:id`
- `DELETE /api/roles/:id`
- `GET /api/projects/:id/budget-items`
- `POST /api/projects/:id/budget-items`
- `PUT /api/budget-items/:id`
- `DELETE /api/budget-items/:id`
- `GET /api/suppliers`
- `POST /api/suppliers`
- `PUT /api/suppliers/:id`
- `DELETE /api/suppliers/:id`
- `GET /api/projects/:id/purchases`
- `POST /api/projects/:id/purchases`
- `POST /api/purchases/:id/items`
- `POST /api/budget-items/:id/replenishment-rule`
- `GET /api/projects/:id/replenishments`

## Massa de teste

O seed cria dados suficientes para navegação local do MVP:

- pelo menos 2 projetos
- fornecedores
- cargos
- itens orçados
- compras
- regras de reposição
- eventos derivados

## Documentação adicional

- guia de teste da API: [docs/api-testing.md](docs/api-testing.md)

## Observações

- O upload de documentos no MVP usa o backend já estabilizado com persistência local de conteúdo simulado.
- A revisão avançada de extração ainda não foi implementada no frontend.
- Existe um diretório `apps/web/legacy-src` mantido apenas como legado da migração do Vite. Ele não participa do build do Next.js.
