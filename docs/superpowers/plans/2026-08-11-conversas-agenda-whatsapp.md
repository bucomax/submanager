# Conversas (WhatsApp/Instagram) + Agenda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o kanban de `/dashboard/contacts` por uma tela de atendimento em 3 colunas (lista → chat → painel do lead) com frases prontas, notas internas, agendamento real persistido e envio real de mensagem via WhatsApp Cloud API, mais uma nova tela `/dashboard/agenda` (semana/mês).

**Architecture:** Clean Architecture do repo (`domain`/`application` ← `infrastructure` ← `app`/`features`). Três modelos Prisma novos (`QuickPhrase`, `LeadNote`, `AgendaEvent`) + `Conversation.stageChangedAt`. Um port novo `IWhatsAppOutbound` (mensagem de texto livre) implementado sobre o `whatsapp-cloud-client.ts` já existente, reaproveitando as credenciais de `Tenant.whatsapp*` já usadas pelo dispatcher de documentos — com skip gracioso se o tenant não tiver WhatsApp configurado (mesmo padrão do `whatsappDispatcher` atual). UI nova em `src/features/contacts/app/` (conversas) e `src/features/agenda/app/` (agenda nova feature). Sem lib de calendário externa — grade construída com Tailwind (KISS/YAGNI).

**Tech Stack:** Next.js 16 App Router, React 19, TS strict, Prisma 6/PostgreSQL, Tailwind v4, shadcn/ui existente (`Sheet`, `Dialog`, `Popover` não existe ainda — ver Task 1B —, `DropdownMenu`, `Skeleton`, `Badge`, `Avatar`, `Select`, `Input`, `Switch`), next-intl, lucide-react.

## Decisão de layout confirmada com o usuário

O README do handoff manda implementar só o **Layout A** (painel do lead sobrepõe a listagem). **O usuário pediu explicitamente o Layout B**: painel do lead abre como **terceira coluna à direita do chat**, não sobreposto. Esta é a decisão vinculante — todas as tasks de UI usam Layout B. Specs exatas extraídas do protótipo (`Conversas.dc.html` linhas 1378-1416):

```
listW = 376; panelW = 376;
grid-template-columns: minmax(320px,376px) minmax(420px,1fr) [panelW quando aberto, 0 quando fechado]
transition: grid-template-columns .34s cubic-bezier(.22,1,.36,1)

painel (grid-column:3):
  transform: translateX(0) quando aberto / translateX(100%) quando fechado
  opacity: 1 / 0
  pointer-events: auto / none
  border-left: 1px solid var(--border)   (não border-right)
  background: var(--card)                 (não box-shadow de overlay)
  transition: transform .34s cubic-bezier(.22,1,.36,1), opacity .26s ease
```

O conteúdo do painel (header escuro `#243b47`, form grid, seção notas, rodapé) é o mesmo descrito na §2.7 do README — só a posição/animação mudam.

## Global Constraints

- Idioma: código/símbolos em inglês, textos visíveis em pt-BR (espelhar en). Diff focado, sem refatorar código não relacionado.
- Sem novos `.md` além deste plano; usar `docs/ARCHITECTURE.md` §8 e `public/openapi.json` (atualizar ambos, exigido pelo CLAUDE.md do projeto quando rota `/api/v1/*` ou modelo Prisma mudam).
- `interface`/`type` só em `src/types/**`, `src/types/api/**` ou `types/` de feature — nunca soltos em `route.ts`/`page.tsx`/componentes.
- Toda query/rota tenant-scoped filtra por `tenantId` do JWT (guards existentes) — nunca aceitar `tenantId` do body.
- Envelope de API: `jsonSuccess`/`jsonError` — nada de wrapper alternativo.
- Sem testes unitários no projeto (não configurados) — verificação via `npx tsc --noEmit`, `npm run lint`, `npm run build`, e checagem manual via `npm run dev` / Playwright quando aplicável. Não inventar suíte de testes nova fora desse escopo.
- Fora de escopo desta entrega (mesmo do README, mantido): upload real de anexo no GCS (anexos = nome de arquivo em texto), janela de 24h do WhatsApp/templates aprovados, menções `@colega`, recorrência de evento/Google Calendar, drag de evento na grade, permissões granulares por papel além do RBAC já existente (`tenant_admin`/`tenant_user`).
- SSE/realtime para novas mensagens (README menciona reaproveitar) fica **fora desta entrega** — não existe webhook de entrada real para `Conversation`/`Message` hoje (dados são seed/demo); adicionar升realtime sem uma fonte real de eventos seria especulativo (YAGNI). Envio outbound real via WhatsApp Cloud API é a única integração "real" desta entrega.

---

## File Structure

```
packages/prisma/schema.prisma                                    # +3 models, +1 field, +enum não precisa (4 status já bate com as 4 etapas do design)

src/types/api/contacts-v1.ts                                     # + tipos de mensagem/envio, quick phrase, lead note, paginação de lista
src/types/api/agenda-v1.ts                                       # novo — tipos de AgendaEvent

src/lib/validators/contacts.ts                                   # + schemas de mensagem, quick phrase, nota
src/lib/validators/agenda.ts                                     # novo

src/application/ports/whatsapp-outbound.port.ts                  # novo — IWhatsAppOutbound
src/infrastructure/whatsapp/whatsapp-outbound.ts                 # novo — impl sobre whatsapp-cloud-client.ts

src/infrastructure/repositories/conversation.repository.ts       # + createMessage, updateStage(seta stageChangedAt)
src/infrastructure/repositories/quick-phrase.repository.ts       # novo
src/infrastructure/repositories/lead-note.repository.ts          # novo
src/infrastructure/repositories/agenda-event.repository.ts       # novo

src/app/api/v1/tenant/conversations/[id]/messages/route.ts       # novo — POST
src/app/api/v1/tenant/conversations/[id]/route.ts                # modificar — PATCH seta stageChangedAt
src/app/api/v1/tenant/conversations/[id]/notes/route.ts          # novo — GET/POST
src/app/api/v1/tenant/notes/[id]/route.ts                        # novo — PATCH/DELETE
src/app/api/v1/tenant/quick-phrases/route.ts                     # novo — GET/POST
src/app/api/v1/tenant/quick-phrases/[id]/route.ts                # novo — PATCH/DELETE
src/app/api/v1/tenant/agenda/route.ts                            # novo — GET/POST
src/app/api/v1/tenant/agenda/[id]/route.ts                       # novo — PATCH/DELETE

src/app/globals.css                                               # + --avatar, --row-hover, keyframes pop-in/tip-in/chat-spin

messages/pt-BR/contacts.json, messages/en/contacts.json          # + chaves novas
messages/pt-BR/agenda.json, messages/en/agenda.json              # novo namespace
src/i18n/request.ts                                               # registrar namespace agenda

src/shared/components/ui/popover.tsx                              # novo (Base UI Popover, não existe ainda)

src/features/contacts/app/
  pages/conversations-page.tsx           # nova — substitui contacts-page.tsx
  pages/conversation-detail-page.tsx     # modificar — fallback mobile (Sheet p/ lead panel)
  components/conversation-list.tsx
  components/conversation-list-item.tsx
  components/conversation-chat.tsx
  components/chat-message-bubble.tsx
  components/chat-note-block.tsx
  components/chat-event-block.tsx
  components/pinned-notes-bar.tsx
  components/quick-phrase-popover.tsx
  components/quick-phrase-manager-drawer.tsx
  components/note-composer.tsx
  components/event-composer.tsx
  components/lead-panel.tsx
  components/lead-stage-picker.tsx
  hooks/use-conversations-list.ts        # substitui use-conversations-board.ts
  hooks/use-conversation-detail.ts       # modificar — + messages/notes/events actions
  hooks/use-quick-phrases.ts
  hooks/use-lead-notes.ts
  services/contacts.service.ts           # modificar
  services/quick-phrases.service.ts
  services/notes.service.ts
  types/api.ts                           # barrel, já reexporta — sem mudança de conteúdo

src/features/agenda/app/
  pages/agenda-page.tsx
  components/agenda-week-grid.tsx
  components/agenda-month-grid.tsx
  components/agenda-upcoming-list.tsx
  hooks/use-agenda-events.ts
  services/agenda.service.ts
  types/api.ts                           # barrel reexportando @/types/api/agenda-v1

src/app/[locale]/(dashboard)/dashboard/agenda/page.tsx            # novo

src/shared/components/layout/app-sidebar.tsx                     # + item Agenda

Removidos (substituídos pela nova tela):
  src/features/contacts/app/components/contacts-kanban-board.tsx
  src/features/contacts/app/components/conversation-card.tsx
  src/features/contacts/app/hooks/use-conversations-board.ts
  src/features/contacts/app/pages/contacts-page.tsx (conteúdo movido/substituído por conversations-page.tsx)
```

---

### Task 1: Schema Prisma — QuickPhrase, LeadNote, AgendaEvent, Conversation.stageChangedAt

**Files:**
- Modify: `packages/prisma/schema.prisma`

**Interfaces:**
- Produces: modelos `QuickPhrase`, `LeadNote`, `AgendaEvent` com os campos abaixo — todas as tasks de repositório/rota dependem exatamente destes nomes de campo.

- [ ] **Step 1: Adicionar os 3 models + relations reversas + campo em Conversation**

Inserir após o model `Message` (mesma seção "Kanban de contatos multicanal"):

```prisma
model QuickPhrase {
  id         String   @id @default(cuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  slug       String
  title      String
  body       String   @db.Text
  attachment String?
  createdById String
  createdBy  User     @relation("QuickPhraseCreatedBy", fields: [createdById], references: [id], onDelete: Cascade)
  usageCount Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([tenantId, slug])
  @@index([tenantId])
}

model LeadNote {
  id             String    @id @default(cuid())
  tenantId       String
  tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  clientId       String?
  client         Client?   @relation(fields: [clientId], references: [id], onDelete: SetNull)
  authorId       String
  author         User      @relation("LeadNoteAuthor", fields: [authorId], references: [id], onDelete: Cascade)
  text           String    @db.Text
  color          String    @default("amber")
  pinned         Boolean   @default(false)
  editedAt       DateTime?
  createdAt      DateTime  @default(now())

  @@index([tenantId, conversationId, createdAt])
}

model AgendaEvent {
  id             String    @id @default(cuid())
  tenantId       String
  tenant         Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversationId String?
  conversation   Conversation? @relation(fields: [conversationId], references: [id], onDelete: SetNull)
  clientId       String?
  client         Client?   @relation(fields: [clientId], references: [id], onDelete: SetNull)
  title          String
  type           String
  startsAt       DateTime
  durationMin    Int
  ownerUserId    String
  owner          User      @relation("AgendaEventOwner", fields: [ownerUserId], references: [id], onDelete: Cascade)
  notes          String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([tenantId, startsAt])
}
```

No model `Conversation`, adicionar campo e relations:
```prisma
  stageChangedAt   DateTime            @default(now())
  notes            LeadNote[]
  agendaEvents     AgendaEvent[]
```

No model `Tenant`, adicionar:
```prisma
  quickPhrases  QuickPhrase[]
  leadNotes     LeadNote[]
  agendaEvents  AgendaEvent[]
```

No model `User`, adicionar:
```prisma
  quickPhrasesCreated QuickPhrase[] @relation("QuickPhraseCreatedBy")
  leadNotesAuthored   LeadNote[]    @relation("LeadNoteAuthor")
  agendaEventsOwned   AgendaEvent[] @relation("AgendaEventOwner")
```

No model `Client`, adicionar:
```prisma
  leadNotes     LeadNote[]
  agendaEvents  AgendaEvent[]
```

- [ ] **Step 2: Gerar migration**

Run: `npx prisma migrate dev --name add_quick_phrases_lead_notes_agenda_events --schema packages/prisma/schema.prisma`
Expected: migration criada e aplicada sem erro, `npx prisma generate` roda automaticamente.

- [ ] **Step 3: Atualizar `docs/ARCHITECTURE.md` §8**

Adicionar `QuickPhrase`, `LeadNote`, `AgendaEvent` na lista de entidades do §8 (uma linha cada, seguindo o padrão das entidades existentes).

- [ ] **Step 4: Commit**

```bash
git add packages/prisma/schema.prisma packages/prisma/migrations docs/ARCHITECTURE.md
git commit -m "feat(prisma): add QuickPhrase, LeadNote, AgendaEvent models"
```

---

### Task 2: Tipos de API (contacts-v1 + agenda-v1)

**Files:**
- Modify: `src/types/api/contacts-v1.ts`
- Create: `src/types/api/agenda-v1.ts`

**Interfaces:**
- Consumes: nada (tipos puros).
- Produces: todos os tipos abaixo — toda task de rota/service/componente usa exatamente estes nomes.

- [ ] **Step 1: Adicionar em `contacts-v1.ts`**

```ts
export type SendMessageRequestBody = {
  body: string;
  attachment?: string | null;
};

export type ConversationListQueryParams = {
  channel?: ConversationChannel;
  status?: ConversationStatus;
  q?: string;
  cursor?: string;
  limit?: number;
};

export type ConversationListItemDto = ConversationCardDto & {
  stageChangedAt: string;
};

export type ConversationsListResponseData = {
  data: ConversationListItemDto[];
  nextCursor: string | null;
  totalItems: number;
};

export type QuickPhraseDto = {
  id: string;
  slug: string;
  title: string;
  body: string;
  attachment: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type QuickPhrasesResponseData = {
  data: QuickPhraseDto[];
};

export type UpsertQuickPhraseRequestBody = {
  slug: string;
  title: string;
  body: string;
  attachment?: string | null;
};

export type LeadNoteColor = "amber" | "sky" | "emerald" | "violet";

export type LeadNoteDto = {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string | null;
  text: string;
  color: LeadNoteColor;
  pinned: boolean;
  editedAt: string | null;
  createdAt: string;
};

export type LeadNotesResponseData = {
  data: LeadNoteDto[];
};

export type UpsertLeadNoteRequestBody = {
  text: string;
  color: LeadNoteColor;
  pinned: boolean;
};
```

- [ ] **Step 2: Criar `agenda-v1.ts`**

```ts
export type AgendaEventType = "consulta" | "retorno" | "exame" | "ligacao";

export type AgendaEventDto = {
  id: string;
  conversationId: string | null;
  clientId: string | null;
  title: string;
  type: AgendaEventType;
  startsAt: string;
  durationMin: number;
  ownerUserId: string;
  ownerUserName: string | null;
  leadName: string | null;
  notes: string | null;
  createdAt: string;
};

export type AgendaListQueryParams = {
  from: string;
  to: string;
};

export type AgendaListResponseData = {
  data: AgendaEventDto[];
};

export type CreateAgendaEventRequestBody = {
  conversationId?: string | null;
  clientId?: string | null;
  title: string;
  type: AgendaEventType;
  startsAt: string;
  durationMin: number;
  ownerUserId: string;
  notes?: string | null;
  sendConfirmation: boolean;
};

export type UpdateAgendaEventRequestBody = Partial<
  Omit<CreateAgendaEventRequestBody, "sendConfirmation">
>;
```

- [ ] **Step 3: `npx tsc --noEmit` (deve continuar passando — só tipos novos, nada os consome ainda)**

- [ ] **Step 4: Commit**

```bash
git add src/types/api/contacts-v1.ts src/types/api/agenda-v1.ts
git commit -m "feat(types): add message/quick-phrase/note/agenda API DTOs"
```

---

### Task 3: Validators Zod

**Files:**
- Modify: `src/lib/validators/contacts.ts`
- Create: `src/lib/validators/agenda.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `sendMessageBodySchema`, `upsertQuickPhraseBodySchema`, `upsertLeadNoteBodySchema`, `createAgendaEventBodySchema`, `updateAgendaEventBodySchema` — rotas da Task 6/7 importam estes nomes.

- [ ] **Step 1: Adicionar em `src/lib/validators/contacts.ts`**

```ts
export const sendMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(4096),
  attachment: z.string().trim().max(255).nullable().optional(),
});

export const upsertQuickPhraseBodySchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "slug deve conter apenas letras minúsculas, números e hífen"),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4096),
  attachment: z.string().trim().max(255).nullable().optional(),
});

const leadNoteColorEnum = z.enum(["amber", "sky", "emerald", "violet"]);

export const upsertLeadNoteBodySchema = z.object({
  text: z.string().trim().min(1).max(2000),
  color: leadNoteColorEnum,
  pinned: z.boolean(),
});
```

- [ ] **Step 2: Criar `src/lib/validators/agenda.ts`**

```ts
import { z } from "zod";

const agendaEventTypeEnum = z.enum(["consulta", "retorno", "exame", "ligacao"]);

export const createAgendaEventBodySchema = z.object({
  conversationId: z.string().trim().min(1).nullable().optional(),
  clientId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(160),
  type: agendaEventTypeEnum,
  startsAt: z.string().trim().datetime({ offset: true }).or(z.string().trim().min(1)),
  durationMin: z.number().int().min(5).max(480),
  ownerUserId: z.string().trim().min(1),
  notes: z.string().trim().max(2000).nullable().optional(),
  sendConfirmation: z.boolean(),
});

export const updateAgendaEventBodySchema = createAgendaEventBodySchema
  .omit({ sendConfirmation: true })
  .partial();
```

- [ ] **Step 3: `npx tsc --noEmit`**

- [ ] **Step 4: Commit**

```bash
git add src/lib/validators/contacts.ts src/lib/validators/agenda.ts
git commit -m "feat(validators): add message/quick-phrase/note/agenda schemas"
```

---

### Task 4: Tokens CSS + i18n (contacts.json, agenda.json)

**Files:**
- Modify: `src/app/globals.css`
- Modify: `messages/pt-BR/contacts.json`, `messages/en/contacts.json`
- Create: `messages/pt-BR/agenda.json`, `messages/en/agenda.json`
- Modify: `src/i18n/request.ts`

**Interfaces:**
- Produces: classes utilitárias `.animate-pop-in`, `.animate-tip-in`, `.animate-chat-spin`; tokens `--avatar`, `--row-hover`; namespace i18n `agenda` disponível via `useTranslations("agenda")`.

- [ ] **Step 1: `globals.css` — tokens no `:root` e `.dark`**

No bloco `:root` (junto dos outros tokens shadcn):
```css
--avatar: oklch(0.905 0 0);
--row-hover: oklch(0.958 0 0);
```
No bloco `.dark`:
```css
--avatar: oklch(0.34 0 0);
--row-hover: oklch(0.245 0 0);
```

- [ ] **Step 2: `globals.css` — keyframes novos dentro de `@layer utilities`, junto dos `chat-*` existentes**

```css
@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(2px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
.animate-pop-in {
  animation: pop-in 0.14s ease-out;
}

@keyframes tip-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
.animate-tip-in {
  animation: tip-in 0.12s ease-out;
}

@keyframes chat-spin {
  to {
    transform: rotate(360deg);
  }
}
.animate-chat-spin {
  animation: chat-spin 0.7s linear infinite;
}
```
Incluir as 3 classes no bloco `@media (prefers-reduced-motion: reduce)` já existente (animation: none).

- [ ] **Step 3: Expandir `messages/pt-BR/contacts.json`**

Adicionar (mesclando com o conteúdo já existente, sem remover `page`/`board`/`card`/`detail` — `board` pode ficar órfão até o Task de cleanup remover o kanban, não apagar agora para não quebrar build no meio do plano):

```json
{
  "list": {
    "title": "Conversas",
    "searchPlaceholder": "Buscar lead, telefone, mensagem",
    "unread": "{count} não lidas",
    "allStages": "Todas as etapas",
    "loadingMore": "Carregando mais conversas…",
    "end": "{count} conversas · fim da lista",
    "anonymous": "Lead #{id}",
    "noResults": "Nenhum contato encontrado para esses filtros.",
    "loadError": "Não foi possível carregar as conversas.",
    "retry": "Tentar novamente"
  },
  "channel": {
    "all": "Todos os canais",
    "whatsappOnly": "Só WhatsApp",
    "instagramOnly": "Só Instagram"
  },
  "stage": {
    "new": "Novo Contato",
    "in_progress": "Em atendimento",
    "qualified": "Qualificado",
    "discarded": "Descartado",
    "move": "Mover lead para",
    "changed": "Etapa alterada para {stage}"
  },
  "chat": {
    "composerPlaceholder": "Mensagem ou / para frases prontas",
    "send": "Enviar · Enter",
    "attach": "Anexar arquivo",
    "phrases": "Frases prontas — digite /",
    "editLead": "Editar lead",
    "closeLead": "Fechar lead",
    "changeStage": "Mudar etapa do lead",
    "sendError": "Não foi possível enviar a mensagem.",
    "openInAgenda": "Ver na agenda"
  },
  "phrases": {
    "title": "Frases prontas",
    "subtitle": "Atalhos digitados com / no chat",
    "new": "Nova frase",
    "searchPlaceholder": "Buscar atalho ou título",
    "createFromDraft": "Criar frase a partir do que está escrito",
    "hintNavigate": "↑↓ navegar · Enter inserir · Esc fechar",
    "validation": "Informe atalho e mensagem",
    "empty": "Nenhuma frase encontrada.",
    "cancel": "Cancelar",
    "create": "Cadastrar frase",
    "save": "Salvar alterações",
    "duplicateSuffix": "2",
    "duplicateLabel": "(cópia)"
  },
  "notes": {
    "section": "Notas",
    "new": "Nova nota",
    "formTitle": "Nota interna sobre o lead",
    "editTitle": "Editar nota interna",
    "notSent": "não é enviada ao contato",
    "pin": "Fixar no chat",
    "pinned": "Fixada no chat",
    "pinnedBar": "Nota fixada",
    "pinnedBarMany": "Notas fixadas {i}/{n}",
    "empty": "Nenhuma nota ainda — use /notas no chat.",
    "placeholder": "Ex.: prefere contato após as 18h; já foi paciente em 2023.",
    "savedPinned": "Nota salva e fixada no chat",
    "saved": "Nota salva no perfil do lead",
    "updated": "Nota atualizada",
    "deleted": "Nota excluída",
    "cancel": "Cancelar",
    "create": "Salvar nota",
    "save": "Salvar alterações",
    "colors": {
      "amber": "Amarelo — atenção",
      "sky": "Azul — informação",
      "emerald": "Verde — positivo",
      "violet": "Roxo — financeiro"
    }
  },
  "event": {
    "formTitle": "Agendar para este lead",
    "goesToAgenda": "vai para a Agenda",
    "sendConfirmation": "Enviar confirmação ao lead",
    "save": "Agendar",
    "cancel": "Cancelar",
    "validation": "Informe título e data",
    "confirmationMessage": "Agendamento confirmado: {title} em {date} às {time} com {owner}. Chegue 15 minutos antes 🙂",
    "type": {
      "consulta": "Consulta",
      "retorno": "Retorno",
      "exame": "Exame",
      "ligacao": "Ligação"
    },
    "dateShortcuts": {
      "today": "Hoje",
      "tomorrow": "Amanhã",
      "in3Days": "Em 3 dias",
      "in7Days": "Em 7 dias"
    }
  }
}
```

Espelhar em `messages/en/contacts.json` com tradução equivalente (mesma estrutura de chaves).

- [ ] **Step 4: Criar `messages/pt-BR/agenda.json`**

```json
{
  "page": {
    "title": "Agenda"
  },
  "view": {
    "week": "Semana",
    "month": "Mês",
    "today": "Hoje"
  },
  "count": "{count} compromissos",
  "upcoming": {
    "title": "Próximos compromissos",
    "empty": "Nenhum compromisso agendado.",
    "openChat": "Abrir conversa"
  },
  "tooltip": {
    "owner": "Responsável"
  }
}
```

Criar `messages/en/agenda.json` equivalente em inglês.

- [ ] **Step 5: Registrar namespace `agenda` em `src/i18n/request.ts`**

Adicionar `agenda: (await import("../../messages/{locale}/agenda.json")).default,` nos 3 branches (`pt-BR`, `en`, `default`), seguindo o padrão de `contacts`.

- [ ] **Step 6: `npx tsc --noEmit && npm run lint`**

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css messages/pt-BR/contacts.json messages/en/contacts.json messages/pt-BR/agenda.json messages/en/agenda.json src/i18n/request.ts
git commit -m "feat(i18n): add conversations/agenda copy and chat animation tokens"
```

---

### Task 5: Componente Popover compartilhado (base UI ainda não existe no repo)

**Files:**
- Create: `src/shared/components/ui/popover.tsx`

**Interfaces:**
- Produces: `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor` — usados por `quick-phrase-popover.tsx`, `lead-stage-picker.tsx`, filtro de etapa da lista.

- [ ] **Step 1: Confirmar dependência disponível**

Run: `grep '"@base-ui-components/react"' package.json` (o projeto já usa Base UI em `dialog.tsx`/`select.tsx`/`sidebar.tsx` — reaproveitar o mesmo pacote, `@base-ui-components/react/popover` ou equivalente já usado nos outros arquivos de `ui/`). Ler `src/shared/components/ui/dropdown-menu.tsx` para copiar o padrão exato de composição (forwardRef, `data-slot`, classes Tailwind, `cn()`).

- [ ] **Step 2: Implementar `popover.tsx`** seguindo 1:1 o padrão de `dropdown-menu.tsx` (mesmo import base, mesma estrutura de `Portal`/`Positioner`/`Popup`), com raio 10px, sombra `shadow-lg`, `animate-pop-in` na entrada, largura controlada via prop `className` (sem width fixa hardcoded).

- [ ] **Step 3: `npx tsc --noEmit`**

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/ui/popover.tsx
git commit -m "feat(ui): add Popover component"
```

---

### Task 6: Port + infra de envio real de mensagem (IWhatsAppOutbound)

**Files:**
- Create: `src/application/ports/whatsapp-outbound.port.ts`
- Create: `src/infrastructure/whatsapp/whatsapp-outbound.ts`

**Interfaces:**
- Consumes: `sendTextMessage` de `@/infrastructure/whatsapp/whatsapp-cloud-client` (já existe), `decryptTenantSecret` de `@/infrastructure/crypto/tenant-secret` (já existe), `prisma` de `@/infrastructure/database/prisma`.
- Produces: `IWhatsAppOutbound.sendText(input): Promise<WhatsAppOutboundResult>` — consumido pela rota da Task 8 (POST messages).

- [ ] **Step 1: Port**

```ts
// src/application/ports/whatsapp-outbound.port.ts
export type WhatsAppOutboundInput = {
  tenantId: string;
  recipientPhone: string;
  text: string;
};

export type WhatsAppOutboundResult =
  | { sent: true; externalMessageId: string }
  | { sent: false; reason: "tenant_not_configured" | "send_failed"; errorDetail?: string };

export interface IWhatsAppOutbound {
  sendText(input: WhatsAppOutboundInput): Promise<WhatsAppOutboundResult>;
}
```

- [ ] **Step 2: Implementação — mesmo padrão de skip gracioso do `whatsapp-dispatcher.ts`**

```ts
// src/infrastructure/whatsapp/whatsapp-outbound.ts
import type {
  IWhatsAppOutbound,
  WhatsAppOutboundInput,
  WhatsAppOutboundResult,
} from "@/application/ports/whatsapp-outbound.port";
import { decryptTenantSecret } from "@/infrastructure/crypto/tenant-secret";
import { prisma } from "@/infrastructure/database/prisma";
import { sendTextMessage } from "@/infrastructure/whatsapp/whatsapp-cloud-client";

export const whatsappOutbound: IWhatsAppOutbound = {
  async sendText(input: WhatsAppOutboundInput): Promise<WhatsAppOutboundResult> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: {
        whatsappEnabled: true,
        whatsappPhoneNumberId: true,
        whatsappAccessTokenEnc: true,
      },
    });

    if (
      !tenant?.whatsappEnabled ||
      !tenant.whatsappPhoneNumberId ||
      !tenant.whatsappAccessTokenEnc
    ) {
      return { sent: false, reason: "tenant_not_configured" };
    }

    try {
      const accessToken = decryptTenantSecret(tenant.whatsappAccessTokenEnc);
      const externalMessageId = await sendTextMessage(
        tenant.whatsappPhoneNumberId,
        accessToken,
        input.recipientPhone,
        input.text,
      );
      return { sent: true, externalMessageId };
    } catch (err) {
      return {
        sent: false,
        reason: "send_failed",
        errorDetail: err instanceof Error ? err.message : "Unknown send error",
      };
    }
  },
};
```

- [ ] **Step 3: `npx tsc --noEmit`**

- [ ] **Step 4: Commit**

```bash
git add src/application/ports/whatsapp-outbound.port.ts src/infrastructure/whatsapp/whatsapp-outbound.ts
git commit -m "feat(whatsapp): add outbound text message port and adapter"
```

---

### Task 7: Repositórios (quick-phrase, lead-note, agenda-event) + extensão do conversation.repository

**Files:**
- Modify: `src/infrastructure/repositories/conversation.repository.ts`
- Create: `src/infrastructure/repositories/quick-phrase.repository.ts`
- Create: `src/infrastructure/repositories/lead-note.repository.ts`
- Create: `src/infrastructure/repositories/agenda-event.repository.ts`

**Interfaces:**
- Consumes: modelos da Task 1.
- Produces: métodos usados diretamente pelas rotas da Task 8.

- [ ] **Step 1: `conversation.repository.ts` — adicionar**

```ts
async listByTenantPaged(
  tenantId: string,
  opts: { channel?: ConversationChannel; status?: ConversationStatus; q?: string; cursor?: string; limit: number },
): Promise<{ items: ConversationRow[]; nextCursor: string | null; totalItems: number }>
// where: tenantId, channel?, status?, q => displayName/client.name contains insensitive OR messages.some body contains
// orderBy: lastMessageAt desc nulls last, id desc (cursor = último id da página anterior)
// cursor-based com cursor+skip:1 padrão Prisma

async createMessage(
  tenantId: string,
  conversationId: string,
  input: { direction: MessageDirection; body: string; status: MessageStatus; actorUserId?: string },
): Promise<Message>
// valida conversationId pertence ao tenantId (findFirst antes do create), atualiza Conversation.lastMessageAt/lastInboundAt em transação

async updateStage(
  tenantId: string,
  conversationId: string,
  status: ConversationStatus,
): Promise<boolean>
// como updateStatus atual, mas seta também stageChangedAt: new Date()
```

Manter `listByTenant`/`findByIdInTenant`/`updateStatus` existentes intactos (ainda usados pelo cleanup até a Task 12 remover o kanban) — `updateStatus` pode virar alias de `updateStage` internamente para não duplicar lógica (DRY, 2 usos = ok manter, mas reaproveitar implementação).

- [ ] **Step 2: `quick-phrase.repository.ts`**

```ts
export const quickPhrasePrismaRepository = {
  async listByTenant(tenantId: string): Promise<QuickPhrase[]>,      // orderBy title asc
  async create(tenantId: string, createdById: string, input: {slug,title,body,attachment}): Promise<QuickPhrase>,
  async update(tenantId: string, id: string, input: Partial<{slug,title,body,attachment}>): Promise<QuickPhrase | null>, // updateMany scoped, depois findFirst para retornar
  async remove(tenantId: string, id: string): Promise<boolean>,      // deleteMany, count>0
  async incrementUsage(tenantId: string, id: string): Promise<void>,
};
```

- [ ] **Step 3: `lead-note.repository.ts`**

```ts
export const leadNotePrismaRepository = {
  async listByConversation(tenantId: string, conversationId: string): Promise<(LeadNote & {author: {name: string|null}})[]>, // orderBy pinned desc, createdAt desc
  async create(tenantId: string, conversationId: string, authorId: string, input: {text,color,pinned}, clientId: string | null): Promise<LeadNote>,
  async update(tenantId: string, id: string, input: Partial<{text,color,pinned}>): Promise<LeadNote | null>, // seta editedAt: new Date() quando text muda
  async remove(tenantId: string, id: string): Promise<boolean>,
};
```

- [ ] **Step 4: `agenda-event.repository.ts`**

```ts
export const agendaEventPrismaRepository = {
  async listByRange(tenantId: string, from: Date, to: Date): Promise<(AgendaEvent & {owner:{name:string|null}, conversation:{displayName:string}|null})[]>, // startsAt >= from AND < to, orderBy startsAt asc
  async create(tenantId: string, input: {conversationId, clientId, title, type, startsAt, durationMin, ownerUserId, notes}): Promise<AgendaEvent>,
  async update(tenantId: string, id: string, input: Partial<{...}>): Promise<AgendaEvent | null>,
  async remove(tenantId: string, id: string): Promise<boolean>,
  async findByIdInTenant(tenantId: string, id: string): Promise<AgendaEvent | null>,
};
```

- [ ] **Step 5: `npx tsc --noEmit`**

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/repositories/
git commit -m "feat(repositories): add quick-phrase, lead-note, agenda-event repos"
```

---

### Task 8: Rotas API v1

**Files:**
- Create: `src/app/api/v1/tenant/conversations/[id]/messages/route.ts`
- Modify: `src/app/api/v1/tenant/conversations/route.ts` (adicionar paginação/filtros server-side via query params, usando `listByTenantPaged`)
- Modify: `src/app/api/v1/tenant/conversations/[id]/route.ts` (PATCH usa `updateStage`)
- Create: `src/app/api/v1/tenant/conversations/[id]/notes/route.ts`
- Create: `src/app/api/v1/tenant/notes/[id]/route.ts`
- Create: `src/app/api/v1/tenant/quick-phrases/route.ts`
- Create: `src/app/api/v1/tenant/quick-phrases/[id]/route.ts`
- Create: `src/app/api/v1/tenant/agenda/route.ts`
- Create: `src/app/api/v1/tenant/agenda/[id]/route.ts`
- Modify: `public/openapi.json`

**Interfaces:**
- Consumes: guards (`requireSessionOr401`, `getActiveTenantIdOr400`, `assertActiveTenantMembership`), `jsonSuccess`/`jsonError`, validators da Task 3, repositórios da Task 7, `whatsappOutbound` da Task 6.
- Produces: os 10 endpoints do README seção "API v1 sugerida".

Todas as rotas seguem o fluxo padrão do projeto (`backend-api.md`):
`requireSessionOr401` → `getActiveTenantIdOr400` → `assertActiveTenantMembership` → parse Zod → repo → `jsonSuccess`/`jsonError`.

- [ ] **Step 1: `conversations/[id]/messages/route.ts` — POST**

Body: `sendMessageBodySchema`. Fluxo: valida conversa pertence ao tenant e pega `client.phone` ou telefone do lead (se `Conversation` não tiver telefone direto, usar `externalId` — checar se `externalId` é o telefone; se não for, buscar via `Client.phone` quando `clientId` setado; se não houver telefone resolvível, `status` fica `"failed"` sem chamar `whatsappOutbound`). Cria `Message` via `createMessage(tenantId, id, {direction:"outbound", body, status:"sent", actorUserId: session.user.id})` **antes** de tentar o envio real (mensagem sempre persiste), chama `whatsappOutbound.sendText`; se `sent:false`, faz `prisma.message.update` para `status:"failed"`, `errorDetail`. Retorna `jsonSuccess<MessageDto>`.

- [ ] **Step 2: `conversations/route.ts` — GET com filtros**

Query params: `channel`, `status`, `q`, `cursor`, `limit` (default 20, max 50). Chama `listByTenantPaged`. Retorna `jsonSuccess<ConversationsListResponseData>`. **Manter** o formato antigo `{columns}` incompatível — decisão: este é um endpoint novo de verdade (lista paginada), o antigo endpoint de board (`{columns}`) deixa de ser usado pelo frontend após a Task 12, mas o contrato muda de shape — **atualizar diretamente este arquivo** (é o mesmo path `GET /api/v1/tenant/conversations`, só muda o formato de resposta) já que não há consumidor externo documentado além do próprio frontend deste repo.

- [ ] **Step 3: `conversations/[id]/route.ts` — PATCH usa `updateStage`**

Troca a chamada de `updateStatus` para `updateStage` (mesma assinatura, mesmo schema `patchConversationStatusBodySchema`).

- [ ] **Step 4: `conversations/[id]/notes/route.ts` — GET/POST**

GET: lista notas via `leadNotePrismaRepository.listByConversation`. POST: valida `upsertLeadNoteBodySchema`, precisa resolver `clientId` da conversa (buscar conversation para pegar `clientId`), chama `create`.

- [ ] **Step 5: `notes/[id]/route.ts` — PATCH/DELETE**

PATCH: `upsertLeadNoteBodySchema.partial()`. DELETE: `remove`. Ambos 404 se `count === 0`/`null`.

- [ ] **Step 6: `quick-phrases/route.ts` — GET/POST**

GET: lista todas do tenant. POST: `upsertQuickPhraseBodySchema`; 409 (`jsonError("SLUG_TAKEN", ..., 409)`) se unique constraint falhar (capturar erro Prisma `P2002`).

- [ ] **Step 7: `quick-phrases/[id]/route.ts` — PATCH/DELETE**

Mesmo padrão, schema `.partial()` no PATCH, 409 em conflito de slug.

- [ ] **Step 8: `agenda/route.ts` — GET/POST**

GET: query `from`/`to` (ISO date, obrigatórios — 400 se ausentes/invalidos). POST: `createAgendaEventBodySchema`; após `create`, se `sendConfirmation === true` e a conversa tiver telefone resolvível, monta a mensagem de confirmação (`event.confirmationMessage` — montar server-side em pt-BR fixo, já que não há locale por tenant persistido para isso: `` `Agendamento confirmado: ${title} em ${dd/mm/aaaa} às ${HH:MM} com ${ownerName}. Chegue 15 minutos antes 🙂` ``) e chama o mesmo fluxo de `createMessage` + `whatsappOutbound.sendText` da Task 8/Step 1 (extrair helper compartilhado `sendConversationTextMessage(tenantId, conversationId, body, actorUserId)` em `src/application/use-cases/conversations/send-conversation-message.ts` para não duplicar entre as duas rotas — **SRP/DRY**, 2 usos já justifica extrair).

- [ ] **Step 9: `agenda/[id]/route.ts` — PATCH/DELETE**

Schema `updateAgendaEventBodySchema`, sem reenvio de confirmação no PATCH (fora de escopo, não pedido pelo design).

- [ ] **Step 10: Extrair `send-conversation-message.ts` (use case)**

```ts
// src/application/use-cases/conversations/send-conversation-message.ts
export type SendConversationMessageInput = {
  tenantId: string;
  conversationId: string;
  actorUserId: string;
  body: string;
};
export type SendConversationMessageResult = { message: Message; sent: boolean };

export async function sendConversationMessage(
  input: SendConversationMessageInput,
): Promise<SendConversationMessageResult>
```
Move a lógica descrita no Step 1 para cá (resolve telefone, cria `Message`, chama `whatsappOutbound.sendText`, atualiza status). As duas rotas (messages POST e agenda POST) chamam este use case.

- [ ] **Step 11: Atualizar `public/openapi.json`**

Adicionar os 8 paths novos/modificados (`/tenant/conversations` GET atualizado, `/tenant/conversations/{id}/messages` POST, `/tenant/conversations/{id}/notes` GET/POST, `/tenant/notes/{id}` PATCH/DELETE, `/tenant/quick-phrases` GET/POST, `/tenant/quick-phrases/{id}` PATCH/DELETE, `/tenant/agenda` GET/POST, `/tenant/agenda/{id}` PATCH/DELETE), com schemas request/response espelhando os tipos da Task 2, seguindo o formato já usado nos paths `conversations` existentes do arquivo.

- [ ] **Step 12: `npx tsc --noEmit`**

- [ ] **Step 13: Verificação manual**

Run: `npm run dev`, depois `curl` autenticado ou via browser DevTools nos endpoints novos (ou Playwright ad-hoc) confirmando envelope `{success,data,meta}` correto e 401/400/403 nos guards.

- [ ] **Step 14: Commit**

```bash
git add src/app/api/v1/tenant/conversations src/app/api/v1/tenant/notes src/app/api/v1/tenant/quick-phrases src/app/api/v1/tenant/agenda src/application/use-cases/conversations public/openapi.json
git commit -m "feat(api): add message send, quick-phrase, lead-note and agenda endpoints"
```

---

### Task 9: Services + hooks do frontend (contacts)

**Files:**
- Modify: `src/features/contacts/app/services/contacts.service.ts`
- Create: `src/features/contacts/app/services/quick-phrases.service.ts`
- Create: `src/features/contacts/app/services/notes.service.ts`
- Create: `src/features/contacts/app/hooks/use-conversations-list.ts`
- Modify: `src/features/contacts/app/hooks/use-conversation-detail.ts`
- Create: `src/features/contacts/app/hooks/use-quick-phrases.ts`
- Create: `src/features/contacts/app/hooks/use-lead-notes.ts`
- Delete: `src/features/contacts/app/hooks/use-conversations-board.ts`

**Interfaces:**
- Consumes: tipos da Task 2, endpoints da Task 8.
- Produces: hooks consumidos pelos componentes da Task 10-12.

- [ ] **Step 1: `contacts.service.ts` — adicionar/ajustar**

```ts
export async function getConversationsList(params: ConversationListQueryParams): Promise<ConversationsListResponseData>
// GET /api/v1/tenant/conversations com querystring
export async function sendMessage(conversationId: string, body: SendMessageRequestBody): Promise<MessageDto>
// POST /api/v1/tenant/conversations/${id}/messages, skipErrorToast:true
```
Manter `updateConversationStatus` e `getConversationDetail` como estão (assinatura inalterada).

- [ ] **Step 2: `quick-phrases.service.ts`**

```ts
export async function listQuickPhrases(): Promise<QuickPhraseDto[]>
export async function createQuickPhrase(input: UpsertQuickPhraseRequestBody): Promise<QuickPhraseDto>
export async function updateQuickPhrase(id: string, input: Partial<UpsertQuickPhraseRequestBody>): Promise<QuickPhraseDto>
export async function deleteQuickPhrase(id: string): Promise<void>
```

- [ ] **Step 3: `notes.service.ts`**

```ts
export async function listLeadNotes(conversationId: string): Promise<LeadNoteDto[]>
export async function createLeadNote(conversationId: string, input: UpsertLeadNoteRequestBody): Promise<LeadNoteDto>
export async function updateLeadNote(id: string, input: Partial<UpsertLeadNoteRequestBody>): Promise<LeadNoteDto>
export async function deleteLeadNote(id: string): Promise<void>
```

- [ ] **Step 4: `use-conversations-list.ts`**

Estado: `{ items: ConversationListItemDto[], loading, loadingMore, error, hasMore, nextCursor }`. Params reativos: `search` (já debounced pelo componente), `channelFilter`, `stageFilter`. `loadMore()` concatena. Reset (zera `items`/`nextCursor`) quando `search`/`channelFilter`/`stageFilter` mudam (useEffect com deps).

- [ ] **Step 5: `use-conversation-detail.ts` — estender**

Adicionar ao retorno: `sendMessage(body: string) => Promise<void>` (optimistic: injeta `MessageDto` local com `status:"sent"` antes da resposta, substitui pelo real na resposta, marca `status:"failed"` em erro — sem re-fetch completo), `notes: LeadNoteDto[]`, `notesLoading`, `refreshNotes()`, `createNote`, `updateNote`, `deleteNote` (delegando a `notes.service.ts`, atualizando o array local).

- [ ] **Step 6: `use-quick-phrases.ts`**

CRUD state simples: `{ items, loading, error }` + `create`/`update`/`remove` que atualizam local após sucesso (sem refetch completo — DRY com padrão de `use-conversations-board.ts` atual que já faz update otimista).

- [ ] **Step 7: `npx tsc --noEmit`**

- [ ] **Step 8: Commit**

```bash
git add src/features/contacts/app/services src/features/contacts/app/hooks
git rm src/features/contacts/app/hooks/use-conversations-board.ts
git commit -m "feat(contacts): add services/hooks for messages, notes, quick phrases"
```

---

### Task 10: Componentes do chat (lista, bolha, notas/eventos inline, composer, popover de frases)

**Files:**
- Create: `src/features/contacts/app/components/conversation-list.tsx`
- Create: `src/features/contacts/app/components/conversation-list-item.tsx`
- Create: `src/features/contacts/app/components/conversation-chat.tsx`
- Create: `src/features/contacts/app/components/chat-message-bubble.tsx`
- Create: `src/features/contacts/app/components/chat-note-block.tsx`
- Create: `src/features/contacts/app/components/chat-event-block.tsx`
- Create: `src/features/contacts/app/components/pinned-notes-bar.tsx`
- Create: `src/features/contacts/app/components/quick-phrase-popover.tsx`
- Create: `src/features/contacts/app/components/note-composer.tsx`
- Create: `src/features/contacts/app/components/event-composer.tsx`

**Interfaces:**
- Consumes: hooks da Task 9, tipos da Task 2, `Popover` da Task 5, componentes shadcn existentes (`Input`, `Button`, `Badge`, `Avatar`, `Switch`, `Select`).
- Produces: props públicas que a Task 11 (`conversations-page.tsx`) monta.

Especificação visual: seguir §2.1, §2.2, §2.3, §2.5, §2.6 do README verbatim (tokens, tamanhos, raios, animações já listados nesse documento — não repetir aqui, é a fonte de verdade). Pontos que exigem decisão de implementação (não estão no README):

- `conversation-list.tsx`: scroll infinito via `onScroll` do container (`scrollTop + clientHeight >= scrollHeight - 120`) chamando `loadMore()` do hook; debounce de chamada com uma flag local `loadingMore` (não `useDebouncedCallback`, já é guardado por `loadingMore` boolean do hook).
- `chat-message-bubble.tsx`: extrair de `conversation-detail-panel.tsx` atual (`MessageBubble`, `DeliveryTicks`, `DateSeparator`, `bubbleTime`, `isSameLocalDay`, `dateSeparatorLabel`) — mover, não duplicar.
- `quick-phrase-popover.tsx`: regex de abertura `/^\/[^\s]*$/` testada no `onChange` do textarea do composer (prop `draft: string`, componente é controlado pelo pai `conversation-chat.tsx`); resolução de variáveis (`{{nome}}`, `{{medico}}`, `{{data}}`) acontece no pai ao inserir (função pura `resolvePhraseVariables(body: string, ctx: {nome, medico, dataProximoCompromisso}): string` em `src/features/contacts/app/utils/resolve-phrase-variables.ts`).
- `/notas` e `/agendar` como slash-commands: tratados no mesmo textarea do composer — ao detectar draft `"/notas"` ou `"/agendar"` exato (não popover, abre direto o formulário), conforme §2.5/§2.6.

- [ ] **Step 1-9: Implementar cada componente conforme README + decisões acima.**

- [ ] **Step 10: `npx tsc --noEmit`**

- [ ] **Step 11: Commit**

```bash
git add src/features/contacts/app/components/conversation-list.tsx src/features/contacts/app/components/conversation-list-item.tsx src/features/contacts/app/components/conversation-chat.tsx src/features/contacts/app/components/chat-message-bubble.tsx src/features/contacts/app/components/chat-note-block.tsx src/features/contacts/app/components/chat-event-block.tsx src/features/contacts/app/components/pinned-notes-bar.tsx src/features/contacts/app/components/quick-phrase-popover.tsx src/features/contacts/app/components/note-composer.tsx src/features/contacts/app/components/event-composer.tsx src/features/contacts/app/utils/resolve-phrase-variables.ts
git commit -m "feat(contacts): build conversation list and chat components"
```

---

### Task 11: Drawer de frases + Painel do lead (Layout B) + Stage picker

**Files:**
- Create: `src/features/contacts/app/components/quick-phrase-manager-drawer.tsx`
- Create: `src/features/contacts/app/components/lead-panel.tsx`
- Create: `src/features/contacts/app/components/lead-stage-picker.tsx`

**Interfaces:**
- Consumes: `Sheet`/`SheetContent` de `@/shared/components/ui/sheet` (drawer de frases usa `Sheet` — README pede painel `position:fixed` lateral, que é exatamente o padrão `Sheet` já usado no projeto, side="right"), `Popover` da Task 5 (stage picker).
- Produces: `LeadPanel` recebe `{ open: boolean; onClose: () => void; conversation: ConversationCardDto; form: ...; onSave; onStageChange; notes; ... }` — a Task 12 controla o estado `leadPanelOpen`.

Ponto crítico: `lead-panel.tsx` **usa a posição de Layout B** definida na seção "Decisão de layout confirmada com o usuário" no topo deste plano — `grid-column:3`, `border-left`, `background: var(--card)`, sem o `box-shadow` de overlay do Layout A. Implementar com Tailwind + `style` inline apenas para o `transform`/`opacity`/`pointer-events` dinâmicos (idênticos ao que `paneRowStyle`/`panelStyle` fazem no protótipo), já que são valores computados a partir de `open` (boolean), não há necessidade de CSS var extra.

- [ ] **Step 1: `quick-phrase-manager-drawer.tsx`** — Sheet side="right", `width:min(560px,100%)`, modo lista/editor conforme §2.4.

- [ ] **Step 2: `lead-stage-picker.tsx`** — Popover com 4 itens (`check` na etapa atual, `circle-dashed` nas outras), conforme §2.7.

- [ ] **Step 3: `lead-panel.tsx`** — header escuro fixo `#243b47`/`#e9edef` (hardcoded, não é token de tema — é intencional no design, igual ao chat), grid de campos, seção Notas, rodapé. Grid-column 3 do container pai (a Task 12 é quem declara o grid completo; este componente só precisa saber que está dentro de uma célula de grid e ocupar 100% dela).

- [ ] **Step 4: `npx tsc --noEmit`**

- [ ] **Step 5: Commit**

```bash
git add src/features/contacts/app/components/quick-phrase-manager-drawer.tsx src/features/contacts/app/components/lead-panel.tsx src/features/contacts/app/components/lead-stage-picker.tsx
git commit -m "feat(contacts): build quick-phrase drawer and lead panel (layout B)"
```

---

### Task 12: `conversations-page.tsx` (assemblagem, grid Layout B, responsivo) + rota + sidebar + cleanup do kanban

**Files:**
- Create: `src/features/contacts/app/pages/conversations-page.tsx`
- Modify: `src/app/[locale]/(dashboard)/dashboard/contacts/page.tsx` (importar `ConversationsPage` em vez de `ContactsPage`)
- Modify: `src/features/contacts/app/pages/conversation-detail-page.tsx` (fallback mobile: `LeadPanel` dentro de `Sheet`)
- Modify: `src/shared/components/layout/app-sidebar.tsx` (+ item Agenda)
- Modify: `messages/pt-BR/dashboard.json`, `messages/en/dashboard.json` (+ `nav.agenda`)
- Delete: `src/features/contacts/app/pages/contacts-page.tsx`
- Delete: `src/features/contacts/app/components/contacts-kanban-board.tsx`
- Delete: `src/features/contacts/app/components/conversation-card.tsx`

**Interfaces:**
- Consumes: todos os componentes das Tasks 10-11, hooks da Task 9.

- [ ] **Step 1: `conversations-page.tsx`**

Grid conforme "Decisão de layout" (topo do plano): `grid-template-columns` dinâmico via `style` inline (`minmax(320px,376px) minmax(420px,1fr) ${leadPanelOpen ? 376 : 0}px`, `transition: "grid-template-columns .34s cubic-bezier(.22,1,.36,1)"`), `hidden lg:grid` (desktop). Em `<lg`, renderiza só `ConversationList` full-width com itens que são `Link` para `/dashboard/contacts/${id}` (usa `router.push` como já faz `conversation-card.tsx` hoje — reaproveitar esse padrão em `conversation-list-item.tsx`, condicionado por `useMediaQuery`-like check simples via `window.matchMedia` ou, mais simples ainest: sempre navegar em telas <1024px e sempre abrir inline em >=1024px, decidido dentro de `conversation-list-item.tsx`'s `onClick` lendo `window.innerWidth < 1024` — evita hook novo).

- [ ] **Step 2: Rota `/dashboard/contacts/page.tsx`** — trocar import para `ConversationsPage`.

- [ ] **Step 3: `conversation-detail-page.tsx`** (mobile fallback) — trocar corpo para usar `ConversationChat` + botão que abre `LeadPanel` dentro de `Sheet` (conforme responsivo do README: "o painel do lead vira Sheet lateral").

- [ ] **Step 4: Sidebar — Agenda**

Em `app-sidebar.tsx`: adicionar `"agenda"` ao union `NavItem["labelKey"]`; adicionar item `{ href: "/dashboard/agenda", labelKey: "agenda", icon: CalendarDays, match: (p) => p.startsWith("/dashboard/agenda") }` entre `contacts` e `pathways` (ordem do README: Início, Clientes, Contatos, **Agenda**, Jornadas, Relatórios, Marketplace, Configurações).

Em `messages/{pt-BR,en}/dashboard.json`, adicionar `"agenda": "Agenda"` no bloco `nav` (mesmo valor nos dois locales, é nome próprio).

- [ ] **Step 5: Apagar kanban antigo**

```bash
git rm src/features/contacts/app/pages/contacts-page.tsx src/features/contacts/app/components/contacts-kanban-board.tsx src/features/contacts/app/components/conversation-card.tsx
```
Confirmar antes (Run: `grep -rn "contacts-kanban-board\|conversation-card\|ContactsPage" src/`) que nada mais importa esses arquivos além do que já foi substituído nesta task.

- [ ] **Step 6: `npx tsc --noEmit && npm run lint && npm run build`**

- [ ] **Step 7: Verificação manual**

Run: `npm run dev`, abrir `/dashboard/contacts`, testar: busca, filtro de canal, filtro de etapa, scroll infinito, abrir conversa, enviar mensagem, `/notas`, `/agendar`, `/` popover de frases, abrir/fechar painel do lead (coluna 3, Layout B), mudar etapa, responsivo (<1024px).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(contacts): assemble 3-column conversations screen (layout B), remove kanban"
```

---

### Task 13: Feature Agenda (semana/mês/aside) + rota

**Files:**
- Create: `src/features/agenda/app/types/api.ts`
- Create: `src/features/agenda/app/services/agenda.service.ts`
- Create: `src/features/agenda/app/hooks/use-agenda-events.ts`
- Create: `src/features/agenda/app/components/agenda-week-grid.tsx`
- Create: `src/features/agenda/app/components/agenda-month-grid.tsx`
- Create: `src/features/agenda/app/components/agenda-upcoming-list.tsx`
- Create: `src/features/agenda/app/pages/agenda-page.tsx`
- Create: `src/app/[locale]/(dashboard)/dashboard/agenda/page.tsx`

**Interfaces:**
- Consumes: `agenda-v1.ts` (Task 2), `/api/v1/tenant/agenda` (Task 8).

- [ ] **Step 1: `types/api.ts`** — barrel `export type * from "@/types/api/agenda-v1";`

- [ ] **Step 2: `agenda.service.ts`**

```ts
export async function listAgendaEvents(from: string, to: string): Promise<AgendaEventDto[]>
export async function createAgendaEvent(input: CreateAgendaEventRequestBody): Promise<AgendaEventDto>
export async function updateAgendaEvent(id: string, input: UpdateAgendaEventRequestBody): Promise<AgendaEventDto>
export async function deleteAgendaEvent(id: string): Promise<void>
```

- [ ] **Step 3: `use-agenda-events.ts`**

Estado: `{ mode: "semana"|"mes", weekOffset, monthOffset, events, loading, error }`. Calcula `from`/`to` a partir de `mode`+offset (semana: segunda a domingo da semana corrente+offset; mês: dia 1 ao último dia do mês corrente+offset), refetch quando `mode`/offset mudam.

- [ ] **Step 4: `agenda-week-grid.tsx`** — grid `64px repeat(7, minmax(120px,1fr))`, slots 56px, 08:00-20:00, conforme §3 README. Cálculo `top`/`height` exatamente como especificado: `top = ((startMin - 480)/60)*56`, `height = max(38, (dur/60)*56 - 4)`.

- [ ] **Step 5: `agenda-month-grid.tsx`** — grid 7×6, até 3 chips + "+N mais", dias fora do mês esmaecidos.

- [ ] **Step 6: `agenda-upcoming-list.tsx`** — aside 340px, cards ordenados por data, botão "Abrir conversa" navega para `/dashboard/contacts/${conversationId}` (ou seta query param de seleção se a página desktop preferir estado local — usar navegação simples via `router.push`, mais robusto e sem acoplamento entre features).

- [ ] **Step 7: `agenda-page.tsx`** — monta header (título com mês/ano via `Intl.DateTimeFormat`, contador, segmented semana/mês, navegação ‹›/Hoje) + grid ativa + aside.

- [ ] **Step 8: Rota** `src/app/[locale]/(dashboard)/dashboard/agenda/page.tsx`:
```tsx
import { AgendaPage } from "@/features/agenda/app/pages/agenda-page";

export default async function Page() {
  return <AgendaPage />;
}
```

- [ ] **Step 9: `npx tsc --noEmit && npm run lint && npm run build`**

- [ ] **Step 10: Verificação manual**

Run: `npm run dev`, abrir `/dashboard/agenda`, testar semana/mês, navegação, hover tooltip, clique em evento, criar evento via `/agendar` no chat e confirmar que aparece na agenda.

- [ ] **Step 11: Commit**

```bash
git add src/features/agenda src/app/[locale]/\(dashboard\)/dashboard/agenda
git commit -m "feat(agenda): build week/month views and upcoming appointments"
```

---

### Task 14: Verificação final e limpeza

**Files:** nenhum novo — checagem cross-cutting.

- [ ] **Step 1:** `npx tsc --noEmit` limpo em todo o projeto.
- [ ] **Step 2:** `npm run lint` limpo.
- [ ] **Step 3:** `npm run build` sem erros.
- [ ] **Step 4:** Rodar `grep -rn "contacts.board\." src/` — se sobrarem chaves i18n `board.*` órfãs sem consumidor, decidir manter (não quebra nada) ou remover do JSON; se remover, remover nos dois locales.
- [ ] **Step 5:** Rodar `npm run test:e2e` — se houver specs Playwright existentes cobrindo `/dashboard/contacts` (verificar `e2e/`), atualizar seletores quebrados pela troca de tela; não é obrigatório criar specs novas nesta entrega (fora do escopo pedido), mas specs existentes não podem ficar quebradas.
- [ ] **Step 6:** Commit final de ajustes, se houver.

---

## Self-Review

**Spec coverage:** todas as seções do README (§1 Shell, §2.1-2.7 Conversas, §3 Agenda, Interactions, State, Modelo de dados, API, Copy, Assets) têm task correspondente, exceto os itens explicitamente listados em "Fora de escopo" no README (mantidos fora aqui também) e o SSE realtime (justificado acima como YAGNI sem fonte real de eventos).

**Decisão vinculante do usuário:** Layout B (painel à direita) documentada no topo e propagada nas Tasks 11-12 com specs exatas extraídas do protótipo.

**Placeholders:** nenhum "TBD"/"implementar depois" — toda task tem assinatura de tipo, schema Zod ou snippet de código concreto onde havia ambiguidade de contrato.
