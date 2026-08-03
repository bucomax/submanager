# Auditoria de Arquitetura, SOLID e Clean Code — Bucomax

**Data:** 2026-08-03
**Escopo:** `src/**` (728 arquivos, ~61.000 linhas), `packages/prisma/schema.prisma`
**Método:** leitura de código, análise de grafo de imports, `npx tsc --noEmit`, `npm run lint`

---

## Veredito

A separação em camadas está **fisicamente** feita e bem feita: `domain/` é puro, `infrastructure/` implementa interfaces, nenhum handler de rota contém regra de negócio, as páginas do App Router são finas. O que não está feito é a **inversão de dependência**: 84 dos 96 use cases importam repositórios concretos diretamente. Os 16 ports existem, são bem desenhados, e são consumidos quase só como fonte de tipos.

Consequência prática: a camada `application/` não é testável em isolamento, e é exatamente por isso que não há um único teste unitário no repositório. Os dois problemas são o mesmo problema.

Fora isso, a disciplina de código é acima da média: zero `any` em 61k linhas, `strict` ligado, tsc limpo, padrão de resposta de API uniforme nos 91 handlers, i18n completo em duas línguas.

---

## Métricas

| Métrica | Valor |
|---------|-------|
| Arquivos TS/TSX | 728 |
| Linhas de código | ~61.000 |
| Route handlers (`route.ts`) | 91 |
| Use cases | 96 |
| Ports | 16 |
| Repositórios Prisma | 21 |
| Modelos Prisma | 29 (+18 enums) |
| Migrations | 42 |
| Componentes React | 211 (141 com `"use client"`) |
| `npx tsc --noEmit` | **limpo** |
| `npm run lint` | 21 erros, 23 warnings |
| Ocorrências de `any` | **0** |
| `as unknown as` | 19 |
| `@ts-ignore` / `eslint-disable` | 7 |
| Testes unitários | **0** |
| Specs E2E | 1 |
| Arquivos > 300 linhas | 30 |
| Arquivos > 500 linhas | 11 |

---

## Camadas

### Direção declarada

```
domain/ ← application/ ← infrastructure/ ← app/ + features/
```

### Aderência real

| Regra | Estado | Evidência |
|-------|--------|-----------|
| `domain/` sem dependência externa | **OK** | único import externo é `import type` de `@/types/api/clients-v1` |
| `infrastructure/` não importa `app/` nem `features/` | **OK** | zero ocorrências |
| Regra de negócio fora de `route.ts` | **OK** | handlers só validam, chamam use case, mapeiam erro → HTTP |
| `page.tsx` de rota fina | **OK** | 27 de 28 páginas com ≤ 25 linhas |
| Prisma fora de `app/` e `features/` | **2 violações** | `admin/apps/[appId]/screenshots/route.ts:10`, `admin/apps/[appId]/icon/route.ts:10` |
| `application/` depende de abstrações | **Falha sistêmica** | ver abaixo |
| `application/` livre de framework | **5 violações** | `import type { Session } from "next-auth"` |

---

## SOLID

### S — Responsabilidade única: **bom**

Use cases são coesos e nomeados pelo fluxo de negócio (`TransitionPatientStage`, `PublishPathwayVersion`, `ExchangePatientPortalMagicLink`). Serialização foi extraída (`serialize-client-detail.ts`, `serialize-client-list.ts`) em vez de inchar o use case.

Uma exceção: `runTransitionPatientStage` (`transition-patient-stage.ts`, 311 linhas) faz lock, transação, checklist, auditoria, notificação in-app, e-mail ao paciente, dispatch de WhatsApp e revalidação de cache num só corpo. É o coração do produto e o candidato natural a virar orquestração de passos menores.

### O — Aberto/fechado: **parcial**

O port `INotificationEmitter` permite adicionar canal sem tocar no núcleo — desenho correto. Mas `runTransitionPatientStage` chama `enqueueEmailDispatch` e `enqueueWhatsAppDispatch` explicitamente, um `if` por canal. Adicionar SMS significa editar a função. O port existe; o call site não o usa.

### L — Substituição de Liskov: **não exercitado**

Repositórios declaram `implements IClientRepository` etc., o que é a metade certa. A outra metade — poder trocar por um fake — nunca acontece porque os use cases importam o singleton concreto. Sem substituição real, o princípio é decorativo.

### I — Segregação de interface: **bom**

16 ports pequenos e por domínio. `IPathwayChecklistRepository` tem um punhado de métodos; `IClientTimelineRepository` cabe em 216 bytes. Nenhuma interface-monstro.

### D — Inversão de dependência: **falha sistêmica**

```
Use cases que importam @/infrastructure diretamente:  84 de 96
Referências a @/application/ports nos use cases:      10 (todas `import type`)
```

Exemplo em `transition-patient-stage.ts`:

```ts
import { pathwayPrismaRepository } from "@/infrastructure/repositories/pathway.repository";
import { patientPathwayPrismaRepository } from "@/infrastructure/repositories/patient-pathway.repository";
import { notificationEmitter } from "@/infrastructure/notifications/notification-emitter";
```

Três singletons concretos de infra importados dentro da camada de aplicação. Os ports estão logo ali e não são usados como contrato de injeção.

**Por que isso importa mais que o rótulo:** para testar essa função hoje é preciso um Postgres, um Redis, uma conta Resend e um endpoint de WhatsApp. É a razão direta de o repositório ter 0 testes unitários numa base de 61k linhas que orquestra jornada clínica.

**Correção — não exige big bang.** Assinatura com dependências default:

```ts
export async function runTransitionPatientStage(
  params: { tenantId: string; actorUserId: string; patientPathwayId: string; input: StageTransitionInput },
  deps: {
    pathways?: IPathwayRepository;
    patientPathways?: IPatientPathwayRepository;
    notifications?: INotificationEmitter;
  } = {},
) {
  const pathways = deps.pathways ?? pathwayPrismaRepository;
  // ...
}
```

Call sites atuais não mudam. Testes passam fakes. Aplicar primeiro nos 5–10 use cases de maior risco (transição, publicação de versão, self-register, portal do paciente) em vez de nos 96.

---

## Clean code

### Bom

- **Tipagem.** Zero `any` em 61k linhas com `strict: true` e `tsc` limpo. Raro.
- **DTOs.** Par schema Zod ↔ `z.infer` como fonte única. Tipos de API centralizados em `src/types/api/*-v1.ts`, reexportados por barrel de feature.
- **Envelope de API.** `jsonSuccess` / `jsonError` uniformes nos 91 handlers, sem wrapper alternativo.
- **Erros como dados.** Use cases retornam união discriminada (`{ ok: false; code: "CHECKLIST_BLOCKED"; pendingItems: [...] }`); o handler faz narrowing e mapeia para status HTTP. Nada de `throw` genérico para caso de negócio.
- **Nomes de domínio.** `currentStageId`, `enteredStageAt`, `ruleOverrideReason`, `dispatchStub` — vocabulário do negócio, não do framework.
- **i18n.** 12 namespaces em pt-BR e en, mensagens de erro de API traduzidas via `ApiT`.
- **Comentários.** Densos onde explicam decisão ("Usamos clientId e não patientPathwayId porque..."), ausentes onde o código já diz.

### A corrigir

**Arquivos grandes.** 30 acima de 300 linhas, 11 acima de 500. Os piores:

| Arquivo | Linhas |
|---------|-------|
| `features/clients/app/components/client-detail-profile-card.tsx` | 956 |
| `features/clients/app/pages/patient-self-register-page.tsx` | 726 |
| `features/pathways/app/components/pathway-editor.tsx` | 713 |
| `features/apps/app/components/admin-app-wizard-dialog.tsx` | 706 |
| `lib/validators/client.ts` | 664 |
| `features/clients/app/components/client-detail-view.tsx` | 662 |

`client.ts` é validador denso e pode ficar. Os componentes de 700–950 linhas misturam layout, estado de formulário e chamadas de serviço — extrair hooks e subcomponentes.

**19 `as unknown as`.** Concentrados na fronteira com `Prisma.TransactionClient` (`tx as Prisma.TransactionClient`) porque os ports tipam `tx` como `unknown`. Sintoma da abstração incompleta: o port quer esconder Prisma mas o use case precisa do tipo de volta. Definir um `TransactionContext` no port resolve.

**`Session` do next-auth em `application/`.** 5 arquivos (`list-clients-page.ts`, `switch-active-tenant.ts`, `create-patient-pathway.ts`, `load-client-visibility-scope.ts`, `list-notifications-with-scope.ts`). Acopla a regra de negócio ao provedor de auth. Substituir por um tipo próprio (`ActorContext { userId, globalRole, tenantId, tenantRole }`) montado no handler.

**Lint: 21 erros, 23 warnings.**

| Regra | Ocorrências |
|-------|------------|
| `react-hooks/set-state-in-effect` | 17 |
| `@typescript-eslint/no-unused-vars` | 8 |
| `react-hooks/exhaustive-deps` | 7 |
| `@typescript-eslint/no-unused-expressions` | 3 |
| `@next/next/no-img-element` | 2 |
| outros | 7 |

Os 17 `set-state-in-effect` são o sinal relevante: estado derivado sendo sincronizado por `useEffect` em vez de calculado no render. Causa render extra e é fonte clássica de bug de sincronização em formulários. Concentrados em `use-clients-list.ts`, `pathway-editor.tsx`, `settings-page-layout.tsx`, `patient-pathway-panel.tsx`.

**Ausência de testes.** 96 use cases, 0 testes unitários. A única cobertura automatizada é `e2e/patient-self-register.spec.ts` (1 spec) mais os scripts de carga/segurança em `scripts/load-and-security/`. O `CLAUDE.md` já registra "unit tests: prioridade futura" — a dívida está reconhecida, não escondida. O bloqueio é a inversão de dependência (ver seção D).

Prioridade quando destravar: `runTransitionPatientStage` (permissão, etapa de outra versão, checklist bloqueante, bundle completo), presença de `tenantId` em todo repositório, `mergeClientWhereWithVisibility`, e mapeamento de erro de domínio → HTTP.

---

## Frontend

**Bom:**
- Estrutura de feature consistente (`components/`, `hooks/`, `services/`, `types/`, `utils/`, `pages/`).
- Páginas de rota finas — 27 de 28 com ≤ 25 linhas.
- Services só fazem HTTP via `apiClient`; tipos importados de `@/types/api/`.
- Interceptor global de erro com toast — sem duplicação nos catch.
- shadcn/ui + Tailwind 4, `StandardDialogContent` como modal padrão, `useDebouncedState` como fonte única de debounce.

**A corrigir:**
- `features/pathways`, `features/settings` e `features/notifications` não têm `pages/` — a regra `.claude/rules/frontend-feature.md` prevê a pasta. Verificar se as rotas dessas features compõem em outro lugar.
- 141 de 211 componentes com `"use client"` (67%). Alto para App Router — indica que boa parte da árvore poderia ser Server Component e busca dados no cliente sem necessidade.
- 2 `<img>` em vez de `next/image` (`app-detail-view.tsx`).

---

## Dados

**Bom:**
- 29 modelos, 18 enums, 42 migrations versionadas. Nomenclatura coerente com o domínio.
- Índices compostos com `tenantId` na frente (`@@index([tenantId, clientId, createdAt])`).
- `onDelete` explícito em toda relação (`Cascade` / `SetNull`).
- Soft delete via `deletedAt` respeitado nas leituras.
- Singleton do Prisma em `infrastructure/database/prisma.ts`.

**A corrigir:**
- `PatientPortalLinkToken` não tem `tenantId` — o escopo vem por `client.tenantId`. A validação está correta no use case, mas o modelo permite estado inconsistente por construção.
- `unstable_cache` acessa `prisma` direto em `infrastructure/cache/*` (aceitável: é infra), mas duplica a query de listagem entre `cached-clients-list.ts` e `getClientsListPageWithoutCache` na mesma função — está fatorado corretamente, só vale registrar que existem dois caminhos de leitura.
- Sem job de retenção/expurgo por tenant.

---

## Divergências entre documentação e código

O `CLAUDE.md` orienta o trabalho no repositório e tem três afirmações desatualizadas:

| `CLAUDE.md` diz | Realidade |
|-----------------|-----------|
| "State: React Query (server state)" | React Query / `@tanstack/*` **não está instalado**. Estado de servidor via `apiClient` + hooks próprios. |
| "Lógica de visibilidade em `src/lib/auth/client-visibility.ts`" | Arquivo não existe. Está em `src/application/use-cases/shared/load-client-visibility-scope.ts`. |
| "Ao alterar rota `/api/v1/*` → atualizar `public/openapi.json`" | 78 paths no OpenAPI para 91 `route.ts` — o spec está atrás. |

Corrigir o `CLAUDE.md` é barato e evita que a próxima sessão parta de premissa errada.

---

## Dívida técnica priorizada

| # | Item | Esforço | Ganho |
|---|------|---------|-------|
| 1 | Injeção de dependência nos 10 use cases críticos | Médio | Destrava testes unitários — pré-requisito de todo o resto |
| 2 | Testes unitários da transição de etapa e visibilidade | Médio | Cobre o fluxo de maior risco do produto |
| 3 | Corrigir os 21 erros de lint (foco nos 17 `set-state-in-effect`) | Baixo | Elimina classe de bug de sincronização em formulário |
| 4 | Trocar `Session` do next-auth por `ActorContext` na `application/` | Baixo | Desacopla regra de negócio do provedor de auth |
| 5 | Quebrar os 6 componentes acima de 600 linhas | Médio | Legibilidade e reaproveitamento |
| 6 | Remover Prisma dos 2 route handlers de admin/apps | Baixo | Fecha a última brecha de camada |
| 7 | Decompor `runTransitionPatientStage` em passos nomeados | Médio | SRP no coração do produto |
| 8 | Sincronizar `public/openapi.json` e corrigir `CLAUDE.md` | Baixo | Doc confiável |
| 9 | Tipar `TransactionContext` no port e eliminar os `as unknown as` | Baixo | Remove 19 escapes de tipo |
| 10 | Reduzir `"use client"` onde a árvore permite Server Component | Alto | Bundle e TTFB |

---

## Nota final

O projeto tem a estrutura de um sistema maduro: camadas reais, tipagem rigorosa, multi-tenancy consistente, i18n completo, auditoria, RBAC granular. A distância entre o que está aqui e um sistema de produção robusto não é arquitetural — é a ponte que falta entre os ports desenhados e os use cases que os ignoram, e a suíte de testes que essa ponte destravaria.
