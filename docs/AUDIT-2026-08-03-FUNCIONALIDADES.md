# Resumo de Funcionalidades — SubManager

**Data:** 2026-08-03
**Base:** 91 endpoints `/api/v1`, 28 páginas, 96 use cases, 29 modelos Prisma

---

## O que o produto é

SaaS multi-tenant que orquestra a jornada clínica de cirurgia bucomaxilofacial. A clínica desenha um fluxo de etapas em editor visual, cadastra o paciente, e o sistema conduz a jornada: entrega documentos por etapa, cobra checklist, monitora SLA, notifica a equipe, envia WhatsApp e e-mail, e dá ao paciente um portal próprio para acompanhar e enviar exames.

Três perfis de acesso:

| Perfil | Onde | O que faz |
|--------|------|-----------|
| `super_admin` | `/dashboard/settings`, `/api/v1/admin/*` | Cria tenants, gerencia catálogo de apps, atua cross-tenant com auditoria |
| `tenant_admin` | `/dashboard/*` | Tudo dentro da clínica: pacientes, fluxos, equipe, integrações, faturamento |
| `tenant_user` | `/dashboard/*` | Operação clínica, com visibilidade opcionalmente restrita |
| Paciente | `/{slug}/patient` | Portal próprio — jornada, documentos, upload de exames |

---

## Módulos

### 1. Autenticação e contexto de tenant

**Staff.** NextAuth v4, JWT de 30 dias, `CredentialsProvider` com bcrypt. Auto-resolução do tenant ativo no primeiro login: usuário com exatamente uma `TenantMembership` tem `activeTenantId` preenchido automaticamente (cobre pós-convite e contas legadas). Troca de contexto por `POST /api/v1/auth/context`.

**Fluxos de conta:** convite de membro com definição manual de senha pelo administrador, esqueci a senha, redefinição, prévia de convite. Tokens em `UserAuthToken` com propósito tipado (`PASSWORD_RESET`, `INVITE_SET_PASSWORD`).

**Páginas:** `/login`, `/auth/invite`, `/auth/forgot-password`, `/auth/reset-password`.

**Auditoria:** `STAFF_LOGIN_SUCCESS`, `STAFF_LOGIN_FAILED`, `STAFF_PASSWORD_CHANGED`, `STAFF_PASSWORD_RESET`.

---

### 2. Pacientes (`Client`)

Cadastro completo com máscaras e validação brasileira: CPF, telefone, CEP, endereço. Suporte a **menor de idade** — dados do responsável legal (`GuardianRelationship`: mãe, pai, tutor legal, outro) com campos condicionais e canais de contato duplicados (e-mail e WhatsApp do responsável recebem OTP e notificações).

**Recursos:**
- Wizard de novo paciente (`new-client-wizard.tsx`)
- Ficha detalhada com perfil, jornada, arquivos, linha do tempo e notas
- Notas clínicas/operacionais dedicadas (`PatientNote`)
- Linha do tempo unificada — transições, uploads, eventos de portal, dispatches
- Exportação de auditoria do paciente (`GET /clients/:id/audit-export`, restrito a `tenant_admin`)
- Fornecedor OPME vinculável (`OpmeSupplier`)
- Preferência de canal declarada (`PatientPreferredChannel`)
- Soft delete (`deletedAt`)

**Visibilidade granular** por `TenantMembership`:
- `restrictedToAssignedOnly` — o membro só vê pacientes atribuídos a si
- `linkedOpmeSupplierId` — o membro só vê pacientes daquele fornecedor OPME

Aplicada no `where` do Prisma via `mergeClientWhereWithVisibility`, incluindo dentro do cache.

**Endpoints:** `/clients`, `/clients/:id`, `/clients/:id/notes`, `/clients/:id/timeline`, `/clients/:id/files`, `/clients/:id/portal-link`, `/clients/:id/audit-export`, `/clients/self-register-invites`

---

### 3. Auto-cadastro por QR (`PatientSelfRegisterInvite`)

A clínica gera um link/QR de uso único e validade definida. O paciente preenche o próprio cadastro sem conta. O convite pode amarrar a um `Client` existente (atualiza em vez de criar).

Rota pública com rate limit, resposta opaca, e validação Zod completa. É o único fluxo com cobertura E2E (`e2e/patient-self-register.spec.ts`).

**Páginas:** `/patient-self-register`, `/{slug}/patient-self-register`
**Endpoint:** `POST /api/v1/public/patient-self-register`

---

### 4. Fluxos de cuidado (`CarePathway`)

Editor visual em `@xyflow/react`. O grafo é persistido em `PathwayVersion.graphJson` e materializado em `PathwayStage` ao salvar.

**Modelo de versionamento:** `CarePathway` → várias `PathwayVersion` (rascunho / publicada). Publicar uma versão pode migrar pacientes ativos, com pré-visualização do impacto (`publish-preview`).

**Cada etapa (`PathwayStage`) tem:**
- `stageKey`, nome, `sortOrder`
- `slaHours` — prazo, base dos alertas
- documentos anexos (`StageDocument`, N:N com `FileAsset` por `sortOrder`)
- checklist (`PathwayStageChecklistItem`, com flag `requiredForTransition`)
- responsáveis padrão (`defaultAssigneeUserIds`)
- `patientMessage` — texto enviado ao paciente ao entrar na etapa

**Endpoints:** `/pathways`, `/pathways/:id/versions`, `/pathways/:id/versions/:vid/publish`, `/pathways/:id/versions/:vid/publish-preview`, `/pathways/:id/published-stages`, `/stage-documents`

---

### 5. Jornada do paciente (`PatientPathway`) — núcleo do produto

Instância do fluxo para um paciente. Se a clínica tem exatamente um fluxo publicado, a associação é automática; com mais de um, a UI obriga escolher.

**Transição de etapa** (`runTransitionPatientStage`) — pipeline completo:

1. Carrega a jornada com escopo de tenant
2. Valida que `toStageId` pertence à mesma `PathwayVersion`
3. Adquire lock distribuído (Redis, TTL 10 s)
4. Em transação Prisma:
   - checa itens de checklist obrigatórios pendentes → bloqueia, salvo `force` com `ruleOverrideReason`
   - monta o bundle de documentos da etapa de destino
   - resolve o responsável da nova etapa
   - grava `StageTransition` com `dispatchStub` (snapshot do que foi enviado)
   - grava `AuditEvent`
   - atualiza `currentStageId` e `enteredStageAt`
5. Após o commit: notificação in-app, e-mail ao paciente com link do portal, enfileiramento do dispatch de WhatsApp com os documentos, revalidação do cache

Idempotência por `correlationId`. Override forçado é auditado com autor e motivo.

**Endpoints:** `/patient-pathways`, `/patient-pathways/:id/transition`, `/patient-pathways/:id/complete`, `/patient-pathways/:id/checklist-items/:itemId`, `/patient-pathways/:id/dispatches`

---

### 6. Portal do paciente

Área pública em `/{tenantSlug}/patient`, com sessão totalmente separada da do staff (cookie próprio assinado por HMAC).

**Três formas de entrar:**

| Método | Como | Validade |
|--------|------|----------|
| Magic link | `PatientPortalLinkToken` enviado por e-mail | 72 h, uso único |
| OTP | CPF → código de 6 dígitos por e-mail e/ou WhatsApp | 15 min, 5 tentativas, 5 códigos/hora |
| Senha | Definida pelo próprio paciente no portal | Sessão de 7 dias |

**O que o paciente faz:** vê a jornada e a etapa atual, baixa os documentos da etapa, envia exames e fotos (presign direto para o GCS, validação de magic bytes), acompanha o status de revisão de cada envio, define e troca a senha, vê a linha do tempo.

**Revisão pela clínica:** cada arquivo enviado pelo paciente entra com `PatientPortalFileReviewStatus` = `PENDING`; a equipe aprova ou rejeita, e o paciente é notificado por e-mail e WhatsApp.

**Segurança da sessão:** trocar a senha invalida todas as sessões abertas (campo `pwdv` no cookie contra `portalPasswordChangedAt`). Header `x-patient-portal-tenant-slug` conferido contra o cookie e contra o banco.

**Páginas:** `/{slug}/patient`, `/{slug}/patient/login`, `/{slug}/patient/enter`, `/{slug}/patient/set-password`
**Endpoints:** `/patient/*` (9 rotas com sessão de portal), `/public/patient-portal/{slug}/*` (5 rotas públicas)

---

### 7. Arquivos e documentos

Armazenamento no Google Cloud Storage com presign v4 e chave por tenant:

```
tenants/{tenantId}/
  clients/{clientId}/uploads/       documentos do paciente
  clients/{clientId}/dispatches/    snapshots enviados por WhatsApp
  library/uploads/                  modelos e templates do tenant
  avatars/                          fotos de perfil
  exports/                          relatórios gerados (TTL curto)
```

Upload direto do browser para o bucket. Após o upload, o registro valida **magic bytes** contra o objeto real e calcula SHA-256. Metadados sempre em `FileAsset`. Download só por URL assinada de 300 s, com auditoria (`FILE_DOWNLOADED_BY_STAFF` / `BY_PATIENT`).

**Páginas:** `/dashboard/files`
**Endpoints:** `/files`, `/files/presign`, `/files/presign-download`, `/files/storage-status`

---

### 8. Dashboard e relatórios

- **Home** — métricas do tenant, pipeline por etapa
- **Kanban** — colunas por etapa do fluxo, com paginação de pacientes por coluna e troca de etapa por diálogo
- **Alertas de SLA** — `sla_warning` e `sla_critical` calculados sobre `slaHours` e `enteredStageAt`
- **Atendimento** (`/dashboard/attendance`)
- **Relatórios** — resumo por fluxo (`/reports/summary`)

**Endpoints:** `/pathways/:id/kanban`, `/pathways/:id/kanban/columns/:stageId/patients`, `/pathways/:id/dashboard-summary`, `/pathways/:id/dashboard-alerts`, `/reports/summary`

---

### 9. Notificações

Sete tipos: `sla_critical`, `sla_warning`, `stage_transition`, `new_patient`, `checklist_complete`, `patient_portal_file_pending`, `patient_portal_link_sent`.

**Arquitetura dual-mode:** com Redis, BullMQ + pub/sub SSE; sem Redis, escrita inline no Postgres. Circuit breaker para falha do Redis. Deduplicação por `correlationId`.

**Entrega em tempo real** por SSE (`/notifications/stream`). Destinatários resolvidos por escopo de visibilidade — quem não pode ver o paciente não recebe a notificação sobre ele. Flags por tenant controlam categorias (`notifyCriticalAlerts`, `notifyNewPatients`, `notifyDocumentDelivery`).

**Endpoints:** `/notifications`, `/notifications/stream`, `/notifications/unread-count`, `/notifications/:id/read`, `/notifications/read-all`, `/tenant/notifications`

---

### 10. E-mail transacional

**Dois modos de envio por tenant** (`EmailOutboundMode`):
- **Resend** — API da plataforma, com domínio verificável pelo próprio tenant
- **SMTP do tenant** — Gmail, Microsoft 365 ou qualquer servidor; credenciais cifradas em AES-256-GCM; tem prioridade sobre o Resend no remetente

Verificação de domínio, teste de conexão SMTP, pré-visualização de template, e página de ajuda sobre e-mails transacionais nas configurações.

**Templates:** convite de membro, redefinição de senha, OTP do portal, transição de etapa para o paciente, checklist concluído, arquivo revisado, alerta de SLA, boas-vindas pós-auto-cadastro.

**Rastreamento:** `EmailDispatchLog` com status; webhook do Resend (assinatura Svix verificada) atualiza entrega, abertura e bounce.

**Endpoints:** `/tenant/email-domain`, `/tenant/email-domain/verify`, `/tenant/email-smtp`, `/tenant/email-smtp/test`, `/tenant/email/preview`, `/webhooks/resend`

---

### 11. WhatsApp

Cliente HTTP para o projeto de chatbot (a implementação do canal Meta fica fora deste repositório). Credenciais por tenant cifradas em AES-256-GCM.

Envio de documentos da etapa após a transição, com `ChannelDispatch` rastreando `DispatchStatus`. Webhook de entrada recebe status de entrega e respostas de botão interativo, refletidos em `AuditEvent` (`WHATSAPP_DISPATCH_SENT` / `DELIVERED` / `READ` / `FAILED`, `WHATSAPP_PATIENT_CONFIRMED`).

**Endpoints:** `/tenant/whatsapp`, `/tenant/whatsapp/test`, `/webhooks/whatsapp`

---

### 12. Marketplace de apps

Catálogo global de integrações gerenciado pelo `super_admin`, ativável por tenant.

**Catálogo (`App`):** slug, nome, tagline, descrição, ícone, screenshots com legenda, cor de destaque, desenvolvedor, categoria (`AppCategory`), modo de renderização (`AppRenderMode`: iframe ou rota interna), schema de configuração declarativo, flags de publicação e destaque.

**Faturamento:** `AppPricingModel` (free/pago), preço em centavos, moeda, intervalo (`AppBillingInterval`), dias de trial, id de produto externo.

**Ativação por tenant (`TenantApp`):** `TenantAppStatus` (`pending_config`, ativo, ...), configuração com campos secretos cifrados individualmente e mascarados na API, `SubscriptionStatus` para o ciclo de assinatura.

**Integração:** app-scoped token JWT de 15 min (`sub`/`tid`/`aid`/`slug`) para o app embarcado chamar a plataforma; webhook de entrada por app com HMAC-SHA256 e idempotência por `eventId`; CSP com `frame-src` configurável via `ALLOWED_IFRAME_ORIGINS`.

**Páginas:** `/dashboard/apps`, `/dashboard/apps/[appSlug]`
**Endpoints:** `/admin/apps/*` (4), `/tenant/apps/*` (5), `/webhooks/apps/:appSlug`

---

### 13. Administração de tenants e equipe

**`super_admin`:** cria tenants por wizard, lista e edita, atua cross-tenant com auditoria.

**`tenant_admin`:** perfil da clínica com máscaras (CNPJ, telefone, endereço), convite de membros com definição manual de senha, gestão de papéis, configuração de visibilidade por membro (restrição a atribuídos, vínculo a fornecedor OPME), atualização automática da lista de equipe após o convite.

**Conta do usuário** (`/dashboard/account`): perfil, avatar, troca de senha com indicador de força.

**Endpoints:** `/admin/tenants/*`, `/admin/invites`, `/admin/invites/set-password`, `/tenant`, `/tenant/members`, `/me`, `/me/password`, `/tenants`

---

### 14. OPME

`OpmeSupplier` por tenant, vinculável a pacientes. Serve de eixo de visibilidade: um `tenant_user` com `linkedOpmeSupplierId` enxerga apenas os pacientes daquele fornecedor.

**Endpoint:** `/opme-suppliers`

---

### 15. Auditoria

`AuditEvent` com **33 tipos** cobrindo transição de etapa, ciclo de vida do paciente, upload e download de arquivo, sessões e falhas de login (staff e portal), consentimento, exportação, dispatches de WhatsApp e configuração de domínio de e-mail.

Payload sem conteúdo clínico, por LGPD. Alimenta a linha do tempo do paciente e a exportação de auditoria.

---

### 16. Plataforma

- **i18n:** next-intl, pt-BR e en, 12 namespaces, roteamento por locale, erros de API traduzidos
- **API docs:** Scalar em `/api-doc` sobre `public/openapi.json` (78 paths documentados)
- **Health check:** `GET /api/v1/health` com ping no banco
- **Legal:** páginas de termos e privacidade
- **Cache:** `unstable_cache` com tags por tenant e invalidação em mutação, chave incluindo escopo de visibilidade
- **Rate limit:** Redis INCR/EXPIRE, presets `auth` (5/min), `api` (120/min), `patientPortalPassword` (5/15min), `sse` (3/10s)
- **Lock distribuído:** Redis SET NX EX
- **Observabilidade:** `x-request-id` propagado, Vercel Speed Insights

---

## Modelo de dados

29 modelos, 18 enums, 42 migrations.

| Grupo | Modelos |
|-------|---------|
| Identidade | `User`, `Account`, `Session`, `VerificationToken`, `UserAuthToken`, `TenantMembership` |
| Tenant | `Tenant` |
| Paciente | `Client`, `PatientNote`, `OpmeSupplier` |
| Portal | `PatientPortalLinkToken`, `PatientPortalOtpChallenge`, `PatientSelfRegisterInvite` |
| Fluxo | `CarePathway`, `PathwayVersion`, `PathwayStage`, `StageDocument`, `PathwayStageChecklistItem` |
| Jornada | `PatientPathway`, `PatientPathwayChecklistItem`, `StageTransition` |
| Arquivos | `FileAsset` |
| Comunicação | `Notification`, `ChannelDispatch`, `EmailDispatchLog` |
| Marketplace | `App`, `AppScreenshot`, `TenantApp` |
| Auditoria | `AuditEvent` |

---

## Superfície de API

| Grupo | Rotas | Autorização |
|-------|-------|-------------|
| `/api/v1/admin/*` | 8 | `super_admin` (membros: `tenant_admin` ou super) |
| `/api/v1/clients/*` | 9 | sessão + tenant + membership |
| `/api/v1/pathways/*` | 10 | sessão + tenant |
| `/api/v1/patient-pathways/*` | 6 | sessão + tenant + membership |
| `/api/v1/tenant/*` | 14 | sessão + tenant (maioria `tenant_admin`) |
| `/api/v1/notifications/*` | 5 | sessão + tenant |
| `/api/v1/files/*` | 4 | sessão + tenant + membership |
| `/api/v1/patient/*` | 9 | sessão de portal do paciente |
| `/api/v1/public/*` | 6 | pública (token/OTP/rate limit) |
| `/api/v1/webhooks/*` | 3 | assinatura HMAC / Svix |
| outros | 17 | variado |

---

## Maturidade

| Área | Estado |
|------|--------|
| Cadastro e jornada do paciente | Completo |
| Editor de fluxos e versionamento | Completo |
| Portal do paciente | Completo (3 métodos de login, upload, revisão) |
| Notificações e SLA | Completo |
| E-mail transacional | Completo (Resend + SMTP por tenant) |
| Auditoria | Completo (33 tipos) |
| Marketplace de apps | Estrutura completa; faturamento modelado, integração de pagamento não verificada |
| WhatsApp | Cliente e webhook prontos; depende do projeto de chatbot externo |
| Relatórios | Básico (resumo por fluxo) |
| Testes | 1 spec E2E, 0 testes unitários |

---

## Documentos relacionados

- `docs/AUDIT-2026-08-03-SEGURANCA.md` — achados de segurança e ordem de correção
- `docs/AUDIT-2026-08-03-ARQUITETURA.md` — camadas, SOLID, clean code, dívida técnica
- `docs/ARCHITECTURE.md` — arquitetura de referência e modelo de dados (§8)
- `docs/PRODUCT-SCOPE.md` — escopo de produto e fases
- `docs/APPS-MARKETPLACE.md` — marketplace em detalhe
- `docs/EMAIL-SYSTEM-PLAN.md` — sistema de e-mail
