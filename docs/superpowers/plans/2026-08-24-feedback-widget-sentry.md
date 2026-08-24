# Widget de Feedback + Vínculo com Sentry — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um widget de feedback no canto inferior esquerdo do painel autenticado cujos relatos ficam no Postgres e carregam o `sentryEventId` do erro que os originou.

**Architecture:** Camada de observabilidade em `src/lib/observability/` normaliza o que sai para o Sentry (PII removida, taxonomia de nível, `request_id` compartilhado entre servidor e browser). Um store Zustand guarda o último erro da sessão por 10 minutos; o widget lê esse store e envia o `sentryEventId` junto do relato para `POST /api/v1/feedback`, que persiste em `FeedbackReport` e espelha no Sentry. Triagem entra como seção `superAdminOnly` no layout de configurações que já existe.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Prisma 6 + PostgreSQL 16, `@sentry/nextjs` 10, Zustand, react-hook-form + Zod, Tailwind 4 + shadcn/ui, next-intl, Vitest (introduzido pela Task 1), Playwright.

**Spec:** `docs/superpowers/specs/2026-08-24-feedback-widget-sentry-design.md`

**Base já entregue:** commit `a9a7d14` (`feat(observability): configura Sentry com coleta de PII desligada`) — SDK instalado, `Sentry.init` no `src/instrumentation.ts` e `src/instrumentation-client.ts`, `sentrySharedOptions` com `dataCollection` restritivo, túnel `/monitoring` funcionando, `withSentryConfig` no `next.config.ts`.

## Global Constraints

- Respostas ao usuário em português (Brasil); código e símbolos exportados em inglês.
- Arquivos em kebab-case; componentes React em PascalCase.
- Envelope de API exclusivamente por `jsonSuccess(data, init?)` / `jsonError(code, message, status, details?)` de `@/lib/api-response`.
- Guards na ordem `requireSessionOr401` → `getActiveTenantIdOr400` → `assertActiveTenantMembership`. `requireSessionOr401` **já aplica** `rateLimit("api", session.user.id)` — não adicionar rate limit próprio.
- `tenantId` e `userId` vêm sempre do JWT, nunca do body.
- Schemas Zod em `src/lib/validators/<domínio>.ts`; DTOs em `src/types/api/<domínio>-v1.ts`. Proibido declarar `interface`/`type` de contrato em `route.ts` ou componentes.
- Services só fazem HTTP via `apiClient`. O interceptor já exibe `toast.error` em falha — não duplicar no catch.
- Nenhum dado clínico, CPF, telefone ou e-mail pode sair para o Sentry.
- Alterou rota `/api/v1/*` → atualizar `public/openapi.json`. Alterou modelo Prisma → atualizar §8 de `docs/ARCHITECTURE.md`.
- Guard de `NEXT_RUNTIME` em `src/instrumentation.ts` precisa continuar sendo a primeira instrução da mesma função que faz os `await import()` dos workers; qualquer mudança nesse arquivo exige conferir o log do build por `Edge Instrumentation`.
- Limites: funções ≤30 linhas, arquivos ≤300 linhas.

**Desvio deliberado do spec (confirmar antes de começar):** o spec previa só E2E e verificação manual, porque o projeto não tem runner de teste unitário. A Task 1 introduz **Vitest** para as funções puras da observabilidade. Motivo: o scrubber é o controle que impede vazamento de PII para fora do domínio — validá-lo clicando na tela não é auditável. Vitest roda só sobre `src/lib/observability/**`, não altera build nem CI existentes.

---

### Task 1: Vitest + scrubber de PII

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/observability/sentry-scrubber.ts`
- Test: `src/lib/observability/sentry-scrubber.test.ts`
- Modify: `package.json` (devDependencies + script `test:unit`)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `scrubSentryEvent(event: ErrorEvent): ErrorEvent`, `scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null`, `redactSensitiveText(value: string): string`, `SENSITIVE_KEY_DENYLIST: readonly string[]`.

- [ ] **Step 1: Instalar Vitest**

```bash
npm install -D vitest@^3
```

- [ ] **Step 2: Criar a config do Vitest**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/observability/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 3: Adicionar o script de teste**

Em `package.json`, dentro de `"scripts"`, logo acima de `"test:e2e"`:

```json
"test:unit": "vitest run",
```

- [ ] **Step 4: Escrever os testes que falham**

```ts
// src/lib/observability/sentry-scrubber.test.ts
import { describe, expect, it } from "vitest";
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import {
  redactSensitiveText,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from "@/lib/observability/sentry-scrubber";

describe("redactSensitiveText", () => {
  it("redige CPF com pontuação", () => {
    expect(redactSensitiveText("paciente 529.982.247-25 chegou")).toBe(
      "paciente [redacted] chegou",
    );
  });

  it("redige CPF sem pontuação", () => {
    expect(redactSensitiveText("doc 52998224725")).toBe("doc [redacted]");
  });

  it("redige telefone brasileiro com DDD", () => {
    expect(redactSensitiveText("ligar (11) 98765-4321")).toBe("ligar [redacted]");
  });

  it("redige e-mail", () => {
    expect(redactSensitiveText("contato joao@clinica.com.br")).toBe(
      "contato [redacted]",
    );
  });

  it("mantém texto sem PII intacto", () => {
    expect(redactSensitiveText("falha ao carregar etapa")).toBe(
      "falha ao carregar etapa",
    );
  });

  it("não confunde id interno com CPF", () => {
    expect(redactSensitiveText("clientId cmg3k2p9x0001abcd")).toBe(
      "clientId cmg3k2p9x0001abcd",
    );
  });
});

describe("scrubSentryEvent", () => {
  it("remove o valor de chaves da denylist em extra", () => {
    const event = {
      extra: { documentId: "52998224725", stageKey: "pre-op" },
    } as unknown as ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(result.extra?.documentId).toBe("[redacted]");
    expect(result.extra?.stageKey).toBe("pre-op");
  });

  it("redige PII dentro do valor da exception", () => {
    const event = {
      exception: {
        values: [{ type: "Error", value: "falha para 529.982.247-25" }],
      },
    } as unknown as ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(result.exception?.values?.[0]?.value).toBe("falha para [redacted]");
  });

  it("descarta a query string da URL da request", () => {
    const event = {
      request: { url: "https://app.local/dashboard/contacts?q=Maria+Silva" },
    } as unknown as ErrorEvent;

    const result = scrubSentryEvent(event);

    expect(result.request?.url).toBe("https://app.local/dashboard/contacts");
  });

  it("varre objetos aninhados", () => {
    const event = {
      extra: { patient: { phone: "11987654321", id: "abc" } },
    } as unknown as ErrorEvent;

    const result = scrubSentryEvent(event);
    const patient = result.extra?.patient as Record<string, unknown>;

    expect(patient.phone).toBe("[redacted]");
    expect(patient.id).toBe("abc");
  });

  it("não estoura com estrutura circular", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    const event = { extra: { circular } } as unknown as ErrorEvent;

    expect(() => scrubSentryEvent(event)).not.toThrow();
  });
});

describe("scrubSentryBreadcrumb", () => {
  it("descarta breadcrumb de console, que costuma carregar payload cru", () => {
    const breadcrumb = { category: "console", message: "user" } as Breadcrumb;

    expect(scrubSentryBreadcrumb(breadcrumb)).toBeNull();
  });

  it("redige PII na mensagem de breadcrumb de navegação", () => {
    const breadcrumb = {
      category: "navigation",
      message: "buscou por joao@clinica.com.br",
    } as Breadcrumb;

    const result = scrubSentryBreadcrumb(breadcrumb);

    expect(result?.message).toBe("buscou por [redacted]");
  });
});
```

- [ ] **Step 5: Rodar e confirmar que falha**

Run: `npm run test:unit`
Expected: FAIL — `Failed to resolve import "@/lib/observability/sentry-scrubber"`.

- [ ] **Step 6: Implementar o scrubber**

```ts
// src/lib/observability/sentry-scrubber.ts
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * Segunda camada de proteção de PII. A primeira é `dataCollection` em
 * `sentry-shared-options.ts`, que impede o SDK de coletar corpo, cookies e
 * variáveis locais. Este módulo cobre o que chega por `captureException`
 * manual, onde o autor da chamada controla o payload.
 *
 * Campo novo com dado sensível no schema Prisma exige entrada aqui.
 */

const REDACTED = "[redacted]";

export const SENSITIVE_KEY_DENYLIST = [
  "cpf",
  "documentid",
  "taxdocument",
  "phone",
  "whatsapp",
  "mobile",
  "birthdate",
  "email",
  "address",
  "zipcode",
  "notes",
  "note",
  "message",
  "content",
  "body",
  "description",
  "password",
  "token",
] as const;

/** CPF com ou sem pontuação. Os lookarounds `(?<!\w)`/`(?!\w)` evitam casar dentro de cuid/uuid. */
const CPF_RE = /(?<!\w)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\w)/g;
/**
 * Telefone exige estrutura explícita — DDD entre parênteses ou hífen separando o
 * sufixo. Um padrão que aceitasse 8 dígitos soltos apagaria timestamp unix, número
 * de nota e valor em centavos, cegando o diagnóstico que este módulo existe para
 * preservar. Celular sem formatação (11 dígitos) já cai no `CPF_RE`, que roda antes.
 * Fixo de 10 dígitos sem formatação fica de fora de propósito: não dá para separá-lo
 * de um timestamp sem heurística frágil, e ele continua coberto pela denylist de
 * chaves e por `dataCollection`.
 */
const PHONE_PAREN_RE = /(?<!\w)\(\d{2}\)\s?9?\d{4}[-\s]?\d{4}(?!\w)/g;
const PHONE_HYPHEN_RE = /(?<!\w)(?:\+?55[\s-]?)?(?:\d{2}[\s-])?9?\d{4}-\d{4}(?!\w)/g;
const EMAIL_RE = /(?<!\w)[\w.+-]+@[\w-]+\.[\w.-]+(?!\w)/g;

export function redactSensitiveText(value: string): string {
  return value
    .replace(EMAIL_RE, REDACTED)
    .replace(CPF_RE, REDACTED)
    .replace(PHONE_PAREN_RE, REDACTED)
    .replace(PHONE_HYPHEN_RE, REDACTED);
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_DENYLIST.some((denied) => normalized.includes(denied));
}

function scrubValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactSensitiveText(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return REDACTED;
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((item) => scrubValue(item, seen));

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? REDACTED : scrubValue(item, seen);
  }
  return result;
}

/** Remove a query string: `?q=<nome do paciente>` é dado de paciente. */
function stripQueryString(url: string): string {
  const cut = url.indexOf("?");
  return cut === -1 ? url : url.slice(0, cut);
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  const seen = new WeakSet<object>();

  if (event.extra) {
    event.extra = scrubValue(event.extra, seen) as ErrorEvent["extra"];
  }

  if (event.request?.url) {
    event.request.url = stripQueryString(event.request.url);
  }

  if (event.exception?.values) {
    for (const value of event.exception.values) {
      if (value.value) value.value = redactSensitiveText(value.value);
    }
  }

  if (event.message) {
    event.message = redactSensitiveText(event.message);
  }

  return event;
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // `console` repassa argumentos crus de `console.log`, sem controle de quem chamou.
  if (breadcrumb.category === "console") return null;

  if (breadcrumb.message) {
    breadcrumb.message = redactSensitiveText(breadcrumb.message);
  }
  if (breadcrumb.data) {
    breadcrumb.data = scrubValue(breadcrumb.data, new WeakSet()) as Breadcrumb["data"];
  }
  return breadcrumb;
}
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `npm run test:unit`
Expected: PASS — 13 testes.

- [ ] **Step 8: Ligar o scrubber às opções compartilhadas**

Em `src/lib/observability/sentry-shared-options.ts`, adicionar o import no topo e as duas chaves ao objeto exportado, depois de `dataCollection`:

```ts
import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/observability/sentry-scrubber";
```

```ts
  beforeSend: scrubSentryEvent,
  beforeBreadcrumb: scrubSentryBreadcrumb,
```

- [ ] **Step 9: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build 2>&1 | grep -c "Edge Instrumentation"`
Expected: `No errors found` e contagem `0`.

- [ ] **Step 10: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/observability/
git commit -m "feat(observability): adiciona scrubber de PII com cobertura unitaria"
```

---

### Task 2: Contexto de tenant e taxonomia de erro

**Files:**
- Create: `src/lib/observability/sentry-context.ts`
- Create: `src/lib/observability/error-taxonomy.ts`
- Test: `src/lib/observability/error-taxonomy.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `applySentryUserContext(context: SentryUserContext): void`, `clearSentryUserContext(): void`, `type SentryUserContext`, `shouldReportHttpStatus(status: number): boolean`, `severityForHttpStatus(status: number): "error" | "warning"`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/observability/error-taxonomy.test.ts
import { describe, expect, it } from "vitest";
import {
  severityForHttpStatus,
  shouldReportHttpStatus,
} from "@/lib/observability/error-taxonomy";

describe("shouldReportHttpStatus", () => {
  it.each([400, 401, 403, 404, 409, 422])(
    "não reporta %i, que é fluxo de negócio esperado",
    (status) => {
      expect(shouldReportHttpStatus(status)).toBe(false);
    },
  );

  it.each([500, 502, 503, 504])("reporta %i", (status) => {
    expect(shouldReportHttpStatus(status)).toBe(true);
  });

  it("não reporta 2xx", () => {
    expect(shouldReportHttpStatus(200)).toBe(false);
  });

  it("reporta 4xx fora da lista de esperados", () => {
    expect(shouldReportHttpStatus(418)).toBe(true);
  });
});

describe("severityForHttpStatus", () => {
  it("trata 5xx como error", () => {
    expect(severityForHttpStatus(500)).toBe("error");
  });

  it("trata 4xx inesperado como warning", () => {
    expect(severityForHttpStatus(418)).toBe("warning");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test:unit`
Expected: FAIL — `Failed to resolve import "@/lib/observability/error-taxonomy"`.

- [ ] **Step 3: Implementar a taxonomia**

```ts
// src/lib/observability/error-taxonomy.ts

/**
 * Decide o que vira evento no Sentry. Status de fluxo de negócio conhecido
 * (validação, sessão expirada, permissão, recurso ausente, conflito) não é
 * defeito: reportá-los afogaria o sinal real em ruído de operação normal.
 */
const EXPECTED_BUSINESS_STATUSES = new Set([400, 401, 403, 404, 409, 422]);

export function shouldReportHttpStatus(status: number): boolean {
  if (status < 400) return false;
  return !EXPECTED_BUSINESS_STATUSES.has(status);
}

export function severityForHttpStatus(status: number): "error" | "warning" {
  return status >= 500 ? "error" : "warning";
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Implementar o contexto**

```ts
// src/lib/observability/sentry-context.ts
import * as Sentry from "@sentry/nextjs";

/**
 * Só o id do usuário vai para o Sentry. Nome e e-mail identificam pessoa e não
 * agregam nada ao diagnóstico — o id resolve qualquer investigação pelo banco.
 */
export type SentryUserContext = {
  userId: string;
  tenantId: string | null;
  tenantRole: string | null;
  globalRole: string | null;
  locale: string;
};

/** Chaves em um lugar só: o clear precisa zerar exatamente o que o apply escreve. */
const CONTEXT_TAG_KEYS = ["tenant.id", "tenant.role", "global.role", "locale"] as const;

export function applySentryUserContext(context: SentryUserContext): void {
  Sentry.setUser({ id: context.userId });
  Sentry.setTags({
    "tenant.id": context.tenantId ?? "none",
    "tenant.role": context.tenantRole ?? "none",
    "global.role": context.globalRole ?? "none",
    locale: context.locale,
  });
}

export function clearSentryUserContext(): void {
  Sentry.setUser(null);
  // Sem zerar as tags, um evento capturado depois do logout — na tela de login ou
  // no portal do paciente na mesma aba — sairia carimbado com o tenant anterior.
  // Atribuir erro ao tenant errado é pior que não atribuir.
  for (const key of CONTEXT_TAG_KEYS) {
    Sentry.setTag(key, undefined);
  }
}
```

- [ ] **Step 6: Ligar o contexto ao shell autenticado**

Sem chamador, `applySentryUserContext` é código morto e nenhum evento carrega
`tenant.id`. O `AppShell` já recebe o usuário resolvido pelo layout, então é ali
que o contexto é aplicado.

Em `src/shared/components/layout/app-shell.tsx`, adicionar aos imports:

```tsx
import { useLocale } from "next-intl";
import { useEffect } from "react";
import { applySentryUserContext, clearSentryUserContext } from "@/lib/observability/sentry-context";
```

E, dentro de `AppShell`, antes do `return`:

```tsx
  const locale = useLocale();

  useEffect(() => {
    applySentryUserContext({
      userId: user.id,
      tenantId: user.tenantId,
      tenantRole: user.tenantRole,
      globalRole: user.globalRole,
      locale,
    });
    return () => clearSentryUserContext();
  }, [user.id, user.tenantId, user.tenantRole, user.globalRole, locale]);
```

Conferir em `src/shared/types/layout.ts` os tipos de `AppShellUser.tenantId`,
`tenantRole` e `globalRole`; se algum não for `string | null`, ajustar a
conversão aqui em vez de afrouxar `SentryUserContext`.

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit && npm run lint`
Expected: `No errors found`, sem problema novo no lint.

- [ ] **Step 8: Commit**

```bash
git add src/lib/observability/ src/shared/components/layout/app-shell.tsx
git commit -m "feat(observability): adiciona contexto de tenant e taxonomia de erro"
```

---

### Task 3: `request-id` fim a fim e captura no servidor

> **Revisão do controller (Ruling R2).** A versão original desta task propagava
> o id mutando `req.headers` no proxy e guardava o valor num `AsyncLocalStorage`.
> Nenhuma das duas coisas funciona no Next: header mutado no middleware não chega
> ao route handler, e nada estabelecia o escopo do ALS, então `currentRequestId()`
> devolveria `null` em toda chamada. A task abaixo usa a isolation scope do Sentry,
> que o SDK do Next já cria por requisição, e o chokepoint natural do projeto:
> `requireSessionOr401`, por onde toda rota autenticada passa e que já recebe o
> `request`.

**Files:**
- Create: `src/lib/observability/request-id.ts`
- Test: `src/lib/observability/request-id.test.ts`
- Modify: `src/lib/auth/guards.ts:17-29` (`requireSessionOr401`)
- Modify: `src/lib/api-response.ts` (`jsonError`)
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `shouldReportHttpStatus`, `severityForHttpStatus` (Task 2).
- Produces: `REQUEST_ID_HEADER` (`"x-request-id"`), `resolveRequestId(request: Request): string`, `tagRequestId(request: Request | undefined): string | null`, `currentRequestId(): string | null`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/observability/request-id.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import * as Sentry from "@sentry/nextjs";
import {
  REQUEST_ID_HEADER,
  currentRequestId,
  resolveRequestId,
  tagRequestId,
} from "@/lib/observability/request-id";

describe("resolveRequestId", () => {
  it("reaproveita o header quando presente", () => {
    const request = new Request("https://app.local/api/v1/feedback", {
      headers: { [REQUEST_ID_HEADER]: "abc-123" },
    });

    expect(resolveRequestId(request)).toBe("abc-123");
  });

  it("gera um id quando o header falta", () => {
    const request = new Request("https://app.local/api/v1/feedback");

    expect(resolveRequestId(request)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("ignora header vazio", () => {
    const request = new Request("https://app.local/api/v1/feedback", {
      headers: { [REQUEST_ID_HEADER]: "   " },
    });

    expect(resolveRequestId(request)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("tagRequestId", () => {
  beforeEach(() => {
    Sentry.getIsolationScope().clear();
  });

  it("grava a tag e devolve o id", () => {
    const request = new Request("https://app.local/api/v1/feedback", {
      headers: { [REQUEST_ID_HEADER]: "req-1" },
    });

    expect(tagRequestId(request)).toBe("req-1");
    expect(currentRequestId()).toBe("req-1");
  });

  it("devolve null sem request, sem sujar a scope", () => {
    expect(tagRequestId(undefined)).toBeNull();
    expect(currentRequestId()).toBeNull();
  });
});

describe("currentRequestId", () => {
  it("devolve null quando nada foi marcado", () => {
    Sentry.getIsolationScope().clear();

    expect(currentRequestId()).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test:unit`
Expected: FAIL — `Failed to resolve import "@/lib/observability/request-id"`.

- [ ] **Step 3: Implementar**

```ts
// src/lib/observability/request-id.ts
import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

/**
 * Elo entre os dois lados de uma mesma falha: o evento capturado no servidor e o
 * capturado no browser carregam a mesma tag `request_id`. Sem isso um relato de
 * bug só aponta para o sintoma que o usuário viu.
 *
 * O valor vive na isolation scope do Sentry, que o SDK do Next cria por
 * requisição. Header mutado no proxy não chega ao route handler, então a scope é
 * o único canal que atravessa middleware e handler sem tocar em toda rota.
 */
export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_TAG = "request_id";

export function resolveRequestId(request: Request): string {
  const fromHeader = request.headers.get(REQUEST_ID_HEADER)?.trim();
  return fromHeader && fromHeader.length > 0 ? fromHeader : randomUUID();
}

/** Chamado no chokepoint de autenticação, por onde toda rota autenticada passa. */
export function tagRequestId(request: Request | undefined): string | null {
  if (!request) return null;
  const requestId = resolveRequestId(request);
  Sentry.getIsolationScope().setTag(REQUEST_ID_TAG, requestId);
  return requestId;
}

export function currentRequestId(): string | null {
  const tag = Sentry.getIsolationScope().getScopeData().tags[REQUEST_ID_TAG];
  return typeof tag === "string" ? tag : null;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Marcar no chokepoint de autenticação**

Em `src/lib/auth/guards.ts`, adicionar ao bloco de imports:

```ts
import { tagRequestId } from "@/lib/observability/request-id";
```

E, dentro de `requireSessionOr401`, como **primeira** instrução da função (antes do
`await requireSession()`, para que o 401 também saia marcado):

```ts
  tagRequestId(request);
```

- [ ] **Step 6: Capturar 5xx no envelope de erro**

Em `src/lib/api-response.ts`, adicionar aos imports:

```ts
import * as Sentry from "@sentry/nextjs";
import { severityForHttpStatus, shouldReportHttpStatus } from "@/lib/observability/error-taxonomy";
import { currentRequestId } from "@/lib/observability/request-id";
```

E, dentro de `jsonError`, logo antes do `return`:

```ts
  const requestId = currentRequestId();

  // `onRequestError` só enxerga exception que escapa do handler. Erro que o
  // handler tratou e converteu em envelope passaria despercebido sem isto.
  if (shouldReportHttpStatus(status)) {
    Sentry.withScope((scope) => {
      scope.setLevel(severityForHttpStatus(status));
      scope.setTags({ "error.code": code, request_id: requestId ?? "none" });
      scope.setFingerprint(["api-error", code, String(status)]);
      Sentry.captureMessage(`API ${status} ${code}`);
    });
  }
```

E o `return` precisa devolver o header — **este é o elo que fecha a correlação**. O
`matcher` do proxy exclui `/api/*` por design, então o carimbo que o proxy faz nunca
alcança rota de API: sem isto, o id vive só na tag do evento do servidor e o browser
nunca o descobre.

```ts
  return Response.json(body, {
    status,
    // Sem id marcado (rota pública, que não passa por `requireSessionOr401`) o header
    // é omitido: id que nenhum evento carrega é pior que id ausente.
    ...(requestId ? { headers: { [REQUEST_ID_HEADER]: requestId } } : {}),
  });
```

O import de `REQUEST_ID_HEADER` entra junto do de `currentRequestId`.

- [ ] **Step 7: Devolver o id ao browser**

O proxy **não** deve tentar mutar `req.headers`: no Next isso não chega ao route
handler. Ele só carimba a resposta, que é o que o SDK do browser lê.

Em `src/proxy.ts`, substituir o corpo de `export default function proxy` por:

```ts
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const response = isPublicPath(pathname)
    ? intlMiddleware(req)
    : (authMiddleware as unknown as (r: NextRequest) => Response)(req);

  // O browser lê este header para carimbar o evento dele com o mesmo id.
  const requestId = req.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  response.headers.set("x-request-id", requestId);
  return response;
}
```

Se `authMiddleware` devolver algo que não seja `Response` (por exemplo `undefined`
em algum caminho do `withAuth`), tratar o caso antes de mexer em `headers` em vez
de forçar o tipo — e reportar isso como concern.

- [ ] **Step 8: Verificar**

Run: `npm run test:unit && npx tsc --noEmit && npm run build 2>&1 | grep -c "Edge Instrumentation"`
Expected: PASS, `No errors found`, contagem `0`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/observability/ src/lib/api-response.ts src/lib/auth/guards.ts src/proxy.ts
git commit -m "feat(observability): propaga request_id e captura 5xx do envelope"
```

---

### Task 4: Store do último erro e captura no cliente

**Files:**
- Create: `src/shared/stores/use-last-error-store.ts`
- Test: `src/shared/stores/use-last-error-store.test.ts`
- Modify: `vitest.config.ts` (incluir o novo teste)
- Modify: `src/lib/api/http-client.ts:70-120` (interceptor de resposta)

**Interfaces:**
- Consumes: `shouldReportHttpStatus`, `severityForHttpStatus` (Task 2), `REQUEST_ID_HEADER` (Task 3).
- Produces: `useLastErrorStore` com estado `{ lastError: CapturedError | null, setLastError(e: CapturedError): void, clearLastError(): void, readFreshError(nowMs: number): CapturedError | null }` e `type CapturedError = { sentryEventId: string | null; requestId: string | null; route: string; capturedAt: number }`; constante `LAST_ERROR_TTL_MS`.

- [ ] **Step 1: Ampliar o include do Vitest**

Em `vitest.config.ts`, trocar a linha do `include` por:

```ts
    include: ["src/lib/observability/**/*.test.ts", "src/shared/stores/**/*.test.ts"],
```

- [ ] **Step 2: Escrever o teste que falha**

```ts
// src/shared/stores/use-last-error-store.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { LAST_ERROR_TTL_MS, useLastErrorStore } from "@/shared/stores/use-last-error-store";

const BASE = 1_700_000_000_000;

function captured(capturedAt: number) {
  return {
    sentryEventId: "evt-1",
    requestId: "req-1",
    route: "/dashboard/clients",
    capturedAt,
  };
}

describe("useLastErrorStore", () => {
  beforeEach(() => {
    useLastErrorStore.getState().clearLastError();
  });

  it("começa vazio", () => {
    expect(useLastErrorStore.getState().lastError).toBeNull();
  });

  it("devolve o erro dentro da janela de validade", () => {
    useLastErrorStore.getState().setLastError(captured(BASE));

    expect(useLastErrorStore.getState().readFreshError(BASE + 60_000)).toEqual(
      captured(BASE),
    );
  });

  it("descarta erro além do TTL", () => {
    useLastErrorStore.getState().setLastError(captured(BASE));

    expect(
      useLastErrorStore.getState().readFreshError(BASE + LAST_ERROR_TTL_MS + 1),
    ).toBeNull();
  });

  it("mantém apenas o erro mais recente", () => {
    useLastErrorStore.getState().setLastError(captured(BASE));
    useLastErrorStore.getState().setLastError({ ...captured(BASE + 1), sentryEventId: "evt-2" });

    expect(useLastErrorStore.getState().lastError?.sentryEventId).toBe("evt-2");
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm run test:unit`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 4: Implementar o store**

```ts
// src/shared/stores/use-last-error-store.ts
import { create } from "zustand";

/**
 * Último erro da sessão, para o widget de feedback oferecer o vínculo com o
 * evento do Sentry. Não é persistido: anexar erro de outra aba ou de ontem a um
 * relato de hoje aponta o triador para o lugar errado.
 */
export const LAST_ERROR_TTL_MS = 10 * 60 * 1000;

export type CapturedError = {
  sentryEventId: string | null;
  requestId: string | null;
  route: string;
  capturedAt: number;
};

type LastErrorState = {
  lastError: CapturedError | null;
  setLastError: (error: CapturedError) => void;
  clearLastError: () => void;
  readFreshError: (nowMs: number) => CapturedError | null;
};

export const useLastErrorStore = create<LastErrorState>()((set, get) => ({
  lastError: null,
  setLastError: (lastError) => set({ lastError }),
  clearLastError: () => set({ lastError: null }),
  readFreshError: (nowMs) => {
    const { lastError } = get();
    if (!lastError) return null;
    return nowMs - lastError.capturedAt <= LAST_ERROR_TTL_MS ? lastError : null;
  },
}));
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 6: Capturar no interceptor do `apiClient`**

Em `src/lib/api/http-client.ts`, adicionar aos imports do topo:

```ts
import * as Sentry from "@sentry/nextjs";
import { severityForHttpStatus, shouldReportHttpStatus } from "@/lib/observability/error-taxonomy";
import { REQUEST_ID_HEADER } from "@/lib/observability/request-id";
import { useLastErrorStore } from "@/shared/stores/use-last-error-store";
```

E, no handler de erro do `interceptors.response`, imediatamente antes do `return Promise.reject(error)` existente:

```ts
    if (typeof window !== "undefined" && status && shouldReportHttpStatus(status)) {
      const route = original?.url ?? "unknown";
      const requestId = error.response?.headers?.[REQUEST_ID_HEADER] ?? null;
      const eventId = Sentry.withScope((scope) => {
        scope.setLevel(severityForHttpStatus(status));
        scope.setTags({
          "error.code": error.response?.data?.error?.code ?? "UNKNOWN",
          "api.route": route,
          request_id: requestId ?? "none",
        });
        // Agrupa por rota e código, não por mensagem — mensagem varia por locale.
        scope.setFingerprint([
          "api-client",
          original?.method ?? "get",
          route,
          error.response?.data?.error?.code ?? "UNKNOWN",
        ]);
        return Sentry.captureException(error);
      });

      useLastErrorStore.getState().setLastError({
        sentryEventId: eventId ?? null,
        requestId,
        route: window.location.pathname,
        capturedAt: Date.now(),
      });
    }
```

- [ ] **Step 7: Verificar**

Run: `npm run test:unit && npx tsc --noEmit && npm run lint`
Expected: PASS, `No errors found`, sem problema novo no lint.

- [ ] **Step 8: Commit**

```bash
git add src/shared/stores/ src/lib/api/http-client.ts vitest.config.ts
git commit -m "feat(observability): captura 5xx no cliente e guarda o ultimo erro da sessao"
```

---

### Task 5: Error boundaries com convite a reportar

**Files:**
- Modify: `src/app/global-error.tsx`
- Create: `src/app/[locale]/error.tsx`
- Create: `messages/pt-BR/feedback.json`
- Create: `messages/en/feedback.json`
- Modify: `src/i18n/request.ts` (três blocos de `loadMessages`)

**Interfaces:**
- Consumes: `useLastErrorStore`, `CapturedError` (Task 4).
- Produces: namespace i18n `feedback` com as chaves `errorBoundary.*` e `widget.*`; o `error.tsx` grava o erro no store para o widget encontrar.

- [ ] **Step 1: Criar as mensagens pt-BR**

```json
{
  "errorBoundary": {
    "title": "Algo quebrou nesta tela",
    "description": "O erro foi registrado. Se puder contar o que você estava fazendo, o conserto vem mais rápido.",
    "retry": "Tentar de novo",
    "report": "Reportar problema",
    "eventLabel": "Código do erro"
  },
  "widget": {
    "trigger": "Enviar feedback",
    "title": "Enviar feedback",
    "description": "Sugestão, problema ou dúvida — tudo chega para a equipe.",
    "typeLabel": "Tipo",
    "typeBug": "Problema",
    "typeSuggestion": "Sugestão",
    "typeQuestion": "Dúvida",
    "messageLabel": "O que aconteceu?",
    "messagePlaceholder": "Descreva com suas palavras. Quanto mais concreto, melhor.",
    "attachLabel": "Anexar detalhes técnicos do último erro",
    "attachHint": "Envia o código do erro e a rota. Nenhum dado de paciente vai junto.",
    "submit": "Enviar",
    "cancel": "Cancelar",
    "success": "Feedback enviado. Obrigado.",
    "messageTooShort": "Escreva ao menos 10 caracteres.",
    "messageTooLong": "Máximo de 2000 caracteres."
  }
}
```

- [ ] **Step 2: Criar as mensagens en**

```json
{
  "errorBoundary": {
    "title": "Something broke on this screen",
    "description": "The error was recorded. Telling us what you were doing makes the fix faster.",
    "retry": "Try again",
    "report": "Report problem",
    "eventLabel": "Error code"
  },
  "widget": {
    "trigger": "Send feedback",
    "title": "Send feedback",
    "description": "Suggestion, problem or question — it all reaches the team.",
    "typeLabel": "Type",
    "typeBug": "Problem",
    "typeSuggestion": "Suggestion",
    "typeQuestion": "Question",
    "messageLabel": "What happened?",
    "messagePlaceholder": "Describe it in your own words. The more concrete, the better.",
    "attachLabel": "Attach technical details from the last error",
    "attachHint": "Sends the error code and route. No patient data goes with it.",
    "submit": "Send",
    "cancel": "Cancel",
    "success": "Feedback sent. Thank you.",
    "messageTooShort": "Write at least 10 characters.",
    "messageTooLong": "2000 characters maximum."
  }
}
```

- [ ] **Step 3: Registrar o namespace**

Em `src/i18n/request.ts`, adicionar a linha abaixo em **cada um dos três** blocos de retorno (`pt-BR`, `en`, `default`), logo após a linha de `agenda`. No bloco `en` use `../../messages/en/feedback.json`; nos outros dois, `../../messages/pt-BR/feedback.json`:

```ts
        feedback: (await import("../../messages/pt-BR/feedback.json")).default,
```

- [ ] **Step 4: Reescrever o `global-error.tsx`**

O arquivo atual é o gerado pelo wizard (`NextError`, `lang="en"` cravado). Substituir por inteiro:

```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Último recurso: pega erro que derrubou até o layout raiz, então não pode
 * depender de provider de i18n nem de componente da UI compartilhada.
 * Texto fixo em pt-BR de propósito.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Algo quebrou</h1>
        <p style={{ marginTop: "0.75rem", color: "#666" }}>
          O erro foi registrado. Recarregue a página para continuar.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid #ccc" }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Criar o boundary de rota**

```tsx
// src/app/[locale]/error.tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useLastErrorStore } from "@/shared/stores/use-last-error-store";

/**
 * Boundary das rotas com locale. Registra o evento no store para o widget de
 * feedback já abrir com o vínculo pronto — é aqui que o usuário está no momento
 * em que ele de fato quer reportar.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("feedback.errorBoundary");
  const setLastError = useLastErrorStore((s) => s.setLastError);
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    const id = Sentry.captureException(error);
    setEventId(id ?? null);
    setLastError({
      sentryEventId: id ?? null,
      requestId: null,
      route: window.location.pathname,
      capturedAt: Date.now(),
    });
  }, [error, setLastError]);

  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground max-w-md text-sm">{t("description")}</p>
      {eventId ? (
        <p className="text-muted-foreground font-mono text-xs">
          {t("eventLabel")}: {eventId.slice(0, 8)}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>
          {t("retry")}
        </Button>
      </div>
    </div>
  );
}
```

O botão de reportar é adicionado na Task 9, quando o widget existir.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm run build 2>&1 | grep -c "Edge Instrumentation"`
Expected: `No errors found`, contagem `0`.

- [ ] **Step 7: Commit**

```bash
git add src/app/global-error.tsx "src/app/[locale]/error.tsx" messages/ src/i18n/request.ts
git commit -m "feat(feedback): adiciona error boundaries e namespace i18n"
```

---

### Task 6: Modelo `FeedbackReport`

**Files:**
- Modify: `packages/prisma/schema.prisma`
- Modify: `docs/ARCHITECTURE.md` (§8)

**Interfaces:**
- Consumes: nada.
- Produces: `FeedbackReport`, `enum FeedbackType { bug | suggestion | question | other }`, `enum FeedbackStatus { open | triaged | in_progress | resolved | wont_fix | duplicate }`.

- [ ] **Step 1: Declarar os enums**

Em `packages/prisma/schema.prisma`, junto dos demais enums:

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
```

- [ ] **Step 2: Declarar o modelo**

```prisma
model FeedbackReport {
  id            String         @id @default(cuid())
  tenantId      String
  tenant        Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  /** Nulo quando o autor é removido: o relato sobrevive à saída da pessoa. */
  authorUserId  String?
  author        User?          @relation("FeedbackReportAuthor", fields: [authorUserId], references: [id], onDelete: SetNull)
  type          FeedbackType
  status        FeedbackStatus @default(open)
  message       String         @db.Text
  sentryEventId String?
  requestId     String?
  /** Apenas o pathname. Query string carrega busca por nome de paciente. */
  pagePath      String
  userAgent     String?
  appVersion    String?
  locale        String
  adminNote     String?        @db.Text
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  resolvedAt    DateTime?

  @@index([tenantId, createdAt])
  @@index([status, createdAt])
  @@index([sentryEventId])
}
```

- [ ] **Step 3: Adicionar os campos inversos**

Em `model Tenant`, junto das outras relações:

```prisma
  feedbackReports             FeedbackReport[]
```

Em `model User`:

```prisma
  feedbackReportsAuthored           FeedbackReport[]              @relation("FeedbackReportAuthor")
```

- [ ] **Step 4: Gerar a migration**

Run: `npm run db:migrate -- --name add_feedback_report`
Expected: migration criada em `packages/prisma/migrations/` e cliente Prisma regenerado.

- [ ] **Step 5: Conferir que o cliente enxerga o modelo**

Run: `npx tsc --noEmit`
Expected: `No errors found`.

- [ ] **Step 6: Registrar na documentação**

Em `docs/ARCHITECTURE.md`, §8 (modelo de dados), adicionar `FeedbackReport` à lista de entidades com uma linha descrevendo o propósito e o vínculo com `sentryEventId`.

- [ ] **Step 7: Commit**

```bash
git add packages/prisma/ docs/ARCHITECTURE.md
git commit -m "feat(feedback): adiciona modelo FeedbackReport"
```

---

### Task 7: `POST /api/v1/feedback`

**Files:**
- Create: `src/lib/validators/feedback.ts`
- Create: `src/types/api/feedback-v1.ts`
- Create: `src/infrastructure/repositories/feedback-report.repository.ts`
- Create: `src/app/api/v1/feedback/route.ts`
- Modify: `public/openapi.json`

**Interfaces:**
- Consumes: modelo `FeedbackReport` (Task 6), `currentRequestId` (Task 3).
- Produces: `createFeedbackBodySchema`, `type FeedbackDto`, `type CreateFeedbackRequestBody`, `type CreateFeedbackResponseData`, `feedbackReportPrismaRepository.create(...)`, `feedbackReportPrismaRepository.listForSuperAdmin(...)`, `feedbackReportPrismaRepository.updateStatus(...)`.

- [ ] **Step 1: Escrever o schema Zod**

```ts
// src/lib/validators/feedback.ts
import { z } from "zod";

export const createFeedbackBodySchema = z.object({
  type: z.enum(["bug", "suggestion", "question", "other"]),
  message: z.string().trim().min(10).max(2000),
  sentryEventId: z.string().trim().max(64).nullable().optional(),
  requestId: z.string().trim().max(128).nullable().optional(),
  // Só o pathname: a rota rejeita qualquer coisa com query string.
  pagePath: z.string().trim().min(1).max(512).regex(/^\/[^?#]*$/),
  locale: z.string().trim().min(2).max(10),
});

export const listFeedbackQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(["open", "triaged", "in_progress", "resolved", "wont_fix", "duplicate"])
    .optional(),
  type: z.enum(["bug", "suggestion", "question", "other"]).optional(),
  tenantId: z.string().trim().optional(),
});

export const patchFeedbackBodySchema = z
  .object({
    status: z
      .enum(["open", "triaged", "in_progress", "resolved", "wont_fix", "duplicate"])
      .optional(),
    adminNote: z.string().trim().max(5000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });
```

- [ ] **Step 2: Escrever os tipos de contrato**

```ts
// src/types/api/feedback-v1.ts
import type { ApiPagination } from "@/lib/api/pagination";

export type FeedbackType = "bug" | "suggestion" | "question" | "other";

export type FeedbackStatus =
  | "open"
  | "triaged"
  | "in_progress"
  | "resolved"
  | "wont_fix"
  | "duplicate";

export type FeedbackDto = {
  id: string;
  tenantId: string;
  type: FeedbackType;
  status: FeedbackStatus;
  message: string;
  sentryEventId: string | null;
  requestId: string | null;
  pagePath: string;
  appVersion: string | null;
  locale: string;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  author: { id: string; name: string | null; email: string } | null;
};

export type CreateFeedbackRequestBody = {
  type: FeedbackType;
  message: string;
  sentryEventId?: string | null;
  requestId?: string | null;
  pagePath: string;
  locale: string;
};

export type CreateFeedbackResponseData = {
  feedback: FeedbackDto;
};

export type ListFeedbackQueryParams = {
  page?: number;
  limit?: number;
  status?: FeedbackStatus;
  type?: FeedbackType;
  tenantId?: string;
};

export type FeedbackListResponseData = {
  data: FeedbackDto[];
  pagination: ApiPagination;
};

export type UpdateFeedbackRequestBody = {
  status?: FeedbackStatus;
  adminNote?: string | null;
};

export type UpdateFeedbackResponseData = {
  feedback: FeedbackDto;
};
```

- [ ] **Step 3: Escrever o repositório**

```ts
// src/infrastructure/repositories/feedback-report.repository.ts
import type { FeedbackStatus, FeedbackType, Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";

const authorSelect = { select: { id: true, name: true, email: true } } as const;

export const feedbackReportPrismaRepository = {
  async create(input: {
    tenantId: string;
    authorUserId: string;
    type: FeedbackType;
    message: string;
    sentryEventId: string | null;
    requestId: string | null;
    pagePath: string;
    userAgent: string | null;
    appVersion: string | null;
    locale: string;
  }) {
    return prisma.feedbackReport.create({
      data: input,
      include: { author: authorSelect },
    });
  },

  async listForSuperAdmin(filters: {
    page: number;
    limit: number;
    status?: FeedbackStatus;
    type?: FeedbackType;
    tenantId?: string;
  }) {
    const where: Prisma.FeedbackReportWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
    };

    const [rows, totalItems] = await Promise.all([
      prisma.feedbackReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: { author: authorSelect },
      }),
      prisma.feedbackReport.count({ where }),
    ]);

    return { rows, totalItems };
  },

  async updateStatus(id: string, input: { status?: FeedbackStatus; adminNote?: string | null }) {
    return prisma.feedbackReport.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}),
        ...(input.status === "resolved" ? { resolvedAt: new Date() } : {}),
      },
      include: { author: authorSelect },
    });
  },
};
```

- [ ] **Step 4: Escrever a rota**

```ts
// src/app/api/v1/feedback/route.ts
import * as Sentry from "@sentry/nextjs";
import { feedbackReportPrismaRepository } from "@/infrastructure/repositories/feedback-report.repository";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { createFeedbackBodySchema } from "@/lib/validators/feedback";
import { toFeedbackDto } from "@/app/api/v1/feedback/to-feedback-dto";
import type { CreateFeedbackResponseData } from "@/types/api/feedback-v1";

export const dynamic = "force-dynamic";

/** Relato de feedback do usuário autenticado. Sugestão, problema ou dúvida. */
export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const memberErr = await assertActiveTenantMembership(
    auth.session!,
    tenantCtx.tenantId!,
    request,
    apiT,
  );
  if (memberErr) return memberErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = createFeedbackBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const row = await feedbackReportPrismaRepository.create({
    tenantId: tenantCtx.tenantId!,
    authorUserId: auth.session!.user.id,
    type: parsed.data.type,
    message: parsed.data.message,
    sentryEventId: parsed.data.sentryEventId ?? null,
    requestId: parsed.data.requestId ?? null,
    pagePath: parsed.data.pagePath,
    userAgent: request.headers.get("user-agent"),
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    locale: parsed.data.locale,
  });

  mirrorToSentry(row.type, row.sentryEventId, row.message);

  const payload: CreateFeedbackResponseData = { feedback: toFeedbackDto(row) };
  return jsonSuccess(payload, { status: 201 });
}

/**
 * Espelho no Sentry, fora do caminho crítico: o Postgres é a fonte de verdade e
 * indisponibilidade do Sentry não pode derrubar o relato do usuário.
 */
function mirrorToSentry(type: string, sentryEventId: string | null, message: string) {
  if (type !== "bug" || !sentryEventId) return;
  try {
    Sentry.captureFeedback({ associatedEventId: sentryEventId, message });
  } catch {
    // silêncio proposital — ver comentário acima
  }
}
```

- [ ] **Step 5: Escrever o mapeador de DTO**

```ts
// src/app/api/v1/feedback/to-feedback-dto.ts
import type { FeedbackReport, User } from "@prisma/client";
import type { FeedbackDto } from "@/types/api/feedback-v1";

type RowWithAuthor = FeedbackReport & {
  author: Pick<User, "id" | "name" | "email"> | null;
};

export function toFeedbackDto(row: RowWithAuthor): FeedbackDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.type,
    status: row.status,
    message: row.message,
    sentryEventId: row.sentryEventId,
    requestId: row.requestId,
    pagePath: row.pagePath,
    appVersion: row.appVersion,
    locale: row.locale,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    author: row.author
      ? { id: row.author.id, name: row.author.name, email: row.author.email }
      : null,
  };
}
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: `No errors found`.

- [ ] **Step 7: Documentar no OpenAPI**

Em `public/openapi.json`, adicionar o path `/api/v1/feedback` com a operação `post`: `requestBody` refletindo `CreateFeedbackRequestBody`, resposta `201` com o envelope de sucesso contendo `feedback`, e as respostas `400`, `401`, `403` e `422`. Registrar os schemas `FeedbackDto`, `FeedbackType` e `FeedbackStatus` em `components.schemas`, seguindo o formato dos paths vizinhos.

- [ ] **Step 8: Commit**

```bash
git add src/lib/validators/feedback.ts src/types/api/feedback-v1.ts src/infrastructure/repositories/feedback-report.repository.ts src/app/api/v1/feedback/ public/openapi.json
git commit -m "feat(feedback): adiciona POST /api/v1/feedback com espelho no Sentry"
```

---

### Task 8: Rotas de triagem (`super_admin`)

**Files:**
- Create: `src/app/api/v1/admin/feedback/route.ts`
- Create: `src/app/api/v1/admin/feedback/[id]/route.ts`
- Modify: `public/openapi.json`

**Interfaces:**
- Consumes: `feedbackReportPrismaRepository`, `toFeedbackDto`, `listFeedbackQuerySchema`, `patchFeedbackBodySchema` (Task 7).
- Produces: `GET /api/v1/admin/feedback` → `FeedbackListResponseData`; `PATCH /api/v1/admin/feedback/{id}` → `UpdateFeedbackResponseData`.

- [ ] **Step 1: Escrever a listagem**

```ts
// src/app/api/v1/admin/feedback/route.ts
import { feedbackReportPrismaRepository } from "@/infrastructure/repositories/feedback-report.repository";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { buildPagination } from "@/lib/api/pagination";
import { requireSessionOr401, superAdminOr403 } from "@/lib/auth/guards";
import { listFeedbackQuerySchema } from "@/lib/validators/feedback";
import { toFeedbackDto } from "@/app/api/v1/feedback/to-feedback-dto";
import type { FeedbackListResponseData } from "@/types/api/feedback-v1";

export const dynamic = "force-dynamic";

/** Fila de triagem de feedback, cross-tenant (apenas `super_admin`). */
export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const forbidden = await superAdminOr403(auth.session!, request, apiT);
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const parsed = listFeedbackQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const { rows, totalItems } = await feedbackReportPrismaRepository.listForSuperAdmin(parsed.data);

  const payload: FeedbackListResponseData = {
    data: rows.map(toFeedbackDto),
    pagination: buildPagination(parsed.data.page, parsed.data.limit, totalItems),
  };
  return jsonSuccess(payload);
}
```

- [ ] **Step 2: Escrever a atualização**

```ts
// src/app/api/v1/admin/feedback/[id]/route.ts
import { feedbackReportPrismaRepository } from "@/infrastructure/repositories/feedback-report.repository";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireSessionOr401, superAdminOr403 } from "@/lib/auth/guards";
import { patchFeedbackBodySchema } from "@/lib/validators/feedback";
import { toFeedbackDto } from "@/app/api/v1/feedback/to-feedback-dto";
import type { UpdateFeedbackResponseData } from "@/types/api/feedback-v1";

export const dynamic = "force-dynamic";

/** Muda status e nota de triagem de um relato (apenas `super_admin`). */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const forbidden = await superAdminOr403(auth.session!, request, apiT);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = patchFeedbackBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const { id } = await context.params;
  const row = await feedbackReportPrismaRepository.updateStatus(id, parsed.data);

  const payload: UpdateFeedbackResponseData = { feedback: toFeedbackDto(row) };
  return jsonSuccess(payload);
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: `No errors found`.

- [ ] **Step 4: Documentar no OpenAPI**

Em `public/openapi.json`, adicionar os paths `/api/v1/admin/feedback` (`get`, com os query params `page`, `limit`, `status`, `type`, `tenantId`) e `/api/v1/admin/feedback/{id}` (`patch`). Ambos com resposta `403` documentada, seguindo o formato dos demais paths sob `/api/v1/admin`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/admin/feedback/ public/openapi.json
git commit -m "feat(feedback): adiciona rotas de triagem para super_admin"
```

---

### Task 9: Widget de feedback

**Files:**
- Create: `src/features/feedback/app/types/api.ts`
- Create: `src/features/feedback/app/utils/feedback-schema.ts`
- Create: `src/features/feedback/app/services/feedback.service.ts`
- Create: `src/features/feedback/app/hooks/use-feedback-form.ts`
- Create: `src/features/feedback/app/components/feedback-dialog.tsx`
- Create: `src/features/feedback/app/components/feedback-launcher.tsx`
- Modify: `src/shared/components/layout/app-sidebar.tsx:198` (dentro de `SidebarFooter`)
- Modify: `src/app/[locale]/error.tsx` (botão de reportar)

**Interfaces:**
- Consumes: `CreateFeedbackRequestBody`, `CreateFeedbackResponseData` (Task 7); `useLastErrorStore`, `CapturedError` (Task 4); namespace i18n `feedback` (Task 5).
- Produces: `<FeedbackLauncher />` (sem props), `useFeedbackDialogStore` com `{ open: boolean; forcedType: FeedbackType | null; openDialog(forcedType?: FeedbackType): void; closeDialog(): void }`.

- [ ] **Step 1: Criar o barrel de tipos**

```ts
// src/features/feedback/app/types/api.ts
export type * from "@/types/api/feedback-v1";
```

- [ ] **Step 2: Criar o schema do formulário**

```ts
// src/features/feedback/app/utils/feedback-schema.ts
import { z } from "zod";

export const feedbackFormSchema = z.object({
  type: z.enum(["bug", "suggestion", "question"]),
  message: z.string().trim().min(10).max(2000),
  attachTechnicalDetails: z.boolean(),
});

export type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;
```

- [ ] **Step 3: Criar o service**

```ts
// src/features/feedback/app/services/feedback.service.ts
import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type {
  CreateFeedbackRequestBody,
  CreateFeedbackResponseData,
} from "@/features/feedback/app/types/api";

/** `toastSuccessMessage` é lido pelo interceptor do `apiClient` (ver `src/types/axios-augment.d.ts`). */
export async function createFeedback(
  input: CreateFeedbackRequestBody,
  toastSuccessMessage: string,
): Promise<CreateFeedbackResponseData> {
  const res = await apiClient.post<ApiEnvelope<CreateFeedbackResponseData>>(
    "/api/v1/feedback",
    input,
    { toastSuccessMessage },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}
```

- [ ] **Step 4: Criar o hook do formulário**

```ts
// src/features/feedback/app/hooks/use-feedback-form.ts
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { createFeedback } from "@/features/feedback/app/services/feedback.service";
import {
  feedbackFormSchema,
  type FeedbackFormValues,
} from "@/features/feedback/app/utils/feedback-schema";
import type { FeedbackType } from "@/features/feedback/app/types/api";
import { useLastErrorStore } from "@/shared/stores/use-last-error-store";

export function useFeedbackForm(forcedType: FeedbackType | null, onDone: () => void) {
  const t = useTranslations("feedback.widget");
  const locale = useLocale();
  const readFreshError = useLastErrorStore((s) => s.readFreshError);
  const clearLastError = useLastErrorStore((s) => s.clearLastError);
  const freshError = readFreshError(Date.now());

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      type: forcedType === "other" ? "question" : (forcedType ?? (freshError ? "bug" : "suggestion")),
      message: "",
      attachTechnicalDetails: freshError !== null,
    },
  });

  async function onValid(values: FeedbackFormValues) {
    const attach = values.attachTechnicalDetails && freshError !== null;
    await createFeedback(
      {
        type: values.type,
        message: values.message,
        sentryEventId: attach ? freshError.sentryEventId : null,
        requestId: attach ? freshError.requestId : null,
        pagePath: window.location.pathname,
        locale,
      },
      t("success"),
    );
    if (attach) clearLastError();
    form.reset();
    onDone();
  }

  return { form, onValid, freshError };
}
```

- [ ] **Step 5: Criar o dialog**

```tsx
// src/features/feedback/app/components/feedback-dialog.tsx
"use client";

import { useTranslations } from "next-intl";
import { Form, FormTextarea } from "@/shared/components/forms";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { useFeedbackForm } from "@/features/feedback/app/hooks/use-feedback-form";
import type { FeedbackType } from "@/features/feedback/app/types/api";

const TYPE_OPTIONS: { value: "bug" | "suggestion" | "question"; labelKey: string }[] = [
  { value: "bug", labelKey: "typeBug" },
  { value: "suggestion", labelKey: "typeSuggestion" },
  { value: "question", labelKey: "typeQuestion" },
];

export function FeedbackDialog({
  open,
  forcedType,
  onOpenChange,
}: {
  open: boolean;
  forcedType: FeedbackType | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("feedback.widget");
  const { form, onValid, freshError } = useFeedbackForm(forcedType, () => onOpenChange(false));
  const selectedType = form.watch("type");
  const attach = form.watch("attachTechnicalDetails");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <StandardDialogContent title={t("title")} description={t("description")}>
        <Form {...form}>
          <form
            id="feedback-form"
            onSubmit={form.handleSubmit(onValid)}
            className="flex flex-col gap-4 p-4"
          >
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("typeLabel")}</span>
              <div className="flex gap-2">
                {TYPE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={selectedType === option.value ? "default" : "outline"}
                    onClick={() => form.setValue("type", option.value)}
                  >
                    {t(option.labelKey)}
                  </Button>
                ))}
              </div>
            </div>

            <FormTextarea
              name="message"
              label={t("messageLabel")}
              placeholder={t("messagePlaceholder")}
              rows={5}
            />

            {freshError ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={attach}
                  onChange={(e) => form.setValue("attachTechnicalDetails", e.target.checked)}
                />
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    {t("attachLabel")}
                    {freshError.sentryEventId ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {freshError.sentryEventId.slice(0, 8)}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground text-xs">{t("attachHint")}</span>
                </span>
              </label>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {t("submit")}
              </Button>
            </div>
          </form>
        </Form>
      </StandardDialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Criar o launcher**

```tsx
// src/features/feedback/app/components/feedback-launcher.tsx
"use client";

import { MessageSquarePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { create } from "zustand";
import { Button } from "@/shared/components/ui/button";
import { useSidebar } from "@/shared/components/ui/sidebar";
import { FeedbackDialog } from "@/features/feedback/app/components/feedback-dialog";
import type { FeedbackType } from "@/features/feedback/app/types/api";

type FeedbackDialogState = {
  open: boolean;
  forcedType: FeedbackType | null;
  openDialog: (forcedType?: FeedbackType) => void;
  closeDialog: () => void;
};

/** Store própria porque a tela de erro abre o dialog de fora da sidebar. */
export const useFeedbackDialogStore = create<FeedbackDialogState>()((set) => ({
  open: false,
  forcedType: null,
  openDialog: (forcedType) => set({ open: true, forcedType: forcedType ?? null }),
  closeDialog: () => set({ open: false, forcedType: null }),
}));

/**
 * Gatilho no rodapé da sidebar no desktop; botão flutuante quando a sidebar está
 * recolhida ou em mobile, onde ela vira sheet e some da tela.
 */
export function FeedbackLauncher() {
  const t = useTranslations("feedback.widget");
  const { state, isMobile } = useSidebar();
  const { open, forcedType, openDialog, closeDialog } = useFeedbackDialogStore();
  const floating = isMobile || state === "collapsed";

  return (
    <>
      {floating ? (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label={t("trigger")}
          onClick={() => openDialog()}
          className="fixed bottom-4 left-4 z-30 size-11 rounded-full shadow-lg"
        >
          <MessageSquarePlus className="size-5" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => openDialog()}
          className="h-auto w-full justify-start gap-2 px-2 py-2"
        >
          <MessageSquarePlus className="size-4 shrink-0" />
          <span className="truncate">{t("trigger")}</span>
        </Button>
      )}

      <FeedbackDialog
        open={open}
        forcedType={forcedType}
        onOpenChange={(next) => (next ? openDialog(forcedType ?? undefined) : closeDialog())}
      />
    </>
  );
}
```

- [ ] **Step 7: Montar na sidebar**

Em `src/shared/components/layout/app-sidebar.tsx`, adicionar o import e inserir `<FeedbackLauncher />` como primeiro filho do `<SidebarFooter>` existente (linha 198), acima do `<DropdownMenu>`. **Remover** `group-data-[collapsible=icon]:hidden` do `className` do `SidebarFooter` não é necessário: o launcher já troca para botão flutuante quando `state === "collapsed"`.

```tsx
import { FeedbackLauncher } from "@/features/feedback/app/components/feedback-launcher";
```

- [ ] **Step 8: Ligar o botão de reportar na tela de erro**

Em `src/app/[locale]/error.tsx`, adicionar o import e o segundo botão dentro do `<div className="flex gap-2">`:

```tsx
import { useFeedbackDialogStore } from "@/features/feedback/app/components/feedback-launcher";
```

```tsx
        <Button onClick={() => useFeedbackDialogStore.getState().openDialog("bug")}>
          {t("report")}
        </Button>
```

- [ ] **Step 9: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm run build 2>&1 | grep -c "Edge Instrumentation"`
Expected: `No errors found`, sem problema novo no lint, contagem `0`.

- [ ] **Step 10: Verificação visual**

Run: `npm run dev`
Abrir `http://localhost:3000/dashboard`. Confirmar: gatilho no rodapé da sidebar; ao recolher a sidebar, ele vira botão redondo no canto inferior esquerdo; o dialog abre, valida mensagem curta e envia. Sem erro recente na sessão, o checkbox de detalhes técnicos **não** aparece.

- [ ] **Step 11: Commit**

```bash
git add src/features/feedback/ src/shared/components/layout/app-sidebar.tsx "src/app/[locale]/error.tsx"
git commit -m "feat(feedback): adiciona widget de feedback com vinculo ao ultimo erro"
```

---

### Task 10: Tela de triagem

**Files:**
- Create: `src/features/settings/app/hooks/use-feedback-triage.ts`
- Create: `src/features/settings/app/services/feedback-triage.service.ts`
- Create: `src/features/settings/app/components/feedback-triage-card.tsx`
- Modify: `src/features/settings/app/utils/section-hash.ts`
- Modify: `src/features/settings/app/components/settings-page-layout.tsx:36-47,152-180`
- Modify: `messages/pt-BR/settings.json`, `messages/en/settings.json`

**Interfaces:**
- Consumes: `FeedbackListResponseData`, `UpdateFeedbackRequestBody`, `FeedbackDto` (Tasks 7 e 8).
- Produces: seção `feedback` em `SettingsSectionId`; `<FeedbackTriageCard />` (sem props); `useFeedbackTriage()` → `{ rows, pagination, loading, filters, setFilters, setPage, changeStatus }`.

- [ ] **Step 1: Registrar a seção no hash**

Em `src/features/settings/app/utils/section-hash.ts`, adicionar `| "feedback"` ao union `SettingsSectionId` e a entrada `feedback: "feedback",` em `HASH_TO_SECTION`.

- [ ] **Step 2: Adicionar os rótulos i18n**

Em `messages/pt-BR/settings.json`, dentro de `sectionsNav`, adicionar `"feedback": "Feedback"`. Em `messages/en/settings.json`, `"feedback": "Feedback"`.

- [ ] **Step 3: Criar o service**

```ts
// src/features/settings/app/services/feedback-triage.service.ts
import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type {
  FeedbackListResponseData,
  ListFeedbackQueryParams,
  UpdateFeedbackRequestBody,
  UpdateFeedbackResponseData,
} from "@/types/api/feedback-v1";

export async function listFeedback(
  params: ListFeedbackQueryParams,
): Promise<FeedbackListResponseData> {
  const res = await apiClient.get<ApiEnvelope<FeedbackListResponseData>>(
    "/api/v1/admin/feedback",
    { params },
  );
  if (!res.data.success) throw new Error(res.data.error.message);
  return res.data.data;
}

export async function updateFeedback(
  id: string,
  input: UpdateFeedbackRequestBody,
): Promise<UpdateFeedbackResponseData> {
  const res = await apiClient.patch<ApiEnvelope<UpdateFeedbackResponseData>>(
    `/api/v1/admin/feedback/${id}`,
    input,
  );
  if (!res.data.success) throw new Error(res.data.error.message);
  return res.data.data;
}
```

- [ ] **Step 4: Criar o hook**

```ts
// src/features/settings/app/hooks/use-feedback-triage.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listFeedback,
  updateFeedback,
} from "@/features/settings/app/services/feedback-triage.service";
import type {
  FeedbackDto,
  FeedbackStatus,
  ListFeedbackQueryParams,
} from "@/types/api/feedback-v1";
import type { ApiPagination } from "@/lib/api/pagination";

export function useFeedbackTriage() {
  const [filters, setFilters] = useState<ListFeedbackQueryParams>({ page: 1, limit: 20 });
  const [rows, setRows] = useState<FeedbackDto[]>([]);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFeedback(filters);
      setRows(data.data);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = useCallback(async (id: string, status: FeedbackStatus) => {
    const { feedback } = await updateFeedback(id, { status });
    setRows((current) => current.map((row) => (row.id === id ? feedback : row)));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((current) => ({ ...current, page }));
  }, []);

  return { rows, pagination, loading, filters, setFilters, setPage, changeStatus };
}
```

- [ ] **Step 5: Criar o card de triagem**

```tsx
// src/features/settings/app/components/feedback-triage-card.tsx
"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  DataTableBody,
  DataTableEmpty,
  DataTableHeader,
  DataTablePagination,
  DataTableRoot,
  DataTableRow,
  DataTableScroll,
} from "@/shared/components/layout/data-table";
import { useFeedbackTriage } from "@/features/settings/app/hooks/use-feedback-triage";
import type { FeedbackStatus } from "@/types/api/feedback-v1";

const SENTRY_ISSUE_BASE = "https://sentry.io/organizations/tercon/issues/?query=";

const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: "open", label: "Aberto" },
  { value: "triaged", label: "Triado" },
  { value: "in_progress", label: "Em andamento" },
  { value: "resolved", label: "Resolvido" },
  { value: "wont_fix", label: "Não será feito" },
  { value: "duplicate", label: "Duplicado" },
];

/** `DataTable*` é baseado em div/ul/li, não em `<table>` — daí o grid. */
const GRID = "grid grid-cols-[6rem_minmax(0,1fr)_12rem_7rem_10rem] items-start gap-3";

export function FeedbackTriageCard() {
  const { rows, pagination, loading, setPage, changeStatus } = useFeedbackTriage();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feedback</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <DataTableRoot>
          <DataTableScroll>
            <DataTableHeader className={GRID}>
              <span>Tipo</span>
              <span>Mensagem</span>
              <span>Autor</span>
              <span>Erro</span>
              <span>Status</span>
            </DataTableHeader>

            {rows.length === 0 && !loading ? (
              <DataTableEmpty>Nenhum feedback ainda.</DataTableEmpty>
            ) : (
              <DataTableBody>
                {rows.map((row) => (
                  <DataTableRow key={row.id} className={GRID}>
                    <Badge variant="outline">{row.type}</Badge>

                    <div className="min-w-0">
                      <p className="line-clamp-3">{row.message}</p>
                      <p className="text-muted-foreground text-xs">{row.pagePath}</p>
                    </div>

                    <span className="truncate">{row.author?.email ?? "—"}</span>

                    {row.sentryEventId ? (
                      <a
                        href={`${SENTRY_ISSUE_BASE}${row.sentryEventId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex items-center gap-1 font-mono text-xs hover:underline"
                      >
                        {row.sentryEventId.slice(0, 8)}
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}

                    <Select
                      value={row.status}
                      onValueChange={(value) =>
                        void changeStatus(row.id, value as FeedbackStatus)
                      }
                    >
                      <SelectTrigger aria-label="Status do relato" className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </DataTableRow>
                ))}
              </DataTableBody>
            )}

            {pagination && pagination.totalPages > 1 ? (
              <DataTablePagination
                page={pagination.page}
                canPrev={pagination.hasPreviousPage}
                canNext={pagination.hasNextPage}
                onPrev={() => setPage(pagination.page - 1)}
                onNext={() => setPage(pagination.page + 1)}
                prevLabel="Página anterior"
                nextLabel="Próxima página"
                rangeLabel={`${pagination.totalItems} relatos`}
              />
            ) : null}
          </DataTableScroll>
        </DataTableRoot>
      </CardContent>
    </Card>
  );
}
```

`Select` do projeto é do `@base-ui/react`; conferir em um uso existente (por
exemplo `src/features/clients/app/components/clients-list.tsx`) se o trigger
precisa de `render` em vez de filho direto antes de dar o passo por concluído.

- [ ] **Step 6: Registrar a seção no layout**

Em `src/features/settings/app/components/settings-page-layout.tsx`:
1. Importar `MessageSquareWarning` de `lucide-react` e `FeedbackTriageCard`.
2. Adicionar `{ id: "feedback", icon: MessageSquareWarning, superAdminOnly: true },` a `NAV_DEFS`, logo após a entrada de `apps`.
3. Adicionar `case "feedback": return <FeedbackTriageCard />;` ao `switch` de `panelContent`.

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: `No errors found`, sem problema novo no lint.

- [ ] **Step 8: Verificação visual**

Run: `npm run dev`
Logado como `super_admin`, abrir `http://localhost:3000/dashboard/settings#feedback`. Confirmar que a seção só aparece para `super_admin`, que a lista carrega e que mudar o status persiste após recarregar.

- [ ] **Step 9: Commit**

```bash
git add src/features/settings/ messages/
git commit -m "feat(feedback): adiciona tela de triagem para super_admin"
```

---

### Task 11: E2E e verificação de LGPD

**Files:**
- Create: `e2e/feedback-widget.spec.ts`
- Create: `scripts/observability/probe-scrubber.ts`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: nenhuma API nova.

- [ ] **Step 1: Escrever o E2E do caminho feliz**

```ts
// e2e/feedback-widget.spec.ts
import { expect, test } from "@playwright/test";

test.describe("widget de feedback", () => {
  test("envia sugestão a partir do rodapé da sidebar", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: /enviar feedback/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: /sugestão/i }).click();
    await page
      .getByLabel(/o que aconteceu/i)
      .fill("A busca de pacientes podia lembrar o último filtro usado.");
    await page.getByRole("button", { name: /^enviar$/i }).click();

    await expect(page.getByText(/feedback enviado/i)).toBeVisible();
  });

  test("bloqueia mensagem curta demais", async ({ page }) => {
    await page.goto("/dashboard");

    await page.getByRole("button", { name: /enviar feedback/i }).click();
    await page.getByLabel(/o que aconteceu/i).fill("erro");
    await page.getByRole("button", { name: /^enviar$/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
```

- [ ] **Step 2: Rodar o E2E**

Run: `npx playwright test e2e/feedback-widget.spec.ts`
Expected: 2 testes passando. Se falhar por sessão, reaproveitar o setup de autenticação dos specs existentes em `e2e/`.

- [ ] **Step 3: Escrever a sonda do scrubber**

```ts
// scripts/observability/probe-scrubber.ts
/**
 * Prova que PII não sai para o Sentry. Roda o pipeline real de `beforeSend`
 * sobre um evento montado com dado sensível e falha se algo escapar.
 *
 * Uso: npx tsx scripts/observability/probe-scrubber.ts
 */
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubSentryEvent } from "../../src/lib/observability/sentry-scrubber";

const event = {
  message: "falha ao salvar paciente 529.982.247-25",
  request: { url: "https://app.local/dashboard/contacts?q=Maria+Silva" },
  extra: {
    client: {
      documentId: "52998224725",
      phone: "(11) 98765-4321",
      email: "maria@exemplo.com",
      id: "cmg3k2p9x0001abcd",
    },
  },
  exception: {
    values: [{ type: "Error", value: "telefone 11987654321 inválido" }],
  },
} as unknown as ErrorEvent;

const scrubbed = JSON.stringify(scrubSentryEvent(event));

const leaks = [
  ["CPF", "52998224725"],
  ["CPF pontuado", "529.982.247-25"],
  ["telefone", "98765-4321"],
  ["e-mail", "maria@exemplo.com"],
  ["query string", "Maria+Silva"],
].filter(([, needle]) => scrubbed.includes(needle));

if (leaks.length > 0) {
  console.error("VAZAMENTO:", leaks.map(([label]) => label).join(", "));
  console.error(scrubbed);
  process.exit(1);
}

if (!scrubbed.includes("cmg3k2p9x0001abcd")) {
  console.error("REGRESSÃO: id interno foi redigido, diagnóstico fica cego.");
  process.exit(1);
}

console.log("OK — nenhum dado sensível no evento; id interno preservado.");
```

- [ ] **Step 4: Rodar a sonda**

Run: `npx tsx scripts/observability/probe-scrubber.ts`
Expected: `OK — nenhum dado sensível no evento; id interno preservado.`

- [ ] **Step 5: Verificar o evento real no Sentry**

Com `NEXT_PUBLIC_SENTRY_DSN` preenchido, rodar `npm run dev`, provocar um 500 em qualquer rota autenticada e abrir o widget: o checkbox de detalhes técnicos deve aparecer pré-marcado com o eventId. Enviar o relato e confirmar em `sentry.io/organizations/tercon/issues/` que o evento existe, que o feedback aparece anexado a ele e que nenhum campo de PII veio junto.

- [ ] **Step 6: Rodar a bateria completa**

Run: `npm run test:unit && npx tsc --noEmit && npm run lint && npm run build`
Expected: tudo verde; o build sem nenhuma ocorrência de `Edge Instrumentation`.

- [ ] **Step 7: Commit**

```bash
git add e2e/feedback-widget.spec.ts scripts/observability/
git commit -m "test(feedback): adiciona e2e do widget e sonda de vazamento de PII"
```
