# Arquitetura — iDoctor

Documento de referência da plataforma: dashboard multi-tenant, autenticação JWT, cadastro de clientes, jornada clínica por tenant, armazenamento em Google Cloud Storage e stack alinhada ao projeto de referência **kaber.ai** (mesmo diretório pai do repositório `idoctor`). **Escopo de produto**, **integrações** e **layout do painel** estão em [PRODUCT-SCOPE.md](./PRODUCT-SCOPE.md). O **modelo de dados** (pathway, etapas, paciente, transição, dispatch) e o **impacto nas camadas de código** são decisão arquitetural central — **§8** abaixo.

---

## 1. Objetivos

| Objetivo | Descrição |
|----------|-----------|
| Isolamento por tenant | Dados de negócio sempre vinculados a um `tenantId`; usuários acessam apenas tenants aos quais pertencem (exceto **admin geral**, com regras explícitas). |
| Permissionamento | Papéis **globais** (plataforma) e **por tenant** (escopo do cliente); APIs e UI respeitam a matriz de permissões. |
| API previsível | REST em `/api/v1/*`, validação com Zod, respostas padronizadas (sucesso/erro). |
| Auth stateless | JWT de acesso + refresh persistido (revogável), compatível com web e integrações. |
| Fluxos configuráveis | Definição de workflow em grafo (nodes/edges); execução com estado persistido. |
| Cadastro flexível | Formulários e etapas dinâmicas sem deploy a cada mudança de processo. |
| Arquivos seguros | Objetos no GCS com prefixo por tenant (e opcionalmente por cliente). |

---

## 2. Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js (App Router) |
| Linguagem | TypeScript |
| UI | React, Tailwind CSS, shadcn/ui, Lucide React |
| HTTP cliente | Axios (interceptors: Bearer, refresh, erros) |
| Gráficos | Recharts ou Chart.js (definir no setup do projeto) |
| Editor de jornada | **@xyflow/react** — canvas do fluxo clínico; estado persistido + etapas materializadas |
| Banco | PostgreSQL |
| ORM | Prisma (`packages/prisma`, workspace npm) |
| Auth (web) | **NextAuth.js v4** (App Router), **Prisma Adapter**, provider Credentials (email/senha); callbacks para claims (`globalRole`, contexto de tenant) |
| Auth (API stateless, opcional) | JWT (`jsonwebtoken`) + refresh no banco para clientes externos — mesmo modelo `User` |
| Storage | Google Cloud Storage (`@google-cloud/storage`, URLs assinadas v4) |
| Validação | Zod |
| Doc API | **Scalar** (`@scalar/nextjs-api-reference`) + **`public/openapi.json`** (OpenAPI 3) |
| Fila / jobs (opcional) | **BullMQ** + **Redis 7** (ativado por `REDIS_URL`); sem Redis, notificações rodam inline — ver §7.7 |

**Referência estrutural:** organização em `app/`, `src/application`, `src/domain`, `src/infrastructure`, `src/lib`, como no kaber.ai.

---

## 3. Estrutura de pastas (alvo)

```text
idoctor/
├── app/
│   ├── (auth)/                 # páginas públicas: login, recuperação de senha
│   ├── (dashboard)/            # área logada: layout, navegação, módulos
│   └── api/
│       └── v1/
│           ├── auth/           # login, refresh, logout, registro
│           ├── tenants/        # contexto, convites (se houver)
│           ├── clients/        # CRUD clientes (escopo tenant)
│           ├── workflows/      # definições de fluxo + publicação
│           ├── workflow-runs/  # instâncias, passos, webhooks
│           └── storage/        # upload / URLs assinadas
├── packages/
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
├── src/
│   ├── application/            # casos de uso por módulo (schemas Zod por pasta quando fizer sentido)
│   ├── domain/                 # entidades, erros de domínio
│   ├── infrastructure/         # Prisma, GCS, e-mail, filas (futuro)
│   ├── types/                  # interfaces e types compartilhados (API, DTOs, UI); sem tipos soltos em app/
│   │   └── api/                # opcional: contratos v1 por recurso
│   └── lib/
│       ├── utils/              # funções auxiliares puras (format, parse, máscaras)
│       ├── constants/          # constantes nomeadas (limites, chaves, labels estáticos)
│       └── auth|api-response|… # integrações leves (JWT helpers, formato de resposta)
├── docs/
│   ├── ARCHITECTURE.md         # este arquivo (inclui modelo de dados §8)
│   ├── PRODUCT-SCOPE.md        # escopo, integrações IA/WhatsApp, UI dashboard
│   ├── DEV-PHASES.md           # etapas de dev (backend primeiro, NextAuth)
│   └── API-DOCS.md             # Scalar + OpenAPI (public/openapi.json)
└── public/
    └── openapi.json            # especificação OpenAPI 3 (Scalar /api-doc)
```

Convenções:

- **Route handlers** (`route.ts`) permanecem finos: parse → schema Zod → use case → resposta; **tipos/DTOs** importados de `src/types/` (não declarar interfaces soltas no arquivo da rota).
- **Componentes e páginas** importam tipos de `src/types/` ou `features/<x>/types.ts`; **utilitários** de `src/lib/utils/`; **constantes** de `src/lib/constants/`.
- **Regras de negócio** ficam em `src/application`.
- **Acesso a dados e externos** em `src/infrastructure`.
- **Zod:** schemas próximos ao use case ou em `src/lib/schemas/` / `src/types` inferidos com `z.infer<>` para alinhar tipo TypeScript ao runtime.

---

## 4. Multi-tenant

### 4.1 Modelo conceitual

- **Tenant:** organização (clínica, unidade de negócio). Campos típicos: nome, **slug** (usado em URL/subdomínio), `subdomain` ou hostname, status, plano.
- **User:** identidade global (e-mail único), com **papel global** opcional (ver seção 5.4).
- **TenantMembership:** vínculo `user` ↔ `tenant` com **papel no tenant** (`tenant_admin`, `tenant_user`, etc.). Para `tenant_user`, flags opcionais de **visibilidade de pacientes**: `restrictedToAssignedOnly` (só `Client` com `assignedToUserId` = o usuário) e `linkedOpmeSupplierId` (só `Client` com aquele fornecedor OPME). `tenant_admin` e `super_admin` no contexto do tenant ignoram esses filtros. A política é aplicada nas rotas via `src/application/use-cases/shared/load-client-visibility-scope.ts` (lista, ficha, Kanban, dashboards, arquivos, notificações).

Todo registro de negócio relevante inclui `tenantId` (Client, `CarePathway` / `PathwayStage`, `PatientPathway`, `StageTransition`, `AuditEvent`, `FileAsset`, `AiJob`, …). Modelo relacional em **§8**.

### 4.2 Resolução do tenant

Combinações comuns (podem coexistir):

1. **Subdomínio (recomendado com hosts dedicados):** `clinica-xyz.idoctor.app` — o middleware lê o host, resolve `Tenant` pelo slug/subdomínio e injeta `tenantId` no contexto da request.
2. **Slug na URL no app principal:** `app.idoctor.app/dashboard/clinica-xyz/...` — mesmo tenant, rota explícita sem depender do Host.
3. **Header / query (API e admin geral):** `X-Tenant-Id` ou `?tenantId=` — útil para integrações e para o **admin geral** trocar de contexto sem mudar de subdomínio (ver seção 5.5).

O JWT deve refletir o **contexto ativo**: `sub` (userId), `tenantId` quando aplicável, `globalRole`, `tenantRole` no tenant atual. Toda operação valida esse contexto no servidor (nunca só no cliente).

### 4.3 Isolamento de dados

- Repositórios recebem `tenantId` e **sempre** filtram por ele.
- Para maior garantia em equipes grandes: avaliar **Row Level Security (RLS)** no PostgreSQL; para MVP, filtro explícito no Prisma é suficiente se seguido com rigor.

### 4.4 Subdomínio por tenant: automação na criação

Objetivo: ao **criar um novo tenant**, o sistema passa a responder em `https://<slug>.idoctor.app` (ou domínio customizado futuro) sem intervenção manual em DNS para cada cliente.

**Ideia central:** um único registro DNS “catch-all” na zona do domínio raiz; cada novo subdomínio **não** exige um novo registro A manual se você usar **wildcard**.

1. **DNS (Cloudflare ou outro provedor)**
   - Criar **`*.idoctor.app`** (wildcard) apontando para o mesmo destino da aplicação (ex.: load balancer, Netlify, Vercel, Cloudflare Workers/Pages, IP do cluster).
   - Opcional: **`idoctor.app`** (apex) para marketing; **`app.idoctor.app`** para o painel admin geral.

2. **TLS (HTTPS)**
   - Em Vercel/Netlify/Cloudflare Pages: certificados **wildcard** `*.idoctor.app` (muitos provedores emitem automaticamente ao validar o domínio raiz).
   - Sem wildcard, seria necessário emitir certificado por host (viável via API — ex.: Cloudflare SSL for SaaS — mas é mais complexo).

3. **O que “automatizar” no código ao criar o tenant**
   - Persistir `slug` (único) e, se usar hostname dedicado, `hostname` ou derivar `slug.idoctor.app`.
   - **Não** é obrigatório chamar API de DNS por tenant se o wildcard já cobre `*.idoctor.app`: basta o app resolver o subdomínio → tenant no middleware.
   - **Quando usar API de DNS por tenant:** domínios **customizados** (`clinica.com.br` apontando para sua app). Aí integrações como **Cloudflare for SaaS** (Custom Hostnames), ou criação de registros CNAME via API, passam a fazer sentido; fluxo típico: tenant solicita domínio → você gera verificação TXT/CNAME → após validação, o tráfego passa a ser aceito para aquele host.

4. **Fluxo resumido (wildcard)**

   ```text
   POST /api/v1/admin/tenants  →  grava Tenant (slug=clinica-a)
   Usuário acessa https://clinica-a.idoctor.app
   →  Middleware: host.split(".")[0] === "clinica-a"  →  busca Tenant por slug  →  contexto tenantId
   ```

5. **Cloudflare em específico (opcional, escala SaaS)**
   - **Custom Hostnames** para marcas white-label.
   - **Workers** na frente do Next.js para roteamento por host.
   - Manter **`tenantId` no banco** como fonte da verdade; host é apenas chave de resolução.

---

## 5. Autenticação e autorização

### 5.0 NextAuth (sessão web)

- **Route Handler:** `app/api/auth/[...nextauth]/route.ts`; configuração com `PrismaAdapter` e modelos `Account`, `Session`, `VerificationToken` no schema Prisma.
- **Sessão:** estratégia **JWT** recomendada para incluir `userId`, `globalRole` e, quando aplicável, `tenantId` / papéis nos callbacks `jwt` e `session`.
- **Variáveis:** `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (obrigatórias).
- O dashboard Next.js usa **cookie de sessão** via NextAuth; APIs `/api/v1` podem validar com `getServerSession` / `auth()`. Para **mobile ou integrações**, ver fluxo JWT na tabela abaixo e [DEV-PHASES.md](./DEV-PHASES.md) (fase B5).

### 5.1 Fluxo JWT (alinhado ao kaber.ai) — API / clientes externos

| Componente | Descrição |
|------------|-----------|
| Access token | Curta duração; claims: `sub` (userId), `globalRole`, `tenantId` (contexto ativo), `tenantRole` (papel no tenant ativo). |
| Refresh token | Opaco ou JWT com `jti` único; persistido na tabela `RefreshToken` com expiração e revogação (`revokedAt`). |
| Login | `POST /api/v1/auth/login` → `access_token` + `refresh_token`. |
| Renovação | `POST /api/v1/auth/refresh` → novo access (e opcionalmente rotação do refresh). |
| Logout | `POST /api/v1/auth/logout` → revoga refresh pelo `jti`. |

### 5.2 Proteção

- Rotas de API protegidas: header `Authorization: Bearer <access_token>`.
- Middleware Next.js: proteger prefixos do dashboard e validar sessão/JWT conforme estratégia escolhida (cookie httpOnly **ou** apenas Bearer no cliente com armazenamento seguro).

### 5.3 Autorização (visão geral)

- **Usuário comum (não admin geral):** sempre verificar `TenantMembership` para o `tenantId` ativo; o `tenantRole` limita ações (CRUD clientes, workflows, etc.).
- **Admin geral:** ver seção 5.5 — bypass controlado com auditoria.

### 5.4 Modelo de permissionamento (global × tenant)

Dois eixos independentes:

| Eixo | Onde vive | Exemplos |
|------|-----------|----------|
| **Papel global** | Coluna em `User` ou tabela `PlatformRole` | `super_admin` (gestão da plataforma: criar tenants, ver todos os tenants); `null` ou `user` (usuário “normal” da plataforma). |
| **Papel no tenant** | `TenantMembership.role` | `tenant_admin` (configura o tenant, convida usuários, publica fluxos); `tenant_user` (opera dia a dia, sem apagar tenant ou gerir billing interno, conforme regra de negócio). |

**Matriz sugerida (ajustar ao produto):**

| Ação | Super admin (global) | Tenant admin | Tenant user |
|------|----------------------|--------------|-------------|
| Criar / suspender **tenant** | Sim | Não | Não |
| Listar **todos** os tenants | Sim | Não | Não |
| Entrar em qualquer tenant (contexto) | Sim (ver 5.5) | Apenas nos tenants onde é membro | Apenas nos tenants onde é membro |
| Convidar usuários ao tenant | Sim (se no contexto) / política | Sim | Não (ou sim, se permitir) |
| CRUD clientes, workflows, arquivos | Sim **no tenant ativo** | Sim | Conforme permissões finas |
| Publicar workflow | Sim no contexto | Sim | Não (típico) |

**Implementação no Prisma (conceito):**

- `User.globalRole` — enum: `super_admin | user` (ou mais valores depois).
- `TenantMembership.role` — enum: `tenant_admin | tenant_user | …`.

**Guards nas APIs:**

- `requireAuth` → `requireTenantContext` → `requireTenantRole(['tenant_admin'])` para rotas restritas.
- `requireSuperAdmin` para `POST /api/v1/admin/tenants`, listagens globais, etc.

**Princípio:** permissão efetiva = `globalRole` **OU** `tenantRole` conforme o recurso; nunca confiar só no front (sempre revalidar no use case).

### 5.5 Admin geral: navegar entre tenants de forma segura e “inteligente”

O super admin precisa **liberdade para operar em qualquer tenant** sem criar `TenantMembership` falso para cada combinação, mas com **rastreabilidade**.

**Opção A — Contexto de tenant explícito (recomendada)**

1. Login do super admin em `app.idoctor.app` (ou domínio central).
2. Lista de tenants (busca, favoritos, recentes) no **Tenant switcher** (componente na topbar, tipo “workspace” do Slack/Notion).
3. Ao selecionar um tenant:
   - **Front:** grava `activeTenantId` (estado global + `localStorage` opcional) e chama `POST /api/v1/auth/context` com `{ tenantId }` **ou** recebe novo **access token** com `tenantId` + `tenantRole: "super_admin_impersonation"` embutido.
   - **Back:** valida `User.globalRole === super_admin`; emite token com `tenantId` ativo e flag `actingAsSuperAdmin: true` (claim interna) para auditoria.

4. Todas as requests subsequentes usam esse `tenantId` como escopo; repositórios aplicam o mesmo filtro que um tenant admin.

**Opção B — Impersonação com audit log**

- Claims extras: `impersonatorUserId` (sempre o super admin real) e `effectiveTenantId`.
- Tabela `AuditLog`: `actorUserId`, `tenantId`, `action`, `payload`, `ip`, `userAgent` — obrigatório para ações sensíveis quando `actingAsSuperAdmin`.

**Opção C — Subdomínio + cookie de contexto**

- Super admin abre `https://clinica-a.idoctor.app` já logado: middleware confere JWT; se `super_admin`, permite acesso a esse host sem membership; caso contrário exige membership.
- Complementar ao switcher central: deep links diretos por tenant.

**UX “inteligente” sugerida**

- **Busca global** de tenant por nome/slug.
- **Recentes** e **fixados** (pins) no switcher.
- Indicador visual claro: **“Você está em: [Tenant X] como administrador da plataforma”** com botão **Sair do contexto** (volta à visão global sem tenant).
- Rotas: `app.idoctor.app/admin/tenants` (só super admin) vs `.../dashboard/...` escopado ao tenant ativo.

**Endpoints úteis**

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/admin/tenants` | Lista paginada (só `super_admin`). |
| POST | `/api/v1/admin/tenants` | Cria tenant (+ slug para subdomínio); opcionalmente primeiro `tenant_admin`. |
| POST | `/api/v1/auth/context` | Define `tenantId` ativo no token (super admin ou usuário com membership). |
| DELETE | `/api/v1/auth/context` | Limpa contexto de tenant (volta modo global para super admin). |

---

## 6. Cadastro de clientes e dados cadastrais

**Ordem de uso:** primeiro **`Client`** (cadastro); depois **`PatientPathway`** (escolha do fluxo + primeira etapa); em seguida **transições** de etapa — ver [PRODUCT-SCOPE.md](./PRODUCT-SCOPE.md) (ordem operacional). Na UI, isso pode ser um **wizard** (dados → fluxo → salvar tudo no final).

Campos alinhados ao produto:

| Campo | Observação |
|-------|------------|
| Nome | Texto |
| Telefone **WhatsApp** | Principal canal; normalizar (E.164) para integração com o chatbot |
| Descrição do caso | Texto / resumo clínico (`caseSummary` ou `caseDescription`) |
| Documento | CPF/CNPJ conforme regra do tenant (validação + Zod) |
| Endereço | Opcional; colunas estruturadas ou JSON validado |

**Entidade sugerida:** `Client` com `tenantId` obrigatório; índices para busca por documento ou telefone **dentro do tenant** quando fizer sentido (`@@unique` apenas se regra de negócio exigir).

---

## 7. Fluxos de atendimento

**Produto (negócio):** a **jornada do paciente** é um fluxo **por tenant**; o tenant pode ter **vários** fluxos (ex.: tipos de tratamento), com **templates padrão** da plataforma e **edição visual** com **@xyflow/react** (adicionar/remover etapas), persistida no banco. Ao **iniciar** a jornada num paciente: **um único** fluxo → associação **automática**; **mais de um** → escolha explícita do fluxo. Ao **entrar** numa etapa nova, o paciente recebe o **pacote integral** de documentos; o **chatbot** envia mensagem + anexos. Detalhe em [PRODUCT-SCOPE.md](./PRODUCT-SCOPE.md) §3.1–3.2.

**Implementação atual:** `CarePathway` (múltiplos por tenant), `PathwayVersion` com **JSON React Flow** + **`PathwayStage`** materializado, `StageDocument`, **`PatientPathway`** (referência a `pathwayId` + `currentStageId`), **`StageTransition`** com **`dispatchStub`** para snapshot do bundle documental. `ChannelDispatch` (WhatsApp Business Cloud API) já está implementado; `AiJob` permanece evolução futura. Motor n8n genérico (`WorkflowDefinition`) permanece **opcional** para cenários futuros. Detalhe em **§8**.

### 7.1 Conceitos (motor genérico / n8n)

| Conceito | Descrição |
|----------|-----------|
| **WorkflowDefinition** | Nome, versão, status (`draft` / `published`), `tenantId`. |
| **Grafo** | JSON serializado compatível com React Flow: `nodes[]`, `edges[]`. Cada node: `id`, `type`, `position`, `data` (config específica). |
| **Tipos de node (exemplos)** | `trigger`, `form`, `condition`, `http`, `delay`, `notify_whatsapp`, `call_ai`, `end`. |
| **WorkflowRun** | Instância em execução: referência à definição (e versão), `status`, `currentNodeId` ou fila de passos, `context` (JSON com variáveis e respostas). **Alternativa:** instância = paciente + `currentStageId` na jornada clínica. |

### 7.2 Cadastro dinâmico

- Schemas de formulário podem ser armazenados por node `form` ou em entidade **`FormSchema`** (por tenant).
- Runtime: renderização dinâmica a partir do schema (campos, validação, máscaras).

### 7.3 Execução

- **Motor síncrono:** use case `execute-step` — dado `runId`, avança conforme tipo do node.
- **Motor assíncrono:** **BullMQ + Redis** como direção preferida para HTTP externo, delays longos, integrações, retries e tarefas agendadas.

Webhooks de retorno (paralelo ao padrão de webhooks do kaber.ai) podem atualizar `WorkflowRun` e disparar o próximo passo.

### 7.4 Central de notificações in-app

O sistema de notificações persiste registros por usuário com status `read/unread`, entregue em **tempo real via SSE** (Server-Sent Events) e visível no **sininho + popover** do painel. É **independente** dos alertas do dashboard (que calculam SLA em tempo real sem persistir).

**Tipos de notificação:**

| Tipo | Evento-gatilho | Destinatário |
|------|---------------|-------------|
| `sla_critical` | Paciente entra em SLA danger | Membros do tenant |
| `sla_warning` | Paciente entra em SLA warning | Membros do tenant |
| `stage_transition` | Transição de etapa executada | Membros do tenant |
| `new_patient` | Novo paciente + jornada criados | Membros do tenant |
| `checklist_complete` | Checklist da etapa 100% concluído | Membros do tenant |

**Modelo:** `Notification` (`tenantId`, `userId`, `type`, `title`, `body?`, `metadata` Json, `readAt?`, `createdAt`). Um registro por membro destinatário — permite `readAt` individual. Índice `(userId, readAt, createdAt)` cobre a query principal.

**Fluxo de emissão (dual-mode):**

1. Evento de negócio (transição, novo paciente, checklist, SLA) chama `INotificationEmitter.emit()`
2. O emitter resolve destinatários e escolhe o modo:
   - **Com Redis:** publica **job** na fila `notifications` do **BullMQ** → worker consome, faz `Notification.createMany()` no Postgres e publica via **Redis pub/sub** → SSE entrega em tempo real
   - **Sem Redis (inline):** `Notification.createMany()` direto no Postgres; frontend usa **polling** para atualizar

**Deduplicação SLA:** antes de emitir `sla_warning`/`sla_critical`, verificar se já existe notificação recente (24 h) para o mesmo `(patientPathwayId, stageId, type)` via campo `metadata`.

**API:**

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/v1/notifications` | Lista paginada (cursor) do usuário autenticado |
| `GET` | `/api/v1/notifications/unread-count` | `{ count }` para badge (fallback) |
| `GET` | `/api/v1/notifications/stream` | **SSE** — push em tempo real (unread-count inicial + notification events) |
| `PATCH` | `/api/v1/notifications/:id/read` | Marca como lida |
| `POST` | `/api/v1/notifications/read-all` | Marca todas como lidas |

**Frontend:** `<NotificationBell />` no header tenta `EventSource` para `/stream`; reconexão automática em 5 s. Após 3 falhas consecutivas (ex.: sem Redis / Vercel), degrada para **polling** de `unread-count` a cada 30 s. Lista no painel com scroll infinito (cursor pagination) e deep link via `metadata`.

### 7.5 BullMQ + Redis (opcional — ativado por `REDIS_URL`)

O processamento assíncrono utiliza **BullMQ + Redis** para notificações quando `REDIS_URL` está configurada. Sem ela, notificações são persistidas de forma síncrona (ver §7.7). A arquitetura está pronta para novas filas conforme o produto crescer.

**Stack:**

- **Redis 7** (docker-compose) como broker
- **BullMQ** (`npm bullmq` + `ioredis`) para filas, retries e agendamento
- **Worker** inicializado via `src/instrumentation.ts` (Next.js `register()`)
- **Redis pub/sub** para broadcast SSE em tempo real

**Infra atual (`src/infrastructure/queue/`):**

| Arquivo | Responsabilidade |
|---------|-----------------|
| `redis-connection.ts` | Conexão singleton IORedis; `isRedisEnabled()` + retorno `null` quando sem `REDIS_URL` |
| `notification-queue.ts` | Fila `notifications` com retry exponencial |
| `notification-job-types.ts` | Tipagem do payload do job |
| `notification-worker.ts` | Worker: `createMany` + pub/sub SSE |

**Fila ativa:**

- `notifications` — 3 attempts, exponential backoff 2 s, concurrency 5

**Filas futuras (quando necessário):**

- `sla-check` — verificação periódica de SLA com cron
- `reports-export` — exportações pesadas / PDF
- `maintenance` — reconciliação e limpeza de dados

**Princípios obrigatórios:**

1. **Idempotência** no handler do job
2. **Deduplicação** com `jobId` derivado do contexto (`tenantId`, entidade, evento)
3. **Port + adapter**: caso de uso não conhece BullMQ diretamente
4. **Persistência de negócio fora da fila**: eventos relevantes continuam no Postgres (`StageTransition`, `Notification`)
5. **Retry controlado**: falha externa não vira erro síncrono do request

**Modelo operacional:**

- `attempts` + `exponential backoff`
- filas separadas por throughput e criticidade
- `removeOnComplete` / `removeOnFail` com limite para não lotar Redis
- logs com `tenantId`, `jobName`, `jobId`

### 7.6 Segurança e resiliência (implementado)

Camada de proteção transversal em `src/lib/api/` e `src/infrastructure/queue/`, usando Redis como backing store. Todas as primitivas degradam graciosamente quando Redis não está disponível (ver §7.7): rate limit e locks fazem **fail-open**, SSE retorna 501 e o frontend faz polling.

#### Rate limiting (`src/lib/api/rate-limit.ts`)

Limita requisições por janela de tempo via `INCR` + `EXPIRE` no Redis. Três presets:

| Preset | Limite | Identificador | Onde se aplica |
|--------|--------|---------------|----------------|
| `auth` | 5/min | IP do cliente | `forgot-password`, `reset-password` |
| `api` | 120/min | `userId` (sessão) | Todas as rotas autenticadas (via `requireSessionOr401`) |
| `sse` | 3 conexões | `userId` | SSE `/notifications/stream` |

Resposta 429 inclui `Retry-After` e `X-RateLimit-*`. Falha no Redis = **allow** (fail-open; sem bloquear request legítimo).

#### Limite de conexões SSE (`/api/v1/notifications/stream`)

Counter Redis `sse:conn:{userId}` com TTL — no máximo 3 conexões SSE simultâneas por usuário. Cada conexão incrementa ao abrir e decrementa ao fechar (via `cancel()` da `ReadableStream`). Impede exaustão de subscribers Redis por abas abertas em excesso.

#### Lock distribuído (`src/lib/api/distributed-lock.ts`)

`SET NX EX` no Redis para operações que não devem ser concorrentes:

| Operação | Key | TTL | Efeito |
|----------|-----|-----|--------|
| Transição de etapa | `lock:transition:{patientPathwayId}` | 10 s | 409 se já em progresso |
| SLA check throttle | `sla-check:{pathwayId}:{versionId}` | 60 s | Skip se já rodou neste minuto |

#### Teto em queries pesadas

`findMany` de dashboard-summary, dashboard-alerts e reports/summary usam `take: 5000` para limitar materialização em memória. Impede que um tenant com volume muito alto derrube a performance do request.

#### Conexões Redis separadas

| Slot | Uso | Motivo |
|------|-----|--------|
| `default` | Queue producers, rate limit, locks, counters | Comandos não-bloqueantes |
| `worker` | Worker BullMQ | Comandos bloqueantes (`BRPOPLPUSH`) — conexão dedicada evita contenção |
| subscriber (por-SSE) | `SUBSCRIBE` no pub/sub | Cada SSE cria a própria; não compartilha com pool |

#### Redis hardening (docker-compose)

```
maxmemory 256mb
maxmemory-policy allkeys-lru
maxclients 1000
save 60 100
appendonly yes
```

#### Tratamento de erros nas emissões

Todas as chamadas a `notificationEmitter.emit()` usam `.catch(err => console.error(...))` em vez de `void` — erros na fila são logados sem rejeição silenciosa.

#### Autenticação e isolamento multi-tenant

- **Todas** as rotas API (exceto `health`, `forgot-password`, `reset-password`) exigem sessão JWT via `requireSessionOr401`.
- `tenantId` **nunca** aceito do body — derivado do JWT + membership via `getActiveTenantIdOr400`.
- `super_admin` acessa contexto de qualquer tenant via `POST /auth/context`, mas todo acesso passa por `activeTenantId` na sessão.
- Validação Zod em todos os bodies de POST/PATCH; queries paginadas validadas com limites explícitos.

### 7.7 Modos de deploy — Redis opcional

A aplicação suporta dois modos de operação controlados pela presença (ou ausência) da variável `REDIS_URL`:

| | Modo **queue** (com Redis) | Modo **inline** (sem Redis) |
|--|---|---|
| **Ativação** | `REDIS_URL` definida | `REDIS_URL` vazia ou não definida |
| **Notificações** | Job BullMQ → Worker → Prisma → Redis pub/sub SSE | Escrita direta no Prisma (síncrona) |
| **Tempo real (SSE)** | `/notifications/stream` funcional via pub/sub | Endpoint retorna `501`; frontend faz **polling** automático a cada 30 s |
| **Rate limiting** | Redis `INCR`/`EXPIRE` | **Desativado** (fail-open) |
| **Locks distribuídos** | `SET NX EX` no Redis | **Desativado** (sempre concede) |
| **Worker BullMQ** | Iniciado via `instrumentation.ts` | **Não inicia** |
| **Ideal para** | Docker local, VPS, servidor dedicado | **Vercel**, serverless, protótipo rápido |

**Como funciona internamente:**

- `isRedisEnabled()` (`src/infrastructure/queue/redis-connection.ts`) checa `process.env.REDIS_URL`.
- `getRedisConnection()` / `getWorkerRedisConnection()` / `createSubscriberConnection()` retornam `null` quando Redis não está habilitado.
- `notificationEmitter.emit()` decide entre `emitViaQueue` (BullMQ) e `emitInline` (Prisma direto) com base em `isRedisEnabled()`.
- `rateLimit()` e `tryAcquire()` retornam **allow** / **true** quando o Redis não está disponível.
- O hook `useNotifications` tenta SSE; após 3 falhas consecutivas, degrada automaticamente para polling via `GET /notifications/unread-count`.
- `instrumentation.ts` só importa e inicia o worker quando `REDIS_URL` existe.

**Deploy na Vercel (sem Redis):**

1. Não definir `REDIS_URL` nas environment variables.
2. `vercel.json` já configurado com framework `nextjs`.
3. `postinstall` executa `prisma generate` automaticamente.
4. Todas as features funcionam — sem tempo real (SSE) e sem proteções Redis, mas com notificações persistidas e polling.

**Deploy local / VPS (com Redis):**

1. `docker-compose up` sobe Postgres + Redis.
2. Definir `REDIS_URL=redis://localhost:6379` no `.env`.
3. BullMQ worker inicia automaticamente; SSE, rate limiting e locks ativos.

---

## 8. Modelo de dados e impacto no código (decisão arquitetural)

Esta secção fixa **como** o produto se materializa em **PostgreSQL/Prisma** e nas **camadas** da aplicação. É o contraponto entre um motor genérico tipo n8n e a **jornada clínica** que adotamos no MVP.

### 8.1 Resumo do modelo atual

- **`CarePathway`**: jornada clínica por tenant; um tenant pode ter várias.
- **`PathwayVersion`**: snapshot versionado do editor (`graphJson`) com flag `published`.
- **`PathwayStage`**: etapa materializada para consultas, timeline, SLA e transição.
- **`PathwayStageChecklistItem`**: checklist operacional materializado por etapa publicada.
- **`StageDocument`**: vínculo ordenado entre etapa e `FileAsset`; representa o pacote integral da etapa.
- **`PatientPathway`**: estado do paciente na jornada (`pathwayId`, `pathwayVersionId`, `currentStageId`, `enteredStageAt`).
- **`PatientPathwayChecklistItem`**: progresso do checklist por paciente na etapa/versionamento atual.
- **`PatientNote`**: nota clínica/operacional dedicada do paciente, com autor e histórico.
- **`StageTransition`**: histórico da mudança de etapa + `dispatchStub` com snapshot do bundle; campos de override de checklist (`ruleOverrideReason`, `forcedByUserId`) quando a transição força conclusão incompleta.
- **`AuditEvent`**: eventos de linha do tempo (`tenantId`, **`clientId?`** — ausente em alguns eventos só de staff/plataforma, ex. login no painel —, `patientPathwayId?`, `actorUserId?`, `type`, `payload` Json, `createdAt`). Inclui transição de etapa, arquivos, cadastro público, portal (`PATIENT_PORTAL_*`), CRUD de paciente, downloads, checklist, sessão do portal, consentimento (`PATIENT_CONSENT_GIVEN` com `consentType` + `version`), exportação de auditoria (`AUDIT_EXPORT_GENERATED`), etc. **LGPD:** `payload` com IDs e metadados mínimos — sem duplicar texto clínico.

O **núcleo já implementado** é: **jornada + versão + etapas + checklist/documentos por etapa + paciente na jornada + notas dedicadas + transição + auditoria de timeline + notificações in-app + `ChannelDispatch` (WhatsApp Business Cloud API)**. `AiJob` continua como evolução futura.
- **`Notification`**: notificação in-app persistida por usuário (`tenantId`, `userId`, `type`, `title`, `body?`, `metadata` Json, `readAt?`). Tipos: `sla_critical`, `sla_warning`, `stage_transition`, `new_patient`, `checklist_complete`. Ver §7.4.
- **`FeedbackReport`**: relato enviado via widget de feedback da aplicação (`tenantId`, `authorUserId?` — nulo se o autor for removido —, `type` bug/suggestion/question/other, `status` open/triaged/in_progress/resolved/wont_fix/duplicate, `message`, `pagePath` — apenas pathname —, `locale`, `adminNote?`). Quando originado de um erro capturado, carrega `sentryEventId` para correlacionar com o evento no Sentry.

### 8.2 Tabelas e relacionamentos (núcleo)

| Modelo | Campos-chave | Observação |
|--------|--------------|------------|
| `Tenant` | `id`, `name`, `slug`, `taxId?`, `phone?`, `addressLine?`, `city?`, `postalCode?`, `affiliatedHospitals?`, flags `notify*` | Tenant/clínica: contexto principal de isolamento, dados institucionais leves e preferências operacionais simples. |
| `CarePathway` | `id`, `tenantId`, `name`, `description?`, `createdAt` | **Múltiplos** por tenant. |
| `PathwayVersion` | `id`, `pathwayId`, `version`, `published`, `graphJson`, `createdAt` | Canvas **@xyflow/react** persistido; ao publicar, **sincronizar** `PathwayStage` com os nodes de etapa. |
| `PathwayStage` | `id`, `pathwayVersionId`, `stageKey`, `name`, `sortOrder`, `patientMessage?`, flags SLA | Materialização para queries, FKs, `StageDocument` e checklist. |
| `PathwayStageChecklistItem` | `id`, `pathwayStageId`, `label`, `sortOrder` | Checklist operacional da etapa publicada; nasce do `graphJson` ao publicar. |
| `StageDocument` | `id`, `pathwayStageId`, `fileAssetId`, `sortOrder` | **N:N** etapa ↔ `FileAsset` (GCS); **pacote integral** ao WhatsApp. |

**Índices atuais/recomendados:** `PathwayStage(pathwayVersionId, stageKey)` único, `PathwayStage(pathwayVersionId, sortOrder)`, `PathwayStageChecklistItem(pathwayStageId, sortOrder)`, `StageDocument(pathwayStageId, sortOrder)` e `StageDocument(pathwayStageId, fileAssetId)` único.

| Modelo | Campos-chave | Observação |
|--------|--------------|------------|
| `Client` | `tenantId`, `name`, `phone`, `documentId?`, `email?`, endereço (`postalCode?`, …, `state?`), `isMinor` (default false), `guardianName?`, `guardianDocumentId?`, `guardianPhone?`, `assignedToUserId?`, `opmeSupplierId?`, **`portalPasswordHash?`** (bcrypt; null = sem senha no portal), **`portalPasswordChangedAt?`** (alinha com `pwdv` no cookie da sessão do portal; troca de senha invalida sessões antigas) | Ficha base do paciente no tenant. Coluna `email` nullable no BD; **`POST /api/v1/clients` e auto-cadastro público exigem e-mail** (validação). Com `isMinor`, CPF do paciente pode ser nulo; responsável obrigatório na validação de API ao marcar menor. Auto-cadastro público grava senha do portal em `portalPasswordHash`. |
| `PatientPathway` | `tenantId`, `clientId`, **`pathwayId`**, `pathwayVersionId`, **`currentStageId`** → `PathwayStage`, `enteredStageAt`, `createdAt` | **Qual fluxo** o paciente segue. **UX:** ao criar, se o tenant tiver **um** fluxo publicado, preencher `pathwayId` automaticamente; se **vários**, exigir escolha na UI antes de persistir. |
| `PatientPathwayChecklistItem` | `patientPathwayId`, `checklistItemId`, `completedAt?`, `completedByUserId?` | Progresso por paciente; update permitido só para item da etapa atual. |
| `PatientNote` | `tenantId`, `clientId`, `authorUserId`, `content`, `createdAt` | Histórico dedicado de anotações clínicas/operacionais do paciente. |

**Regras:** `currentStageId` pertence ao `pathwayVersionId` ativo; `pathwayId` coerente com a versão.

| Modelo | Campos-chave | Observação |
|--------|--------------|------------|
| `StageTransition` | `patientPathwayId`, `fromStageId?`, `toStageId`, `actorUserId`, `note?`, `ruleOverrideReason?`, `forcedByUserId?`, `dispatchStub`, `createdAt` | Histórico; `dispatchStub.correlationId` amarra o snapshot do bundle. |
| `AuditEvent` | `tenantId`, `clientId?`, `patientPathwayId?`, `actorUserId?`, `type` (enum), `payload` Json, `createdAt` | Linha do tempo unificada na ficha quando há `clientId`; índice `(tenantId, clientId, createdAt)`. Escrita via `recordAuditEvent` (infra). Eventos sem `clientId` não aparecem na timeline do paciente. |
| `ChannelDispatch` | Implementado | Registro de envio por canal externo (WhatsApp). Status: QUEUED → SENT → DELIVERED → READ → CONFIRMED / FAILED. Detalhe de **quando dispara**, **botões de confirmação** e **eventos de auditoria**: [integrations/whatsapp-dispatch-events.md](./integrations/whatsapp-dispatch-events.md). |

| Modelo | Observação |
|--------|------------|
| `FileAsset` | `tenantId`, `r2Key`, `mimeType`, `sizeBytes`, `sha256Hash?` (hex do objeto no GCS após upload, para integridade), `clientId?`, `uploadedById?` (null se envio pelo portal), `patientPortalReviewStatus` (`NOT_APPLICABLE` / `PENDING` / `APPROVED` / `REJECTED`); upload na biblioteca **não** dispara WhatsApp sozinho. |
| `OpmeSupplier` | Catálogo por tenant para relacionamento opcional em `Client`. |
| `AiJob` | Futuro | Evolução para integração assíncrona com IA. |
| `FeedbackReport` | `tenantId`, `authorUserId?`, `type` (bug/suggestion/question/other), `status` (open/triaged/in_progress/resolved/wont_fix/duplicate), `message`, `sentryEventId?`, `pagePath`, `adminNote?` | Relato do widget de feedback; `sentryEventId?` correlaciona com o evento no Sentry quando originado de um erro. |

| Modelo | Campos-chave | Observação |
|--------|--------------|------------|
| `Conversation` | `tenantId`, `channel` (whatsapp/instagram), `externalId`, `displayName`, `clientId?`, `status` (etapa: new/in_progress/qualified/discarded — `waiting_contact` existe no enum mas não é usada na tela de Conversas), `stageChangedAt`, `assignedToUserId?`, `lastMessageAt?`, `unreadCount` | Conversa de canal; vira `Client` via conversão explícita. `stageChangedAt` alimenta o "(N dias)" da UI. |
| `Message` | `conversationId`, `direction` (inbound/outbound), `type`, `body?`, `status` (sent/delivered/read/failed), `actorUserId?`, `createdAt` | Mensagem individual; envio outbound real via `IWhatsAppOutbound` (Cloud API), com persistência sempre, mesmo se o disparo externo falhar (`status: failed`). |
| `QuickPhrase` | `tenantId`, `slug` (único por tenant), `title`, `body`, `attachment?`, `createdById`, `usageCount` | Frases prontas ("/atalho") do composer, compartilhadas por toda a equipe do tenant. |
| `LeadNote` | `tenantId`, `conversationId`, `clientId?`, `authorId`, `text`, `color` (amber/sky/emerald/violet), `pinned`, `editedAt?` | Nota interna sobre o lead/conversa — nunca enviada ao contato; pode ser fixada no topo do chat. |
| `AgendaEvent` | `tenantId`, `conversationId?`, `clientId?`, `title`, `type` (consulta/retorno/exame/ligacao), `startsAt`, `durationMin`, `ownerUserId`, `notes?` | Compromisso da tela `/dashboard/agenda`; criado via `/agendar` no chat ou diretamente na Agenda. |

Auth/plataforma (`User.globalRole`, `TenantMembership`, `UserAuthToken`, …) permanece como já descrito nas secções anteriores. **Auditoria de ficha:** `AuditEvent` (não confundir com um “audit log” genérico de plataforma).

### 8.3 Consultas que o modelo precisa suportar

1. **Payload WhatsApp ao mover etapa:** `StageDocument` ⋈ `FileAsset` filtrando `pathwayStageId = toStageId`, `ORDER BY sortOrder`; hoje o snapshot fica em `dispatchStub`, e URLs assinadas são geradas sob demanda.  
2. **Pacientes “na etapa X”:** `PatientPathway` com `currentStageId` nas etapas de ordem desejada.  
3. **Ficha / linha do tempo:** `GET /api/v1/clients/:id/timeline` agrega `AuditEvent` (ordenado) com `StageTransition` legado **deduplicado** quando o audit já referencia o mesmo `transitionId` no `payload`. Há teto de janela no merge; resposta inclui `timelineCapped` quando aplicável. **Exportação CSV (auditoria/perícia):** `GET /api/v1/clients/:id/audit-export` — `tenant_admin` ou `super_admin`, janela opcional (máx. 730 dias), gera `AUDIT_EXPORT_GENERATED`. `ChannelDispatch` / `AiJob` entram depois como fontes adicionais.
4. **Checklist da etapa atual:** `PathwayStageChecklistItem` + `PatientPathwayChecklistItem` filtrando a etapa atual do paciente.

### 8.4 Impacto no código (camadas)

| Camada | O que entra |
|--------|-------------|
| **`src/domain` / `src/application`** | Direção desejada: regras de pathway, bundle documental, transição e dispatch desacopladas de rotas. |
| **`src/infrastructure`** | Prisma, GCS/presign e futuros clientes externos de WhatsApp/IA. |
| **`app/api/v1`** | Hoje concentra parte da orquestração: `clients` (incl. `clients/:id/timeline`), `pathways`, `patient-pathways`, `stage-documents`, `files`. |
| **Frontend** | Editor **@xyflow/react**, dashboard, lista/ficha do paciente e modal de transição com preview do pacote. |

Eventos de domínio (opcional): após `TransitionPatientStage`, worker assíncrono só para IA — desacopla HTTP.

### 8.5 O que não é obrigatório no MVP

- Motor **n8n** genérico (`WorkflowDefinition` arbitrário) além do fluxo clínico com **XYFlow + stages**.
- Ramificações complexas no grafo: o MVP pode restringir a **topologia linear** no canvas (uma “linha” de etapas) e evoluir depois.

### 8.6 Evolução natural

1. Consolidar a lógica hoje espalhada em `app/api/v1` em casos de uso dedicados.  
2. ~~Introduzir `ChannelDispatch` e cliente HTTP real do canal.~~ **Implementado** — WhatsApp Business Cloud API via `ChannelDispatch`.  
3. Introduzir `AiJob` + webhooks.  
4. Evoluir notas e regras de topologia do fluxo.  
5. Ampliar `AuditEvent` (ex. assinaturas, dispatch real). **RBAC fino** na leitura (lista/ficha/Kanban/notificações) está em `src/application/use-cases/shared/load-client-visibility-scope.ts` — ver Fase 7 em `docs/submanager/meeting-presentation-action-plan.md`.  

### 8.7 Resumo

| Camada | Mudança principal |
|--------|-------------------|
| **BD** | Núcleo atual: **pathway / version / stage / stage_checklist_item / stage_document** + **patient_pathway / patient_pathway_checklist_item / patient_note** + **stage_transition** + **audit_event** + **file_asset** + extensões de cliente (`email`, responsável, OPME). |
| **Código** | Orquestração centrada em **transição de etapa** e **bundle de documentos**, ainda parcialmente nas rotas. |
| **Front** | Editor **XYFlow**, dashboard, lista e ficha do paciente; integração de canal/IA ainda evolutiva. |

---

## 9. Armazenamento (Google Cloud Storage)

| Aspecto | Prática recomendada |
|---------|---------------------|
| Bucket | Um bucket; isolamento por **prefixo** `tenants/{tenantId}/...` |
| Upload | URL assinada (v4) para upload direto do browser (`PUT`) **ou** `POST` multipart para API que grava no bucket |
| Metadados | Tabela `FileAsset`: `tenantId`, `clientId` opcional, `r2Key` (chave do objeto no GCS), `mimeType`, `sizeBytes`, `sha256Hash?` (hex após upload), `createdAt`. Listagens `GET …/clients/:id/files` e `GET …/patient/files` expõem `sha256Hash` para integridade. |
| Exclusão | Política de lifecycle ou job de limpeza ao apagar entidade dona do arquivo |

Variáveis de ambiente típicas: `GCS_BUCKET_NAME`, credenciais (`GCS_SERVICE_ACCOUNT_JSON` ou `GOOGLE_APPLICATION_CREDENTIALS`), opcional `GCS_PROJECT_ID`, `GCS_PUBLIC_BASE_URL`. CORS no bucket para origens do app (PUT/GET/HEAD).

---

## 10. API — visão de endpoints

Prefixo: `/api/v1`.

| Área | Métodos | Estado atual |
|------|---------|--------------|
| Auth | `POST` | Contexto de tenant, forgot/reset password e endpoints de autenticação já existem em `/api/v1/auth/*`. |
| Me | `GET`, `PATCH`, `DELETE` | Perfil do usuário autenticado (`/api/v1/me`, `/api/v1/me/password`). |
| Admin / tenants | `GET`, `POST` | Gestão global em `/api/v1/admin/tenants`; membros por tenant em `/api/v1/admin/tenants/:tenantId/members`. |
| Tenants | `GET` | `/api/v1/tenants` lista tenants acessíveis ao usuário. |
| Clients | `GET`, `POST`, `PATCH`, `DELETE` | `/api/v1/clients`, `/api/v1/clients/:id` (detalhe rico); **linha do tempo** `GET /api/v1/clients/:id/timeline` (audit + transições legado); **exportação CSV** `GET /api/v1/clients/:id/audit-export` (admin); notas `…/notes`; arquivos `…/files`. |
| Patient pathways | `GET`, `POST` | `/api/v1/patient-pathways` lista/inicia jornada; detalhe em `/api/v1/patient-pathways/:id`; transição em `POST /api/v1/patient-pathways/:id/transition`. |
| Pathways | `GET`, `POST`, `PATCH` | `/api/v1/pathways`, `/api/v1/pathways/:id`, `/versions`, `PATCH /versions/:versionId`, `POST /publish`, `GET /published-stages`, `GET /kanban`, `GET /dashboard-summary`, `GET /dashboard-alerts`. |
| Stage documents | `POST` | `/api/v1/stage-documents` vincula `FileAsset` a etapa publicada. |
| Tenant members (picker) | `GET` | `/api/v1/tenant/members` lista membros do tenant ativo para pickers operacionais. |
| OPME suppliers | `GET`, `POST` | `/api/v1/opme-suppliers` lista/cria fornecedores do tenant. |
| Files / storage | `POST` | `/api/v1/files/presign`, `/api/v1/files`, `/api/v1/files/presign-download`. |
| Notifications | `GET`, `PATCH`, `POST` | `/api/v1/notifications` (lista cursor), `/api/v1/notifications/unread-count`, `/api/v1/notifications/stream` (SSE), `PATCH .../notifications/:id/read`, `POST .../notifications/read-all`. |
| Patient portal | `GET`, `POST`, `PATCH` | Público: `POST /api/v1/public/patient-portal/exchange` (magic link → cookie `patient_portal_session`). Paciente: `GET/POST /api/v1/patient/files`, `POST .../files/presign`, `POST .../files/presign-download`, `GET /api/v1/patient/overview`, `GET /api/v1/patient/timeline` (LGPD: payload sanitizado), `POST /api/v1/patient/logout`. Staff: `POST /api/v1/clients/:clientId/portal-link`; `PATCH /api/v1/clients/:clientId/files/:fileId/review` (fila `PENDING` → `APPROVED`/`REJECTED`). UI `/patient`, `/patient/enter`. |
| Health | `GET` | `/api/v1/health`. |

### 10.0 Evoluções previstas

- RBAC fino (assignee + OPME em `TenantMembership`) aplicado nas rotas principais; UI dedicada para flags do membro e **CareTeam** podem evoluir (plano Fase 7).
- ~~`ChannelDispatch` dedicado e endpoints/contratos de dispatch reais.~~ **Implementado.**
- `AiJob` e webhooks de IA.
- Webhooks do chatbot / WhatsApp.
- Eventual camada de workflow genérico, se a jornada clínica deixar de ser suficiente.

### 10.1 Documentação interativa (Scalar + OpenAPI)

- **Spec:** `public/openapi.json` (OpenAPI 3.x) — paths sob `/api/v1`, `components.schemas` alinhados aos DTOs em `src/types/`.
- **UI:** [Scalar](https://scalar.com/) via pacote **`@scalar/nextjs-api-reference`**; página dedicada (ex.: `/api-doc`) carrega o spec e habilita **Try it**.
- **Segurança no doc:** `securitySchemes` com **Bearer** (JWT); operações protegidas referenciam esse scheme.
- Manutenção obrigatória: **cada mudança de contrato** na API deve atualizar o `openapi.json`.
- Detalhes de setup e checklist: **[API-DOCS.md](./API-DOCS.md)**.

---

## 11. Frontend (dashboard)

| Tema | Decisão |
|------|---------|
| Layout | Sidebar + área de conteúdo; tema claro/escuro via shadcn |
| Dados | TanStack Query (recomendado) + Axios para cache e estados de loading/erro |
| Fluxos | Canvas React Flow; painel lateral para propriedades do node selecionado |
| Gráficos | Cards com KPIs por tenant; filtros por período |
| Super admin | Página `/admin/tenants` (ou rota equivalente); **Tenant switcher** na barra superior (busca, recentes, pins); banner quando `actingAsSuperAdmin` |
| Resolução de host | Middleware Next.js: se hostname = `*.idoctor.app`, resolver slug → `tenantId` e alinhar com token/context |

---

## 12. Segurança — checklist

- [ ] Senhas com bcrypt (custo adequado).
- [ ] Rate limit em login e refresh (middleware ou edge).
- [ ] CORS restrito a origens conhecidas em produção.
- [ ] Validação de entrada em todos os bodies (Zod).
- [ ] Nunca confiar em `tenantId` vindo só do cliente; derivar do token + membership **ou** de `super_admin` validado no servidor.
- [ ] Ações do super admin em tenant: **audit log** (quem, quando, qual tenant, qual ação).
- [ ] Rotas `/api/v1/admin/*` recusam usuários sem `globalRole === super_admin`.
- [ ] URLs assinadas com expiração curta para upload/download.

---

## 13. Roadmap de implementação sugerido

1. Monorepo Next + `packages/prisma`: `Tenant`, `User` (com `globalRole`), `TenantMembership` (com `tenant_admin` / `tenant_user`), `RefreshToken`.
2. Auth `/api/v1/auth/*`, `/api/v1/auth/context` + guards de super admin + middleware (host + dashboard).
3. CRUD `Client` com isolamento por tenant.
4. Integração GCS + entidade de metadados de arquivo.
5. **Jornada:** `CarePathway` → `PathwayVersion` → `PathwayStage` + `StageDocument`; UI editor (lista de etapas + docs).
6. **Paciente na jornada:** `PatientPathway` + `POST …/transition` + `StageTransition` + `dispatchStub` + `ChannelDispatch` (WhatsApp Business Cloud API, com botões interativos de confirmação e webhook de callback).
7. `AiJob` + webhook IA; opcional: `WorkflowDefinition` + React Flow se precisar de ramificações.
8. Formulários dinâmicos (se necessário) e dashboard analítico (gráficos).

---

## 14. Referência externa de projeto

A base de organização (pastas, Prisma em pacote, JWT, armazenamento de objetos, rotas `v1`) segue o repositório local **kaber.ai** (`…/kaber.ai`). Adaptações principais: **multi-tenant**, **RBAC**, **jornada clínica** (pathway/stage/paciente/transição/dispatch), **integrações IA e WhatsApp**, **subdomínios**.

---

*Última atualização: §8 inclui `AuditEvent`, linha do tempo na API e override de checklist em `StageTransition`.*
