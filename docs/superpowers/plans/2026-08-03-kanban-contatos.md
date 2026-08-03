# Kanban de contatos multicanal — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer a conversa de WhatsApp para dentro do painel, num kanban onde o contato desconhecido vira paciente e entra na jornada clínica existente.

**Architecture:** A conversa ancora no canal, não no paciente — `Conversation.clientId` é nulável e só é preenchido na conversão ou por vínculo automático com paciente já cadastrado. Nenhuma query existente sobre `Client` muda. O webhook que já valida assinatura e resolve o tenant ganha um ramo de ingestão. O kanban e o painel de conversa vivem na mesma rota.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Prisma 6 + PostgreSQL 16, BullMQ + Redis (com fallback inline), SSE, Tailwind 4 + shadcn/ui, @dnd-kit, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-03-kanban-contatos-multicanal-design.md`

**Escopo deste plano:** fases 1 a 3 do spec — WhatsApp, kanban, conversa e conversão em paciente. Instagram (fase 4) e métricas (fase 5) ficam para planos próprios; o Instagram depende de App Review da Meta, fora do controle do time.

**Pré-requisito:** a Task 1 do plano `2026-08-03-whatsapp-templates.md` (Vitest). Se aquele plano ainda não rodou, executar aquela task primeiro.

## Global Constraints

- Idioma: respostas ao usuário em pt-BR; código e símbolos exportados em inglês.
- Camadas: `domain` ← `application` ← `infrastructure` ← `app`/`features`. Nada de Prisma em `route.ts`.
- Envelope de API: `jsonSuccess(data)` / `jsonError(code, message, status)` de `src/lib/api-response.ts`.
- Guards em ordem: `requireSessionOr401` → `getActiveTenantIdOr400` → `assertActiveTenantMembership`.
- Multi-tenant: `tenantId` sempre do JWT, nunca do body ou da query.
- Validação: Zod em `src/lib/validators/<domínio>.ts`. Proibido `interface`/`type` de contrato em `route.ts`, `page.tsx` ou componente.
- Tipos de API em `src/types/api/<domínio>-v1.ts`; sufixos `QueryParams` e `ResponseData`.
- Estrutura de feature: `src/features/contacts/app/{components,hooks,pages,services,types,utils}`. `page.tsx` da rota é fina.
- Debounce só por `useDebouncedState` / `useDebouncedCallback` de `src/shared/hooks/use-debounce.ts`.
- `apiClient` já exibe `toast.error` em falha HTTP — não duplicar no catch.
- **Proibido `setState` dentro de `useEffect`**: `react-hooks/set-state-in-effect` é erro de lint. Estado derivado calcula no render; reset de formulário usa `key`.
- Arquivos em kebab-case; componentes React em PascalCase; guia de 300 linhas por arquivo.
- LGPD: `AuditEvent` sem conteúdo de mensagem; log só com ids e canal, nunca corpo.
- Ao alterar rota `/api/v1/*` → atualizar `public/openapi.json`. Ao alterar modelo Prisma → conferir §8 de `docs/ARCHITECTURE.md`.
- Commits em Conventional Commits, direto na `main`, sem trailer `Co-Authored-By`.
- Gates: `npm run test` verde, `npx tsc --noEmit` limpo, `npm run lint` sem erro novo (baseline: 2 erros, 5 warnings).

---

### Task 1: Modelo de dados

**Files:**
- Modify: `packages/prisma/schema.prisma`
- Create: migration gerada
- Modify: `docs/ARCHITECTURE.md` (§8)

**Interfaces:**
- Produces: modelos `Conversation` e `Message`; enums `ConversationChannel`, `ConversationStatus`, `MessageDirection`, `MessageType`, `MessageStatus`; valor `CONTACT_CONVERTED_TO_CLIENT` em `AuditEventType`

- [ ] **Step 1: Adicionar enums e modelos**

Copiar do spec, seção "Modelo de dados". Pontos que não podem ser alterados:

- `@@unique([tenantId, channel, externalId])` em `Conversation` — é o que torna o upsert do webhook determinístico
- `@@unique([conversationId, externalMessageId])` em `Message` — idempotência de reentrega da Meta
- `clientId` nulável com `onDelete: SetNull` — paciente removido não apaga o histórico da conversa

Relações inversas: `conversations Conversation[]` em `Client` e `Tenant`; `conversationMessages Message[]` em `FileAsset` e `User`.

Em `AuditEventType`, adicionar `CONTACT_CONVERTED_TO_CLIENT`.

- [ ] **Step 2: Gerar e aplicar**

```bash
npm run db:migrate -- --name conversations
```

Expected: migration aplicada, client regenerado. Se o Postgres não estiver de pé: `docker compose up -d`.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: `No errors found`.

- [ ] **Step 4: Atualizar §8 da ARCHITECTURE**

Duas linhas: `Conversation` (thread por tenant, canal e identidade externa; `clientId` nulo até a conversão) e `Message` (mensagens de entrada e saída, mídia via `FileAsset`).

- [ ] **Step 5: Commit**

```bash
git add packages/prisma/ docs/ARCHITECTURE.md
git commit -m "feat(prisma): modelo de conversa e mensagem multicanal

clientId nulável é o que mantém lead fora de toda query existente sobre
Client. O único índice por (tenantId, channel, externalId) torna o upsert do
webhook determinístico, e o único por (conversationId, externalMessageId)
absorve reentrega da Meta sem duplicar mensagem."
```

---

### Task 2: Port e repositório de conversas

**Files:**
- Create: `src/application/ports/conversation-repository.port.ts`
- Create: `src/infrastructure/repositories/conversation.repository.ts`
- Modify: `src/infrastructure/repositories/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ConversationRow = {
    id: string; channel: ConversationChannel; externalId: string;
    displayName: string | null; clientId: string | null;
    status: ConversationStatus; assignedToUserId: string | null;
    lastInboundAt: Date | null; lastMessageAt: Date | null;
    firstResponseAt: Date | null; unreadCount: number;
  };
  export type AppendMessageInput = {
    conversationId: string; direction: MessageDirection;
    externalMessageId: string | null; type: MessageType;
    body: string | null; fileAssetId: string | null;
    status: MessageStatus | null; actorUserId: string | null;
    sentAt: Date | null;
  };
  export interface IConversationRepository {
    findByExternalId(tenantId: string, channel: ConversationChannel, externalId: string): Promise<ConversationRow | null>;
    create(input: { tenantId: string; channel: ConversationChannel; externalId: string; displayName: string | null; clientId: string | null }): Promise<ConversationRow>;
    findById(tenantId: string, id: string): Promise<ConversationRow | null>;
    appendMessage(input: AppendMessageInput): Promise<{ id: string; created: boolean }>;
    registerInbound(conversationId: string, at: Date): Promise<void>;
    registerOutbound(conversationId: string, at: Date, isFirstResponse: boolean): Promise<void>;
    updateStatus(tenantId: string, id: string, status: ConversationStatus): Promise<void>;
    assign(tenantId: string, id: string, userId: string | null): Promise<void>;
    linkClient(tenantId: string, id: string, clientId: string): Promise<void>;
    markRead(tenantId: string, id: string): Promise<void>;
  }
  export const conversationPrismaRepository: IConversationRepository
  ```

- [ ] **Step 1: Escrever o port**

Com os tipos acima. Enums importados de `@prisma/client`.

- [ ] **Step 2: Implementar o repositório**

Detalhe que não pode passar batido — `appendMessage` precisa ser idempotente sem lançar:

```ts
async appendMessage(input: AppendMessageInput): Promise<{ id: string; created: boolean }> {
  if (input.externalMessageId) {
    const existing = await prisma.message.findUnique({
      where: {
        conversationId_externalMessageId: {
          conversationId: input.conversationId,
          externalMessageId: input.externalMessageId,
        },
      },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };
  }
  const created = await prisma.message.create({ data: input, select: { id: true } });
  return { id: created.id, created: true };
}
```

`registerInbound` faz `lastInboundAt` e `lastMessageAt` = `at`, e `unreadCount: { increment: 1 }`.
`registerOutbound` faz `lastMessageAt` = `at` e, quando `isFirstResponse`, preenche `firstResponseAt`.
`markRead` zera `unreadCount`.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 4: Commit**

```bash
git add src/application/ports/conversation-repository.port.ts src/infrastructure/repositories/
git commit -m "feat(conversations): port e repositório de conversa e mensagem

appendMessage devolve created:false em vez de lançar quando o wamid já existe
— reentrega de webhook é o caso normal, não erro."
```

---

### Task 3: Use case de ingestão

O coração da fase 1. TDD com dependências injetadas.

**Files:**
- Create: `src/application/use-cases/conversation/ingest-inbound-message.ts`
- Test: `src/application/use-cases/conversation/__tests__/ingest-inbound-message.test.ts`

**Interfaces:**
- Consumes: `IConversationRepository` (Task 2), `digitsOnlyPhone` de `@/lib/validators/phone`
- Produces:
  ```ts
  export type InboundMessageInput = {
    tenantId: string;
    channel: ConversationChannel;
    externalId: string;          // wa_id
    profileName: string | null;
    externalMessageId: string;   // wamid
    type: MessageType;
    body: string | null;
    mediaId: string | null;      // media_id da Meta, baixado depois
    timestamp: Date;
  };
  export type IngestInboundMessageResult = {
    conversationId: string;
    messageId: string;
    created: boolean;            // false = reentrega
    linkedClientId: string | null;
  };
  export async function runIngestInboundMessage(
    input: InboundMessageInput,
    deps?: IngestInboundMessageDeps,
  ): Promise<IngestInboundMessageResult>
  ```

- [ ] **Step 1: Escrever os testes**

```ts
import { describe, expect, it, vi } from "vitest";
import { runIngestInboundMessage } from "../ingest-inbound-message";

function makeDeps(over: Partial<Record<string, unknown>> = {}) {
  const conversation = {
    id: "c1", channel: "WHATSAPP" as const, externalId: "5511999999999",
    displayName: "Maria", clientId: null, status: "NEW" as const,
    assignedToUserId: null, lastInboundAt: null, lastMessageAt: null,
    firstResponseAt: null, unreadCount: 0,
  };
  return {
    conversations: {
      findByExternalId: vi.fn(async () => null),
      create: vi.fn(async () => conversation),
      findById: vi.fn(async () => conversation),
      appendMessage: vi.fn(async () => ({ id: "m1", created: true })),
      registerInbound: vi.fn(async () => undefined),
      registerOutbound: vi.fn(async () => undefined),
      updateStatus: vi.fn(async () => undefined),
      assign: vi.fn(async () => undefined),
      linkClient: vi.fn(async () => undefined),
      markRead: vi.fn(async () => undefined),
    },
    findClientsByPhone: vi.fn(async () => [] as { id: string }[]),
    ...over,
  };
}

const base = {
  tenantId: "t1",
  channel: "WHATSAPP" as const,
  externalId: "5511999999999",
  profileName: "Maria",
  externalMessageId: "wamid.A",
  type: "TEXT" as const,
  body: "Oi, quero saber sobre a cirurgia",
  mediaId: null,
  timestamp: new Date("2026-08-03T12:00:00Z"),
};

describe("runIngestInboundMessage", () => {
  it("cria conversa nova quando o contato é desconhecido", async () => {
    const deps = makeDeps();
    const result = await runIngestInboundMessage(base, deps);

    expect(deps.conversations.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", externalId: "5511999999999", clientId: null }),
    );
    expect(result.created).toBe(true);
    expect(result.linkedClientId).toBeNull();
  });

  it("é idempotente: mesmo wamid duas vezes não duplica mensagem", async () => {
    const deps = makeDeps();
    deps.conversations.appendMessage = vi.fn(async () => ({ id: "m1", created: false }));

    const result = await runIngestInboundMessage(base, deps);

    expect(result.created).toBe(false);
    // reentrega não pode incrementar não lidas nem mexer na janela
    expect(deps.conversations.registerInbound).not.toHaveBeenCalled();
  });

  it("vincula automaticamente quando existe exatamente um paciente com o telefone", async () => {
    const deps = makeDeps({ findClientsByPhone: vi.fn(async () => [{ id: "cli1" }]) });

    const result = await runIngestInboundMessage(base, deps);

    expect(deps.conversations.create).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "cli1" }),
    );
    expect(result.linkedClientId).toBe("cli1");
  });

  it("não vincula quando há mais de um paciente com o mesmo telefone", async () => {
    const deps = makeDeps({
      findClientsByPhone: vi.fn(async () => [{ id: "cli1" }, { id: "cli2" }]),
    });

    const result = await runIngestInboundMessage(base, deps);

    expect(result.linkedClientId).toBeNull();
  });

  it("reusa conversa existente sem criar outra", async () => {
    const existing = {
      id: "c1", channel: "WHATSAPP" as const, externalId: "5511999999999",
      displayName: "Maria", clientId: "cli1", status: "IN_PROGRESS" as const,
      assignedToUserId: "u1", lastInboundAt: new Date(), lastMessageAt: new Date(),
      firstResponseAt: null, unreadCount: 2,
    };
    const deps = makeDeps();
    deps.conversations.findByExternalId = vi.fn(async () => existing);

    const result = await runIngestInboundMessage(base, deps);

    expect(deps.conversations.create).not.toHaveBeenCalled();
    expect(result.conversationId).toBe("c1");
    expect(result.linkedClientId).toBe("cli1");
  });

  it("registra entrada atualizando janela e não lidas", async () => {
    const deps = makeDeps();
    await runIngestInboundMessage(base, deps);
    expect(deps.conversations.registerInbound).toHaveBeenCalledWith("c1", base.timestamp);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- ingest-inbound-message`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Ordem obrigatória: buscar conversa → se não existe, procurar paciente por telefone e criar → gravar mensagem → **só registrar entrada se a mensagem foi criada de fato**. Reentrega não pode incrementar não lidas nem mexer na janela de 24h.

O default de `findClientsByPhone` busca por `phone` normalizado com `digitsOnlyPhone`, filtrando `deletedAt: null` e o tenant. Vínculo só com **exatamente um** resultado — dois pacientes com o mesmo telefone é ambiguidade que a secretária resolve na conversão.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- ingest-inbound-message`
Expected: 6 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/application/use-cases/conversation/
git commit -m "feat(conversations): ingestão de mensagem recebida

Reentrega da Meta não incrementa não lidas nem move a janela de 24h — só a
primeira gravação conta. Vínculo automático com paciente existente exige
exatamente um match por telefone; ambiguidade fica para a conversão resolver."
```

---

### Task 4: Ramo de ingestão no webhook

**Files:**
- Modify: `src/application/use-cases/whatsapp/process-whatsapp-webhook-payload.ts`
- Modify: `src/lib/validators/whatsapp-webhook.ts`
- Test: `src/application/use-cases/whatsapp/__tests__/process-whatsapp-webhook-payload.test.ts`

**Interfaces:**
- Consumes: `runIngestInboundMessage` (Task 3)
- Produces: nada novo; estende o comportamento existente

- [ ] **Step 1: Estender o schema Zod do webhook**

`whatsappWebhookPayloadSchema` hoje cobre `statuses` e `messages` interativas. Acrescentar os campos de mensagem de texto e mídia: `text.body`, `image.id`, `audio.id`, `video.id`, `document.id` e `document.filename`, `sticker.id`, `location`. Todos opcionais — tipo desconhecido não pode derrubar o parse.

- [ ] **Step 2: Escrever o teste**

Casos: payload com mensagem de texto chama a ingestão com `type: "TEXT"` e o corpo certo; payload com imagem chama com `type: "IMAGE"` e `mediaId`; tipo desconhecido chama com `UNSUPPORTED` em vez de ignorar; `button_reply` continua chamando `handleButtonReply` **e** também vira mensagem.

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npm run test -- process-whatsapp-webhook-payload`
Expected: FAIL.

- [ ] **Step 4: Implementar**

No laço que já existe sobre `value.messages`, mapear o tipo da Meta para `MessageType` e chamar `runIngestInboundMessage`. O `phone_number_id` continua resolvendo o tenant, como hoje.

O ramo de `value.statuses` ganha, além do `ChannelDispatch` atual, a atualização de `Message.status` por `externalMessageId`.

Mensagem que a Meta manda com tipo fora do mapa vira `UNSUPPORTED` com `body` nulo — nunca descartar em silêncio, senão a secretária vê buraco na conversa.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npm run test -- process-whatsapp-webhook-payload`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add src/application/use-cases/whatsapp/ src/lib/validators/whatsapp-webhook.ts
git commit -m "feat(webhooks): persiste mensagem recebida do WhatsApp como conversa

Tipo fora do mapa vira UNSUPPORTED em vez de ser descartado: buraco na thread
é pior do que uma linha dizendo que veio algo não suportado."
```

---

### Task 5: Download de mídia

**Files:**
- Create: `src/infrastructure/whatsapp/whatsapp-media-client.ts`
- Create: `src/infrastructure/queue/media-download-worker.ts`
- Create: `src/application/use-cases/conversation/download-inbound-media.ts`
- Modify: `src/instrumentation.ts`

**Interfaces:**
- Consumes: `Message.fileAssetId` (Task 1), `presignPutObject` / GCS, `validateMagicBytes`
- Produces: `enqueueMediaDownload({ tenantId, messageId, mediaId })`

- [ ] **Step 1: Cliente de mídia**

Dois passos na Graph: `GET /{media_id}` devolve uma URL temporária; `GET` nessa URL com o mesmo Bearer devolve os bytes.

- [ ] **Step 2: Use case de download**

Baixa, valida magic bytes com o utilitário já existente, sobe para `tenants/{tenantId}/conversations/{conversationId}/`, cria `FileAsset` e preenche `Message.fileAssetId`.

Mídia que falha na validação de magic bytes **não** é persistida; a mensagem fica com `errorDetail` e a thread mostra que o arquivo foi recusado.

- [ ] **Step 3: Worker e fallback inline**

Seguir o padrão de `email-dispatch-emitter.ts`: com Redis, BullMQ com retry e backoff; sem Redis, executa inline. Registrar o worker em `instrumentation.ts` junto dos existentes.

- [ ] **Step 4: Verificar**

Run: `npm run test && npx tsc --noEmit`
Expected: verde e limpo.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/whatsapp/whatsapp-media-client.ts src/infrastructure/queue/ src/application/use-cases/conversation/ src/instrumentation.ts
git commit -m "feat(conversations): baixa mídia recebida para o GCS

Mídia da Meta expira em poucos dias, então o arquivo é copiado para o bucket
do tenant. Passa pela mesma validação de magic bytes dos uploads — arquivo
recusado não vira FileAsset."
```

---

### Task 6: Envio de texto com janela de 24h

**Files:**
- Create: `src/domain/conversation/service-window.ts`
- Create: `src/application/use-cases/conversation/send-text-message.ts`
- Test: `src/domain/conversation/__tests__/service-window.test.ts`
- Test: `src/application/use-cases/conversation/__tests__/send-text-message.test.ts`

**Interfaces:**
- Consumes: `IConversationRepository` (Task 2), `sendTextMessage` do cliente Graph
- Produces:
  ```ts
  export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
  export function isWithinServiceWindow(lastInboundAt: Date | null, now: Date): boolean;
  export function serviceWindowExpiresAt(lastInboundAt: Date | null): Date | null;

  export type SendTextMessageResult =
    | { ok: true; messageId: string }
    | { ok: false; code: "CONVERSATION_NOT_FOUND" | "OUTSIDE_SERVICE_WINDOW" | "CHANNEL_NOT_CONFIGURED" | "SEND_FAILED"; detail?: string };
  ```

`service-window.ts` fica em `domain/` porque é regra pura, sem dependência de infra — respeitando a direção de dependências do projeto.

- [ ] **Step 1: Testes da janela**

```ts
import { describe, expect, it } from "vitest";
import { isWithinServiceWindow, serviceWindowExpiresAt } from "../service-window";

const now = new Date("2026-08-03T12:00:00Z");

describe("isWithinServiceWindow", () => {
  it("é falso quando o contato nunca escreveu", () => {
    expect(isWithinServiceWindow(null, now)).toBe(false);
  });

  it("é verdadeiro dentro de 24h", () => {
    expect(isWithinServiceWindow(new Date("2026-08-03T11:59:00Z"), now)).toBe(true);
  });

  it("é falso exatamente em 24h", () => {
    expect(isWithinServiceWindow(new Date("2026-08-02T12:00:00Z"), now)).toBe(false);
  });

  it("é falso passadas 24h", () => {
    expect(isWithinServiceWindow(new Date("2026-08-02T11:00:00Z"), now)).toBe(false);
  });
});

describe("serviceWindowExpiresAt", () => {
  it("devolve null sem entrada", () => {
    expect(serviceWindowExpiresAt(null)).toBeNull();
  });

  it("devolve a entrada mais 24h", () => {
    expect(serviceWindowExpiresAt(new Date("2026-08-03T10:00:00Z"))).toEqual(
      new Date("2026-08-04T10:00:00Z"),
    );
  });
});
```

- [ ] **Step 2: Rodar, implementar, rodar**

Run: `npm run test -- service-window` — falha, implementa, passa.

Limite exato de 24h conta como **fora**: a Meta fecha a janela em 24h, e recusar no limite é mais seguro do que tentar e falhar.

- [ ] **Step 3: Testes do envio**

Casos: conversa inexistente → `CONVERSATION_NOT_FOUND`; fora da janela → `OUTSIDE_SERVICE_WINDOW` **sem** chamar a Meta; dentro da janela → grava `Message` OUTBOUND e chama a Meta com o texto; primeira resposta após inbound preenche `firstResponseAt`; resposta seguinte não sobrescreve; erro da Meta → `SEND_FAILED` e a mensagem fica `FAILED` com `errorDetail`.

- [ ] **Step 4: Implementar o use case**

Verificar a janela **antes** de gravar qualquer coisa. `firstResponseAt` só é preenchido se ainda for nulo e existir `lastInboundAt`.

- [ ] **Step 5: Rodar e confirmar**

Run: `npm run test -- send-text-message`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add src/domain/conversation/ src/application/use-cases/conversation/
git commit -m "feat(conversations): envio de texto respeitando a janela de 24h

A regra da janela fica em domain/ por ser pura. Fora da janela o envio é
recusado antes de qualquer chamada à Meta — a UI usa isso para desabilitar o
composer em vez de deixar o usuário digitar algo que vai falhar."
```

---

### Task 7: Listagem com visibilidade

**Files:**
- Create: `src/application/use-cases/conversation/list-conversations-board.ts`
- Test: `src/application/use-cases/conversation/__tests__/list-conversations-board.test.ts`

**Interfaces:**
- Consumes: `mergeClientWhereWithVisibility` e `TenantMembershipClientScope` de `@/application/use-cases/shared/load-client-visibility-scope`
- Produces:
  ```ts
  export function buildConversationVisibilityWhere(
    tenantId: string, scope: TenantMembershipClientScope, viewerUserId: string,
  ): Prisma.ConversationWhereInput;
  export async function runListConversationsBoard(
    params: { tenantId: string; viewerUserId: string; globalRole: string; scope: TenantMembershipClientScope; search?: string; channel?: ConversationChannel },
    deps?: { ... },
  ): Promise<{ columns: Array<{ status: ConversationStatus; items: ConversationCardDto[]; total: number }> }>
  ```

- [ ] **Step 1: Testes da regra de visibilidade**

A regra do spec, que precisa de teste explícito porque é contraintuitiva:

```ts
describe("buildConversationVisibilityWhere", () => {
  it("sem restrição, vê tudo do tenant", () => {
    const where = buildConversationVisibilityWhere("t1", { restrictedToAssignedOnly: false, linkedOpmeSupplierId: null }, "u1");
    expect(where).toEqual({ tenantId: "t1" });
  });

  it("com restrição, vê conversa sem paciente OU paciente do seu escopo", () => {
    const where = buildConversationVisibilityWhere("t1", { restrictedToAssignedOnly: true, linkedOpmeSupplierId: null }, "u1");
    expect(where.OR).toEqual([
      { clientId: null },
      { client: expect.objectContaining({ assignedToUserId: "u1" }) },
    ]);
  });
});
```

`{ clientId: null }` no `OR` é deliberado: a fila de entrada precisa ser vista por alguém, senão contato novo fica órfão numa clínica com visibilidade restrita.

- [ ] **Step 2: Rodar, implementar, rodar**

Run: `npm run test -- list-conversations-board`

A listagem devolve as 5 colunas sempre, mesmo vazias, com as primeiras N conversas de cada e o total — mesmo formato do kanban da jornada, para o frontend reaproveitar o padrão.

- [ ] **Step 3: Commit**

```bash
git add src/application/use-cases/conversation/
git commit -m "feat(conversations): listagem do board com regra de visibilidade

Conversa sem paciente é visível a todos os membros mesmo com
restrictedToAssignedOnly: a fila de entrada precisa de dono, e sem essa regra
contato novo fica invisível em clínica com visibilidade restrita."
```

---

### Task 8: Rotas de API

**Files:**
- Create: `src/app/api/v1/conversations/route.ts` (GET board)
- Create: `src/app/api/v1/conversations/[conversationId]/route.ts` (GET detalhe + PATCH status/atribuição)
- Create: `src/app/api/v1/conversations/[conversationId]/messages/route.ts` (GET histórico paginado + POST envio)
- Create: `src/app/api/v1/conversations/[conversationId]/read/route.ts` (POST marcar lida)
- Create: `src/lib/validators/conversation.ts`
- Create: `src/types/api/conversations-v1.ts`
- Modify: `public/openapi.json`, `messages/{pt-BR,en}/api.json`

**Interfaces:**
- Consumes: use cases das Tasks 6 e 7
- Produces: `ConversationCardDto`, `ConversationDetailDto`, `MessageDto`, `ListConversationsQueryParams`, `ConversationsBoardResponseData`

- [ ] **Step 1: Schemas Zod**

`listConversationsQuerySchema` (search, channel, limit), `patchConversationBodySchema` (status, assignedToUserId), `postMessageBodySchema` (body com min 1 e max 4096 — limite da Meta).

- [ ] **Step 2: Tipos de API**

Em `src/types/api/conversations-v1.ts`. `ConversationCardDto` inclui `serviceWindowExpiresAt: string | null`, calculado no servidor — o cliente não deve recalcular regra de janela.

- [ ] **Step 3: Implementar as rotas**

Cadeia de guards padrão em todas. O `POST` de mensagem mapeia `OUTSIDE_SERVICE_WINDOW` para **409**, não 422: é conflito de estado, não erro de validação de input.

- [ ] **Step 4: i18n e OpenAPI**

Chaves de erro novas e as 4 rotas documentadas.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/v1/conversations/ src/lib/validators/conversation.ts src/types/api/conversations-v1.ts public/openapi.json messages/
git commit -m "feat(api): rotas de conversa — board, detalhe, mensagens e leitura

Envio fora da janela responde 409: é conflito de estado da conversa, não erro
de validação do corpo."
```

---

### Task 9: Realtime pelo SSE existente

**Files:**
- Modify: `src/app/api/v1/notifications/stream/route.ts`
- Modify: `src/infrastructure/notifications/notification-emitter.ts`
- Modify: `packages/prisma/schema.prisma` (novo `NotificationType`)

- [ ] **Step 1: Novo tipo de notificação**

Adicionar `conversation_message` a `NotificationType` e ao mapa `TYPE_TO_TENANT_FLAG` com valor `null` (sem flag de tenant). Migration curta.

- [ ] **Step 2: Emitir na ingestão**

Na Task 3, ao criar mensagem de entrada, emitir pelo `notificationEmitter` já existente, com `correlationId` = `conversationId:messageId` para deduplicar.

Destinatários: quem pode ver a conversa pela regra da Task 7.

- [ ] **Step 3: Evento no stream**

O stream ganha o tipo de evento `conversation` com `{ conversationId, status, unreadCount, lastMessageAt }`. **Sem segundo SSE** — o preset `sse` limita a 3 conexões por 10s por usuário, e abrir outro stream estouraria o limite.

- [ ] **Step 4: Verificar e commitar**

```bash
git add src/app/api/v1/notifications/ src/infrastructure/notifications/ packages/prisma/
git commit -m "feat(conversations): eventos de conversa no stream SSE existente

Reusa o stream de notificações em vez de abrir um segundo: o preset de rate
limit sse é 3 conexões por 10s por usuário."
```

---

### Task 10: Services e hooks do frontend

**Files:**
- Create: `src/features/contacts/app/services/conversations.service.ts`
- Create: `src/features/contacts/app/types/api.ts`
- Create: `src/features/contacts/app/hooks/use-conversations-board.ts`
- Create: `src/features/contacts/app/hooks/use-conversation-thread.ts`

- [ ] **Step 1: Barrel de tipos**

`export type * from "@/types/api/conversations-v1";` — sem tipo de contrato local.

- [ ] **Step 2: Service**

Só HTTP via `apiClient`. `skipErrorToast: true` na chamada de marcar lida, que é auxiliar.

- [ ] **Step 3: Hooks**

`use-conversations-board` gerencia colunas, busca com `useDebouncedState` (`{ trim: true, delayMs: DEBOUNCE_MS.search }`) e assinatura do SSE.

**Sem `setState` dentro de `useEffect`.** Estado derivado de props calcula no render; a chave de filtro serve para invalidar resultado, como já é feito em `use-clients-list.ts` depois do refactor do commit `0c72950`.

- [ ] **Step 4: Verificar e commitar**

Run: `npx tsc --noEmit && npm run lint` — lint sem erro novo é obrigatório aqui, é o arquivo mais propenso a `set-state-in-effect`.

---

### Task 11: Board do kanban

**Files:**
- Create: `src/features/contacts/app/components/contacts-board.tsx`
- Create: `src/features/contacts/app/components/contact-card.tsx`
- Create: `src/features/contacts/app/components/service-window-badge.tsx`
- Create: `src/features/contacts/app/pages/contacts-page.tsx`
- Create: `src/app/[locale]/(dashboard)/dashboard/contatos/page.tsx`
- Create: `messages/{pt-BR,en}/contacts.json`

- [ ] **Step 1: Rota fina**

```tsx
import { ContactsPage } from "@/features/contacts/app/pages/contacts-page";
export default function Page() { return <ContactsPage />; }
```

- [ ] **Step 2: Board**

5 colunas fixas, arrastar com `@dnd-kit` (já é dependência). Arrastar chama o `PATCH` de status — **não** cria paciente nem envia nada.

- [ ] **Step 3: Card**

Nome ou perfil, ícone do canal, tempo desde a última mensagem, badge de não lidas, avatar de quem atende, e o `ServiceWindowBadge`.

O badge deriva de `serviceWindowExpiresAt` vindo do servidor. Como ele muda com o tempo sem evento novo, atualizar por `setInterval` de 60s guardado em ref — **não** por `setState` em `useEffect` de montagem.

- [ ] **Step 4: i18n e navegação**

`contacts.json` nos dois idiomas; item no menu lateral.

- [ ] **Step 5: Verificar e commitar**

---

### Task 12: Painel de conversa

**Files:**
- Create: `src/features/contacts/app/components/conversation-panel.tsx`
- Create: `src/features/contacts/app/components/message-bubble.tsx`
- Create: `src/features/contacts/app/components/message-composer.tsx`

- [ ] **Step 1: Painel**

Abre ao clicar no card. Histórico com scroll infinito para trás.

Ao trocar de conversa, o composer precisa resetar — usar `key={conversationId}` no componente, **não** effect com `setState`.

- [ ] **Step 2: Bolha de mensagem**

Entrada e saída com estilos distintos; status de entrega nas de saída; mídia com preview; `UNSUPPORTED` com aviso legível; `FAILED` com o motivo e botão de reenviar.

- [ ] **Step 3: Composer**

Fora da janela: desabilitado, com o motivo visível e um botão de enviar template (que fica inerte até o plano de templates entrar — deixar o ponto de extensão, não a funcionalidade pela metade; se o plano de templates já tiver rodado, ligar aqui).

- [ ] **Step 4: Verificar e commitar**

---

### Task 13: Conversão em paciente

**Files:**
- Create: `src/application/use-cases/conversation/convert-conversation-to-client.ts`
- Test: `src/application/use-cases/conversation/__tests__/convert-conversation-to-client.test.ts`
- Create: `src/app/api/v1/conversations/[conversationId]/convert/route.ts`

**Interfaces:**
- Consumes: `StartPatientPathway` existente, `IConversationRepository`
- Produces:
  ```ts
  export type ConvertConversationResult =
    | { ok: true; clientId: string; patientPathwayId: string }
    | { ok: false; code: "CONVERSATION_NOT_FOUND" | "ALREADY_LINKED" | "PATHWAY_NOT_PUBLISHED" | "DUPLICATE_FOUND"; duplicates?: Array<{ id: string; name: string; phone: string }> };
  ```

- [ ] **Step 1: Testes**

Casos: conversa já vinculada → `ALREADY_LINKED`; telefone bate com paciente existente e `linkExistingClientId` não veio → `DUPLICATE_FOUND` com a lista, sem criar nada; com `linkExistingClientId` → vincula sem criar `Client`; caminho novo → cria `Client`, chama `StartPatientPathway`, preenche `clientId`, move status para `QUALIFIED`, grava `AuditEvent`; fluxo sem versão publicada → `PATHWAY_NOT_PUBLISHED` **sem** deixar `Client` órfão.

O último caso é o que exige transação: criar paciente e falhar ao iniciar a jornada deixaria exatamente o "paciente solto" que o `business-logic.md` já lista como problema conhecido.

- [ ] **Step 2: Rodar, implementar, rodar**

Reusar `StartPatientPathway` — a primeira `StageTransition` e o disparo do pacote já estão lá.

- [ ] **Step 3: Rota**

`POST /api/v1/conversations/{id}/convert`. `DUPLICATE_FOUND` responde **409** com a lista de candidatos no `details`.

- [ ] **Step 4: Commit**

```bash
git add src/application/use-cases/conversation/ src/app/api/v1/conversations/
git commit -m "feat(conversations): converte contato em paciente com deduplicação

Criação do Client e início da jornada numa transação só: falhar no meio
deixaria o paciente solto sem jornada, que business-logic.md já lista como
problema conhecido. Telefone repetido devolve 409 com os candidatos em vez de
criar duplicata."
```

---

### Task 14: Wizard de conversão e contexto da jornada

**Files:**
- Create: `src/features/contacts/app/components/convert-contact-dialog.tsx`
- Create: `src/features/contacts/app/components/patient-journey-context.tsx`
- Modify: `src/features/contacts/app/components/conversation-panel.tsx`

- [ ] **Step 1: Wizard**

`StandardDialogContent`, react-hook-form + Zod, campos pré-preenchidos com `displayName` e telefone. Reusar os schemas de `src/lib/validators/client.ts` em vez de escrever validação nova.

Ao receber 409 com duplicatas, a tela troca para a escolha "vincular a este paciente" ou "criar mesmo assim".

- [ ] **Step 2: Contexto da jornada**

Quando `clientId` existe: etapa atual, checklist pendente, últimos documentos, e botão de avançar etapa reusando o diálogo que já existe em `pipeline-change-stage-dialog.tsx`.

Este componente é o diferencial do produto sobre o Kommo — é o que faz conversar e operar a jornada serem o mesmo gesto.

- [ ] **Step 3: Verificar e commitar**

---

### Task 15: E2E e fechamento

**Files:**
- Create: `e2e/contacts-kanban.spec.ts`
- Modify: `docs/FRONTEND-FEATURES.md`

- [ ] **Step 1: Spec E2E**

Seguindo o padrão de `e2e/patient-self-register.spec.ts` e seu `global-setup.ts`: semear uma `Conversation` direto no banco (não dá para simular a Meta), abrir `/dashboard/contatos`, conferir o card em "Novo", converter em paciente e confirmar que ele aparece no kanban da jornada.

- [ ] **Step 2: Rodar a suíte inteira**

```bash
npm run test && npx tsc --noEmit && npm run lint && npm run test:e2e
```

Expected: unitários verdes, tsc limpo, lint sem erro novo, E2E verde.

- [ ] **Step 3: Commit**

```bash
git add e2e/ docs/FRONTEND-FEATURES.md
git commit -m "test(e2e): fluxo de contato até paciente no kanban da jornada"
```

---

## Self-Review

**Cobertura do spec (fases 1-3):**

| Requisito | Task |
|---|---|
| Modelo `Conversation` + `Message` | 1 |
| Idempotência de reentrega | 2, 3 |
| Vínculo automático por telefone | 3 |
| Ingestão de texto e mídia no webhook | 4 |
| Tipo não suportado não é descartado | 4 |
| Download de mídia para o GCS | 5 |
| Envio de texto e janela de 24h | 6 |
| Visibilidade com `restrictedToAssignedOnly` | 7 |
| Rotas de API | 8 |
| Realtime sem segundo SSE | 9 |
| Kanban com 5 colunas fixas | 11 |
| Arrastar só muda status | 11 |
| Painel lateral com composer | 12 |
| Composer desabilitado fora da janela | 12 |
| Conversão com dedup e escolha de fluxo | 13, 14 |
| Contexto da jornada no painel | 14 |
| E2E do ciclo completo | 15 |

**Lacuna consciente:** a política de retenção de mensagem está marcada como fora de escopo no spec e não tem task. É dívida registrada, não esquecimento.

**Consistência de tipos:** `ConversationRow` (Task 2) alimenta as Tasks 3, 6, 7 e 13 com os mesmos nomes. `serviceWindowExpiresAt` é calculado por `src/domain/conversation/service-window.ts` (Task 6), exposto no `ConversationCardDto` (Task 8) e consumido pelo `ServiceWindowBadge` (Task 11) — o cliente nunca recalcula a regra.

**Dependência entre planos:** a Task 12 referencia o botão de template, que só funciona depois do plano `2026-08-03-whatsapp-templates.md`. Rodar aquele plano primeiro deixa este completo; rodar este antes deixa o botão inerte, que é degradação aceitável e está sinalizada na task.
