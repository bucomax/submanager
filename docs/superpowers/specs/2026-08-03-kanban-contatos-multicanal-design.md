# Spec B — Kanban de contatos multicanal

**Data:** 2026-08-03
**Status:** aprovado, aguardando implementação
**Depende de:** [Spec A — Templates e janela de 24h](./2026-08-03-whatsapp-templates-janela-24h-design.md) para envio proativo
**Referência de mercado:** Kommo, rejeitado pelo cliente por complexidade de UX

---

## Objetivo

Trazer a conversa de WhatsApp (e depois Instagram Direct) para dentro do painel, num
kanban onde o contato desconhecido vira paciente e entra na jornada clínica que já
existe.

O produto não é um CRM novo. O motor de pipeline já existe (`CarePathway`,
`PathwayStage`, `/pathways/:id/kanban`). O que falta é conversa, e a ponte entre ela e
a jornada.

### A tese de UX

O Kommo obriga a clínica a modelar-se como funil de vendas e separa "Leads" de "Chats"
em dois modelos mentais. Aqui, **conversa, contato e card são o mesmo objeto**, e o
fluxo clínico já está pronto antes da primeira mensagem chegar.

Cinco consequências, que são os critérios de aceite de UX:

1. Contexto da jornada dentro da conversa — etapa atual, checklist, documentos
2. Ações do fluxo como botão na thread — sem trocar de tela
3. Janela de 24h explícita, antes do envio falhar
4. Sem construtor de bot
5. Zero configuração para começar a usar

---

## Decisões fechadas

| # | Decisão | Escolha |
|---|---|---|
| 1 | Conexão com a Meta | Direto com a Cloud API, como o código já faz |
| 2 | Colunas do kanban | Status fixo do produto, sem funil configurável |
| 3 | Instagram | Depois; modelo de dados já nasce multicanal |
| 4 | Conversão em paciente | Ação explícita, com escolha do fluxo |
| 5 | Onde se lê e responde | Painel lateral no próprio kanban |
| 6 | Identidade do contato | `Conversation` ancora o canal; `Client` só existe após converter |
| 7 | Empacotamento | Feature nativa em `src/features/contacts/`, não app do marketplace |

A decisão 6 é a estrutural: **nenhuma query existente sobre `Client` muda**. Lista de
pacientes, kanban da jornada, relatórios e regras de visibilidade continuam vendo só
pacientes de verdade. Lead que nunca converte não polui nada, e não se cria registro de
pessoa para quem mandou "oi" e sumiu.

---

## Modelo de dados

```prisma
enum ConversationChannel { WHATSAPP  INSTAGRAM }

enum ConversationStatus {
  NEW              // Novo
  IN_PROGRESS      // Em atendimento
  WAITING_CONTACT  // Aguardando paciente
  QUALIFIED        // Qualificado
  DISCARDED        // Descartado
}

enum MessageDirection { INBOUND  OUTBOUND }
enum MessageType { TEXT IMAGE AUDIO VIDEO DOCUMENT STICKER LOCATION TEMPLATE INTERACTIVE UNSUPPORTED }
enum MessageStatus { QUEUED SENT DELIVERED READ FAILED }

model Conversation {
  id               String  @id @default(cuid())
  tenantId         String
  tenant           Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  channel          ConversationChannel
  /** `wa_id` no WhatsApp; IG-scoped user id no Instagram. */
  externalId       String
  /** Nome do perfil no canal — não é o nome cadastral. */
  displayName      String?
  /** Null até a conversão. Preenchido também por vínculo automático com paciente existente. */
  clientId         String?
  client           Client? @relation(fields: [clientId], references: [id], onDelete: SetNull)
  status           ConversationStatus @default(NEW)
  assignedToUserId String?
  assignedTo       User?   @relation(fields: [assignedToUserId], references: [id], onDelete: SetNull)
  /** Última mensagem recebida — base da janela de 24h. Persistido para não recalcular por card. */
  lastInboundAt    DateTime?
  lastMessageAt    DateTime?
  /** Primeira resposta humana após um inbound — base do SLA de atendimento. */
  firstResponseAt  DateTime?
  unreadCount      Int     @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  messages         Message[]

  @@unique([tenantId, channel, externalId])
  @@index([tenantId, status, lastMessageAt])
  @@index([tenantId, clientId])
  @@index([tenantId, assignedToUserId])
}

model Message {
  id                String  @id @default(cuid())
  conversationId    String
  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  direction         MessageDirection
  /** `wamid` da Meta. Null enquanto OUTBOUND está em fila. */
  externalMessageId String?
  type              MessageType
  body              String? @db.Text
  /** Mídia baixada da Meta e persistida no GCS. */
  fileAssetId       String?
  fileAsset         FileAsset? @relation(fields: [fileAssetId], references: [id], onDelete: SetNull)
  /** Só OUTBOUND. */
  status            MessageStatus?
  /** Quem enviou. Null = recebida do paciente ou gerada por automação. */
  actorUserId       String?
  actor             User?   @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  sentAt            DateTime?
  deliveredAt       DateTime?
  readAt            DateTime?
  failedAt          DateTime?
  errorDetail       String? @db.Text
  createdAt         DateTime @default(now())

  /**
   * Idempotência: a Meta reentrega webhook e reentrega não pode duplicar mensagem.
   * Postgres permite múltiplos NULL num índice único, então OUTBOUND ainda em fila
   * (sem `wamid`) não conflita entre si — que é o comportamento desejado.
   */
  @@unique([conversationId, externalMessageId])
  @@index([conversationId, createdAt])
}
```

### Por que duas tabelas e não três

A versão inicial separava identidade (`ContactChannel`) de atendimento
(`Conversation`). Como o card do kanban **é** a conversa, e há exatamente uma conversa
por contato por canal, a separação só somava uma junção em toda consulta. Uma pessoa
com WhatsApp e Instagram terá duas `Conversation` apontando para o mesmo `Client` —
que é o comportamento correto: são duas threads.

### O que fica de fora por YAGNI

Tags, notas internas na conversa, respostas rápidas, bot, funil configurável,
agrupamento de conversas em atendimentos. Nenhum é necessário para fechar o ciclo
mensagem → paciente → jornada, e cada um é porta de entrada da complexidade que o
cliente rejeitou. Entram quando a clínica pedir, não antes.

`ChannelDispatch` fica intocado — é da jornada, amarrado a `stageTransitionId`.

---

## Ingestão

O webhook `POST /api/v1/webhooks/whatsapp` já resolve o tenant pelo `phone_number_id` e
já valida a assinatura HMAC (corrigido em `b8c1494`). Ganha um caminho novo.

```
webhook → valida assinatura → resolve tenant por phone_number_id
   ├── value.statuses[]  → atualiza Message.status (fluxo novo)
   │                       e ChannelDispatch (fluxo atual, preservado)
   └── value.messages[]  → upsert Conversation → cria Message INBOUND
                           → se tem mídia, enfileira download
                           → emite SSE + notificação
```

**Upsert da conversa** por `(tenantId, channel, externalId)`. Na criação:

- `displayName` vem de `value.contacts[].profile.name`
- **vínculo automático**: busca `Client` no tenant cujo `phone` normalizado bate com o
  `wa_id`. Achou exatamente um e não removido → preenche `clientId`. Paciente existente
  que manda mensagem não pode aparecer como lead desconhecido.
- mais de um match → deixa null e a UI oferece escolher na conversão

**Mídia.** A Meta entrega só um `media_id`. Um job BullMQ baixa com o token do tenant,
sobe para `tenants/{tenantId}/conversations/{conversationId}/`, cria `FileAsset` e
preenche `Message.fileAssetId`. Até terminar, a mensagem aparece com o tipo e um estado
de carregamento. Sem Redis, roda inline — mesmo padrão do `notificationEmitter`.

Mídia recebida passa pela mesma validação de magic bytes já usada nos uploads.

**Botão interativo.** `button_reply` continua tratado por `handleButtonReply` **e** passa
a virar uma `Message` do tipo `INTERACTIVE` na conversa. Os dois registros são legítimos:
um é confirmação de jornada, outro é histórico de conversa.

Depois que o Spec A entrar, a clínica para de **enviar** mensagem interativa — o aviso
de etapa vira template com link do portal. O tratamento do clique permanece porque
mensagens já entregues continuam clicáveis, e porque o histórico da conversa deve
mostrar o que o paciente respondeu.

---

## Envio

`sendTextMessage` já existe no cliente Graph. O use case novo:

1. carrega a conversa e checa a janela: `lastInboundAt` a menos de 24h
2. dentro da janela → texto livre
3. fora → recusa com `OUTSIDE_SERVICE_WINDOW`, e a UI oferece template (Spec A)
4. grava `Message` OUTBOUND `QUEUED`, envia, atualiza para `SENT` com o `wamid`
5. primeira resposta humana após um inbound preenche `firstResponseAt`

Envio de mídia pela clínica fica para depois da v1.

---

## Tela

Rota `/dashboard/contatos`, feature em `src/features/contacts/app/`.

```
┌─ Kanban de contatos ─────────────────┬─ Maria Souza ──────────┐
│  Novo    Em atend.  Aguard.  Qualif. │ 🟢 responde até 14:32  │
│  ┌────┐  ┌──────┐   ┌────┐          │────────────────────────│
│  │Mar │  │João  │   │Ana │          │ Oi, quero saber sobre  │
│  │ia  │◀─┤@ana  │   │18h │          │ a cirurgia             │
│  └────┘  └──────┘   └────┘          │                        │
│                                      │ ── contexto ─────────  │
│                                      │ Etapa: Exames pré-op   │
│                                      │ Checklist: 2 pendentes │
│                                      │ [Avançar etapa]        │
│                                      │ [Virar paciente]       │
│                                      │ [digite...          ]  │
└──────────────────────────────────────┴────────────────────────┘
```

- **Card**: nome ou perfil, canal, tempo desde a última mensagem, indicador de janela,
  avatar de quem está atendendo, badge de não lidas
- **Arrastar** muda `status` — só organização, não cria nem envia nada
- **Painel**: histórico, contexto do paciente quando `clientId` existe, composer
- **Realtime**: reusa `/api/v1/notifications/stream`, com tipos de evento novos. Sem
  segundo SSE — o preset de rate limit `sse` é 3 conexões por 10s.

Fora da janela, o composer fica desabilitado com o motivo visível e um botão para
enviar template. Nunca deixar o usuário digitar uma mensagem que vai falhar.

---

## Conversão em paciente

Ação explícita, no card ou no painel.

```
[Virar paciente] → wizard pré-preenchido
   nome     ← displayName do perfil
   telefone ← externalId normalizado
   CPF, nascimento, demais campos ← secretária preenche
   fluxo    ← escolhe CarePathway publicado (auto se só houver um)
```

**Deduplicação antes de criar.** Busca por telefone e por CPF. Se achar `Client`
existente, o wizard oferece **vincular** em vez de criar — evita paciente duplicado, que
é o erro mais caro nesse fluxo.

Ao confirmar, numa transação:

1. cria ou vincula `Client`
2. chama `StartPatientPathway`, que já existe
3. preenche `Conversation.clientId` e move o status para `QUALIFIED`
4. grava `AuditEvent` do tipo novo `CONTACT_CONVERTED_TO_CLIENT`

O card **permanece** no kanban de contatos, agora vinculado, e o paciente aparece
também no kanban da jornada. São duas visões do mesmo ciclo, não uma migração.

Reusa `StartPatientPathway` em vez de reimplementar — a criação da primeira
`StageTransition` e o disparo do pacote de documentos já estão lá.

---

## Permissões e visibilidade

Guards padrão: `requireSessionOr401` → `getActiveTenantIdOr400` →
`assertActiveTenantMembership`.

`TenantMembership.restrictedToAssignedOnly` precisa de regra explícita, porque conversa
sem `clientId` não tem paciente atribuído:

- conversa **com** `clientId` → aplica `mergeClientWhereWithVisibility`, igual ao resto
- conversa **sem** `clientId` → visível a todos os membros do tenant

A segunda regra é deliberada: a fila de entrada precisa ser vista por alguém, senão
contato novo fica órfão. Documentar na tela para não surpreender clínica que usa
visibilidade restrita.

`linkedOpmeSupplierId` segue a mesma lógica, via `clientId`.

---

## LGPD

Conteúdo de mensagem é dado pessoal e pode ser dado clínico — paciente manda foto de
exame pelo WhatsApp. Consequências:

- `AuditEvent` registra que houve mensagem, **nunca o conteúdo**
- log estruturado sem corpo de mensagem, só ids e canal
- mídia no GCS com prefixo por tenant, acesso só por URL assinada de TTL curto
- conversa `DISCARDED` sem `clientId` é candidata a expurgo. **A política de retenção
  fica de fora desta v1**, mas o modelo já permite: apagar `Conversation` cascateia as
  mensagens. Registrar como dívida explícita, não como esquecimento.

---

## Erros e bordas

| Situação | Comportamento |
|---|---|
| Webhook reentregue pela Meta | `@@unique([conversationId, externalMessageId])` absorve |
| Mensagem de tipo não suportado | `Message` com `UNSUPPORTED` e aviso na thread; nunca descartar silenciosamente |
| Download de mídia falha | Mensagem fica sem `fileAssetId`, com botão de tentar de novo; job com retry e backoff |
| Envio recusado pela Meta | `Message` `FAILED` com `errorDetail` visível na thread |
| Paciente escreve de número diferente do cadastrado | Nova conversa sem vínculo; conversão oferece vincular ao paciente existente |
| Dois membros respondem ao mesmo tempo | Sem lock: as duas mensagens saem. Presença ("Fulano está respondendo") fica para depois |
| Conversa sem mensagem há muito tempo | Sem arquivamento automático na v1 |
| Redis ausente | Ingestão e download rodam inline; realtime degrada para polling |

---

## Testes

Os use cases novos nascem com **injeção de dependência por parâmetro com default no
singleton atual**, o padrão recomendado na auditoria de arquitetura. É a oportunidade de
o projeto ganhar sua primeira suíte unitária sem refatorar os 96 use cases existentes.

Prioridade:

- ingestão é idempotente — mesmo `wamid` duas vezes gera uma mensagem
- vínculo automático: um match vincula, zero ou vários deixam null
- janela de 24h: dentro permite texto livre, fora recusa
- visibilidade: usuário restrito vê conversa sem cliente, e não vê conversa de paciente
  fora do seu escopo
- conversão cria `Client` + `PatientPathway` e preenche `clientId` na mesma transação
- conversão com telefone já existente oferece vínculo em vez de duplicar

E2E (Playwright), seguindo `e2e/patient-self-register.spec.ts`: mensagem chega → card
aparece em "Novo" → secretária responde → converte em paciente → card aparece no kanban
da jornada.

---

## Fases

| Fase | Entrega |
|---|---|
| 1 | Modelo de dados, ingestão de texto do WhatsApp, download de mídia |
| 2 | Kanban, painel de conversa, envio de texto, realtime |
| 3 | Conversão em paciente com dedup, contexto da jornada no painel |
| 4 | Instagram: onboarding, ingestão, resposta, story reply e mention |
| 5 | SLA de primeira resposta e métricas por canal e atendente |

Fase 1 e 2 são a entrega mínima útil: a clínica já atende pelo painel. Fase 3 fecha o
ciclo pedido. Fase 4 depende de App Review da Meta, fora do controle do time.

---

## Fora de escopo

Bot e automação, funil configurável, campos customizados, disparo em massa, outros
canais (Telegram, Messenger, e-mail no inbox), presença em tempo real entre atendentes,
e política de retenção de mensagem.

---

## Arquivos afetados

| Área | Mudança |
|---|---|
| `packages/prisma/schema.prisma` | `Conversation`, `Message`, 5 enums, relações em `Client`, `Tenant`, `User`, `FileAsset` |
| `src/app/api/v1/webhooks/whatsapp/route.ts` | ramo de ingestão de mensagens |
| `src/application/use-cases/whatsapp/process-whatsapp-webhook-payload.ts` | upsert de conversa e mensagem |
| `src/application/use-cases/conversation/` | novo: ingestão, envio, conversão, listagem |
| `src/application/ports/conversation-repository.port.ts` | novo |
| `src/infrastructure/repositories/conversation.repository.ts` | novo |
| `src/infrastructure/queue/` | worker de download de mídia |
| `src/app/api/v1/conversations/**` | listar, detalhar, enviar, atribuir, mudar status, converter |
| `src/features/contacts/app/**` | kanban, painel, composer, wizard de conversão |
| `src/app/[locale]/(dashboard)/dashboard/contatos/page.tsx` | rota fina |
| `messages/{pt-BR,en}/contacts.json` | i18n novo |
| `public/openapi.json` | rotas novas |
