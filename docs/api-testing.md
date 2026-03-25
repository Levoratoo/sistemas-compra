# API Testing Guide

Guia de teste local do backend MVP de gestao de contratos operacionais.

## Pre-requisitos

- Node.js 20+
- npm 10+

## Instalacao

Na raiz do projeto:

```bash
npm install
npm run setup
```

O `setup` faz:

- gera `apps/api/.env` e `apps/web/.env`
- gera o Prisma Client
- aplica migrations
- executa o seed

## Subir apenas o backend

Opcao 1, pela workspace da API:

```bash
npm run dev -w apps/api
```

Opcao 2, pelo atalho da raiz:

```bash
npm run dev:api
```

Base URL padrao:

- `http://localhost:3000`
- `http://localhost:3000/api`

Health check:

```bash
curl http://localhost:3000/api/health
```

## Ordem recomendada para testar a API

1. criar projeto
2. anexar documento
3. criar fornecedor
4. criar item orcado
5. criar compra
6. criar item da compra
7. criar regra de reposicao
8. consultar reposicoes
9. consultar dashboard

## Fluxo minimo de teste

### 1. Criar projeto

```bash
curl -X POST http://localhost:3000/api/projects ^
  -H "Content-Type: application/json" ^
  -d "{\"code\":\"TEST-OPS-001\",\"name\":\"Projeto Teste API\",\"organizationName\":\"Orgao Teste\",\"bidNumber\":\"PE-001/2026\",\"projectStatus\":\"PLANNED\",\"implementationStatus\":\"NOT_STARTED\",\"plannedStartDate\":\"2026-04-10T00:00:00.000Z\",\"contractDurationMonths\":12,\"monthlyContractValue\":10000}"
```

Resposta esperada:

- objeto do projeto com `id`
- `counts` inicializados

Guarde:

- `projectId`

### 2. Criar documento do projeto

```bash
curl -X POST http://localhost:3000/api/projects/{projectId}/documents ^
  -H "Content-Type: application/json" ^
  -d "{\"documentType\":\"NOTICE\",\"originalFileName\":\"edital-teste.pdf\",\"mimeType\":\"application/pdf\",\"contentText\":\"Pregao PE-001/2026\",\"extractedFields\":[{\"targetType\":\"PROJECT\",\"fieldKey\":\"bidNumber\",\"proposedValue\":\"PE-001/2026\",\"confirmedValue\":\"PE-001/2026\",\"sourcePage\":1,\"reviewStatus\":\"CONFIRMED\"}]}"
```

Resposta esperada:

- documento salvo com `storagePath` relativo ao projeto
- `extractedFields` retornados na resposta

### 3. Criar fornecedor

```bash
curl -X POST http://localhost:3000/api/suppliers ^
  -H "Content-Type: application/json" ^
  -d "{\"legalName\":\"Fornecedor Teste Ltda\",\"documentNumber\":\"55555555000155\",\"contactName\":\"Equipe Teste\",\"email\":\"teste@fornecedor.local\"}"
```

Guarde:

- `supplierId`

### 4. Criar item orcado

```bash
curl -X POST http://localhost:3000/api/projects/{projectId}/budget-items ^
  -H "Content-Type: application/json" ^
  -d "{\"itemCategory\":\"UNIFORM\",\"name\":\"Camisa operacional\",\"unit\":\"un\",\"plannedQuantity\":10,\"bidUnitValue\":55,\"hasBidReference\":true}"
```

Resposta esperada:

- `bidTotalValue` calculado em runtime
- `realTotalValue` inicialmente `0`

Guarde:

- `budgetItemId`

### 5. Criar compra

```bash
curl -X POST http://localhost:3000/api/projects/{projectId}/purchases ^
  -H "Content-Type: application/json" ^
  -d "{\"supplierId\":\"{supplierId}\",\"purchaseStatus\":\"APPROVED\",\"purchaseDate\":\"2026-03-23T00:00:00.000Z\",\"internalReference\":\"PC-TESTE-001\",\"glpiNumber\":\"GLPI-TESTE-001\"}"
```

Guarde:

- `purchaseOrderId`

### 6. Criar item da compra

```bash
curl -X POST http://localhost:3000/api/purchases/{purchaseOrderId}/items ^
  -H "Content-Type: application/json" ^
  -d "{\"budgetItemId\":\"{budgetItemId}\",\"quantityPurchased\":10,\"realUnitValue\":50,\"deliveredAt\":\"2026-03-24T00:00:00.000Z\",\"deliveryStatus\":\"DELIVERED\"}"
```

Resposta esperada:

- `realTotalValue = 500`
- `budgetTotalValue = 550`
- `savingsValue = 50`
- `isAboveBudget = false`

## Fluxo alternativo: item sem rubrica

Se a compra nao tiver item orcado previo, envie `manualBudgetItem` no mesmo payload:

```bash
curl -X POST http://localhost:3000/api/purchases/{purchaseOrderId}/items ^
  -H "Content-Type: application/json" ^
  -d "{\"quantityPurchased\":1,\"realUnitValue\":300,\"deliveryStatus\":\"DELIVERED\",\"manualBudgetItem\":{\"itemCategory\":\"OTHER\",\"name\":\"Arte de cracha emergencial\",\"unit\":\"servico\",\"plannedQuantity\":1,\"hasBidReference\":false}}"
```

Resposta esperada:

- a API cria um `BudgetItem` manual
- o item fica sinalizado como sem rubrica
- nao existe economia persistida no banco

### 7. Criar regra de reposicao

```bash
curl -X POST http://localhost:3000/api/budget-items/{budgetItemId}/replenishment-rule ^
  -H "Content-Type: application/json" ^
  -d "{\"triggerType\":\"FROM_DELIVERY\",\"intervalUnit\":\"MONTH\",\"intervalValue\":6,\"warningDays\":30}"
```

Resposta esperada:

- regra criada
- `nextEvent` gerado automaticamente quando a data base puder ser resolvida

### 8. Listar reposicoes do projeto

```bash
curl http://localhost:3000/api/projects/{projectId}/replenishments
```

Resposta esperada:

- lista de regras
- `status` derivado
- `events`
- `nextEvent`

### 9. Consultar dashboard do projeto

```bash
curl http://localhost:3000/api/projects/{projectId}/dashboard
```

Resposta esperada:

- `totalPlanned`
- `totalRealized`
- `savings`
- `itemsWithoutBidReference`
- `upcomingEvents`
- `alerts`

## Rotas principais

### Projects

- `POST /api/projects`
- `GET /api/projects`
- `GET /api/projects/:id`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`

### ProjectDocument

- `POST /api/projects/:id/documents`
- `GET /api/projects/:id/documents`

### ProjectRole

- `POST /api/projects/:id/roles`
- `GET /api/projects/:id/roles`

### BudgetItem

- `POST /api/projects/:id/budget-items`
- `GET /api/projects/:id/budget-items`

### Supplier

- `POST /api/suppliers`
- `GET /api/suppliers`

### PurchaseOrder

- `POST /api/projects/:id/purchases`
- `GET /api/projects/:id/purchases`

### PurchaseOrderItem

- `POST /api/purchases/:id/items`

### Replenishment

- `POST /api/budget-items/:id/replenishment-rule`
- `GET /api/projects/:id/replenishments`

### Dashboard

- `GET /api/projects/:id/dashboard`

## Validacoes importantes para conferir

- `quantityPurchased` deve ser maior que `0`
- `realUnitValue` nao pode ser negativo
- `plannedQuantity` nao pode ser negativa
- `bidUnitValue` nao pode ser negativo
- `PurchaseOrderItem` sempre precisa de `budgetItemId` valido ou `manualBudgetItem`
- `storagePath` de documento deve ser relativo e nao pode escapar da pasta do projeto
- regra com `triggerType = MANUAL` exige `baseDate`
- `sourceDocumentId` em cargo e item orcado precisa existir e pertencer ao mesmo projeto

## Massa inicial do seed

O seed atual cria:

- 2 projetos
- 3 fornecedores
- cargos
- itens orcados
- compras
- regras de reposicao
- eventos de reposicao

Isso permite testar a API mesmo antes de criar registros manuais.

## Observacao sobre Prisma no Windows

Em alguns ambientes Windows, `npx prisma generate` pode imprimir um aviso `EPERM` ao tentar substituir o engine nativo do Prisma. O projeto inclui `npm run db:generate -w apps/api`, que encapsula esse comportamento e garante que o client gerado continue utilizavel localmente.
