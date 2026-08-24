# Widget de feedback + padronização do Sentry

**Data:** 2026-08-24
**Status:** design aprovado, aguardando plano de implementação

## Problema

Duas lacunas hoje:

1. **Usuário não tem canal in-app.** Sugestão e relato de bug chegam por WhatsApp/e-mail, sem contexto técnico, sem tenant identificado, sem rastro no sistema.
2. **Não há observabilidade.** Zero Sentry no repositório — nenhuma dependência, nenhum arquivo de config. Nenhum error boundary (`error.tsx`, `global-error.tsx`) existe: erro de render entrega tela branca do Next. Falha em produção só é descoberta quando alguém liga.

O que amarra as duas: quando o cliente relata "deu erro", ninguém consegue ligar aquele relato ao stack trace correspondente.

## Objetivo

Widget de feedback no canto inferior esquerdo do painel autenticado, com o relato persistido no Postgres e **vinculado ao evento do Sentry** que originou o problema. Mais a padronização de captura de erro que torna esse vínculo confiável.

## Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Destino do relato | Postgres como fonte de verdade + espelho no Sentry | Banco não tem retenção de 90 dias e é filtrável por tenant; Sentry dá o vínculo com o stack trace |
| Superfície | Só dashboard autenticado | Sessão NextAuth garante `tenantId` + `userId`; sem rota pública nova, sem superfície de spam |
| Vínculo erro→bug | Automático **e** manual | Tela de erro convida a reportar; widget manual cobre o bug que virou toast e sumiu |
| UI do widget | Componente próprio (shadcn) | Visual do sistema, i18n via next-intl, dado no banco primeiro |
| Screenshot | **Fora da v1** | +50KB de `html2canvas`, quebra em iframe/canvas, e captura tela com dado de paciente — problema de LGPD antes de ser feature |
| Visibilidade da triagem | Só `super_admin` na v1 | `tenant_admin` vendo os próprios feedbacks é escopo separado, sem demanda hoje |

### Alternativa descartada: `feedbackIntegration` do Sentry

O widget oficial resolveria a UI quase sem código e traz screenshot nativo. Descartado porque: +35KB no bundle; shadow DOM com CSS próprio que nunca casa com shadcn; i18n manual string a string; e sobretudo o dado sai do browser pro Sentry **antes** do banco, sem transação — num SaaS multi-tenant clínico a triagem por tenant é o ponto todo, e ela depende do dado ser nosso primeiro.

## Ambiente Sentry

Projeto único: **org `tercon`, project `submanager`** (SaaS). Nenhum outro projeto Sentry recebe telemetria do SubManager.

Setup inicial pelo wizard, rodado **pelo usuário** (é interativo, abre browser pra login):

```bash
npx @sentry/wizard@latest -i nextjs --saas --org tercon --project submanager
```

Consultas de issue durante investigação usam o MCP do Sentry (`mcp__sentry__*`), que exige `authenticate` antes da primeira chamada.

## Arquitetura

### 1. Camada de observabilidade

Arquivos gerados pelo wizard, a revisar: `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation-client.ts`, `withSentryConfig` no `next.config.ts`.

Dois ajustes obrigatórios por cima:

1. **`src/instrumentation.ts` — fundir, não sobrescrever.** O `register()` atual sobe o worker BullMQ com guardas de `REDIS_URL`/`VERCEL`/`DISABLE_NOTIFICATION_WORKER`. A init do Sentry entra antes dessas guardas, e o arquivo passa a exportar `onRequestError`.
2. **`withSentryConfig`** com `tunnelRoute: "/monitoring"` (adblock bloqueia `*.sentry.io` e come parte dos eventos de client), `widenClientFileUploadSourceMaps`, `disableLogger`.

Módulo novo `src/lib/observability/`:

| Arquivo | Responsabilidade |
|---|---|
| `sentry-scrubber.ts` | `beforeSend` / `beforeBreadcrumb`. Deny-list de chaves (`cpf`, `documentId`, `phone`, `whatsapp`, `birthDate`, `notes`, `message`, `content`, `address`) mais regex de CPF, telefone BR e e-mail aplicados a `request.data`, `extra`, `breadcrumbs` e à mensagem do evento. `sendDefaultPii: false`. |
| `sentry-context.ts` | `setUser({ id })` — **só o id**, nunca nome ou e-mail. Tags `tenant.id`, `tenant.role`, `global.role`, `locale`. |
| `error-taxonomy.ts` | Decide se o erro é enviado e com que nível. 400/401/403/404/409/422 esperados **não** são enviados (viram breadcrumb). 5xx → `error`. Falha de integração externa (WhatsApp, GCS, Redis, SMTP) → `error` + tag `integration`. |
| `request-id.ts` | Gera e propaga `x-request-id`. |

Tags padrão em todo evento: `request_id`, `error.code`, `api.route`, `tenant.id`.

**Captura no server.** `onRequestError` cobre exception não tratada em route handler e RSC sem tocar nas rotas existentes. Complementarmente, `jsonError()` com `status >= 500` chama `captureApiError()` — pega o erro que o handler tratou e converteu em envelope, que o `onRequestError` nunca veria.

**Captura no client.** O interceptor de resposta do `apiClient` (já existente em `src/lib/api/http-client.ts`) passa a registrar breadcrumb de toda request e, em 5xx, faz `captureException` com fingerprint `[method, route, error.code]`, lendo `x-request-id` do header da resposta.

**O `request_id` é o elo.** A mesma tag aparece no evento do server e no do client, então um relato de bug aponta para os dois lados da mesma falha — não só para o sintoma que o usuário viu.

**Error boundaries.** Criar `src/app/global-error.tsx` e `src/app/[locale]/error.tsx`: capturam a exception, exibem tela padrão e oferecem "Reportar problema" já com o `eventId` em mãos.

**Variáveis de ambiente:** `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG=tercon`, `SENTRY_PROJECT=submanager`, `SENTRY_AUTH_TOKEN`, `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`. Sem DSN tudo vira no-op — dev local não quebra.

O CSP atual (`connect-src 'self' https: wss:`) já permite o ingest; nenhuma mudança de header é necessária.

### 2. Modelo de dados

```prisma
enum FeedbackType {
  bug
  suggestion
  question
  other
}

enum FeedbackStatus {
  open
  triaged
  in_progress
  resolved
  wont_fix
  duplicate
}

model FeedbackReport {
  id            String         @id @default(cuid())
  tenantId      String
  userId        String?
  type          FeedbackType
  status        FeedbackStatus @default(open)
  message       String         @db.Text
  sentryEventId String?
  requestId     String?
  pagePath      String
  userAgent     String?
  appVersion    String?
  locale        String
  adminNote     String?        @db.Text
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  resolvedAt    DateTime?

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User?  @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([tenantId, createdAt])
  @@index([status, createdAt])
  @@index([sentryEventId])
}
```

`userId` é nullable com `onDelete: SetNull`: o relato sobrevive à remoção do usuário que o escreveu. As relações exigem os campos inversos `feedbackReports FeedbackReport[]` em `Tenant` e em `User`.

`appVersion` vem de `NEXT_PUBLIC_APP_VERSION`, injetada no build a partir da `version` do `package.json`; ausente em dev, o campo fica nulo.

`pagePath` guarda **apenas o pathname**. Query string como `/dashboard/contacts?q=<nome do paciente>` carrega dado de paciente e é descartada na borda, antes de persistir.

Registrar a entidade nova na §8 de `docs/ARCHITECTURE.md`.

### 3. API

Todas sob `/api/v1`, envelope padrão (`jsonSuccess` / `jsonError`), schemas Zod em `src/lib/validators/feedback.ts`, tipos em `src/types/api/feedback-v1.ts`.

**`POST /api/v1/feedback`**
Guards na ordem padrão: `requireSessionOr401` → `getActiveTenantIdOr400` → `assertActiveTenantMembership`. Rate limit preset `api` por userId. Body: `{ type, message, sentryEventId?, requestId?, pagePath, locale }` — `tenantId` e `userId` vêm do JWT, nunca do body. Persiste; se `type === "bug"` e há `sentryEventId`, espelha via `Sentry.captureFeedback({ associatedEventId, message })` **fora do caminho crítico** — Sentry indisponível não pode derrubar o relato. Responde `201`.

**`GET /api/v1/admin/feedback`**
`superAdminOr403()`. Paginado com `buildPagination`. Filtros `status`, `type`, `tenantId`, `q`.

**`PATCH /api/v1/admin/feedback/[id]`**
`superAdminOr403()`. Altera `status` e `adminNote`; grava `resolvedAt` na transição para `resolved`.

Atualizar `public/openapi.json` com os três endpoints.

### 4. Widget

**Posicionamento.** A sidebar do shadcn ocupa a lateral esquerda inteira, então um `fixed bottom-4 left-4` no desktop cobriria o rodapé do menu. Solução: item no `SidebarFooter` do `AppSidebar` no desktop (canto inferior esquerdo literal, acompanha o collapse para ícone) mais FAB `fixed bottom-4 left-4 md:hidden` no mobile, onde a sidebar vira sheet e desaparece. Um componente, duas montagens.

**Estrutura** `src/features/feedback/app/`:

```
components/feedback-launcher.tsx    gatilho (sidebar footer + FAB mobile)
components/feedback-dialog.tsx      StandardDialogContent + formulário
hooks/use-feedback-form.ts          react-hook-form + Zod
services/feedback.service.ts        chamadas via apiClient
types/api.ts                        barrel de @/types/api/feedback-v1
utils/feedback-schema.ts            schema Zod
```

Mais `src/shared/stores/use-last-error-store.ts` (Zustand): guarda `{ sentryEventId, requestId, route, at }` do último erro da sessão, com **TTL de 10 minutos**. Anexar um erro de quarenta minutos atrás a uma sugestão de produto é pior do que não anexar nada.

**Formulário:** tipo (ToggleGroup — bug, sugestão, dúvida), mensagem (Textarea, 10 a 2000 caracteres) e, apenas quando há erro no store, um checkbox `Anexar detalhes técnicos` pré-marcado, com badge exibindo o eventId curto. O usuário vê o que está enviando junto; nada de telemetria oculta.

**Os dois caminhos do vínculo:**

1. **Automático** — erro estoura, `error.tsx` ou o interceptor grava no store, a tela de erro oferece "Reportar problema", o dialog abre com `type=bug` travado e o eventId anexado.
2. **Manual** — usuário abre o widget por conta própria; havendo erro dentro dos 10 minutos, o checkbox aparece pré-marcado. Cobre o bug que não derrubou a tela: o 500 que virou toast e sumiu.

**i18n:** `messages/pt-BR/feedback.json` e `messages/en/feedback.json`, seguindo o padrão de um arquivo por domínio.

### 5. Triagem

Seção nova `feedback` em `NAV_DEFS` de `src/features/settings/app/components/settings-page-layout.tsx`, com `superAdminOnly: true` e ícone `MessageSquareWarning`. Nenhuma rota nova — o layout de settings já resolve navegação e guard por papel.

Componente `feedback-triage-card.tsx` em `src/features/settings/app/components/`: tabela paginada, filtros por status, tipo e tenant. Linha com `sentryEventId` traz link direto para `https://sentry.io/organizations/tercon/issues/?query=<eventId>` — um clique do relato ao stack trace.

## Fluxo completo

```
Erro em produção
  ├─ server: onRequestError / jsonError(5xx) → Sentry (tags: request_id, tenant.id, error.code)
  └─ client: interceptor apiClient ou error.tsx → Sentry (mesmo request_id) → useLastErrorStore

Usuário abre o widget (pela tela de erro ou pelo rodapé da sidebar)
  → dialog pré-preenchido com eventId quando há erro recente
  → POST /api/v1/feedback
      ├─ FeedbackReport no Postgres  (fonte de verdade)
      └─ Sentry.captureFeedback({ associatedEventId })  (best-effort)

super_admin abre Settings → Feedback
  → lista, filtra, muda status
  → clica no eventId → issue no Sentry com o stack trace
```

## Testes

O projeto não tem unit tests configurados. Cobertura via Playwright E2E mais verificação manual:

- E2E: abrir widget, enviar sugestão, conferir que aparece na triagem.
- E2E: rota que retorna 500 → tela de erro → botão reportar → relato criado **com** `sentryEventId` preenchido.
- **Verificação manual do scrubber:** disparar exception com CPF e telefone no payload e confirmar no Sentry que chegaram redigidos. Esse é o único que não pode ser pulado — é a garantia de LGPD da feature inteira.
- `npx tsc --noEmit` e `npm run lint`.

## Ordem de execução

1. Usuário roda o wizard do Sentry (árvore limpa antes, para o diff ficar isolado).
2. Ajustar o que o wizard gerou: merge do `src/instrumentation.ts`, `tunnelRoute`; escrever `src/lib/observability/`.
3. Error boundaries e captura no interceptor do `apiClient`.
4. Migration Prisma, rotas da API, `public/openapi.json`, §8 da ARCHITECTURE.
5. Widget e i18n.
6. Tela de triagem.
7. Gates de qualidade e E2E.

## Riscos

- **O wizard mexe em arquivos vivos** (`next.config.ts`, `src/instrumentation.ts`). Rodar com árvore limpa e revisar o diff antes de prosseguir; o worker BullMQ precisa continuar subindo.
- **Scrubber incompleto vaza PII pro Sentry.** A deny-list cobre o que existe hoje no schema; campo novo com dado sensível exige atualizar `sentry-scrubber.ts`. Vale nota na regra `infrastructure`.
- **`captureFeedback` server-side falhando em silêncio.** É best-effort por decisão de design; a falha vira log estruturado, não erro pro usuário.

## Fora de escopo (v1)

- Screenshot anexado ao relato.
- Feedback no portal do paciente e nas telas de login.
- `tenant_admin` visualizando os feedbacks do próprio tenant.
- Resposta ao usuário / notificação de mudança de status do relato.
- Session Replay do Sentry.
