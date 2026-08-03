# Templates do WhatsApp e janela de 24h — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o aviso de documentos de etapa chegar ao paciente fora da janela de 24h da Meta, usando template aprovado com link para o portal.

**Architecture:** O cliente Graph ganha `sendTemplateMessage`. Um catálogo `WhatsAppTemplate` por tenant é sincronizado da Meta sob demanda. Cada `PathwayStage` aponta para um template; sem template, a etapa simplesmente não avisa por WhatsApp (estado válido, não erro). O dispatcher deixa de enviar documento e mensagem interativa e passa a enviar um template que leva ao portal do paciente.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Prisma 6 + PostgreSQL 16, Zod, BullMQ, Vitest (novo neste plano).

**Spec:** `docs/superpowers/specs/2026-08-03-whatsapp-templates-janela-24h-design.md`

## Global Constraints

- Idioma: respostas ao usuário em pt-BR; código e símbolos exportados em inglês.
- Camadas: `domain` ← `application` ← `infrastructure` ← `app`/`features`. Nada de Prisma em `route.ts`.
- Envelope de API: `jsonSuccess(data)` / `jsonError(code, message, status)` de `src/lib/api-response.ts`. Não criar wrapper alternativo.
- Guards em ordem: `requireSessionOr401` → `getActiveTenantIdOr400` → `assertActiveTenantMembership`. Rotas de configuração do tenant exigem `assertTenantAdminOrSuper`.
- Validação: schemas Zod em `src/lib/validators/<domínio>.ts`. Proibido `interface`/`type` de contrato dentro de `route.ts`.
- Tipos de API em `src/types/api/<domínio>-v1.ts`. Query string com sufixo `QueryParams`, corpo de sucesso com sufixo `ResponseData`.
- Arquivos em kebab-case; componentes React em PascalCase.
- Ao alterar rota `/api/v1/*` → atualizar `public/openapi.json`.
- Ao alterar modelo Prisma → conferir §8 de `docs/ARCHITECTURE.md`.
- Segredos do tenant cifrados com `encryptTenantSecret` (AES-256-GCM, `WHATSAPP_ENCRYPTION_KEY`).
- LGPD: `AuditEvent` sem conteúdo clínico; log sem PII, só ids.
- Commits em Conventional Commits, direto na `main`, sem trailer `Co-Authored-By`.
- Gates que precisam continuar passando: `npx tsc --noEmit` limpo, e `npm run lint` sem erro novo (baseline atual: 2 erros, 5 warnings).

---

### Task 1: Infraestrutura de teste unitário (Vitest)

O projeto não tem runner de teste unitário — só Playwright para E2E. Todo o resto do plano depende disto.

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/utils/__tests__/timing-safe-compare.test.ts`
- Modify: `package.json` (scripts + devDependencies)

**Interfaces:**
- Consumes: nada
- Produces: comandos `npm run test` e `npm run test:watch`; alias `@/*` resolvido nos testes

- [ ] **Step 1: Instalar dependências**

```bash
npm i -D vitest@^3 vite-tsconfig-paths@^5
```

- [ ] **Step 2: Criar a config**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // E2E é Playwright; não deixar o Vitest tentar rodar e2e/
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
  },
});
```

- [ ] **Step 3: Adicionar os scripts**

Em `package.json`, junto dos scripts existentes:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Escrever um teste que prova que a infra funciona**

`src/lib/utils/__tests__/timing-safe-compare.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { timingSafeEqualStrings } from "@/lib/utils/timing-safe-compare";

describe("timingSafeEqualStrings", () => {
  it("aceita strings iguais", () => {
    expect(timingSafeEqualStrings("abc123", "abc123")).toBe(true);
  });

  it("rejeita strings diferentes de mesmo tamanho", () => {
    expect(timingSafeEqualStrings("abc123", "abc124")).toBe(false);
  });

  it("rejeita strings de tamanhos diferentes sem lançar", () => {
    expect(timingSafeEqualStrings("abc", "abcdef")).toBe(false);
  });

  it("rejeita string vazia contra não vazia", () => {
    expect(timingSafeEqualStrings("", "a")).toBe(false);
  });
});
```

Este teste também cobre o helper criado no commit `b8c1494`, que hoje não tem teste.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm run test`
Expected: 4 testes passando. Se o alias `@/` falhar, o `vite-tsconfig-paths` não foi carregado — conferir o plugin na config.

- [ ] **Step 6: Confirmar que o tsc não quebrou**

Run: `npx tsc --noEmit`
Expected: `No errors found`. Se reclamar dos globais do Vitest, é porque `describe`/`it` estão sendo importados — eles são, então não deve ocorrer.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/utils/__tests__/timing-safe-compare.test.ts
git commit -m "test: configura Vitest e cobre o helper de comparação timing-safe

Primeiro runner de teste unitário do projeto — havia só Playwright para E2E.
O alias @/ vem do tsconfig via vite-tsconfig-paths, e e2e/ fica excluído para
o Vitest não tentar rodar os specs do Playwright."
```

---

### Task 2: `sendTemplateMessage` no cliente Graph

**Files:**
- Modify: `src/infrastructure/whatsapp/whatsapp-cloud-client.ts`
- Test: `src/infrastructure/whatsapp/__tests__/whatsapp-cloud-client.test.ts`

**Interfaces:**
- Consumes: `metaFetch`, `BASE_URL`, `SendMessageResponse` (já existem no arquivo)
- Produces:
  ```ts
  export type WhatsAppTemplatePayload = {
    name: string;
    languageCode: string;
    bodyParams: string[];
  };
  export async function sendTemplateMessage(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    template: WhatsAppTemplatePayload,
  ): Promise<string>   // wamid
  ```

- [ ] **Step 1: Escrever o teste que falha**

`src/infrastructure/whatsapp/__tests__/whatsapp-cloud-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTemplateMessage } from "@/infrastructure/whatsapp/whatsapp-cloud-client";

function mockFetchOk() {
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      messaging_product: "whatsapp",
      contacts: [{ input: "5511999999999", wa_id: "5511999999999" }],
      messages: [{ id: "wamid.TEST" }],
    }),
  }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendTemplateMessage", () => {
  it("monta o payload type=template com os parâmetros na ordem recebida", async () => {
    const spy = mockFetchOk();

    const wamid = await sendTemplateMessage("PHONE_ID", "TOKEN", "5511999999999", {
      name: "aviso_documentos",
      languageCode: "pt_BR",
      bodyParams: ["Maria", "3", "Exames pré-operatórios", "https://app/portal"],
    });

    expect(wamid).toBe("wamid.TEST");

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/PHONE_ID/messages");

    const payload = JSON.parse(init.body as string);
    expect(payload.type).toBe("template");
    expect(payload.template.name).toBe("aviso_documentos");
    expect(payload.template.language).toEqual({ code: "pt_BR" });
    expect(payload.template.components).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "Maria" },
          { type: "text", text: "3" },
          { type: "text", text: "Exames pré-operatórios" },
          { type: "text", text: "https://app/portal" },
        ],
      },
    ]);
  });

  it("omite components quando o template não tem variáveis", async () => {
    const spy = mockFetchOk();

    await sendTemplateMessage("PHONE_ID", "TOKEN", "5511999999999", {
      name: "sem_variaveis",
      languageCode: "pt_BR",
      bodyParams: [],
    });

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(init.body as string);
    expect(payload.template.components).toBeUndefined();
  });

  it("propaga erro da Meta com código e mensagem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        statusText: "Bad Request",
        json: async () => ({
          error: { message: "Template name does not exist", type: "OAuthException", code: 132001 },
        }),
      })),
    );

    await expect(
      sendTemplateMessage("PHONE_ID", "TOKEN", "5511999999999", {
        name: "inexistente",
        languageCode: "pt_BR",
        bodyParams: [],
      }),
    ).rejects.toThrow("[WhatsApp API] 132001: Template name does not exist");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- whatsapp-cloud-client`
Expected: FAIL — `sendTemplateMessage is not a function` / erro de import.

- [ ] **Step 3: Implementar**

Em `whatsapp-cloud-client.ts`, junto das outras funções públicas:

```ts
export type WhatsAppTemplatePayload = {
  name: string;
  /** Código de idioma como cadastrado na Meta (ex.: `pt_BR`). */
  languageCode: string;
  /** Variáveis do corpo, na ordem de {{1}}, {{2}}, … */
  bodyParams: string[];
};

/**
 * Send an approved template message.
 * Template messages are accepted outside the 24h customer service window.
 * Returns the WhatsApp message ID (wamid).
 */
export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  template: WhatsAppTemplatePayload,
): Promise<string> {
  const url = `${BASE_URL}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.languageCode },
      ...(template.bodyParams.length > 0
        ? {
            components: [
              {
                type: "body",
                parameters: template.bodyParams.map((text) => ({ type: "text", text })),
              },
            ],
          }
        : {}),
    },
  };

  const data = await metaFetch<SendMessageResponse>(url, accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return data.messages[0].id;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- whatsapp-cloud-client`
Expected: 3 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/whatsapp/whatsapp-cloud-client.ts src/infrastructure/whatsapp/__tests__/whatsapp-cloud-client.test.ts
git commit -m "feat(whatsapp): adiciona envio de mensagem por template

Template é aceito pela Meta fora da janela de 24h, diferente de documento,
texto e interativa — que é o que o cliente sabia enviar até agora."
```

---

### Task 3: Modelo `WhatsAppTemplate` e campos de template na etapa

**Files:**
- Modify: `packages/prisma/schema.prisma`
- Create: `packages/prisma/migrations/<timestamp>_whatsapp_templates/migration.sql` (gerado)
- Modify: `docs/ARCHITECTURE.md` (§8, tabela de modelo de dados)

**Interfaces:**
- Produces: modelo `WhatsAppTemplate`, enum `WhatsAppTemplateStatus`, valor `SKIPPED` em `DispatchStatus`, campos `whatsappTemplateName` e `whatsappTemplateLang` em `PathwayStage`, campo `templateName` em `ChannelDispatch`

- [ ] **Step 1: Editar o schema**

Adicionar o enum perto dos outros enums de WhatsApp:

```prisma
enum WhatsAppTemplateStatus {
  APPROVED
  PENDING
  REJECTED
  DISABLED
}
```

Adicionar o modelo:

```prisma
/**
 * Catálogo de templates aprovados na Meta, por tenant.
 * Sincronizado sob demanda de `GET /{wabaId}/message_templates` — não há job periódico.
 */
model WhatsAppTemplate {
  id             String                 @id @default(cuid())
  tenantId       String
  tenant         Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  /** `name` na Meta — é o identificador usado no envio. */
  name           String
  languageCode   String
  category       String
  status         WhatsAppTemplateStatus
  /** Corpo com {{n}} como aprovado; usado só para preview na UI. */
  bodyPreview    String?                @db.Text
  /** Quantidade de variáveis no corpo; valida o envio antes de chamar a Meta. */
  bodyParamCount Int                    @default(0)
  syncedAt       DateTime
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt

  @@unique([tenantId, name, languageCode])
  @@index([tenantId, status])
}
```

Em `Tenant`, adicionar a relação inversa: `whatsappTemplates WhatsAppTemplate[]`.

Em `PathwayStage`, adicionar:

```prisma
  /** Template do aviso de documentos desta etapa. Null = etapa não avisa por WhatsApp. */
  whatsappTemplateName String?
  whatsappTemplateLang String?
```

Em `DispatchStatus`, adicionar o valor `SKIPPED`.

Em `ChannelDispatch`, adicionar:

```prisma
  /** Template usado no envio; null nos registros anteriores à migração para template. */
  templateName String?
```

Em `AuditEventType`, adicionar `WHATSAPP_DISPATCH_SKIPPED`.

- [ ] **Step 2: Gerar e aplicar a migration**

```bash
npm run db:migrate -- --name whatsapp_templates
```

Se o Postgres local não estiver de pé: `docker compose up -d` antes.
Expected: migration criada e aplicada, Prisma Client regenerado.

- [ ] **Step 3: Conferir que o tsc continua limpo**

Run: `npx tsc --noEmit`
Expected: `No errors found`. Se houver erro em `switch` sobre `DispatchStatus`, é o novo `SKIPPED` sem branch — tratar no ponto indicado pelo compilador.

- [ ] **Step 4: Atualizar a §8 da ARCHITECTURE**

Adicionar `WhatsAppTemplate` à tabela de modelo de dados, com uma linha: catálogo de templates aprovados por tenant, sincronizado da Meta.

- [ ] **Step 5: Commit**

```bash
git add packages/prisma/ docs/ARCHITECTURE.md
git commit -m "feat(prisma): catálogo de templates de WhatsApp e template por etapa

PathwayStage.whatsappTemplateName nulo é estado válido: significa que a etapa
não avisa por WhatsApp, não que falta configuração. DispatchStatus ganha
SKIPPED para distinguir isso de falha de envio."
```

---

### Task 4: Port e repositório de templates

**Files:**
- Create: `src/application/ports/whatsapp-template-repository.port.ts`
- Create: `src/infrastructure/repositories/whatsapp-template.repository.ts`
- Modify: `src/infrastructure/repositories/index.ts`

**Interfaces:**
- Consumes: modelo `WhatsAppTemplate` (Task 3)
- Produces:
  ```ts
  export type WhatsAppTemplateRow = {
    id: string; name: string; languageCode: string; category: string;
    status: WhatsAppTemplateStatus; bodyPreview: string | null;
    bodyParamCount: number; syncedAt: Date;
  };
  export type UpsertWhatsAppTemplateInput = Omit<WhatsAppTemplateRow, "id">;
  export interface IWhatsAppTemplateRepository {
    listByTenant(tenantId: string): Promise<WhatsAppTemplateRow[]>;
    findApproved(tenantId: string, name: string, languageCode: string): Promise<WhatsAppTemplateRow | null>;
    replaceAllForTenant(tenantId: string, rows: UpsertWhatsAppTemplateInput[]): Promise<number>;
  }
  export const whatsAppTemplatePrismaRepository: IWhatsAppTemplateRepository
  ```

- [ ] **Step 1: Escrever o port**

`src/application/ports/whatsapp-template-repository.port.ts` com os tipos e a interface acima. Importar `WhatsAppTemplateStatus` de `@prisma/client`.

- [ ] **Step 2: Implementar o repositório**

`src/infrastructure/repositories/whatsapp-template.repository.ts`:

```ts
import type { WhatsAppTemplateStatus } from "@prisma/client";
import type {
  IWhatsAppTemplateRepository,
  UpsertWhatsAppTemplateInput,
  WhatsAppTemplateRow,
} from "@/application/ports/whatsapp-template-repository.port";
import { prisma } from "@/infrastructure/database/prisma";

const SELECT = {
  id: true, name: true, languageCode: true, category: true,
  status: true, bodyPreview: true, bodyParamCount: true, syncedAt: true,
} as const;

export class WhatsAppTemplatePrismaRepository implements IWhatsAppTemplateRepository {
  async listByTenant(tenantId: string): Promise<WhatsAppTemplateRow[]> {
    return prisma.whatsAppTemplate.findMany({
      where: { tenantId },
      select: SELECT,
      orderBy: [{ status: "asc" }, { name: "asc" }],
    });
  }

  async findApproved(tenantId: string, name: string, languageCode: string) {
    return prisma.whatsAppTemplate.findFirst({
      where: { tenantId, name, languageCode, status: "APPROVED" as WhatsAppTemplateStatus },
      select: SELECT,
    });
  }

  /** Sync é substituição: a Meta é a fonte de verdade sobre quais templates existem. */
  async replaceAllForTenant(tenantId: string, rows: UpsertWhatsAppTemplateInput[]): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const keep = rows.map((r) => `${r.name}::${r.languageCode}`);
      const existing = await tx.whatsAppTemplate.findMany({
        where: { tenantId },
        select: { id: true, name: true, languageCode: true },
      });
      const stale = existing
        .filter((e) => !keep.includes(`${e.name}::${e.languageCode}`))
        .map((e) => e.id);
      if (stale.length > 0) {
        await tx.whatsAppTemplate.deleteMany({ where: { id: { in: stale } } });
      }
      for (const row of rows) {
        await tx.whatsAppTemplate.upsert({
          where: {
            tenantId_name_languageCode: {
              tenantId, name: row.name, languageCode: row.languageCode,
            },
          },
          create: { tenantId, ...row },
          update: { ...row },
        });
      }
      return rows.length;
    });
  }
}

export const whatsAppTemplatePrismaRepository = new WhatsAppTemplatePrismaRepository();
```

Exportar em `src/infrastructure/repositories/index.ts` seguindo o padrão dos vizinhos.

- [ ] **Step 3: Confirmar tipos**

Run: `npx tsc --noEmit`
Expected: `No errors found`.

- [ ] **Step 4: Commit**

```bash
git add src/application/ports/whatsapp-template-repository.port.ts src/infrastructure/repositories/
git commit -m "feat(whatsapp): port e repositório do catálogo de templates

replaceAllForTenant apaga o que não voltou da Meta: ela é a fonte de verdade
sobre quais templates existem, então sync é substituição, não merge."
```

---

### Task 5: Use case de sincronização com a Meta

**Files:**
- Create: `src/infrastructure/whatsapp/whatsapp-template-client.ts`
- Create: `src/application/use-cases/whatsapp/sync-whatsapp-templates.ts`
- Test: `src/application/use-cases/whatsapp/__tests__/sync-whatsapp-templates.test.ts`

**Interfaces:**
- Consumes: `IWhatsAppTemplateRepository` (Task 4), `decryptTenantSecret`, `tenantPrismaRepository.findTenantWhatsAppById`
- Produces:
  ```ts
  export type SyncWhatsAppTemplatesResult =
    | { ok: true; synced: number }
    | { ok: false; code: "WABA_NOT_CONFIGURED" | "NO_ACCESS_TOKEN" | "META_ERROR"; detail?: string };

  export async function runSyncWhatsAppTemplates(
    params: { tenantId: string },
    deps?: {
      templates?: IWhatsAppTemplateRepository;
      fetchTemplates?: (wabaId: string, token: string) => Promise<MetaTemplateDto[]>;
      loadTenant?: (tenantId: string) => Promise<TenantWhatsAppRow | null>;
    },
  ): Promise<SyncWhatsAppTemplatesResult>
  ```

O parâmetro `deps` com default no singleton atual é o padrão de injeção recomendado na auditoria de arquitetura — é o que torna o use case testável sem Postgres nem rede.

- [ ] **Step 1: Escrever o cliente da Graph para templates**

`src/infrastructure/whatsapp/whatsapp-template-client.ts`:

```ts
const BASE_URL = "https://graph.facebook.com/v21.0";
const TIMEOUT_MS = 15_000;

export type MetaTemplateComponent = {
  type: string;
  text?: string;
};

export type MetaTemplateDto = {
  name: string;
  language: string;
  category: string;
  status: string;
  components?: MetaTemplateComponent[];
};

type ListTemplatesResponse = {
  data: MetaTemplateDto[];
  paging?: { next?: string };
};

/** Lê todos os templates do WABA, seguindo paginação. */
export async function fetchMetaTemplates(
  wabaId: string,
  accessToken: string,
): Promise<MetaTemplateDto[]> {
  const all: MetaTemplateDto[] = [];
  let url: string | undefined =
    `${BASE_URL}/${wabaId}/message_templates?limit=100&fields=name,language,category,status,components`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.json();
    if (!res.ok) {
      const msg = body?.error?.message ?? res.statusText;
      const code = body?.error?.code ?? res.status;
      throw new Error(`[WhatsApp API] ${code}: ${msg}`);
    }
    const page = body as ListTemplatesResponse;
    all.push(...page.data);
    url = page.paging?.next;
  }

  return all;
}
```

- [ ] **Step 2: Escrever o teste do use case**

`src/application/use-cases/whatsapp/__tests__/sync-whatsapp-templates.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { countBodyParams, runSyncWhatsAppTemplates } from "../sync-whatsapp-templates";

const tenantOk = {
  whatsappEnabled: true,
  whatsappPhoneNumberId: "PHONE",
  whatsappBusinessAccountId: "WABA",
  whatsappAccessTokenEnc: "cifrado",
  whatsappVerifiedAt: null,
};

describe("countBodyParams", () => {
  it("conta variáveis distintas do corpo", () => {
    expect(countBodyParams("Olá {{1}}, você tem {{2}} documentos da etapa {{3}}")).toBe(3);
  });

  it("não conta variável repetida duas vezes", () => {
    expect(countBodyParams("{{1}} e de novo {{1}}")).toBe(1);
  });

  it("retorna zero sem variáveis", () => {
    expect(countBodyParams("Mensagem fixa")).toBe(0);
  });
});

describe("runSyncWhatsAppTemplates", () => {
  it("falha claramente sem WABA configurado", async () => {
    const result = await runSyncWhatsAppTemplates(
      { tenantId: "t1" },
      { loadTenant: async () => ({ ...tenantOk, whatsappBusinessAccountId: null }) },
    );
    expect(result).toEqual({ ok: false, code: "WABA_NOT_CONFIGURED" });
  });

  it("falha claramente sem access token", async () => {
    const result = await runSyncWhatsAppTemplates(
      { tenantId: "t1" },
      { loadTenant: async () => ({ ...tenantOk, whatsappAccessTokenEnc: null }) },
    );
    expect(result).toEqual({ ok: false, code: "NO_ACCESS_TOKEN" });
  });

  it("grava os templates da Meta com a contagem de variáveis do corpo", async () => {
    const replaceAllForTenant = vi.fn(async () => 1);

    const result = await runSyncWhatsAppTemplates(
      { tenantId: "t1" },
      {
        loadTenant: async () => tenantOk,
        fetchTemplates: async () => [
          {
            name: "aviso_documentos",
            language: "pt_BR",
            category: "UTILITY",
            status: "APPROVED",
            components: [
              { type: "BODY", text: "Olá {{1}}, {{2}} documentos da etapa {{3}}. Acesse {{4}}" },
            ],
          },
        ],
        templates: {
          listByTenant: async () => [],
          findApproved: async () => null,
          replaceAllForTenant,
        },
      },
    );

    expect(result).toEqual({ ok: true, synced: 1 });
    const [, rows] = replaceAllForTenant.mock.calls[0];
    expect(rows[0]).toMatchObject({
      name: "aviso_documentos",
      languageCode: "pt_BR",
      status: "APPROVED",
      bodyParamCount: 4,
    });
  });

  it("converte erro da Meta em META_ERROR com detalhe", async () => {
    const result = await runSyncWhatsAppTemplates(
      { tenantId: "t1" },
      {
        loadTenant: async () => tenantOk,
        fetchTemplates: async () => {
          throw new Error("[WhatsApp API] 190: Invalid OAuth access token");
        },
        templates: {
          listByTenant: async () => [],
          findApproved: async () => null,
          replaceAllForTenant: async () => 0,
        },
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("META_ERROR");
      expect(result.detail).toContain("190");
    }
  });
});
```

Nota: o teste passa `whatsappAccessTokenEnc: "cifrado"` e não exercita `decryptTenantSecret`. Para isso funcionar, a decifragem tem que ser injetável — incluir `decrypt` em `deps` com default em `decryptTenantSecret`, e no teste passar `decrypt: (v) => v`.

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm run test -- sync-whatsapp-templates`
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar o use case**

`src/application/use-cases/whatsapp/sync-whatsapp-templates.ts`:

```ts
import type {
  IWhatsAppTemplateRepository,
  UpsertWhatsAppTemplateInput,
} from "@/application/ports/whatsapp-template-repository.port";
import type { TenantWhatsAppRow } from "@/application/ports/tenant-repository.port";
import { decryptTenantSecret } from "@/infrastructure/crypto/tenant-secret";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { whatsAppTemplatePrismaRepository } from "@/infrastructure/repositories/whatsapp-template.repository";
import {
  fetchMetaTemplates,
  type MetaTemplateDto,
} from "@/infrastructure/whatsapp/whatsapp-template-client";
import type { WhatsAppTemplateStatus } from "@prisma/client";

/** Conta variáveis distintas {{n}} no corpo do template. */
export function countBodyParams(body: string): number {
  const found = new Set<string>();
  for (const match of body.matchAll(/\{\{(\d+)\}\}/g)) {
    found.add(match[1]);
  }
  return found.size;
}

function toStatus(raw: string): WhatsAppTemplateStatus {
  const upper = raw.toUpperCase();
  if (upper === "APPROVED" || upper === "PENDING" || upper === "REJECTED") {
    return upper as WhatsAppTemplateStatus;
  }
  return "DISABLED";
}

function toRow(dto: MetaTemplateDto, syncedAt: Date): UpsertWhatsAppTemplateInput {
  const body = dto.components?.find((c) => c.type.toUpperCase() === "BODY")?.text ?? "";
  return {
    name: dto.name,
    languageCode: dto.language,
    category: dto.category,
    status: toStatus(dto.status),
    bodyPreview: body || null,
    bodyParamCount: countBodyParams(body),
    syncedAt,
  };
}

export type SyncWhatsAppTemplatesResult =
  | { ok: true; synced: number }
  | { ok: false; code: "WABA_NOT_CONFIGURED" | "NO_ACCESS_TOKEN" | "META_ERROR"; detail?: string };

export type SyncWhatsAppTemplatesDeps = {
  templates?: IWhatsAppTemplateRepository;
  loadTenant?: (tenantId: string) => Promise<TenantWhatsAppRow | null>;
  fetchTemplates?: (wabaId: string, token: string) => Promise<MetaTemplateDto[]>;
  decrypt?: (value: string) => string;
  now?: () => Date;
};

export async function runSyncWhatsAppTemplates(
  params: { tenantId: string },
  deps: SyncWhatsAppTemplatesDeps = {},
): Promise<SyncWhatsAppTemplatesResult> {
  const templates = deps.templates ?? whatsAppTemplatePrismaRepository;
  const loadTenant =
    deps.loadTenant ?? ((id: string) => tenantPrismaRepository.findTenantWhatsAppById(id));
  const fetchTemplates = deps.fetchTemplates ?? fetchMetaTemplates;
  const decrypt = deps.decrypt ?? decryptTenantSecret;
  const now = deps.now ?? (() => new Date());

  const tenant = await loadTenant(params.tenantId);
  if (!tenant?.whatsappBusinessAccountId) {
    return { ok: false, code: "WABA_NOT_CONFIGURED" };
  }
  if (!tenant.whatsappAccessTokenEnc) {
    return { ok: false, code: "NO_ACCESS_TOKEN" };
  }

  let dtos: MetaTemplateDto[];
  try {
    const token = decrypt(tenant.whatsappAccessTokenEnc);
    dtos = await fetchTemplates(tenant.whatsappBusinessAccountId, token);
  } catch (err) {
    return {
      ok: false,
      code: "META_ERROR",
      detail: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }

  const syncedAt = now();
  const rows = dtos.map((dto) => toRow(dto, syncedAt));
  const synced = await templates.replaceAllForTenant(params.tenantId, rows);

  return { ok: true, synced };
}
```

Ajustar o teste do Step 2 para passar `decrypt: (v) => v` nos casos que chegam à Meta.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm run test -- sync-whatsapp-templates`
Expected: 7 testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/whatsapp/whatsapp-template-client.ts src/application/use-cases/whatsapp/
git commit -m "feat(whatsapp): sincroniza catálogo de templates da Meta

O use case recebe dependências por parâmetro com default no singleton atual,
padrão recomendado na auditoria de arquitetura — é o que permite testar sem
Postgres nem rede."
```

---

### Task 6: Rota de listar e sincronizar templates

**Files:**
- Create: `src/app/api/v1/tenant/whatsapp/templates/route.ts`
- Create: `src/types/api/whatsapp-templates-v1.ts`
- Modify: `public/openapi.json`
- Modify: `messages/pt-BR/api.json`, `messages/en/api.json`

**Interfaces:**
- Consumes: `runSyncWhatsAppTemplates` (Task 5), `whatsAppTemplatePrismaRepository.listByTenant` (Task 4)
- Produces:
  ```ts
  export type WhatsAppTemplateDto = {
    name: string; languageCode: string; category: string;
    status: "APPROVED" | "PENDING" | "REJECTED" | "DISABLED";
    bodyPreview: string | null; bodyParamCount: number; syncedAt: string;
  };
  export type ListWhatsAppTemplatesResponseData = { templates: WhatsAppTemplateDto[] };
  export type SyncWhatsAppTemplatesResponseData = { synced: number };
  ```

- [ ] **Step 1: Criar os tipos de API**

`src/types/api/whatsapp-templates-v1.ts` com os tipos acima. Sem `interface` solta em `route.ts`.

- [ ] **Step 2: Implementar a rota**

`GET` lista, `POST` sincroniza. Ambos com a cadeia de guards e `assertTenantAdminOrSuper` — configuração de canal é de administrador.

```ts
export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const adminBlock = await assertTenantAdminOrSuper(auth.session!, tenantCtx.tenantId, request, apiT);
  if (adminBlock) return adminBlock;

  const result = await runSyncWhatsAppTemplates({ tenantId: tenantCtx.tenantId });

  if (!result.ok) {
    if (result.code === "WABA_NOT_CONFIGURED") {
      return jsonError("VALIDATION_ERROR", apiT("errors.whatsappWabaRequired"), 422);
    }
    if (result.code === "NO_ACCESS_TOKEN") {
      return jsonError("VALIDATION_ERROR", apiT("errors.whatsappTokenRequired"), 422);
    }
    return jsonError("BAD_GATEWAY", apiT("errors.whatsappSyncFailed"), 502, { detail: result.detail });
  }

  return jsonSuccess({ synced: result.synced });
}
```

- [ ] **Step 3: Adicionar as chaves de i18n**

Em `messages/pt-BR/api.json` e `messages/en/api.json`, dentro de `errors`:
`whatsappWabaRequired`, `whatsappTokenRequired`, `whatsappSyncFailed`.

- [ ] **Step 4: Documentar no OpenAPI**

Adicionar `/api/v1/tenant/whatsapp/templates` com `GET` (200) e `POST` (200, 422, 502), tag `Tenant`, security igual às rotas vizinhas.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc limpo, lint sem erro novo.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/v1/tenant/whatsapp/templates/ src/types/api/whatsapp-templates-v1.ts public/openapi.json messages/
git commit -m "feat(api): lista e sincroniza templates de WhatsApp do tenant"
```

---

### Task 7: Novo fluxo do dispatcher

Esta é a mudança de comportamento central do plano.

**Files:**
- Create: `src/application/use-cases/whatsapp/build-stage-template-params.ts`
- Modify: `src/infrastructure/whatsapp/whatsapp-dispatcher.ts`
- Test: `src/application/use-cases/whatsapp/__tests__/build-stage-template-params.test.ts`

**Interfaces:**
- Consumes: `sendTemplateMessage` (Task 2), campos de `PathwayStage` (Task 3)
- Produces:
  ```ts
  export function buildStageTemplateParams(input: {
    patientName: string;
    documentCount: number;
    stageName: string;
    portalUrl: string;
  }): string[]   // ordem: {{1}} nome, {{2}} quantidade, {{3}} etapa, {{4}} url
  ```

- [ ] **Step 1: Escrever o teste dos parâmetros**

```ts
import { describe, expect, it } from "vitest";
import { buildStageTemplateParams } from "../build-stage-template-params";

describe("buildStageTemplateParams", () => {
  it("devolve nome, quantidade, etapa e url nessa ordem", () => {
    expect(
      buildStageTemplateParams({
        patientName: "Maria Souza",
        documentCount: 3,
        stageName: "Exames pré-operatórios",
        portalUrl: "https://app.submanager.com/clinica/patient/login",
      }),
    ).toEqual([
      "Maria Souza",
      "3",
      "Exames pré-operatórios",
      "https://app.submanager.com/clinica/patient/login",
    ]);
  });

  it("converte quantidade para string porque a Meta só aceita texto", () => {
    const params = buildStageTemplateParams({
      patientName: "João",
      documentCount: 1,
      stageName: "Consulta",
      portalUrl: "https://x",
    });
    expect(typeof params[1]).toBe("string");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- build-stage-template-params`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
/**
 * Parâmetros do template de aviso de etapa, na ordem {{1}}..{{4}}.
 * A Meta só aceita parâmetro de texto — números viram string.
 */
export function buildStageTemplateParams(input: {
  patientName: string;
  documentCount: number;
  stageName: string;
  portalUrl: string;
}): string[] {
  return [
    input.patientName,
    String(input.documentCount),
    input.stageName,
    input.portalUrl,
  ];
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- build-stage-template-params`
Expected: 2 testes passando.

- [ ] **Step 5: Reescrever `whatsappDispatcher.dispatch`**

Substituir o laço que envia documentos e a mensagem interativa por:

1. Carregar a etapa de destino (`whatsappTemplateName`, `whatsappTemplateLang`).
2. Se `whatsappTemplateName` for nulo → criar **um** `ChannelDispatch` com `status: SKIPPED`, `errorDetail: "Etapa sem template de WhatsApp configurado"`, gravar `AuditEvent` `WHATSAPP_DISPATCH_SKIPPED` e retornar. Não é erro.
3. Se houver template → validar `bodyParamCount === 4` contra o catálogo local; divergente → `FAILED` com mensagem explicando que o template precisa de 4 variáveis.
4. Montar `portalUrl` como `${getPublicAppUrl()}/${slug}/patient/login` — mesma construção já usada em `transition-patient-stage.ts`.
5. Chamar `sendTemplateMessage` e gravar `ChannelDispatch` com `templateName` e `externalMessageId`.
6. Remover as chamadas a `sendDocumentMessage` e `sendInteractiveButtonMessage` deste fluxo. As funções permanecem no cliente Graph — o Spec B usa `sendTextMessage`, e remover as outras é limpeza fora deste escopo.

- [ ] **Step 6: Emitir notificação quando o envio falhar**

No caminho `FAILED`, chamar `notificationEmitter.emit` com um tipo novo `whatsapp_dispatch_failed`, destinatários por `resolvePathwayNotificationTargetUserIds`. Adicionar o valor ao enum `NotificationType` no schema e ao mapa `TYPE_TO_TENANT_FLAG` em `notification-emitter.ts` (valor `null`, sem flag de tenant). Isso exige uma migration curta — pode ir junto do commit.

- [ ] **Step 7: Verificar**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: testes passando, tsc limpo, lint sem erro novo.

- [ ] **Step 8: Commit**

```bash
git add src/application/use-cases/whatsapp/ src/infrastructure/whatsapp/whatsapp-dispatcher.ts src/infrastructure/notifications/ packages/prisma/
git commit -m "feat(whatsapp): aviso de etapa por template com link do portal

O envio deixa de mandar o documento pelo WhatsApp e passa a mandar um template
apontando para o portal do paciente. Resolve a janela de 24h — template é
aceito fora dela — e tira URL assinada de documento clínico de circulação em
conversa de WhatsApp.

Etapa sem template configurado agora é SKIPPED, não falha. Falha de envio
emite notificação: até aqui gravava errorDetail e ninguém via."
```

---

### Task 8: Seleção de template na etapa e botão de sincronizar

**Files:**
- Modify: `src/features/pathways/app/components/pathway-stages-settings-panel.tsx`
- Modify: `src/features/settings/app/components/whatsapp-settings-card.tsx`
- Create: `src/features/settings/app/services/whatsapp-templates.service.ts`
- Modify: `messages/pt-BR/settings.json`, `messages/en/settings.json`, `messages/pt-BR/pathways.json`, `messages/en/pathways.json`

**Interfaces:**
- Consumes: rotas da Task 6, tipos de `@/types/api/whatsapp-templates-v1`
- Produces: nada consumido por tarefas posteriores

- [ ] **Step 1: Criar o service**

Só chamadas HTTP via `apiClient`, tipos importados de `@/types/api/whatsapp-templates-v1`. Sem tipo de contrato local.

```ts
export async function listWhatsAppTemplates(): Promise<WhatsAppTemplateDto[]>
export async function syncWhatsAppTemplates(): Promise<number>
```

Usar `toastSuccessMessage` no config da requisição de sync.

- [ ] **Step 2: Botão de sincronizar no card de WhatsApp**

Adicionar ao `whatsapp-settings-card.tsx`, junto do botão de testar conexão. Mostrar `syncedAt` do template mais recente.

**Atenção:** este arquivo usa `serverForm` memoizado + `useSyncedDraft`. Não introduzir `setState` dentro de `useEffect` — a regra `react-hooks/set-state-in-effect` é erro de lint no projeto.

- [ ] **Step 3: Seletor de template na etapa**

No painel de configuração da etapa, um select com os templates `APPROVED`, mais a opção "Não avisar por WhatsApp" (valor nulo, que é o default).

Abaixo do select, mostrar `bodyPreview` para a clínica conferir o texto, e um aviso quando `bodyParamCount !== 4` explicando que o template precisa de 4 variáveis nesta ordem: nome do paciente, quantidade de documentos, nome da etapa e link do portal.

- [ ] **Step 4: i18n**

Chaves novas em `settings.json` (sincronizar, última sincronização) e `pathways.json` (template da etapa, sem aviso, preview, aviso de variáveis).

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc limpo, lint sem erro novo.

- [ ] **Step 6: Commit**

```bash
git add src/features/ messages/
git commit -m "feat(settings): escolha do template de WhatsApp por etapa

A tela mostra o corpo aprovado e avisa quando a contagem de variáveis não
bate com as 4 que o aviso de etapa precisa, em vez de deixar a falha
aparecer só no envio."
```

---

### Task 9: Atualizar a documentação de integração

**Files:**
- Modify: `docs/integrations/whatsapp-dispatch-events.md`

- [ ] **Step 1: Reescrever as seções de envio**

O documento hoje descreve envio de documento e mensagem interativa com botões — que deixa de existir. Reescrever:

- "O que é enviado ao paciente": template com link do portal, não arquivos
- "Botões de confirmação": marcar como legado. `handleButtonReply` continua tratando cliques de mensagens já entregues, mas não se envia interativa nova
- Nova seção "Janela de 24h e templates": por que template, o que é `SKIPPED`, como configurar na etapa
- Seção de variáveis de ambiente: sem mudança

- [ ] **Step 2: Commit**

```bash
git add docs/integrations/whatsapp-dispatch-events.md
git commit -m "docs(whatsapp): atualiza o fluxo de envio para template

O documento descrevia envio de documento e mensagem interativa, que saíram
do fluxo. Acrescenta a seção sobre janela de 24h, que faltava desde o início."
```

---

## Self-Review

**Cobertura do spec:**

| Requisito do spec | Task |
|---|---|
| `sendTemplateMessage` no cliente Graph | 2 |
| Modelo `WhatsAppTemplate` | 3 |
| Sync sob demanda da Meta | 5, 6 |
| Só `APPROVED` selecionável | 8 |
| `whatsappTemplateName` por etapa | 3, 8 |
| Etapa sem template → `SKIPPED` | 7 |
| Validação de contagem de variáveis | 7, 8 |
| Interativa sai do fluxo, `handleButtonReply` fica | 7, 9 |
| Notificação de falha de envio | 7 |
| Testes unitários com injeção de dependência | 1, 2, 5, 7 |
| Doc de integração atualizado | 9 |

Sem lacunas.

**Consistência de tipos:** `WhatsAppTemplateRow` (Task 4) é consumido por `runSyncWhatsAppTemplates` (Task 5) e pela rota (Task 6) com os mesmos nomes de campo. `buildStageTemplateParams` devolve `string[]` de 4 posições, que é o que `WhatsAppTemplatePayload.bodyParams` (Task 2) espera, e o que a validação da Task 7 confere contra `bodyParamCount`.

**Ponto de atenção para quem implementar:** a Task 5 exige `decrypt` injetável no `deps` — o teste do Step 2 depende disso. Se implementar sem esse parâmetro, os dois últimos testes falham por tentar decifrar `"cifrado"` com a chave real.
