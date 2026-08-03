# CLAUDE.md — SubManager

Instruções obrigatórias para Claude Code neste repositório.

## O que é o SubManager

SaaS multi-tenant de orquestração de jornadas clínicas (cirurgia bucomaxilofacial). Painel para clínicas gerenciarem pacientes, fluxos de etapas, documentos, checklists, notificações e integrações com WhatsApp/IA.

## Stack

- **Runtime:** Node.js, Next.js 16.x (App Router), React 19, TypeScript (strict)
- **DB:** PostgreSQL 16 + Prisma ORM 6.x (schema em `packages/prisma/schema.prisma`)
- **Storage:** Google Cloud Storage (presign v4, tenant-scoped keys)
- **Queue/Realtime:** BullMQ + Redis 7 (opcional — fallback inline Prisma)
- **Auth:** NextAuth v4 (JWT strategy, CredentialsProvider)
- **UI:** Tailwind CSS 4, shadcn/ui, @xyflow/react (editor de fluxos), react-hook-form + Zod
- **HTTP Client:** Axios via `apiClient` (`src/lib/api/http-client.ts`)
- **State:** Zustand (client), React Query (server state)
- **i18n:** next-intl (pt-BR / en)
- **E-mail:** Resend API (plataforma) e/ou **SMTP por tenant** (Gmail, Microsoft 365, etc.; prioridade no remetente)
- **Infra local:** Docker Compose (PostgreSQL 16 + Redis 7)

## Documentação obrigatória

| Documento | O que contém |
|-----------|-------------|
| `docs/ARCHITECTURE.md` | Arquitetura, modelo de dados (§8), auth, RBAC, subdomínios, notificações |
| `docs/PRODUCT-SCOPE.md` | Escopo de produto, jornada do paciente, fases |
| `docs/submanager/business-logic.md` | Regras de negócio consolidadas |
| `docs/DEV-PHASES.md` | Fases de implementação e status |
| `docs/API-DOCS.md` | Documentação API (Scalar + OpenAPI) |

**Antes de modelar entidades novas**, conferir §8 da ARCHITECTURE.md.

## Arquitetura (Clean Architecture)

```
domain/         → entidades, value objects, erros (zero deps externas)
application/    → use cases, ports (interfaces)
infrastructure/ → Prisma repos, GCS, HTTP clients, BullMQ, notifications
app/            → Route Handlers (API), pages (UI), adapters
features/       → módulos por domínio (components, hooks, pages, services, types)
shared/         → UI compartilhada (shadcn), layouts, providers, stores, hooks
lib/            → utils, auth guards, API helpers, validators, constants
types/          → DTOs compartilhados, contratos API (src/types/api/*.ts)
packages/prisma → schema, migrations, seed
```

### Direção de dependências
`domain` ← `application` ← `infrastructure` ← `app/features`

**domain/** não importa Prisma, Next.js, React, fetch, nem nada de infra.

## Multi-tenant

- Todo registro de negócio tem `tenantId`.
- Queries **sempre** filtram por `tenantId` do contexto autenticado.
- **Nunca** aceitar `tenantId` do body/query como verdade — derivar do JWT + `TenantMembership`.
- `super_admin` pode atuar cross-tenant com regra explícita e auditoria (§5.5 da arquitetura).
- `TenantMembership.restrictedToAssignedOnly` — `tenant_user` só vê pacientes atribuídos a si.
- `TenantMembership.linkedOpmeSupplierId` — `tenant_user` só vê pacientes daquele fornecedor OPME.
- Lógica de visibilidade em `src/lib/auth/client-visibility.ts`.

## RBAC

- `User.globalRole`: `super_admin` | `user`
- `TenantMembership.role`: `tenant_admin` | `tenant_user`
- Guards em `src/lib/auth/guards.ts`:
  - `requireSessionOr401()` → valida sessão + rate limit
  - `getActiveTenantIdOr400()` → resolve tenant do token
  - `assertActiveTenantMembership()` → confirma membership
  - `superAdminOr403()` → exige super_admin
  - `assertTenantAdminOrSuper()` → tenant_admin ou super_admin

## Padrões de API

### Envelope de resposta
```typescript
{ success: true,  data: T,     meta: { timestamp } }  // sucesso
{ success: false, error: { code, message, details? }, meta }  // erro
```

Helpers: `jsonSuccess(data, init?)` e `jsonError(code, message, status, details?)` em `src/lib/api-response.ts`.

### Fluxo de um route handler
1. `requireSessionOr401(request)` → session
2. `getActiveTenantIdOr400(session, request)` → tenantId
3. `assertActiveTenantMembership(session, tenantId, request)` → permissão
4. Parse body com `safeParse` (Zod schema de `src/lib/validators/`)
5. Chamar use case ou query Prisma com `tenantId`
6. `jsonSuccess(data)` ou `jsonError(code, msg, status)`

### Validação
- Schemas Zod em `src/lib/validators/<domínio>.ts`
- Tipos inferidos com `z.infer<typeof schema>`
- Erros traduzidos via `ApiT` (i18n)

### Paginação
- `buildPagination(page, limit, totalItems)` em `src/lib/api/pagination.ts`
- Retorna `{ data[], pagination: ApiPagination }`

## Padrões de frontend

### Estrutura de feature
```
src/features/<nome>/app/
  components/    → componentes React da feature
  hooks/         → hooks customizados
  pages/         → páginas compostas (importadas pela page.tsx da rota)
  services/      → funções HTTP (apiClient) — sem tipos inline
  types/         → tipos exclusivos da feature
  utils/         → schemas Zod, helpers
```

### Páginas Next.js (App Router)
`src/app/<rota>/page.tsx` deve ser **fina**: só importa a página de `features/.../pages/` e exporta.

### Services
- Apenas chamadas HTTP via `apiClient` (`src/lib/api/http-client.ts`)
- Tipos de request/response importados de `src/types/api/<domínio>-v1.ts`
- Interceptor de erro global com `toast.error` — não duplicar no catch

### Componentes compartilhados
- UI (shadcn): `@/shared/components/ui/`
- Forms (RHF): `@/shared/components/forms/`
- Layouts: `@/shared/components/layout/` (AppShell, DashboardPage, AuthLayout)
- Modal padrão: `StandardDialogContent` em `@/shared/components/ui/dialog`
- Debounce: `useDebouncedState` / `useDebouncedCallback` em `src/shared/hooks/use-debounce.ts`

## Organização de tipos

- **`src/types/api/<domínio>-v1.ts`** — DTOs de API (request/response)
- **`src/types/`** — contratos compartilhados por domínio
- **`src/features/<nome>/app/types/`** — tipos exclusivos da feature (com barrel `api.ts` reexportando de `@/types/api/`)
- **Proibido:** declarar `interface`/`type` soltos em `route.ts`, `page.tsx` ou componentes (exceto estado realmente local)

## Domínio: jornada clínica

### Vocabulário
- `CarePathway` → fluxo de cuidado do tenant (vários por tenant)
- `PathwayVersion` → versão do fluxo com `graphJson` (@xyflow/react)
- `PathwayStage` → etapa materializada da versão
- `StageDocument` → documento vinculado à etapa
- `PatientPathway` → instância da jornada do paciente
- `StageTransition` → registro histórico de mudança de etapa
- `App` → integração do marketplace (catálogo global, `super_admin` gerencia)
- `TenantApp` → ativação de app por tenant (status, config encriptada, billing)
- `PatientPortalLinkToken` → magic link para acesso do paciente
- `PatientPortalOtpChallenge` → autenticação OTP do portal do paciente
- `PatientSelfRegisterInvite` → link QR para auto-cadastro do paciente
- `PatientNote` → nota clínica/operacional por paciente
- `OpmeSupplier` → fornecedor OPME vinculado a pacientes

### Ordem operacional
1. Cadastrar `Client` (paciente)
2. Escolher/iniciar `PatientPathway` (auto se 1 fluxo publicado)
3. Transicionar etapas (`StageTransition`)

### Transição de etapa
Pipeline: auth → load PatientPathway → validar toStageId no mesmo pathwayVersionId → checklist → lock distribuído → persist StageTransition → update currentStageId → build document bundle → dispatch WhatsApp → notify → audit event

## LGPD

- Minimizar logs com CPF, telefone, conteúdo clínico — usar IDs internos.
- Arquivos no GCS com prefixo por tenant; URLs assinadas com TTL curto.
- AuditEvent sem payload clínico (LGPD compliance).

## Comandos úteis

```bash
npm run dev              # dev server (localhost:3000)
npm run build            # build de produção
npm run db:migrate       # rodar migrations Prisma
npm run db:seed          # seed de desenvolvimento
npm run db:studio        # Prisma Studio
npm run lint             # ESLint
npx tsc --noEmit         # type check
docker compose up -d     # PostgreSQL 16 + Redis 7 local
npm run test:e2e         # Playwright E2E
npm run stress:all       # Load + security battery
```

## Testes

- **E2E:** Playwright (`e2e/`, `playwright.config.ts`) — `npm run test:e2e`
- **Load/Security:** Scripts autocannon em `scripts/load-and-security/` — `npm run stress:all`
- **Unit tests:** prioridade futura — ainda não configurados.

## Regras de conduta

- **Idioma:** respostas em português (Brasil), código e símbolos em inglês.
- **Diff mínimo:** focado na tarefa; não refatorar código não relacionado.
- **Sem docs .md** novos sem necessidade — editar os existentes.
- Ao alterar rota `/api/v1/*` → atualizar `public/openapi.json`.
- Ao alterar modelo Prisma → verificar §8 da ARCHITECTURE.md.
