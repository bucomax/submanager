# Apps Marketplace — Documentação de Implementação

> Sistema de integração de aplicativos externos ao painel SubManager, com catálogo gerenciado por `super_admin` e ativação por `tenant_admin`.

---

## 1. Visão geral

O SubManager precisa de um sistema de **marketplace de apps** que permita:

1. **Cadastro de apps** (super_admin) — registrar novos produtos/serviços que podem ser integrados ao dashboard.
2. **Ativação de apps** (tenant_admin) — habilitar/configurar apps disponíveis para seu tenant.
3. **Renderização** — apps externos renderizados via **iframe** ou apps internos que já existem no codebase (ex.: WhatsApp).
4. **Menu "Apps"** — nova seção na sidebar do dashboard agrupando todos os apps ativos do tenant.

### Motivação

Hoje o WhatsApp está acoplado como seção de Settings. Com o crescimento do produto, teremos múltiplos serviços (chatbot IA, agendamento, prontuário eletrônico, etc.) que precisam de um modelo uniforme de registro, ativação e renderização.

---

## 2. Modelo de dados (Prisma)

### 2.1 `App` — Catálogo global de apps

```prisma
model App {
  id              String          @id @default(cuid())
  slug            String          @unique       // ex.: "whatsapp", "ai-chatbot", "scheduling"
  name            String                        // nome de exibição (editável pelo super_admin)
  tagline         String?                       // frase curta tipo App Store: "Conecte sua clínica ao WhatsApp"
  description     String?         @db.Text      // descrição longa com detalhes, formatada em markdown
  category        AppCategory     @default(integration)

  // === Identidade visual (estilo App Store / Play Store) ===

  /// Ícone principal do app (quadrado, 512×512 recomendado)
  /// Armazenado no GCS: apps/{appId}/icon.{ext}
  iconFileId      String?
  iconFile        FileAsset?      @relation("AppIcon", fields: [iconFileId], references: [id])

  /// Screenshots/fotos do app funcionando (galeria estilo loja)
  /// Ordenadas por sortOrder no AppScreenshot
  screenshots     AppScreenshot[]

  /// Cor de destaque do app (hex) — usada no card e header da página de detalhe
  accentColor     String?                       // ex.: "#25D366" para WhatsApp

  /// Nome do desenvolvedor/provedor do app
  developerName   String?                       // ex.: "SubManager", "Parceiro X"

  /// URL do site do desenvolvedor
  developerUrl    String?

  // === Configuração técnica ===

  /// Tipo de renderização no dashboard
  renderMode      AppRenderMode   @default(iframe)

  /// URL base para iframe (template com variáveis: {{tenantId}}, {{locale}})
  iframeBaseUrl   String?         @db.Text

  /// Rota interna do dashboard (para apps nativos como WhatsApp settings)
  internalRoute   String?                       // ex.: "/dashboard/apps/whatsapp"

  /// Se o app requer credenciais/configuração do tenant ao ativar
  requiresConfig  Boolean         @default(false)

  /// Schema JSON dos campos de configuração (para renderizar form dinâmico)
  configSchema    Json?                         // JSON Schema dos campos

  /// Visível no catálogo para tenants ativarem
  isPublished     Boolean         @default(false)

  /// App em destaque no catálogo (banner maior)
  isFeatured      Boolean         @default(false)

  /// Ordem no catálogo
  sortOrder       Int             @default(0)

  // === Billing (preparado para assinatura futura) ===

  /// Modelo de cobrança do app
  pricingModel    AppPricingModel @default(free)

  /// Preço em centavos (ex.: 4990 = R$ 49,90). Interpretação depende do pricingModel.
  priceInCents    Int?

  /// Moeda ISO 4217 (BRL, USD, etc.)
  priceCurrency   String          @default("BRL")

  /// Intervalo da assinatura
  billingInterval AppBillingInterval @default(monthly)

  /// Dias de trial gratuito antes de cobrar (0 = sem trial)
  trialDays       Int             @default(0)

  /// ID do produto na plataforma de billing externa (Stripe, Pagar.me, etc.)
  /// Preenchido quando a integração com billing for implementada
  externalProductId String?

  /// Metadata livre (docs URL, changelog URL, versão, privacy policy, terms, etc.)
  metadata        Json?

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  tenantApps      TenantApp[]

  @@index([isPublished, sortOrder])
}

// ...

enum AppPricingModel {
  free            // gratuito, sem cobrança
  flat            // preço fixo por tenant (ex.: R$ 49,90/mês)
  per_seat        // preço por usuário ativo no tenant (priceInCents × membros)
  usage_based     // cobrança por uso (metrificado externamente)
}

enum AppBillingInterval {
  monthly         // mensal
  yearly          // anual (pode ter desconto — controlado pelo preço)
}

/// Screenshots/fotos do app (galeria estilo App Store)
model AppScreenshot {
  id          String    @id @default(cuid())
  appId       String
  fileId      String
  caption     Json?     // i18n: { "pt-BR": "Tela de configuração", "en": "Settings screen" }
  sortOrder   Int       @default(0)

  app         App       @relation(fields: [appId], references: [id], onDelete: Cascade)
  file        FileAsset @relation("AppScreenshot", fields: [fileId], references: [id])

  @@index([appId, sortOrder])
}

enum AppCategory {
  communication   // WhatsApp, SMS, email
  ai              // chatbot IA, análise de exames
  scheduling      // agendamento
  clinical        // prontuário, prescrição
  financial       // faturamento, cobrança
  integration     // genérico
}

enum AppRenderMode {
  iframe          // app externo em iframe
  internal        // componente React nativo do dashboard
  external_link   // abre em nova aba
}
```

### 2.2 `TenantApp` — Ativação por tenant

```prisma
model TenantApp {
  id              String          @id @default(cuid())
  tenantId        String
  appId           String

  /// Status da ativação
  status          TenantAppStatus @default(pending_config)

  /// Configuração específica do tenant (credenciais, tokens, etc.)
  /// Campos sensíveis são criptografados (AES-256-GCM) antes de persistir
  configEncrypted Json?

  /// Data de ativação efetiva
  activatedAt     DateTime?

  /// Quem ativou
  activatedById   String?

  /// Data de desativação (null = ativo)
  deactivatedAt   DateTime?

  // === Billing / Assinatura (preparado para integração futura) ===

  /// ID da assinatura na plataforma de billing externa (Stripe subscription_id, etc.)
  externalSubscriptionId  String?

  /// Status da assinatura sincronizado via webhook do billing
  subscriptionStatus      SubscriptionStatus @default(none)

  /// Data de início do trial (null = sem trial ou trial não iniciado)
  trialStartedAt          DateTime?

  /// Data de fim do trial (calculada: trialStartedAt + App.trialDays)
  trialEndsAt             DateTime?

  /// Próxima data de cobrança (sincronizada via webhook)
  currentPeriodEnd        DateTime?

  /// Motivo do cancelamento (preenchido pelo tenant_admin ao cancelar)
  cancelReason            String?

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  tenant          Tenant          @relation(fields: [tenantId], references: [id])
  app             App             @relation(fields: [appId], references: [id])
  activatedBy     User?           @relation(fields: [activatedById], references: [id])

  @@unique([tenantId, appId])
  @@index([tenantId, status])
  @@index([externalSubscriptionId])
}

// ...

enum SubscriptionStatus {
  none            // app gratuito ou billing não configurado
  trialing        // em período de trial
  active          // pagamento em dia
  past_due        // pagamento atrasado (grace period)
  canceled        // cancelado pelo tenant
  unpaid          // falha de pagamento após grace period
  suspended       // suspenso por super_admin
}

enum TenantAppStatus {
  pending_config  // ativado mas faltam credenciais/config
  active          // totalmente configurado e funcional
  suspended       // suspenso por admin ou por erro
  inactive        // desativado pelo tenant
}
```

### 2.3 Alterações em modelos existentes

```prisma
// Em Tenant, adicionar relação:
model Tenant {
  // ... campos existentes ...
  tenantApps  TenantApp[]
}

// Em User, adicionar relação:
model User {
  // ... campos existentes ...
  activatedApps  TenantApp[]
}
```

### 2.4 Migração do WhatsApp

O WhatsApp atualmente tem campos diretos no modelo `Tenant`. A migração será em 2 fases:

**Fase 1 (compatibilidade):** Criar o `App` "whatsapp" e `TenantApp` correspondente, mas manter os campos legados no `Tenant` funcionando. O `renderMode` do app WhatsApp será `internal` com `internalRoute: "/dashboard/apps/whatsapp"`.

**Fase 2 (limpeza):** Após confirmar que tudo funciona, migrar os dados dos campos `whatsapp*` do `Tenant` para `TenantApp.configEncrypted` e remover os campos legados do schema.

---

## 3. RBAC e permissões

### 3.1 Matriz de permissões

| Ação | `super_admin` | `tenant_admin` | `tenant_user` |
|------|:---:|:---:|:---:|
| CRUD no catálogo `App` | ✅ | ❌ | ❌ |
| Publicar/despublicar `App` | ✅ | ❌ | ❌ |
| Ver catálogo de apps disponíveis | ✅ | ✅ | ❌ |
| Ativar/desativar `TenantApp` | ✅ | ✅ | ❌ |
| Configurar credenciais do `TenantApp` | ✅ | ✅ | ❌ |
| Acessar/usar app ativo | ✅ | ✅ | ✅ |
| Ver menu "Apps" na sidebar | ✅ | ✅ | ✅ (*) |

(*) `tenant_user` vê apenas apps com `status: active` no tenant.

### 3.2 Guards necessários

```typescript
// Novo guard em src/lib/auth/guards.ts
export async function assertTenantAppAccess(
  session: Session,
  tenantId: string,
  appSlug: string,
  request: NextRequest,
): Promise<NextResponse | null> {
  // 1. Verificar se o app existe e está publicado
  // 2. Verificar se TenantApp existe para o tenant com status 'active'
  // 3. Retornar 404 se app não encontrado ou não ativo no tenant
}
```

### 3.3 Auditoria

Toda ativação/desativação/configuração de app gera `AuditEvent`:
- `action: "app_activated" | "app_deactivated" | "app_configured"`
- `entityType: "TenantApp"`
- `entityId: tenantApp.id`
- Sem payload de credenciais (LGPD)

---

## 4. API Routes

### 4.1 Catálogo de apps (super_admin)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/v1/admin/apps` | Listar todos os apps do catálogo |
| `POST` | `/api/v1/admin/apps` | Criar novo app (multipart — aceita ícone + screenshots) |
| `GET` | `/api/v1/admin/apps/:appId` | Detalhe do app com screenshots |
| `PATCH` | `/api/v1/admin/apps/:appId` | Atualizar dados do app |
| `DELETE` | `/api/v1/admin/apps/:appId` | Remover app (soft delete ou hard se sem ativações) |
| `PATCH` | `/api/v1/admin/apps/:appId/publish` | Publicar/despublicar |
| `POST` | `/api/v1/admin/apps/:appId/icon` | Upload/substituir ícone (multipart) |
| `POST` | `/api/v1/admin/apps/:appId/screenshots` | Upload de screenshots (multipart, múltiplos) |
| `PATCH` | `/api/v1/admin/apps/:appId/screenshots/reorder` | Reordenar screenshots |
| `DELETE` | `/api/v1/admin/apps/:appId/screenshots/:screenshotId` | Remover screenshot |

### 4.2 Apps do tenant

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/v1/tenant/apps` | Apps disponíveis + status de ativação do tenant |
| `POST` | `/api/v1/tenant/apps/:appId/activate` | Ativar app no tenant |
| `PATCH` | `/api/v1/tenant/apps/:appId/config` | Salvar configuração/credenciais |
| `POST` | `/api/v1/tenant/apps/:appId/deactivate` | Desativar app no tenant |
| `POST` | `/api/v1/tenant/apps/:appId/test` | Testar conexão (se aplicável) |

### 4.3 Apps ativos (leitura para todos os roles)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/v1/tenant/apps/active` | Lista de apps ativos do tenant (para sidebar) |
| `GET` | `/api/v1/tenant/apps/:appId/iframe-url` | URL do iframe com token/contexto |

### 4.4 Envelope de resposta

Segue o padrão existente `jsonSuccess` / `jsonError`.

```typescript
// GET /api/v1/tenant/apps
{
  success: true,
  data: {
    available: AppWithStatus[],  // catálogo publicado + status do tenant
  },
  meta: { timestamp }
}

// GET /api/v1/tenant/apps/active
{
  success: true,
  data: ActiveApp[],  // apenas apps com TenantApp.status === 'active'
  meta: { timestamp }
}
```

---

## 5. Sidebar e navegação

### 5.1 Mudanças na sidebar

A sidebar atual tem um grupo "principal" com 5 itens fixos. A proposta é adicionar um grupo dinâmico "Apps" que aparece **apenas quando o tenant tem apps ativos**.

```
Sidebar:
├── Principal
│   ├── Home
│   ├── Clientes
│   ├── Jornadas
│   └── Relatórios
├── Apps (dinâmico — só aparece se há apps ativos)
│   ├── WhatsApp        ← app nativo migrado
│   ├── Chatbot IA      ← iframe
│   └── Agendamento     ← iframe
└── Sistema
    └── Configurações
```

### 5.2 Implementação da sidebar dinâmica

```typescript
// Hook: src/features/apps/app/hooks/use-active-apps.ts
// Busca apps ativos do tenant via React Query
// Cache com staleTime adequado (5min)

// Em app-sidebar.tsx:
// 1. Buscar apps ativos via useActiveApps()
// 2. Renderizar grupo "Apps" dinamicamente entre "Principal" e "Sistema"
// 3. Cada app ativo vira um SidebarMenuItem com:
//    - href: `/dashboard/apps/${app.slug}`
//    - icon: ícone dinâmico (lucide por nome ou imagem)
//    - label: app.name
```

### 5.3 Rotas das páginas de apps

```
src/app/(dashboard)/dashboard/apps/
  page.tsx                    → Catálogo/marketplace (tenant_admin vê ativação, tenant_user vê ativos)
  [appSlug]/
    page.tsx                  → Página do app (iframe ou componente interno)
    settings/
      page.tsx                → Config do app (tenant_admin only)
```

---

## 6. Frontend: feature `apps`

### 6.1 Estrutura de pastas

```
src/features/apps/
  app/
    components/
      # Catálogo (marketplace)
      app-catalog-grid.tsx            → grid responsivo de cards (agrupado por categoria)
      app-catalog-card.tsx            → card estilo App Store (ícone, nome, tagline, badge status)
      app-featured-carousel.tsx       → carousel dos apps isFeatured (banner grande)
      app-catalog-filters.tsx         → busca + filtro por categoria
      app-status-badge.tsx            → badge de status (Ativo, Instalar, Configurar)

      # Detalhe do app
      app-detail-header.tsx           → header com ícone, nome, tagline, accentColor, botão ação
      app-screenshot-carousel.tsx     → carrossel horizontal de screenshots com zoom/lightbox
      app-detail-info.tsx             → seção "Sobre" (markdown renderizado) + metadados

      # Ativação e config
      app-activation-dialog.tsx       → dialog de ativação com form dinâmico (configSchema)
      app-config-form.tsx             → form de configuração renderizado do configSchema

      # Iframe
      app-iframe-container.tsx        → container do iframe com loading/error/postMessage

      # Admin (super_admin) — cadastro estilo App Store
      admin-app-wizard.tsx            → wizard 3 etapas (identidade, técnico, preview)
      admin-app-icon-upload.tsx       → upload de ícone com crop e preview circular
      admin-app-screenshot-upload.tsx → upload múltiplo com drag & drop e reordenação
      admin-app-preview-card.tsx      → preview do card como aparece no catálogo
      admin-app-preview-detail.tsx    → preview da página de detalhe
      admin-app-list.tsx              → lista de apps cadastrados (tabela com status)
      admin-app-config-schema-editor.tsx → editor visual do configSchema (campos dinâmicos)

    hooks/
      use-active-apps.ts              → React Query: apps ativos do tenant (sidebar)
      use-app-catalog.ts              → React Query: catálogo com filtros e busca
      use-app-detail.ts               → React Query: detalhe de um app com screenshots
      use-app-activation.ts           → mutation: ativar/desativar
      use-app-config.ts               → mutation: salvar config
      use-admin-app-form.ts           → react-hook-form: wizard de cadastro do app
      use-admin-app-screenshots.ts    → gerenciamento de upload/reorder/delete de screenshots

    pages/
      apps-catalog-page.tsx           → marketplace com grid + featured + filtros
      app-detail-page.tsx             → página de detalhe (screenshots, descrição, ação)
      app-render-page.tsx             → renderização do app (iframe ou componente interno)

    services/
      apps.service.ts                 → chamadas HTTP (catálogo, ativação, config)
      admin-apps.service.ts           → chamadas HTTP admin (CRUD, upload, screenshots)

    types/
      api.ts                          → reexport de @/types/api/apps-v1.ts
```

### 6.2 Iframe container

O componente `AppIframeContainer` é responsável por:

1. **Renderizar o iframe** com a URL do app, interpolando variáveis de contexto:
   - `{{tenantId}}` → ID do tenant ativo
   - `{{locale}}` → locale do usuário (pt-BR, en)
   - `{{userId}}` → ID do usuário
   - `{{theme}}` → tema atual (light/dark)

2. **Comunicação via postMessage**:
   - `submanager:init` → envia contexto inicial ao app (tenantId, locale, theme, user básico)
   - `submanager:navigate` → app pode solicitar navegação no dashboard
   - `submanager:toast` → app pode disparar toast no dashboard
   - `submanager:resize` → app pode solicitar resize do container
   - `submanager:token-request` → app pode solicitar token temporário para APIs do SubManager

3. **Segurança do iframe**:
   - `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`
   - `referrerPolicy="no-referrer"`
   - Validar `origin` no `message` event listener
   - CSP headers para permitir o domínio do app

4. **Loading/Error states**:
   - Skeleton durante carregamento
   - Error boundary com retry
   - Timeout de 15s para considerar falha

### 6.3 Form de configuração dinâmico

O campo `App.configSchema` contém um JSON Schema que descreve os campos de configuração. O `AppConfigForm` renderiza automaticamente:

```json
// Exemplo de configSchema para um app de chatbot IA:
{
  "fields": [
    {
      "key": "apiKey",
      "label": { "pt-BR": "Chave da API", "en": "API Key" },
      "type": "secret",
      "required": true,
      "placeholder": "sk-..."
    },
    {
      "key": "webhookUrl",
      "label": { "pt-BR": "URL do Webhook", "en": "Webhook URL" },
      "type": "url",
      "required": false
    },
    {
      "key": "model",
      "label": { "pt-BR": "Modelo", "en": "Model" },
      "type": "select",
      "options": ["gpt-4", "claude-3"],
      "default": "claude-3"
    }
  ]
}
```

Tipos de campo suportados: `text`, `secret`, `url`, `email`, `number`, `boolean`, `select`, `textarea`.

Campos do tipo `secret` são criptografados com `encryptTenantSecret()` antes de persistir (mesmo padrão do WhatsApp).

---

## 7. Admin: gestão do catálogo (super_admin)

### 7.1 Onde fica

**Opção recomendada:** Nova seção "Apps" dentro de Settings (`#apps`), visível apenas para `super_admin`. Segue o padrão existente do `SuperAdminTenantsCard`.

Conteúdo:
- Listagem de todos os apps cadastrados (com status publicado/rascunho)
- Formulário de criação/edição estilo App Store (wizard multi-step)
- Configuração do `configSchema` (editor JSON ou form builder básico)
- Preview em tempo real do card e da página de detalhe

### 7.2 Formulário de cadastro do app (estilo App Store)

O cadastro é um **wizard de 3 etapas** para guiar o super_admin na criação do app com visual profissional:

#### Etapa 1 — Identidade visual

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `name` | text | ✅ | Nome do app exibido no catálogo |
| `tagline` | text | ❌ | Frase curta de destaque (ex.: "Conecte sua clínica ao WhatsApp") |
| `slug` | text | ✅ | Auto-gerado do name, editável. Usado na URL `/dashboard/apps/{slug}` |
| `description` | rich textarea (markdown) | ❌ | Descrição longa com formatação — suporta markdown, aparece na página de detalhe |
| Ícone | upload (drag & drop) | ✅ | Imagem quadrada (mínimo 256×256, recomendado 512×512). Aceita PNG/SVG/WebP. Preview com crop circular |
| Screenshots | upload múltiplo (drag & drop) | ❌ | Até 8 imagens. Reordenáveis por drag & drop. Cada uma aceita legenda i18n (pt-BR / en). Resolução recomendada: 1280×720 |
| `accentColor` | color picker | ❌ | Cor de destaque do card e header. Fallback: cor primária do tema |
| `developerName` | text | ❌ | Nome do provedor/desenvolvedor |
| `developerUrl` | url | ❌ | Site do desenvolvedor |
| `category` | select | ✅ | Categoria do app (communication, ai, scheduling, clinical, financial, integration) |

#### Etapa 2 — Configuração técnica e pricing

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `renderMode` | radio group | ✅ | `iframe` / `internal` / `external_link` |
| `iframeBaseUrl` | text | condicional | Aparece se `renderMode = iframe`. Suporta variáveis: `{{tenantId}}`, `{{locale}}`, `{{userId}}`, `{{theme}}` |
| `internalRoute` | text | condicional | Aparece se `renderMode = internal`. Rota do dashboard |
| `requiresConfig` | toggle | ❌ | Se ativo, mostra editor de `configSchema` |
| `configSchema` | JSON editor | condicional | Editor visual de campos de configuração (chave, tipo, obrigatório, placeholder) |
| `isFeatured` | toggle | ❌ | Destacar no catálogo com banner grande |
| `sortOrder` | number | ❌ | Ordem no catálogo (menor = primeiro) |
| `metadata` | JSON editor | ❌ | Links de docs, changelog, privacy policy, terms of service |
| **Pricing** | | | |
| `pricingModel` | select | ✅ | `free` / `flat` / `per_seat` / `usage_based` |
| `priceInCents` | currency input | condicional | Aparece se `pricingModel !== free`. Input com máscara R$ (salva em centavos) |
| `priceCurrency` | select | ❌ | Moeda ISO 4217 (default: BRL) |
| `billingInterval` | radio | condicional | `monthly` / `yearly`. Aparece se `pricingModel !== free` |
| `trialDays` | number | ❌ | Dias de trial gratuito (0 = sem trial). Aparece se `pricingModel !== free` |

#### Etapa 3 — Preview e publicação

- **Preview do card** como aparece no catálogo (grid card com ícone, nome, tagline, categoria)
- **Preview da página de detalhe** (header com ícone + accentColor, descrição markdown renderizada, galeria de screenshots com carrossel)
- Toggle de **publicação** (rascunho vs publicado)
- Botão "Salvar rascunho" e "Publicar"

### 7.3 UX do catálogo (tenant_admin / tenant_user)

A página `/dashboard/apps` segue o layout de App Store:

```
┌─────────────────────────────────────────────────┐
│  🔍 Buscar apps...              [Filtro: Todos] │
├─────────────────────────────────────────────────┤
│                                                 │
│  ★ Em destaque (carousel de apps isFeatured)    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │  [icon]  │ │  [icon]  │ │  [icon]  │        │
│  │  App 1   │ │  App 2   │ │  App 3   │        │
│  │  tagline │ │  tagline │ │  tagline │        │
│  └──────────┘ └──────────┘ └──────────┘        │
│                                                 │
│  Comunicação                                    │
│  ┌──────┐ ┌──────┐                              │
│  │ icon │ │ icon │                              │
│  │ name │ │ name │                              │
│  │[Ativo]│ │[Instalar]│                         │
│  └──────┘ └──────┘                              │
│                                                 │
│  Inteligência Artificial                        │
│  ┌──────┐                                       │
│  │ icon │                                       │
│  │ name │                                       │
│  │[Instalar]│                                   │
│  └──────┘                                       │
└─────────────────────────────────────────────────┘
```

**Card do catálogo:** Ícone (rounded), nome, tagline, badge de categoria, badge de status (Ativo/Instalar/Configurar), accentColor como borda ou highlight sutil.

**Página de detalhe do app** (ao clicar no card):

```
┌─────────────────────────────────────────────────┐
│  ← Voltar                                       │
│                                                 │
│  ┌────┐  App Name                               │
│  │icon│  Tagline do app aqui                     │
│  └────┘  por Developer Name    [Ativar / Abrir] │
│          ───────────────────────                 │
│                                                 │
│  ┌─ Screenshots (carrossel horizontal) ────────┐│
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐        ││
│  │ │ screen1 │ │ screen2 │ │ screen3 │        ││
│  │ │         │ │         │ │         │        ││
│  │ │  (zoom  │ │         │ │         │        ││
│  │ │  click) │ │         │ │         │        ││
│  │ └─────────┘ └─────────┘ └─────────┘        ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Sobre este app                                 │
│  ─────────────                                  │
│  Descrição longa renderizada em markdown...     │
│  Com parágrafos, listas, negrito, etc.          │
│                                                 │
│  Informações                                    │
│  ─────────────                                  │
│  Categoria: Comunicação                         │
│  Desenvolvedor: SubManager                         │
│  Site: https://...                              │
│  Versão: 1.0.0 (do metadata)                   │
└─────────────────────────────────────────────────┘
```

### 7.4 Upload de ícone e screenshots

Segue o padrão existente de `FileAsset` do projeto:

- **Storage:** GCS com chave `apps/{appId}/icon.{ext}` e `apps/{appId}/screenshots/{screenshotId}.{ext}`
- **Validação:**
  - Ícone: PNG/SVG/WebP, max 2MB, dimensão mínima 256×256
  - Screenshots: PNG/JPG/WebP, max 5MB cada, máximo 8 por app
- **Presign:** URL assinada com TTL curto para exibição no catálogo
- **Thumbnails:** Gerar thumbnails menores para os cards do catálogo (128×128 para ícone, 400×225 para screenshot thumb)

---

## 8. Migração do WhatsApp

### 8.1 Plano de migração

| Etapa | O que fazer | Impacto |
|-------|-------------|---------|
| 1 | Criar migration com modelos `App`, `TenantApp`, enums | Zero — aditiva |
| 2 | Seed: inserir `App` com `slug: "whatsapp"`, `renderMode: internal` | Zero |
| 3 | Script: para cada `Tenant` com `whatsappEnabled: true`, criar `TenantApp` com `status: active` | Zero — dados complementares |
| 4 | Criar rota `/dashboard/apps/whatsapp` que renderiza `WhatsAppSettingsCard` existente | Nova rota, componente existente |
| 5 | Atualizar sidebar para mostrar WhatsApp no grupo "Apps" em vez de em Settings | UX muda, funcionalidade intacta |
| 6 | Remover seção "whatsapp" do Settings | UX cleanup |
| 7 | (futuro) Migrar campos `whatsapp*` do Tenant para `TenantApp.configEncrypted` | Refactor de dados |

### 8.2 Retrocompatibilidade

Durante a fase de transição, a API `/api/v1/tenant/whatsapp` continua funcionando normalmente. A nova API `/api/v1/tenant/apps/whatsapp/config` pode coexistir e gradualmente substituir.

---

## 9. Gaps identificados e considerações

### 9.1 Segurança do iframe

- **CSP (Content Security Policy):** Hoje o Next.js pode ter CSP restritiva. Será necessário configurar `frame-src` dinamicamente para permitir os domínios dos apps ativos. Isso pode ser feito via middleware do Next.js que consulta os apps ativos.
- **Token de autenticação para iframes:** Apps externos precisarão de um token temporário (short-lived, scoped) para chamar APIs do SubManager em nome do tenant. Proposta: endpoint `/api/v1/tenant/apps/:appId/token` que gera JWT com escopo limitado ao app.
- **Clickjacking:** O iframe do app externo pode tentar redirecionar ou exibir conteúdo malicioso. O `sandbox` attribute mitiga isso parcialmente.

### 9.2 Billing e assinatura

O modelo de dados já está **preparado** para cobrança por assinatura. Os campos de billing nos modelos `App` e `TenantApp` existem desde a v1 mas ficam inativos (todos os apps com `pricingModel: free`) até que uma plataforma de billing seja escolhida.

#### Plataformas candidatas

| Plataforma | Prós | Contras |
|------------|------|---------|
| **Stripe** | Referência global, API excelente, webhooks robustos | Tarifa mais alta para BRL; exige conta no exterior para receber |
| **Pagar.me** | Brasileiro, boleto/PIX nativo, bom suporte | API menos madura que Stripe |
| **Asaas** | Brasileiro, assinatura + cobrança recorrente nativa, PIX | Menos documentação |
| **Vindi** | Foco em recorrência, bom para SaaS | Interface administrativa fraca |

A arquitetura foi desenhada para ser **agnóstica à plataforma** — a integração concreta fica em `infrastructure/billing/`.

#### Fluxo de ativação com billing (futuro)

```
tenant_admin clica "Ativar" no app pago
  │
  ├─ App.pricingModel === "free"?
  │   └─ SIM → ativa direto (fluxo atual)
  │
  └─ NÃO → abre checkout
        │
        ├─ App.trialDays > 0?
        │   └─ SIM → cria TenantApp com subscriptionStatus: "trialing"
        │            trialStartedAt: now, trialEndsAt: now + trialDays
        │            app fica ATIVO durante trial
        │
        └─ NÃO → redireciona para checkout da plataforma externa
                  │
                  ├─ Webhook "payment_success" → subscriptionStatus: "active"
                  │                               TenantApp.status: "active"
                  │
                  └─ Webhook "payment_failed"  → subscriptionStatus: "past_due"
                                                  grace period (X dias)
                                                  notifica tenant_admin
```

#### Webhooks de billing (futuro)

```
POST /api/v1/webhooks/billing
  │
  ├─ Valida assinatura do webhook (secret por plataforma)
  ├─ Identifica TenantApp via externalSubscriptionId
  │
  ├─ Eventos tratados:
  │   ├─ subscription.created     → subscriptionStatus = "active"
  │   ├─ subscription.trial_end   → se não pagou → "past_due"
  │   ├─ invoice.paid             → renova currentPeriodEnd
  │   ├─ invoice.payment_failed   → subscriptionStatus = "past_due"
  │   ├─ subscription.canceled    → subscriptionStatus = "canceled"
  │   │                             agenda desativação em X dias (grace)
  │   └─ subscription.deleted     → TenantApp.status = "inactive"
  │
  └─ Idempotência via eventId do webhook
```

#### Port de billing (interface)

```typescript
// src/application/ports/billing-provider.port.ts

export interface IBillingProvider {
  /** Cria checkout session para o tenant assinar o app */
  createCheckoutSession(params: {
    tenantId: string;
    appId: string;
    externalProductId: string;
    pricingModel: AppPricingModel;
    priceInCents: number;
    currency: string;
    billingInterval: AppBillingInterval;
    seatCount?: number;               // para per_seat
    trialDays?: number;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ checkoutUrl: string; sessionId: string }>;

  /** Cancela assinatura (com grace period da plataforma) */
  cancelSubscription(externalSubscriptionId: string): Promise<void>;

  /** Reativa assinatura cancelada (se dentro do grace period) */
  reactivateSubscription(externalSubscriptionId: string): Promise<void>;

  /** Gera URL do portal de billing do cliente (faturas, cartão, etc.) */
  getCustomerPortalUrl(tenantId: string): Promise<string>;

  /** Valida assinatura do webhook */
  validateWebhookSignature(payload: string, signature: string): boolean;

  /** Parseia evento do webhook para formato interno */
  parseWebhookEvent(payload: string): BillingWebhookEvent;
}
```

Implementações futuras em `src/infrastructure/billing/`:
- `stripe-billing-provider.ts`
- `pagarme-billing-provider.ts`
- `noop-billing-provider.ts` (default — aceita tudo, usado enquanto billing não está ativo)

#### UX de pricing no catálogo

O card e a página de detalhe do app mostram o preço quando `pricingModel !== "free"`:

```
┌──────────────────────┐
│      [ícone]         │
│    Nome do App       │
│    Tagline aqui      │
│                      │
│  R$ 49,90/mês        │  ← formatado com Intl.NumberFormat + billingInterval
│  7 dias grátis       │  ← aparece se trialDays > 0
│                      │
│  [ Experimentar ]    │  ← "Experimentar" se tem trial, "Assinar" se não
│  ou [ Ativo ✓ ]      │
└──────────────────────┘
```

Para `per_seat`: exibe "R$ 9,90/usuário/mês" e calcula estimativa baseada no número de membros do tenant.

#### O que NÃO fazer agora

- **Não** integrar com nenhuma plataforma de billing ainda
- **Não** implementar cobrança real — todos os apps ficam `pricingModel: free`
- **Não** implementar webhooks de billing
- Os campos de billing existem no banco mas são **informativos** (super_admin preenche preço para exibir no catálogo)
- A ativação ignora pricing e funciona como se fosse free até a integração de billing ser implementada

#### Checklist para ativar billing no futuro

Quando a plataforma for escolhida, será necessário:

1. [ ] Implementar `IBillingProvider` para a plataforma escolhida
2. [ ] Rota `POST /api/v1/webhooks/billing` com validação de assinatura
3. [ ] Rota `POST /api/v1/tenant/apps/:appId/checkout` que gera checkout session
4. [ ] Rota `GET /api/v1/tenant/billing/portal` para portal de faturas
5. [ ] Cron job para verificar trials expirados (diário)
6. [ ] Cron job para desativar apps com `past_due` > grace period
7. [ ] Notificações: trial expirando, pagamento falhou, app será desativado
8. [ ] UI: modal de checkout, banner de trial, aviso de pagamento pendente
9. [ ] Seed: configurar `externalProductId` para cada app pago na plataforma
10. [ ] Testes: simular ciclo completo (trial → ativo → cancelamento → reativação)

### 9.3 Versionamento de apps

- Apps externos podem mudar de versão. O campo `App.metadata` pode conter `version`, mas não há mecanismo de:
  - Notificação de atualização disponível
  - Changelog para o tenant_admin
  - Rollback de versão
- **Recomendação:** Para v1, manter simples. Versioning pode ser adicionado quando houver demanda real.

### 9.4 Health check e monitoramento

- Apps iframe podem ficar fora do ar. Considerar:
  - `TenantApp.lastHealthCheckAt` e `healthStatus` para monitorar
  - Endpoint periódico que verifica se a `iframeBaseUrl` responde (cron job ou BullMQ)
  - Badge visual no menu "Apps" se um app está degradado
- **Para v1:** Apenas timeout no iframe + error state no UI.

### 9.5 Permissões granulares por app

- O modelo atual permite ativação binária (ativo/inativo). Pode surgir necessidade de:
  - Permissões por app por role (ex.: apenas cirurgiões acessam app de prontuário)
  - `TenantAppPermission` (tenantAppId, membershipId, permissions[])
- **Para v1:** Todos os membros do tenant veem apps ativos. Granularidade posterior.

### 9.6 Webhooks de saída (app → SubManager)

- Apps externos podem precisar notificar o SubManager de eventos (ex.: chatbot completou atendimento, agendamento confirmado).
- Necessário:
  - `App.webhookSecret` para validar assinatura
  - Rota genérica `/api/v1/webhooks/apps/:appSlug` que roteia para handler específico
  - Registro de webhook por `TenantApp` (URL de callback do SubManager para o app)
- **Para v1:** Implementar apenas para apps que precisam (caso a caso).

### 9.7 Dados compartilhados entre apps

- Um app de chatbot pode precisar dos dados de `Client` para contextualizar a conversa. Escopos de API a serem definidos:
  - `clients:read` — ler dados de pacientes
  - `pathways:read` — ler jornadas
  - `files:read` — ler documentos
  - `notifications:write` — criar notificações
- O token gerado para o iframe teria esses escopos conforme configurado no `App`.

### 9.8 Experiência offline/degraded

- Se o Redis estiver fora, a sidebar dinâmica que depende de React Query pode falhar. Garantir:
  - Fallback para sidebar sem grupo "Apps" se a query falhar
  - Cache local (React Query persisted cache) para não piscar

### 9.9 i18n do catálogo

- O `App.name` e `App.description` são strings simples. Para i18n:
  - Opção A: `App.nameI18n` como JSON (`{ "pt-BR": "...", "en": "..." }`)
  - Opção B: Chaves de tradução em `messages/` e `App.nameKey` como referência
- **Recomendação:** Opção A (JSON) é mais flexível para apps cadastrados dinamicamente.

### 9.10 Rate limiting por app

- Apps iframe que usam token para acessar APIs do SubManager precisam de rate limiting separado para evitar que um app bugado degrade o tenant inteiro.
- Adicionar preset `rate_limit_app` com limite por `(tenantId, appId)`.

### 9.11 Desativação em cascata

- Quando um `super_admin` despublica um `App`, todos os `TenantApp` devem mudar para `status: suspended` com notificação aos tenant_admins.
- Quando o app é republicado, os suspended voltam ao estado anterior (necessário campo `previousStatus`).

---

## 10. Fases de implementação

### Fase 1 — Fundação + Catálogo visual (MVP) ✅

- [x] Modelos Prisma (`App`, `AppScreenshot`, `TenantApp`, enums) + migration
- [x] Relações `FileAsset` para ícone e screenshots
- [x] Seed com apps de exemplo (WhatsApp, Chatbot IA, Agendamento Pro)
- [x] API admin: CRUD de apps (`/api/v1/admin/apps`) — list, create, update, delete, publish
- [x] API admin: upload de ícone (`POST/DELETE /admin/apps/:appId/icon`)
- [x] API admin: upload/reorder/delete de screenshots (`POST/DELETE /admin/apps/:appId/screenshots`)
- [x] API tenant: catálogo, ativação, desativação, apps ativos (`/api/v1/tenant/apps`)
- [x] Wizard de cadastro do app (3 etapas: identidade + config/pricing + preview)
- [x] Upload de ícone com drag & drop, validação tipo/tamanho, deferred em create mode
- [x] Upload múltiplo de screenshots com preview grid e reorder
- [x] Preview do card na etapa 3 do wizard (com ícone real + contagem de screenshots)
- [x] Componente `AppIcon` reutilizável (4 tamanhos, fallback com accentColor)
- [x] Página do catálogo estilo App Store (`/dashboard/apps`) com grid + busca + filtro por categoria + featured
- [x] Página de detalhe do app (header, screenshots, descrição, info, pricing)
- [x] Sidebar dinâmica com grupo "Apps" (apps ativos com ícone real)
- [x] Migração do WhatsApp para dentro do menu Apps (renderMode: internal, removido do Settings nav)
- [x] Seção "Apps" no Settings para super_admin (listagem, publish/unpublish, delete, create, edit)
- [x] Tipos TypeScript de API (`apps-v1.ts`) + validators Zod (`lib/validators/app.ts`)
- [x] Services HTTP (tenant: `apps.service.ts`, admin: `admin-apps.service.ts`, upload: `admin-app-upload.service.ts`)
- [x] Hooks: useActiveApps, useAppCatalog, useAppDetail, useAppActivation
- [x] i18n completo (pt-BR e en) — 140+ chaves
- [x] OpenAPI documentado (`public/openapi.json`) — rotas admin e tenant

### Fase 2 — Iframe + Ativação ✅

- [x] App Viewer com iframe (interpolação de variáveis: tenantId, locale, userId, theme)
- [x] App Viewer com external_link (botão "Abrir app" em nova aba)
- [x] App Viewer com internal (registry de componentes — WhatsApp mapeado)
- [x] Token scoped para iframe — JWT 15min via `POST /api/v1/tenant/apps/:appId/token` (`jose` HS256)
- [x] Lib `app-scoped-token.ts` com `generateAppScopedToken` / `verifyAppScopedToken`
- [x] CSP dinâmico via middleware (`ALLOWED_IFRAME_ORIGINS` env var + security headers)
- [x] Error boundary + timeout (15s) no iframe com retry
- [x] postMessage protocol completo:
  - Host→Iframe: `submanager:init` (context + token), `submanager:theme`
  - Iframe→Host: `submanager:ready`, `submanager:navigate`, `submanager:toast`, `submanager:resize`, `submanager:token-request`
  - Validação de origin em todas as mensagens
- [x] Hook `useIframeProtocol` — gerencia comunicação bidirecional
- [x] Tipos tipados em `iframe-protocol.ts` com type guard `isIframeToHostMessage`
- [x] Dialog de confirmação de desativação (`AppDeactivateDialog`)
- [x] Formulário de config dinâmico (configSchema) na ativação (`AppConfigForm`)
- [x] IframeViewer com resize dinâmico via postMessage

### Fase 3 — Configuração dinâmica ✅

- [x] Renderização de form dinâmico a partir de `configSchema` (8 tipos: text, secret, url, email, number, boolean, select, textarea)
- [x] Criptografia de campos `secret` — AES-256-GCM (`encryptConfigSecrets` / `decryptConfigSecrets` / `maskConfigSecrets`)
- [x] configSummary mascarado na API (`••••••` para secrets)
- [x] Endpoint de test connection — `POST /api/v1/tenant/apps/:appId/test` (chama `metadata.healthCheckUrl`, usa apiKey decriptado)
- [x] Webhooks de entrada — `POST /api/v1/webhooks/apps/:appSlug` (HMAC-SHA256, Zod schema, verificação tenant ativo)

---

### O que falta fazer

#### Pendências menores (quick wins)

- [x] Atualizar `public/openapi.json` com rotas novas: `/tenant/apps/:appId/token`, `/tenant/apps/:appId/test`, `/webhooks/apps/:appSlug`
- [x] Lightbox/zoom nas screenshots da página de detalhe (Dialog com navegação prev/next)
- [x] Primeiro app externo integrado como PoC (`public/app-poc/index.html` — valida fluxo iframe + postMessage + token)

#### Fase 4 — Billing e assinatura (requer decisão de produto)

- [ ] Escolher plataforma de billing (Stripe, Pagar.me, Asaas, etc.)
- [ ] Implementar `IBillingProvider` para a plataforma escolhida
- [ ] `NoopBillingProvider` como fallback (já existe implícito na v1)
- [ ] Rota `POST /api/v1/webhooks/billing` com validação de assinatura
- [ ] Rota `POST /api/v1/tenant/apps/:appId/checkout` → gera checkout session
- [ ] Rota `GET /api/v1/tenant/billing/portal` → portal de faturas do cliente
- [ ] Cron job: verificar trials expirados (diário)
- [ ] Cron job: desativar apps com `past_due` > grace period
- [ ] UI: badge de trial no card, modal de checkout, banner "trial expira em X dias"
- [ ] UI: aviso de pagamento pendente para tenant_admin
- [ ] Notificações: trial expirando (3 dias, 1 dia), pagamento falhou, app desativado
- [ ] Relatório de billing para super_admin (MRR, churn, trial conversions)

#### Fase 5 — Maturidade (sob demanda)

- [ ] Health check periódico de apps iframe (cron/BullMQ + badge de status)
- [ ] Permissões granulares por app por role (`TenantAppPermission`)
- [ ] i18n do catálogo (campos JSON i18n no `App` — `nameI18n`, `descriptionI18n`)
- [ ] Rate limiting por app (preset `rate_limit_app` por `tenantId + appId`)
- [ ] Métricas de uso por app (analytics dashboard)
- [ ] Notificações de status do app (degradação, manutenção)
- [ ] Desativação em cascata ao despublicar app (`suspended` + notificação)

---

## 11. Tipos TypeScript (referência)

```typescript
// src/types/api/apps-v1.ts

// ─── Enums ──────────────────────────────────────

export type AppCategory = "communication" | "ai" | "scheduling" | "clinical" | "financial" | "integration";
export type AppRenderMode = "iframe" | "internal" | "external_link";
export type TenantAppStatus = "pending_config" | "active" | "suspended" | "inactive";
export type AppPricingModel = "free" | "flat" | "per_seat" | "usage_based";
export type AppBillingInterval = "monthly" | "yearly";
export type SubscriptionStatus = "none" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "suspended";

// ─── DTOs de leitura ────────────────────────────

export type AppScreenshotDto = {
  id: string;
  imageUrl: string;           // URL presigned do GCS
  caption: Record<string, string> | null;  // i18n: { "pt-BR": "...", "en": "..." }
  sortOrder: number;
};

export type AppDto = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;     // markdown
  iconUrl: string | null;         // URL presigned do ícone
  accentColor: string | null;     // hex
  developerName: string | null;
  developerUrl: string | null;
  category: AppCategory;
  renderMode: AppRenderMode;
  iframeBaseUrl: string | null;
  internalRoute: string | null;
  requiresConfig: boolean;
  configSchema: AppConfigField[] | null;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
  screenshots: AppScreenshotDto[];
  // Billing
  pricingModel: AppPricingModel;
  priceInCents: number | null;
  priceCurrency: string;
  billingInterval: AppBillingInterval;
  trialDays: number;
};

/** Versão resumida para o card do catálogo (sem configSchema, sem iframeBaseUrl) */
export type AppCatalogCardDto = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  iconUrl: string | null;
  accentColor: string | null;
  developerName: string | null;
  category: AppCategory;
  isFeatured: boolean;
  // Billing (exibição no card)
  pricingModel: AppPricingModel;
  priceInCents: number | null;
  priceCurrency: string;
  billingInterval: AppBillingInterval;
  trialDays: number;
  /** Status do TenantApp (null = não instalado) */
  tenantStatus: TenantAppStatus | null;
  /** Status da assinatura (null = não instalado) */
  subscriptionStatus: SubscriptionStatus | null;
};

export type TenantAppDto = {
  id: string;
  appId: string;
  status: TenantAppStatus;
  activatedAt: string | null;
  deactivatedAt: string | null;
  app: AppDto;
  /** Config fields sem valores sensíveis (masked: "sk-****1234") */
  configSummary: Record<string, string> | null;
  // Billing
  subscriptionStatus: SubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

/** Para a sidebar — o mínimo necessário */
export type ActiveAppDto = {
  slug: string;
  name: string;
  iconUrl: string | null;
  accentColor: string | null;
  renderMode: AppRenderMode;
  internalRoute: string | null;
};

export type AppConfigField = {
  key: string;
  label: Record<string, string>;  // i18n
  type: "text" | "secret" | "url" | "email" | "number" | "boolean" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  helpText?: Record<string, string>;  // i18n
  options?: string[];
  default?: string | number | boolean;
};

// ─── Query params ───────────────────────────────

export type ListAppsQueryParams = {
  category?: AppCategory;
  search?: string;
  featured?: boolean;
};

// ─── Requests ───────────────────────────────────

export type CreateAppRequest = {
  name: string;
  slug?: string;
  tagline?: string;
  description?: string;
  category: AppCategory;
  renderMode: AppRenderMode;
  accentColor?: string;
  developerName?: string;
  developerUrl?: string;
  iframeBaseUrl?: string;
  internalRoute?: string;
  requiresConfig?: boolean;
  configSchema?: AppConfigField[];
  isFeatured?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
};

export type UpdateAppRequest = Partial<CreateAppRequest>;

export type ReorderScreenshotsRequest = {
  /** Array de screenshotId na nova ordem */
  order: string[];
};

export type ActivateAppRequest = {
  config?: Record<string, unknown>;
};

export type UpdateAppConfigRequest = {
  config: Record<string, unknown>;
};

// ─── Responses ──────────────────────────────────

export type AppCatalogResponseData = {
  featured: AppCatalogCardDto[];
  byCategory: Record<AppCategory, AppCatalogCardDto[]>;
};

export type AppDetailResponseData = AppDto & {
  tenantApp: TenantAppDto | null;
};
```

---

## 12. Resumo de decisões

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Onde vive o catálogo | Tabela `App` no mesmo banco | Simplicidade; poucos apps previsto |
| Visual do catálogo | Estilo App Store / Play Store | UX familiar; ícone, screenshots, descrição rich |
| Ícone e screenshots | `FileAsset` no GCS via `AppScreenshot` | Reusa infra existente; presign para exibição |
| Cadastro do app | Wizard 3 etapas (identidade, técnico, preview) | Guia o super_admin; preview antes de publicar |
| Renderização | iframe com postMessage | Isolamento; apps independentes do stack |
| Config dinâmica | JSON Schema em `configSchema` | Flexível; não precisa deploy para novo app |
| Migração WhatsApp | Gradual em 2 fases | Zero downtime; retrocompatível |
| Permissões v1 | Binário (ativo = todos veem) | KISS; granularidade quando houver demanda |
| i18n do catálogo | JSON nos campos (caption, helpText) | Apps dinâmicos, sem deploy para traduzir |
| Billing | Campos no schema desde v1, cobrança inativa | Preparado para qualquer plataforma; `IBillingProvider` agnóstico |
