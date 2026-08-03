# Plano de Evolução do Sistema de E-mail — SubManager

> Diagnóstico completo + plano de ajustes para disparo de e-mails em todos os momentos relevantes e configuração de domínio próprio por clínica.

---

## 1. Estado Atual

### 1.1 Infraestrutura

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/infrastructure/email/resend.client.ts` | Cliente Resend (singleton), `sendEmail()`, `isEmailConfigured()` |
| `src/infrastructure/email/email-templates.ts` | 8 templates HTML (dark theme, table-based) |
| `src/infrastructure/email/notify-patient-self-registered.ts` | Notifica staff quando paciente faz auto-cadastro |
| `src/infrastructure/email/notify-patient-self-register-welcome.ts` | Boas-vindas ao paciente auto-cadastrado |
| `src/infrastructure/email/notify-patient-file-reviewed.ts` | Resultado de revisão de documento do paciente |

### 1.2 Configuração Atual

- **Resend API key global** via `process.env.RESEND_API_KEY`
- **Remetente fixo**: `process.env.EMAIL_FROM` (default `SubManager <onboarding@resend.dev>`)
- **Sem configuração por tenant** — todos os e-mails saem do mesmo domínio
- **Sem fila/retry** — fire-and-forget com `.catch()` (diferente do WhatsApp que usa BullMQ)
- **Sem tracking de entrega** — Resend retorna `id` mas não é salvo; sem webhook de bounce/open

### 1.3 Templates Existentes

| # | Template | Usado em | Destinatário | Status |
|---|----------|----------|-------------|--------|
| 1 | `getResetPasswordHtml` | `forgot-password.ts` | Staff/usuário | ✅ Ativo |
| 2 | `getInviteSetPasswordHtml` | `invite-tenant-member.ts` | Staff convidado | ✅ Ativo |
| 3 | `getPatientSelfRegisterWelcomeHtml` | `process-patient-self-register.ts` | Paciente | ✅ Ativo |
| 4 | `getPatientSelfRegisteredStaffHtml` | `process-patient-self-register.ts` | Staff | ✅ Ativo |
| 5 | `getPatientPortalMagicLinkHtml` | `create-client-portal-link.ts` | Paciente | ✅ Ativo |
| 6 | `getPatientPortalOtpHtml` | `request-patient-portal-otp.ts` | Paciente/responsável | ✅ Ativo |
| 7 | `getFileReviewResultPatientHtml` | `route.ts` (file review) | Paciente | ✅ Ativo |
| 8 | `getConfirmEmailHtml` | — | — | ❌ Sem uso |

### 1.4 Pontos de Disparo Atuais (7 gatilhos)

| Momento | Use Case / Route | E-mail? | WhatsApp? | Notif in-app? |
|---------|-----------------|---------|-----------|---------------|
| Recuperação de senha | `forgot-password.ts` | ✅ | — | — |
| Convite de membro | `invite-tenant-member.ts` | ✅ | — | — |
| Auto-cadastro (boas-vindas) | `process-patient-self-register.ts` | ✅ | — | — |
| Auto-cadastro (aviso staff) | `process-patient-self-register.ts` | ✅ | — | ✅ `new_patient` |
| Magic link portal | `create-client-portal-link.ts` | ✅ | — | — |
| OTP portal | `request-patient-portal-otp.ts` | ✅ | via webhook | — |
| Revisão de documento | `route.ts` (file review) | ✅ | — | — |
| **Transição de etapa** | `transition-patient-stage.ts` | ❌ **NÃO** | ✅ | ✅ `stage_transition` |
| **Alerta SLA warning** | `sla-notification-check.ts` | ❌ **NÃO** | — | ✅ `sla_warning` |
| **Alerta SLA critical** | `sla-notification-check.ts` | ❌ **NÃO** | — | ✅ `sla_critical` |
| **Checklist completo** | — | ❌ **NÃO** | — | ❌ Não emitido |
| **Doc pendente revisão** | — | ❌ **NÃO** | — | ❌ Não emitido |

---

## 2. O Que Falta: E-mails por Momento

### 2.1 TRANSIÇÃO DE ETAPA (Prioridade Máxima)

**Arquivo:** `src/application/use-cases/pathway/transition-patient-stage.ts`

**Situação:** Linhas 230–257 emitem notificação in-app + WhatsApp, mas **zero e-mail**.

**O que implementar:**

#### 2.1.1 E-mail para o PACIENTE (único destinatário)

> **Decisão de produto:** a clínica (staff/admins) **NÃO** recebe e-mail na transição — já tem alertas em tempo real no dashboard (notificação in-app + SSE). O e-mail de transição é exclusivamente para o **paciente**, que não tem acesso ao dashboard.

- **Quando:** após commit da transação + emissão da notificação in-app (linha ~243)
- **Condição:** paciente (`Client`) tem `email` preenchido
- **Canais para o paciente:** e-mail + WhatsApp (quando disponível) — são complementares
- **Template novo:** `getStageTransitionPatientHtml`
- **Conteúdo:**
  - Saudação com nome do paciente
  - Nome da clínica
  - Nome da nova etapa (`toStage.name`)
  - Mensagem personalizada da etapa (se existir campo futuro `PathwayStage.patientMessage`)
  - Lista de documentos da etapa (se houver bundle)
  - CTA para o portal do paciente
- **Dados disponíveis no use case:** `pp.client.name`, `pp.client.email`, `toStage.name`, `tenantId` → buscar `Tenant.name`, documentos do bundle

#### 2.1.2 Implementação proposta

```typescript
// Após linha 243 de transition-patient-stage.ts
// E-mail para o PACIENTE (clínica não recebe — já tem alertas no dashboard)
if (pp.client.email) {
  enqueueEmailDispatch({
    type: "stage_transition_patient",
    tenantId,
    to: pp.client.email,
    data: {
      patientName: pp.client.name,
      stageName: toStage.name,
      documents: whatsappEnqueue?.documents ?? [],
    },
  }).catch((err) => console.error("[email] stage_transition patient dispatch failed:", err));
}
```

### 2.2 ALERTA SLA (Warning + Critical)

**Arquivo:** `src/infrastructure/notifications/sla-notification-check.ts`

**Situação:** Emite apenas notificação in-app (Prisma + SSE). Nenhum e-mail.

**O que implementar:**

#### Template novo: `getSlaAlertStaffHtml`

- **Destinatários:** mesmos `targetUserIds` que já recebem a notificação in-app (resolver e-mails)
- **Conteúdo:**
  - Tipo: "Atenção" (warning) ou "Alerta Crítico" (critical) — cor diferente
  - Nome do paciente
  - Nome da etapa atual
  - Quantos dias na etapa
  - SLA configurado (horas)
  - CTA para abrir a ficha do paciente
- **Deduplicação:** já existe na notificação (24h window) — reutilizar a mesma lógica
- **Condição:** respeitar flag `notifyCriticalAlerts` do tenant (já verificado pelo `notificationEmitter`)

#### Implementação proposta

Após a linha 83 de `sla-notification-check.ts` (dentro do loop, após emitir notificação):

```typescript
// Disparar e-mail para os targetUserIds
if (targetUserIds.length > 0) {
  enqueueEmailDispatch({
    type: "sla_alert",
    tenantId: input.tenantId,
    targetUserIds,
    data: {
      severity: status, // "warning" | "danger"
      patientName: pp.client.name,
      stageName: pp.currentStage.name,
      daysInStage,
      clientId: pp.clientId,
      patientPathwayId: pp.id,
    },
  }).catch((err) => console.error("[email] sla alert dispatch failed:", err));
}
```

### 2.3 CHECKLIST COMPLETO

**Situação:** `NotificationType.checklist_complete` existe no enum Prisma mas **nunca é emitido** em lugar nenhum do código.

**O que implementar:**

1. **Onde disparar:** no use case/route que marca item de checklist como completo — quando **todos os itens obrigatórios** de uma etapa estiverem concluídos
2. **Template novo:** `getChecklistCompleteStaffHtml`
3. **Destinatários:** assignee da etapa + tenant_admins
4. **Conteúdo:**
   - Nome do paciente
   - Nome da etapa
   - Resumo: "Todos os X itens obrigatórios foram concluídos"
   - CTA para transicionar (ou ver detalhes)

### 2.4 DOCUMENTO PENDENTE DE REVISÃO

**Situação:** `NotificationType.patient_portal_file_pending` existe no enum Prisma mas **nunca é emitido**.

**O que implementar:**

1. **Onde disparar:** quando paciente faz upload de documento pelo portal
2. **Template novo:** `getFilePendingReviewStaffHtml`
3. **Destinatários:** assignee da etapa + tenant_admins
4. **Conteúdo:**
   - Nome do paciente
   - Nome do arquivo enviado
   - CTA para revisar o documento

### 2.5 GAPS DE COERÊNCIA: Paciente recebe comunicação mas dashboard não registra

> **Princípio:** toda comunicação enviada ao paciente deve gerar uma notificação correspondente no dashboard da clínica para que a equipe tenha visibilidade completa do que o paciente recebeu.

#### Auditoria completa (paciente recebe → dashboard tem notificação?)

| # | Evento | Paciente recebe | Dashboard notifica? | Veredicto |
|---|--------|----------------|--------------------|---------:|
| 1 | Transição de etapa | E-mail + WhatsApp | ✅ `stage_transition` (`transition-patient-stage.ts:230`) | OK |
| 2 | Auto-cadastro boas-vindas | E-mail | ✅ `new_patient` (`notify-patient-self-registered.ts:25`) | OK |
| 3 | Magic link portal | E-mail | ❌ Nenhuma notificação | **GAP** |
| 4 | OTP portal | E-mail + WhatsApp | ❌ — ação do paciente (login) | OK* |
| 5 | Revisão de documento | E-mail + WhatsApp | ❌ Nenhuma notificação | **GAP** |
| 6 | Reset de senha | E-mail | ❌ — ação do usuário staff | OK* |

*Esses são iniciados pelo próprio destinatário — notificação no dashboard não agrega valor.

#### GAP 3: Magic Link do Portal — sem notificação no dashboard

**Arquivo:** `src/application/use-cases/client/create-client-portal-link.ts`

**O que acontece:** staff gera magic link → paciente recebe e-mail → **nenhum registro no sino de notificações** do dashboard.

**Impacto:** outros membros da equipe (ex.: assignee da etapa ou admin) não sabem que o link foi enviado ao paciente. O único rastro é o `AuditEvent` (linha 38), que não aparece no sino de notificações.

**O que implementar:**
- Emitir notificação in-app após envio do e-mail
- Tipo sugerido: reutilizar metadata genérica ou criar tipo `patient_portal_link_sent` (requer adicionar ao enum `NotificationType` no Prisma)
- **Alternativa mais simples:** como o `AuditEvent` já é gravado, pode-se apenas garantir que o timeline do paciente exiba esse evento — sem criar novo tipo de notificação. Avaliar se a equipe precisa de notificação push (sino) ou se basta o histórico.

**Implementação mínima (sem novo enum):**
```typescript
// Após sendEmail bem-sucedido em create-client-portal-link.ts (~linha 81)
notificationEmitter.emit({
  tenantId,
  type: "stage_transition", // reutilizar tipo genérico ou criar novo
  title: `Link do portal enviado para ${client.name}`,
  correlationId: `portal-link:${tokenRow.id}`,
  metadata: { clientId: client.id, source: "portal_link_email" },
}).catch(() => {});
```

**Implementação ideal (com novo enum):**
- Adicionar `patient_portal_link_sent` ao enum `NotificationType` no Prisma
- Mapear no `TYPE_TO_TENANT_FLAG` → `null` (sempre emitir) ou `"notifyDocumentDelivery"`
- Notificação com CTA para abrir ficha do paciente

#### GAP 4: Revisão de Documento — sem notificação no dashboard

**Arquivo:** `src/infrastructure/email/notify-patient-file-reviewed.ts`

**O que acontece:** staff aprova/rejeita documento → paciente recebe e-mail + WhatsApp → **nenhuma notificação in-app** para a equipe.

**Impacto:** 
- Outros membros da equipe não sabem que o documento foi revisado
- O assignee da etapa pode não estar ciente da decisão (se quem revisou foi outro membro)
- Sem registro no sino de notificações — histórico só via `AuditEvent` (se existir)

**O que implementar:**
1. Emitir notificação in-app no route handler de review (`src/app/api/v1/clients/[clientId]/files/[fileId]/review/route.ts`)
2. Tipo: `patient_portal_file_pending` (já existe no enum!) — ou renomear para algo mais genérico como `file_review_update`
3. **Destinatários:** assignee da etapa do paciente + tenant_admins (excluindo o ator que fez a revisão)

**Implementação:**
```typescript
// Em route.ts do file review, após notifyPatientFileReviewed()
notificationEmitter.emit({
  tenantId,
  type: "patient_portal_file_pending", // reutilizar enum existente
  title: decision === "approve"
    ? `Documento aprovado: ${fileName} (${clientName})`
    : `Documento devolvido: ${fileName} (${clientName})`,
  body: decision === "reject" && rejectReason
    ? `Motivo: ${rejectReason}`
    : undefined,
  targetUserIds: stageAssigneeAndAdmins, // resolver
  correlationId: `file-review:${fileId}`,
  metadata: {
    clientId,
    fileId,
    decision,
  },
}).catch(() => {});
```

**Prioridade:** alta — o paciente recebe 2 canais (e-mail + WhatsApp) mas a equipe não tem rastro algum no dashboard.

### 2.6 RESUMO SEMANAL (Futuro)

- Flag `notifyWeeklyReport` existe no modelo `Tenant` mas não é usada
- Implementar como cron job (BullMQ repeatable ou cron externo)
- Template com métricas: pacientes por etapa, SLAs violados, transições da semana

---

## 3. Novos Templates Necessários

| # | Template | Destinatário | Variáveis |
|---|----------|-------------|-----------|
| 1 | `getStageTransitionPatientHtml` | Paciente | patientName, clinicName, stageName, patientMessage?, documents[], portalUrl |
| 2 | `getSlaAlertStaffHtml` | Staff | severity, staffName, patientName, stageName, daysInStage, slaHours, clinicName, patientUrl |
| 3 | `getChecklistCompleteStaffHtml` | Staff | staffName, patientName, stageName, totalItems, clinicName, patientUrl |
| 4 | `getFilePendingReviewStaffHtml` | Staff | staffName, patientName, fileName, clinicName, reviewUrl |

> **Nota:** transição de etapa não gera e-mail para staff/clínica — o dashboard com notificações in-app já cobre esse caso.

**Todos devem:**
- Seguir o padrão visual existente (dark theme, `baseLayout`, `ctaButton`)
- Receber `clinicName` para branding (preparação para domínio próprio)
- Escapar HTML com `escapeHtmlText` existente

---

## 4. Infraestrutura de E-mail: Fila e Retry

### 4.1 Problema Atual

Todos os e-mails são fire-and-forget inline. Se a API do Resend estiver fora ou responder lento, o e-mail é perdido silenciosamente.

### 4.2 Solução: `enqueueEmailDispatch`

Criar infraestrutura espelhando o padrão do WhatsApp (`enqueueWhatsAppDispatch`):

```
src/infrastructure/email/
  resend.client.ts              ← já existe
  email-templates.ts            ← já existe (adicionar novos templates)
  email-dispatch-emitter.ts     ← NOVO — enfileira job
  email-dispatch-worker.ts      ← NOVO — processa job (sendEmail + tracking)
```

**Fluxo:**
1. Use case chama `enqueueEmailDispatch({ type, tenantId, to, data })`
2. Job vai para fila BullMQ `email-dispatch` (fallback inline se sem Redis)
3. Worker resolve template + `sendEmail()` + salva resultado
4. Retry com backoff exponencial (3 tentativas, 30s/60s/120s)

### 4.3 Tracking de Entrega

Criar modelo ou estender `ChannelDispatch` para incluir `EMAIL` no enum `DispatchChannel`:

```prisma
enum DispatchChannel {
  WHATSAPP
  EMAIL     // ← adicionar
}
```

Para e-mails que não são de transição (SLA, checklist), criar tabela leve `EmailDispatchLog` ou usar o mesmo `ChannelDispatch` com `stageTransitionId` opcional.

---

## 5. Domínio Próprio por Clínica (Resend Custom Domain)

### 5.1 Conceito

Cada clínica (tenant) pode configurar seu próprio domínio de e-mail para que os alertas saiam como `notificacoes@clinicadrdanilo.com.br` em vez de `noreply@submanager.com`.

### 5.2 Como Funciona no Resend

O Resend permite criar **domínios verificados** programaticamente via API:

1. **POST** `/domains` → criar domínio no Resend → retorna registros DNS (TXT, CNAME, MX)
2. Clínica adiciona os registros DNS no provedor dela
3. **POST** `/domains/{id}/verify` → Resend verifica os registros
4. Após verificação, e-mails podem ser enviados com `from: "Clínica X <notificacoes@clinicadrdanilo.com.br>"`

**Endpoints Resend relevantes:**
- `POST /domains` — `{ name: "clinicadrdanilo.com.br" }` → retorna `id`, `records[]` (DNS)
- `GET /domains/{id}` — status de verificação
- `POST /domains/{id}/verify` — solicitar re-verificação
- `DELETE /domains/{id}` — remover domínio

### 5.3 Modelo de Dados — Alterações no Prisma

Adicionar campos ao modelo `Tenant`:

```prisma
model Tenant {
  // ... campos existentes ...

  // === E-mail (Resend Domain) ===
  emailEnabled               Boolean   @default(false)
  emailFromName              String?   // ex.: "Clínica Dr. Danilo"
  emailFromAddress           String?   // ex.: "notificacoes@clinicadrdanilo.com.br"
  emailResendDomainId        String?   // ID do domínio no Resend
  emailDomainName            String?   // ex.: "clinicadrdanilo.com.br"
  emailDomainStatus          String?   // "pending" | "verified" | "failed"
  emailDomainDnsRecords      Json?     // registros DNS retornados pelo Resend (para exibir na UI)
  emailDomainVerifiedAt      DateTime? // quando verificou
}
```

### 5.4 Resolução do Remetente — Lógica

```typescript
// src/infrastructure/email/resolve-tenant-sender.ts
export async function resolveTenantSender(tenantId: string): Promise<{
  from: string;
  isCustomDomain: boolean;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      emailEnabled: true,
      emailFromName: true,
      emailFromAddress: true,
      emailDomainStatus: true,
    },
  });

  // Se tenant tem domínio verificado e email habilitado, usar domínio dele
  if (
    tenant?.emailEnabled &&
    tenant.emailDomainStatus === "verified" &&
    tenant.emailFromAddress
  ) {
    const name = tenant.emailFromName || "Notificações";
    return {
      from: `${name} <${tenant.emailFromAddress}>`,
      isCustomDomain: true,
    };
  }

  // Fallback: remetente global da plataforma
  return {
    from: process.env.EMAIL_FROM ?? "SubManager <noreply@submanager.com>",
    isCustomDomain: false,
  };
}
```

Atualizar `sendEmail()` em `resend.client.ts` para aceitar `from` dinâmico:

```typescript
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;  // ← novo (opcional, override do padrão)
}): Promise<{ id?: string; error?: Error }> {
  const resend = getClient();
  const { data, error } = await resend.emails.send({
    from: params.from ?? fromEmail,  // ← usa custom ou fallback
    to: [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
  // ...
}
```

### 5.5 UI — Nova Aba de Configurações de E-mail

**Localização:** Adicionar seção `"email"` na página de configurações existente.

**Arquivo a alterar:** `src/features/settings/app/components/settings-page-layout.tsx`

```typescript
// Adicionar no NAV_DEFS (entre "notifications" e "team"):
{ id: "email", icon: Mail, tenantAdminOnly: true },

// Adicionar no switch do panelContent:
case "email":
  return <EmailSettingsCard />;
```

**Atualizar:** `src/features/settings/app/utils/section-hash.ts` para incluir `"email"` no tipo `SettingsSectionId`.

#### Componente: `EmailSettingsCard`

**Arquivo:** `src/features/settings/app/components/email-settings-card.tsx`

**Três estados da UI:**

##### Estado 1: Sem domínio configurado

```
┌─────────────────────────────────────────────────────┐
│  📧 Configurações de E-mail                         │
│                                                     │
│  Configure um domínio próprio para que os e-mails   │
│  de notificação saiam com o endereço da sua         │
│  clínica (ex.: notificacoes@suaclinica.com.br).     │
│                                                     │
│  Domínio: [_________________________]               │
│  Nome do remetente: [_________________________]     │
│  E-mail remetente: [_________________________]      │
│                                                     │
│  [Configurar domínio]                               │
│                                                     │
│  ℹ️  Sem domínio próprio, os e-mails serão          │
│     enviados como noreply@submanager.com               │
└─────────────────────────────────────────────────────┘
```

##### Estado 2: Pendente verificação DNS

```
┌─────────────────────────────────────────────────────┐
│  📧 Configurações de E-mail                         │
│                                                     │
│  Domínio: clinicadrdanilo.com.br                    │
│  Status: 🟡 Aguardando verificação DNS              │
│                                                     │
│  Adicione os registros abaixo no DNS do seu         │
│  domínio e clique em "Verificar":                   │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ Tipo   │ Host           │ Valor             │    │
│  │ TXT    │ _dmarc         │ v=DMARC1; p=none  │    │
│  │ CNAME  │ resend._domai… │ resend.dev        │    │
│  │ TXT    │ @              │ v=spf1 include:…  │    │
│  │ MX     │ @              │ feedback-smtp.…   │    │
│  └─────────────────────────────────────────────┘    │
│  (cada registro com botão copiar ao lado)            │
│                                                     │
│  [Verificar agora]   [Remover domínio]              │
└─────────────────────────────────────────────────────┘
```

##### Estado 3: Domínio verificado

```
┌─────────────────────────────────────────────────────┐
│  📧 Configurações de E-mail                         │
│                                                     │
│  Domínio: clinicadrdanilo.com.br                    │
│  Status: 🟢 Verificado ✓                            │
│  Remetente: Clínica Dr. Danilo                      │
│  E-mail: notificacoes@clinicadrdanilo.com.br        │
│  Verificado em: 15/04/2026                          │
│                                                     │
│  [ ] Ativar e-mails com domínio próprio             │
│                                                     │
│  [Alterar remetente]   [Remover domínio]            │
└─────────────────────────────────────────────────────┘
```

#### Arquivos Novos para a Feature

```
src/features/settings/app/
  components/email-settings-card.tsx          ← UI com 3 estados
  hooks/use-email-domain-settings.ts          ← hook com mutations
  services/email-domain.service.ts            ← chamadas HTTP

src/app/api/v1/tenant/email-domain/
  route.ts                                    ← POST (criar), GET (status), DELETE (remover)

src/app/api/v1/tenant/email-domain/verify/
  route.ts                                    ← POST (solicitar verificação)

src/application/use-cases/tenant/
  setup-tenant-email-domain.ts                ← use case: cria domínio no Resend + salva
  verify-tenant-email-domain.ts               ← use case: verifica status + atualiza
  remove-tenant-email-domain.ts               ← use case: remove domínio do Resend + limpa

src/infrastructure/email/
  resend-domain.client.ts                     ← wrapper Resend Domains API
  resolve-tenant-sender.ts                    ← resolve from dinâmico

src/lib/validators/
  email-domain.ts                             ← schemas Zod para os endpoints

src/types/api/
  email-domain-v1.ts                          ← tipos de request/response
```

### 5.6 API Endpoints

#### `POST /api/v1/tenant/email-domain`

```typescript
// Request
{
  domainName: "clinicadrdanilo.com.br",
  fromName: "Clínica Dr. Danilo",
  fromAddress: "notificacoes"  // prefix — será fromAddress@domainName
}

// Response (success)
{
  success: true,
  data: {
    resendDomainId: "d_xxx",
    domainName: "clinicadrdanilo.com.br",
    status: "pending",
    dnsRecords: [
      { type: "TXT", host: "_dmarc", value: "v=DMARC1; p=none; ..." },
      { type: "CNAME", host: "resend._domainkey", value: "..." },
      // ...
    ]
  }
}
```

- Auth: `tenant_admin` ou `super_admin`
- Validação: domínio válido, não duplicado, prefixo de e-mail válido
- Chama Resend `POST /domains`
- Salva `emailResendDomainId`, `emailDomainName`, `emailDomainDnsRecords`, `emailDomainStatus: "pending"` no Tenant

#### `POST /api/v1/tenant/email-domain/verify`

- Chama Resend `POST /domains/{id}/verify`
- Depois `GET /domains/{id}` para checar status
- Atualiza `emailDomainStatus` e `emailDomainVerifiedAt`
- Retorna status atualizado

#### `GET /api/v1/tenant/email-domain`

- Retorna configuração atual (domínio, status, registros DNS, remetente)
- Sem chamar Resend — apenas dados do banco

#### `DELETE /api/v1/tenant/email-domain`

- Chama Resend `DELETE /domains/{id}`
- Limpa campos `email*` do Tenant
- Desativa `emailEnabled`

#### `PATCH /api/v1/tenant/email-domain`

- Atualiza `emailFromName`, `emailFromAddress`, `emailEnabled`
- Validação: `emailEnabled` só pode ser `true` se `emailDomainStatus === "verified"`

### 5.7 Segurança

- Apenas `tenant_admin` / `super_admin` pode configurar domínio
- Resend API key nunca exposta ao frontend
- `emailResendDomainId` não exposto na API de leitura pública
- Validar que o domínio não é um domínio de e-mail comum (gmail.com, hotmail.com, etc.)
- Rate limit no endpoint de verify para evitar spam na API do Resend
- AuditEvent para criação/remoção de domínio

### 5.8 Branding nos Templates

Quando o tenant tem domínio próprio verificado, os templates devem:

1. Usar o nome da clínica no header (em vez de "SubManager")
2. Usar o nome da clínica no footer
3. Manter o layout/tema visual SubManager (é a plataforma, não white-label completo)

Ajuste no `baseLayout` de `email-templates.ts`:

```typescript
function baseLayout(content: string, preheader?: string, options?: {
  brandName?: string;  // Nome da clínica (se custom domain)
}): string {
  const brand = options?.brandName ?? "SubManager";
  // ... usar `brand` no header e footer
}
```

Todos os templates que recebem `clinicName` já têm a informação — basta propagar para o `baseLayout`.

---

## 6. Refatoração do `sendEmail` — From Dinâmico

### 6.1 Alterar `resend.client.ts`

Adicionar parâmetro `from?` ao `sendEmail()` (já descrito em §5.4).

### 6.2 Pontos de Chamada a Atualizar

Todos os locais que chamam `sendEmail()` devem resolver o remetente pelo tenant:

| Arquivo | Tem `tenantId`? | Ação |
|---------|----------------|------|
| `forgot-password.ts` | Não (reset é global) | Manter remetente global |
| `invite-tenant-member.ts` | Sim (via tenant) | Resolver via `resolveTenantSender(tenantId)` |
| `process-patient-self-register.ts` | Sim (via tenant) | Resolver via `resolveTenantSender(tenantId)` |
| `create-client-portal-link.ts` | Sim (via tenantId) | Resolver via `resolveTenantSender(tenantId)` |
| `request-patient-portal-otp.ts` | Sim (via tenantId) | Resolver via `resolveTenantSender(tenantId)` |
| `notify-patient-file-reviewed.ts` | Sim (via tenantId) | Resolver via `resolveTenantSender(tenantId)` |
| Novos templates (transição, SLA, etc.) | Sim | Já nascerão com `resolveTenantSender` |

---

## 7. Resumo de Tarefas (Ordem de Implementação)

### Fase 1 — E-mail na Transição de Etapa (somente paciente)

1. [ ] Criar template `getStageTransitionPatientHtml` em `email-templates.ts`
2. [ ] Adicionar disparo de e-mail em `transition-patient-stage.ts` (após notificação in-app)
3. [ ] Buscar `Tenant.name` e `Client.email` no contexto da transição
4. [ ] Testar: paciente com e-mail recebe, paciente sem e-mail não quebra
> Staff/clínica não recebe e-mail — já tem notificações in-app no dashboard.

### Fase 2 — E-mail nos Alertas SLA

6. [ ] Criar template `getSlaAlertStaffHtml` em `email-templates.ts`
7. [ ] Resolver e-mails dos `targetUserIds` em `sla-notification-check.ts`
8. [ ] Adicionar disparo de e-mail (respeitando deduplicação 24h existente)
9. [ ] Respeitar flag `notifyCriticalAlerts` do tenant

### Fase 3 — Corrigir Gaps de Coerência (dashboard ↔ paciente)

10. [ ] **Revisão de documento:** emitir notificação in-app `patient_portal_file_pending` no route handler de review — a equipe precisa saber que o paciente foi notificado (prioridade alta)
11. [ ] **Magic link portal:** emitir notificação in-app em `create-client-portal-link.ts` após envio do e-mail — avaliar se novo enum ou metadata genérica (prioridade média)

### Fase 4 — Notificações de Checklist e Doc Pendente

12. [ ] Implementar emissão de `checklist_complete` (notificação + e-mail) quando todos os itens obrigatórios de uma etapa são concluídos
13. [ ] Implementar emissão de `patient_portal_file_pending` para upload de documento pelo portal (notificação + e-mail para staff)
14. [ ] Criar templates de e-mail correspondentes

### Fase 5 — Fila de E-mail (BullMQ)

15. [ ] Criar `email-dispatch-emitter.ts` (espelho do WhatsApp)
16. [ ] Criar `email-dispatch-worker.ts` com retry (3x backoff)
17. [ ] Adicionar `EMAIL` ao enum `DispatchChannel` no Prisma
18. [ ] Migrar todos os `sendEmail()` inline para `enqueueEmailDispatch()`
19. [ ] Fallback inline quando Redis indisponível (padrão existente)

### Fase 6 — Domínio Próprio por Clínica

20. [ ] Migration Prisma: campos `email*` no modelo `Tenant`
21. [ ] Criar `resend-domain.client.ts` (wrapper Resend Domains API)
22. [ ] Criar `resolve-tenant-sender.ts`
23. [ ] Use cases: `setup-tenant-email-domain`, `verify-tenant-email-domain`, `remove-tenant-email-domain`
24. [ ] Validators Zod + tipos API
25. [ ] Endpoints REST: POST/GET/DELETE/PATCH `/api/v1/tenant/email-domain`
26. [ ] Componente `EmailSettingsCard` + hook + service
27. [ ] Adicionar seção "E-mail" no `settings-page-layout.tsx`
28. [ ] Atualizar `baseLayout` para branding dinâmico (nome da clínica)
29. [ ] Refatorar todos os `sendEmail()` existentes para usar `resolveTenantSender()`
30. [ ] Atualizar `openapi.json` com novos endpoints

### Fase 7 — Tracking e Observabilidade

31. [ ] Configurar webhook Resend para delivery/bounce/open
32. [ ] Salvar `resendMessageId` no `ChannelDispatch` / `EmailDispatchLog`
33. [ ] Dashboard de entrega (futuro)

---

## 8. Arquivos Impactados (Resumo)

### Arquivos Existentes a Alterar

| Arquivo | Alteração |
|---------|-----------|
| `packages/prisma/schema.prisma` | Campos `email*` no Tenant + `EMAIL` em `DispatchChannel` |
| `src/infrastructure/email/resend.client.ts` | Parâmetro `from?` no `sendEmail()` |
| `src/infrastructure/email/email-templates.ts` | 4 templates novos + `baseLayout` com branding |
| `src/application/use-cases/pathway/transition-patient-stage.ts` | Disparo de e-mail para paciente |
| `src/infrastructure/notifications/sla-notification-check.ts` | Disparo de e-mail SLA |
| `src/infrastructure/email/notify-patient-file-reviewed.ts` | Adicionar notificação in-app (gap coerência) |
| `src/application/use-cases/client/create-client-portal-link.ts` | Adicionar notificação in-app (gap coerência) |
| `src/app/api/v1/clients/[clientId]/files/[fileId]/review/route.ts` | Emitir notificação `patient_portal_file_pending` |
| `src/features/settings/app/components/settings-page-layout.tsx` | Nova seção "email" |
| `src/features/settings/app/utils/section-hash.ts` | Adicionar "email" ao tipo |
| `public/openapi.json` | Novos endpoints |

### Arquivos Novos

| Arquivo | Propósito |
|---------|-----------|
| `src/infrastructure/email/email-dispatch-emitter.ts` | Enfileirar jobs de e-mail |
| `src/infrastructure/email/email-dispatch-worker.ts` | Processar jobs com retry |
| `src/infrastructure/email/resend-domain.client.ts` | Wrapper Resend Domains API |
| `src/infrastructure/email/resolve-tenant-sender.ts` | Resolver remetente por tenant |
| `src/features/settings/app/components/email-settings-card.tsx` | UI configuração domínio |
| `src/features/settings/app/hooks/use-email-domain-settings.ts` | Hook mutations |
| `src/features/settings/app/services/email-domain.service.ts` | Service HTTP |
| `src/app/api/v1/tenant/email-domain/route.ts` | CRUD domínio |
| `src/app/api/v1/tenant/email-domain/verify/route.ts` | Verificação DNS |
| `src/application/use-cases/tenant/setup-tenant-email-domain.ts` | Use case criar |
| `src/application/use-cases/tenant/verify-tenant-email-domain.ts` | Use case verificar |
| `src/application/use-cases/tenant/remove-tenant-email-domain.ts` | Use case remover |
| `src/lib/validators/email-domain.ts` | Schemas Zod |
| `src/types/api/email-domain-v1.ts` | DTOs |

---

## 9. Notas Técnicas

- **Resend Domains API** requer plano **Pro** ou superior (verificar conta atual)
- Domínios de e-mail comuns (gmail.com, outlook.com, etc.) devem ser bloqueados na validação
- O Resend aceita até **10 domínios** no plano Pro; plano Business permite mais
- E-mails transacionais (reset, OTP) devem continuar funcionando mesmo sem domínio custom — o fallback global garante isso
- Considerar rate limit por tenant para evitar abuso (ex.: máx 500 e-mails/dia por tenant)
- LGPD: não logar corpo do e-mail; logar apenas `resendMessageId`, `tenantId`, `type`, `to` (hash)
