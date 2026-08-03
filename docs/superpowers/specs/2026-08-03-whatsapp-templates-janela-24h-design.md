# Spec A — Templates do WhatsApp e janela de 24h

**Data:** 2026-08-03
**Status:** aprovado, aguardando implementação
**Depende de:** nada
**Destrava:** [Spec B — Kanban de contatos](./2026-08-03-kanban-contatos-multicanal-design.md)

---

## Problema

`src/infrastructure/whatsapp/whatsapp-cloud-client.ts` expõe `sendDocumentMessage`,
`sendInteractiveButtonMessage`, `sendTextMessage` e `getPhoneNumberInfo`. **Não existe
suporte a template.**

A Meta só aceita mensagem livre (documento, texto, interativa) dentro da **janela de
atendimento de 24 horas**, contada a partir da última mensagem enviada pelo paciente.
Fora dela, a API responde erro (`131047` / `131026`) e a mensagem não chega.

O envio de documentos de etapa (`whatsappDispatcher.dispatch`) roda logo após a
transição, num momento que **não tem relação nenhuma** com a última mensagem do
paciente. No caso comum — paciente que não escreveu para a clínica nas últimas 24h —
o envio falha.

### O que foi verificado e o que não foi

Verificado no código: ausência total de capacidade de template, e o payload enviado
(`type: "document"` e `type: "interactive"`).

**Não verificado em execução.** `ChannelDispatch` está vazio, nenhum tenant tem
WhatsApp habilitado e o `.env` não tem credenciais Meta. A falha é consequência da
regra documentada da Meta, não erro observado nos dados. Confirmar com número de teste
antes de considerar o diagnóstico fechado.

Nem `docs/integrations/whatsapp-dispatch-events.md`, nem `PRODUCT-SCOPE.md`, nem
`business-logic.md` mencionam janela ou template — a lacuna é de planejamento, não de
implementação esquecida.

---

## Decisão de produto: portal em vez de arquivo no WhatsApp

Duas formas de resolver:

**Escolhida — template aponta para o portal.** A transição envia um template utility do
tipo *"Olá {{1}}, você tem {{2}} documento(s) da etapa {{3}}. Acesse: {{4}}"*, com link
para o portal do paciente. Os arquivos ficam atrás de autenticação.

Ganhos além de destravar o envio: URL assinada de documento clínico deixa de circular
em conversa de WhatsApp (que fica no aparelho, em backup de nuvem, e é encaminhável) —
melhor postura de LGPD; um template só serve todas as etapas; e o portal, que já existe
com magic link, OTP e senha, passa a ser o canal de entrega.

**Alternativa — template de abertura, documentos livres em seguida.** Enviar um template
abre uma janela de 24h em que mensagem livre é aceita, então daria para mandar os
arquivos logo depois. Mantém o comportamento atual, mas depende do template ser entregue
antes do documento (a janela abre na entrega), mantém arquivo clínico no WhatsApp, e
não elimina o modo de falha — só o adia.

A alternativa fica registrada porque exige menos mudança de produto. Se a clínica exigir
o arquivo dentro do WhatsApp, é o caminho.

---

## Design

### 1. Suporte a template no cliente Graph

Adicionar a `whatsapp-cloud-client.ts`:

```ts
export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  template: { name: string; languageCode: string; bodyParams: string[] },
): Promise<string>   // retorna wamid
```

Payload `type: "template"` com `components: [{ type: "body", parameters: [...] }]`.
Sem header de mídia na v1 — o link vai no corpo.

### 2. Catálogo de templates por tenant

```prisma
enum WhatsAppTemplateStatus { APPROVED  PENDING  REJECTED  DISABLED }

model WhatsAppTemplate {
  id           String  @id @default(cuid())
  tenantId     String
  tenant       Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  /** `name` na Meta — é o identificador usado no envio. */
  name         String
  languageCode String
  category     String                    // UTILITY | MARKETING | AUTHENTICATION
  status       WhatsAppTemplateStatus
  /** Corpo com {{n}}, como aprovado — usado só para preview na UI. */
  bodyPreview  String? @db.Text
  /** Quantidade de variáveis no corpo; valida o envio antes de chamar a Meta. */
  bodyParamCount Int   @default(0)
  syncedAt     DateTime

  @@unique([tenantId, name, languageCode])
  @@index([tenantId, status])
}
```

Sincronização sob demanda: `POST /api/v1/tenant/whatsapp/templates/sync` chama
`GET /{whatsappBusinessAccountId}/message_templates` com o token do tenant e faz upsert.
Sem job periódico — a clínica cria template raramente, e um botão "Sincronizar" na tela
de configurações resolve.

Só templates `APPROVED` aparecem para seleção.

### 3. Template por etapa

```prisma
model PathwayStage {
  // ...
  /** Template usado no aviso de documentos desta etapa. Null = etapa não notifica por WhatsApp. */
  whatsappTemplateName String?
  whatsappTemplateLang String?
}
```

Configurado no editor de etapas, ao lado dos documentos. Nulo é estado válido e
significa "esta etapa não avisa por WhatsApp" — não é erro.

### 4. Novo fluxo do dispatcher

`whatsappDispatcher.dispatch` passa a:

1. Se a etapa não tem template configurado → não envia, grava `ChannelDispatch` com
   status `SKIPPED` e motivo. Não é falha.
2. Se tem → monta os parâmetros (nome do paciente, quantidade de documentos, nome da
   etapa, URL do portal) e chama `sendTemplateMessage`.
3. Um `ChannelDispatch` por disparo, com `documentFileName` nulo e um campo novo
   `templateName`. Os documentos continuam registrados no `dispatchStub` da
   `StageTransition`, que já existe.
4. A mensagem interativa de confirmação **deixa de ser enviada**. Botão só funciona
   dentro da janela; a confirmação de recebimento passa a ser o acesso ao portal, que já
   gera `AuditEvent` de download.

`handleButtonReply` no webhook **não é removido**: mensagens interativas já enviadas
continuam podendo receber clique por até 24h após o deploy, e o Spec B passa a registrar
`button_reply` como mensagem da conversa. Ele deixa de receber tráfego novo, não deixa
de existir.

`DispatchStatus` ganha `SKIPPED`. `AuditEventType` ganha `WHATSAPP_DISPATCH_SKIPPED`.

### 5. Visibilidade da falha

Falha de envio hoje é silenciosa: grava `errorDetail` e ninguém vê. Passa a emitir
notificação in-app do tipo `whatsapp_dispatch_failed` para os destinatários já
resolvidos por `resolvePathwayNotificationTargetUserIds`.

---

## Erros e bordas

| Situação | Comportamento |
|---|---|
| Etapa sem template | `SKIPPED`, sem notificação de erro |
| Template configurado mas não `APPROVED` na última sync | Tenta enviar; se a Meta recusar, `FAILED` + notificação. Não bloquear por cache local desatualizado |
| Contagem de variáveis diverge do template | Falha na validação antes de chamar a Meta, com mensagem clara |
| Paciente sem telefone | Já coberto: enqueue não é chamado |
| Tenant sem `whatsappEnabled` | Já coberto |
| Sync sem `whatsappBusinessAccountId` | 422 com mensagem pedindo o campo em Configurações |

---

## Testes

Este é o primeiro código do projeto a nascer com teste unitário. Os use cases novos
recebem dependências por parâmetro com default no singleton atual — o padrão sugerido
na auditoria de arquitetura — para que o dispatcher seja testável sem Postgres, Redis
nem Meta.

Casos mínimos:

- etapa sem template → `SKIPPED`, nenhuma chamada HTTP
- etapa com template → payload `type: "template"` com os parâmetros na ordem certa
- Meta recusa → `FAILED` com `errorDetail` e notificação emitida
- contagem de variáveis divergente → falha antes da chamada HTTP
- sync faz upsert sem duplicar em `(tenantId, name, languageCode)`

---

## Fora de escopo

Criação e submissão de template pela UI (a clínica cria no Meta Business Manager),
templates com header de mídia, categoria marketing, e métricas de custo por conversa.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/infrastructure/whatsapp/whatsapp-cloud-client.ts` | `sendTemplateMessage` |
| `src/infrastructure/whatsapp/whatsapp-dispatcher.ts` | novo fluxo, remove interativa |
| `packages/prisma/schema.prisma` | `WhatsAppTemplate`, campos em `PathwayStage`, `SKIPPED` |
| `src/application/use-cases/whatsapp/` | sync de templates, montagem de parâmetros |
| `src/app/api/v1/tenant/whatsapp/templates/route.ts` | listar e sincronizar |
| `src/features/pathways/app/components/` | seleção de template na etapa |
| `src/features/settings/app/components/whatsapp-settings-card.tsx` | botão de sincronizar |
| `public/openapi.json` | rotas novas |
| `docs/integrations/whatsapp-dispatch-events.md` | reescrever o fluxo de envio |
