# Backlog: o que criar/alterar no banco (Prisma)

Documento **único** que consolida mudanças de schema necessárias para os mocks SubManager e para o fluxo **colunas DnD + Kanban**.  
Detalhes por tela também citam gaps em [`pages/`](./pages/) e em [`../SUBMANAGER-INTERFACES-AND-DATA.md`](../SUBMANAGER-INTERFACES-AND-DATA.md).

**Regra:** toda tabela nova com `tenantId` quando for dado do tenant; revisar LGPD antes de campos clínicos.

---

## Já existe hoje (não precisa criar)

| Model | Uso |
|-------|-----|
| `Tenant`, `User`, `TenantMembership` | Multi-tenant, equipe |
| `Client` | Paciente básico (`name`, `phone`, `caseDescription`, `documentId`) |
| `CarePathway`, `PathwayVersion`, `PathwayStage` | Jornada e etapas ordenáveis (`sortOrder`, `stageKey`, `name`) |
| `PatientPathway` | Cliente na jornada + `currentStageId` |
| `StageTransition` | Auditoria de mudança de etapa |
| `FileAsset` | Arquivos R2 |

Com isso já é possível um **MVP** de listar estágios publicados + pacientes por etapa + transição, **sem** vários campos dos mocks.

---

## P0 — Recomendado antes ou junto ao Kanban “completo” operacional

**Implementado no schema + migration `20260328120000_pathway_sla_entered_stage_at`** (aplicar migrate no ambiente).

| # | Mudança | Model/campo | Motivo | Páginas / features |
|---|---------|-------------|--------|---------------------|
| P0.1 | Data de entrada na etapa atual | `PatientPathway.enteredStageAt` `DateTime` (atualizar em toda transição) | “Dias na fase”, alertas, status ok/warning/danger | Dashboard, lista, detalhe, relatórios |
| P0.2 | SLA por etapa (MVP) | `PathwayStage.alertWarningDays`, `alertCriticalDays` opcionais | Limiares por coluna; podem vir do `graphJson` ao publicar | Dashboard alertas, config fases |

*Índice sugerido:* `(tenantId)` já em entidades filhas; em `PatientPathway` considerar índice para queries Kanban `(pathwayVersionId, currentStageId)` se ainda não houver.

---

## P1 — Paridade com lista/detalhe/settings dos mocks

| # | Mudança | Model/campo | Motivo | Páginas |
|---|---------|-------------|--------|---------|
| P1.1 | E-mail do paciente | `Client.email String?` | Lista/tabela e detalhe | `page-patients-list`, `page-patient-detail` — **implementado** |
| P1.2 | Responsável | `Client.assignedToUserId String?` → `User` | Mock “responsável” | Dashboard modal, detalhe — **implementado** |
| P1.3 | Fornecedor OPME | Nova `OpmeSupplier` (`id`, `tenantId`, `name`, `active`) + `Client.opmeSupplierId String?` | Filtros e badges OPME | Dashboard, lista, relatórios, settings — **implementado** (cadastro rápido na ficha para `tenant_admin`) |
| P1.4 | Dados da clínica | `Tenant` campos extras **ou** `TenantSettings Json` / model `TenantClinicProfile` | CNPJ, endereço, hospitais | `page-settings` clínica |

---

## P2 — Documentos por etapa e dispatch (arquitetura §8)

| # | Mudança | Motivo |
|---|---------|--------|
| P2.1 | `StageDocument` (etapa ↔ arquivo/template ordenado) | Preview no modal de fase, pacote no envio — **modelo + API POST + detalhe GET**; associar arquivos: `POST /api/v1/stage-documents` |
| P2.2 | Evolução de `ChannelDispatch` / tabela dedicada | Rastrear envio WhatsApp, status |
| P2.3 | Ligação estágio ↔ checklist template (**feito**) | Checklist no detalhe do paciente |

*(Nomes exatos alinhar com `docs/ARCHITECTURE.md` na hora de modelar.)*

---

## P3 — Checklist, notas, convênio, relatórios avançados

| # | Mudança | Motivo |
|---|---------|--------|
| P3.1 | `PathwayStageChecklistItem` + progresso por `PatientPathway` (**feito**) | UI checklist do mock |
| P3.2 | `PatientNote` ou notas versionadas (**feito**) | Anotações no detalhe |
| P3.3 | `InsuranceAuthorization` ou campos em `Client` | Alerta “prazo convênio” |
| P3.4 | Eventos de cirurgia / datas agendadas | KPIs “cirurgias agendadas/realizadas” nos relatórios |

---

## O que **não** exige migration imediata

- **Ordem das colunas:** já coberto por `PathwayStage.sortOrder` (ajustar só use case de publicação).
- **`graphJson`:** pode permanecer mínimo/derivado conforme [persistence-api-and-transitions.md](./persistence-api-and-transitions.md).

---

## Próximos passos técnicos

1. Producto escolhe até onde vai o MVP (ideal: **P0** + fluxo publicar estágios).  
2. `npx prisma migrate dev` com mudanças aprovadas.  
3. Atualizar seed para dados de teste (SLA, `enteredStageAt`).  
4. Skill **docs-alignment**: após merge do schema, alinhar `ARCHITECTURE.md` §8 se o modelo divergir da doc.

---

## Relacionado

- [execution-plan.md](./execution-plan.md) — **em qual fase** cada backlog entra.  
- [../SUBMANAGER-INTERFACES-AND-DATA.md](../SUBMANAGER-INTERFACES-AND-DATA.md) — lista original de gaps (§5).  
- [pages/entity-to-pages-matrix.md](./pages/entity-to-pages-matrix.md)
