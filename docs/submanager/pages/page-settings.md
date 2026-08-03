# Página: Configurações

## Origem do mock

- **Arquivo:** [`arquivos-interfaces/configuracoes.html`](../../../arquivos-interfaces/configuracoes.html)
- **Layout:** sidebar interna com seções + área de conteúdo.

## Objetivo no produto

Centralizar **perfil**, **dados da clínica**, **fases do tratamento** (DnD + SLA), **notificações**, **equipe**, **fornecedores OPME** e **integrações**. No código atual, **perfil/segurança/equipe** passaram a viver na própria `settings`; a rota antiga de conta virou apenas redirecionamento compatível para `/dashboard/settings`. Para `super_admin`, a página também expõe um bloco adicional de **gestão global de tenants** (fora do mock original).

**Listagens:** equipe, OPME, convites e quaisquer tabelas CRUD nesta área seguem [../listings-pagination-and-filters.md](../listings-pagination-and-filters.md) (paginação obrigatória). **Editor DnD de fases:** a lista vertical de etapas deve suportar **virtualização ou paginação** quando o número de linhas passar do limite acordado (evitar DOM e `graphJson` gigantes).

---

## Rota sugerida

- Atual: `/[locale]/dashboard/settings` com seções na mesma página:
  - perfil e segurança do usuário
  - dados da clínica do tenant ativo
  - equipe / convites
  - fornecedores OPME
  - editor de fases do tratamento
  - gestão de tenants para `super_admin`
- Evolução natural: manter a mesma rota e introduzir **sub-rotas ou tabs** alinhadas ao mock:
  - `/dashboard/settings/profile`
  - `/dashboard/settings/clinic`
  - `/dashboard/settings/pathway-stages`
  - `/dashboard/settings/notifications`
  - `/dashboard/settings/team`
  - `/dashboard/settings/opme`
  - `/dashboard/settings/integrations`

`/dashboard/account` fica como rota legada e deve redirecionar para `settings`, sem nova lógica própria.

Ou uma única página com `Tabs`/`Sidebar` client-side (como o mock).

---

## Seções do mock → feature → dados

### 1. Perfil (`section-profile`)

| Campo mock | Persistência sugerida |
|------------|------------------------|
| Nome, e-mail, telefone | `User` (+ NextAuth) |
| CRO, especialidade | **Gap:** `User.metadata` JSON ou tabela `ProfessionalProfile` |

**Backend:** `PATCH /api/v1/users/me` ou rota já existente de perfil.  
**Frontend:** já consolidado em `settings` com cards de perfil, senha e desativação de conta.

---

### 2. Clínica (`section-clinic`)

| Campo mock | Persistência sugerida |
|------------|------------------------|
| Nome da clínica | `Tenant.name` |
| CNPJ, telefone, endereço, cidade, CEP | **Implementado:** `Tenant.taxId`, `Tenant.phone`, `Tenant.addressLine`, `Tenant.city`, `Tenant.postalCode` |
| Hospitais conveniados (textarea) | **Implementado:** `Tenant.affiliatedHospitals` (`TEXT`) |

**Backend:** `GET|PATCH /api/v1/tenant` no **tenant ativo**; `PATCH` restrito a `tenant_admin` / `super_admin`.  
**Frontend:** `ClinicSettingsCard` na `SettingsPage`, com formulário, reload, toast e bloqueio visual para quem não pode editar. **Pendência opcional:** máscara/validação mais específica de CNPJ/CEP se o produto exigir.

---

### 3. Fases do tratamento (`section-phases`)

| Comportamento mock | Implementação real |
|--------------------|---------------------|
| Lista de fases com “alerta após N dias” e “X documentos automáticos” | **Ordem e CRUD de colunas:** lista **DnD** ([../column-editor-drag-drop.md](../column-editor-drag-drop.md)); SLA por etapa em metadata; checklist por etapa no rascunho/publicação; contagem de docs quando `StageDocument` existir |

**Backend:** mesmos endpoints de [../persistence-api-and-transitions.md](../persistence-api-and-transitions.md) + eventual `PATCH` em metadata de SLA por `PathwayStage`.  
**Frontend:** substituir inputs estáticos do HTML por editor conectado à API + botão Publicar.

---

### 4. Notificações (`section-notifications`)

| Toggle mock | Realidade |
|-------------|-----------|
| Alertas críticos, lembretes cirurgia, novos pacientes, relatório semanal, confirmação envio docs | **Implementado parcialmente:** flags leves em `Tenant` (`notifyCriticalAlerts`, `notifySurgeryReminders`, `notifyNewPatients`, `notifyWeeklyReport`, `notifyDocumentDelivery`) |

**Backend:** `GET|PATCH /api/v1/tenant/notifications` no tenant ativo; `PATCH` restrito a `tenant_admin` / `super_admin`.  
**Frontend:** `TenantNotificationsCard` na `SettingsPage`, com toggles persistidos e feedback de save/reload. **Escopo desta rodada:** só persistência das preferências; workers/envio real continuam evolutivos.

---

### 5. Equipe (`section-team`)

| Mock | App atual |
|------|-----------|
| Lista membros, papéis, adicionar/editar/excluir | `TenantMembership` + painel consolidado em `settings` |

**Backend:** reutilizar `/api/v1/...` de membros/convites (RBAC).  
**Frontend:** alinhar ao `users-management-panel` / cards existentes.

---

### 6. Fornecedores OPME (`section-opme`)

| Mock | Persistência |
|------|----------------|
| Lista Art Fix, Evolve, etc.; contagem pacientes ativos | **Implementado parcialmente:** `OpmeSupplier` + FK em `Client`; listagem paginada com `activePatientsCount` |

**Backend:** `GET|POST /api/v1/opme-suppliers` no tenant ativo; `GET` com `page`, `limit`, `q`, `includeInactive`; `POST` restrito a `tenant_admin` / `super_admin`.  
**Frontend:** card na `SettingsPage` com busca, paginação e criação. **Pendências:** editar/inativar fornecedor.

---

### 7. Integrações (`section-integrations`)

| Mock | Notas |
|------|--------|
| WhatsApp, Google Calendar, financeiro, prontuário | **Flags** em `TenantSettings`; integrações reais em fases posteriores ([../../SUBMANAGER-INTERFACES-AND-DATA.md](../../SUBMANAGER-INTERFACES-AND-DATA.md)). **Decisão atual:** esta seção pode permanecer como **“em desenvolvimento”** / placeholder, sem fechamento funcional nesta rodada. |

**Backend:** `PATCH` settings JSON.  
**Frontend:** `Switch` + texto explicativo, ou bloco apenas informativo/placeholder enquanto as integrações reais não entram.

---

### 8. Gestão de tenants (`super_admin`)

| Escopo extra | Implementação |
|--------------|---------------|
| Criar tenant e trocar contexto explicitamente | **Implementado:** card adicional na `SettingsPage` visível só para `super_admin`, reaproveitando `POST /api/v1/admin/tenants`, `GET /api/v1/tenants` e `POST /api/v1/auth/context` |

**Backend:** já existente; mantido como fluxo de administração global.  
**Frontend:** `SuperAdminTenantsCard` com formulário de criação e botão para ativar o tenant recém-criado ou qualquer tenant listado.

---

## Backend (consolidado)

### Tabelas tocadas (direta ou indiretamente)

- `User`, `Tenant`, `TenantMembership`
- `CarePathway`, `PathwayVersion`, `PathwayStage` (fases)
- `Tenant` agora concentra os campos clínicos leves (`taxId`, `phone`, `addressLine`, `city`, `postalCode`, `affiliatedHospitals`)
- `Tenant` agora também concentra flags leves de notificações operacionais
- Novas conforme gaps restantes: perfil profissional

### Checklist backend

- [ ] Política de autorização por sub-seção (`tenant_admin` vs `tenant_user`)
- [ ] Endpoints de pathway/stages/publicação
- [ ] Listagens (membros, OPME, convites) com **paginação** e filtros quando aplicável
- [x] Migração para campos clínicos leves em `Tenant`

---

## Frontend (consolidado)

### Checklist frontend

- [ ] Navegação lateral interna/tabs espelhando seções do mock
- [x] Perfil/segurança/equipe consolidados em `settings`
- [x] Card de clínica conectado ao tenant ativo
- [x] Card de notificações com persistência simples
- [x] Card de gestão de tenants para `super_admin`
- [ ] Cada seção em componente lazy ou rota filha
- [ ] Estados salvos com feedback (toast) e tratamento de erro
- [ ] i18n para todas as strings

---

## Documentação relacionada

- [../listings-pagination-and-filters.md](../listings-pagination-and-filters.md)
- [../column-editor-drag-drop.md](../column-editor-drag-drop.md)
- [../persistence-api-and-transitions.md](../persistence-api-and-transitions.md)
- [../frontend-backend-scope.md](../frontend-backend-scope.md)
- Implementação atual: `src/features/settings/`
