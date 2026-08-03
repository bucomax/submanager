# Página: Dashboard (visão completa)

## Origem do mock

- **Arquivo:** [`arquivos-interfaces/index.html`](../../../arquivos-interfaces/index.html)
- O HTML trata **toda** a área principal (`<main>`) como o dashboard: **não é só o Kanban**. A ordem vertical do mock deve ser respeitada no produto (com adaptação ao `AppShell`).

## Objetivo no produto

Tela inicial operacional com **seis grandes áreas** além do shell global, mais **dois modais**:

1. **Cards de métricas** (4)  
2. **Alertas ativos** (lista)  
3. **Barra de ações** (Novo paciente, Relatórios, Exportar)  
4. **Filtros** (busca, fluxo, status, OPME)  
5. **Pipeline / Kanban** ("Visão por Etapas")  
6. **Modais:** novo paciente; alterar fase (+ preview de documentos)

A doc [../dashboard-kanban-dynamic-columns.md](../dashboard-kanban-dynamic-columns.md) cobre **apenas o item 5** e o DnD entre colunas. **Este arquivo** é a referência da **página inteira**.

**Paginação e filtros:** ver [../listings-pagination-and-filters.md](../listings-pagination-and-filters.md). No dashboard, **cada coluna do pipeline** deve paginar os pacientes; a lista de **alertas** também. Filtros do mock: **busca** (nome/telefone), **fluxo** (`CarePathway`), **status** (ok/warning/danger), **OPME**.

---

## Mapa da página (ordem do `index.html` → produto)

| # | Bloco no mock | Conteúdo / comportamento | Frontend | Backend / dados | Status implementação (API) |
|---|---------------|--------------------------|----------|-----------------|----------------------------|
| 1 | **Stats grid** | Total; Em dia; Atenção; Críticos (limites por etapa). Clique no card aplica filtro de status no pipeline. | `Card` ×4 na home | `GET .../dashboard-summary` | **Implementado** |
| 2 | **Alertas ativos** | Linhas: estagnação por paciente (nome + dias + fase); prazo convênio; alerta agregado ("3 pacientes…"). CTAs "Ver paciente" / "Ver lista". | `Alert` / lista em `Card` | `GET .../dashboard-alerts` (MVP: só **danger** por SLA) | **Parcial** — convênio/agregados ainda P1/P3 |
| 3 | **Barra de ações** | Novo paciente; link Relatórios; Exportar (JSON/CSV do que está visível ou relatório) | `Button`, `Link` `/reports`, export | Export: `GET` com mesmo filtro ou geração no cliente no MVP | **Implementado** — link + export CSV do pipeline (inclui filtros atuais); relatório completo em `/dashboard/reports` |
| 4 | **Filtros** | Busca nome/telefone; Fluxo (`CarePathway`); Status (ok/warning/danger); OPME | `Input`, `Select` | Filtros aplicados na query do Kanban ou pós-processamento | **Implementado** — busca/status/OPME + filtros na URL |
| 5 | **Pipeline (Kanban)** | Colunas dinâmicas; cards; DnD; avançar / ver | Ver [../dashboard-kanban-dynamic-columns.md](../dashboard-kanban-dynamic-columns.md) | `GET .../kanban` + coluna paginada + `POST .../transition` | **Implementado** na home (DnD + paginação) |
| 6a | **Modal novo paciente** | Nome, WhatsApp, e-mail, tipo de fluxo, OPME, responsável | `Dialog` + alinhar a `new-client-wizard` | `POST /clients` + `POST /patient-pathways` ou wizard único | **Parcial** — wizard existe; campos e-mail/OPME/responsável podem ser gap |
| 6b | **Modal alterar fase** | Lista de etapas; destaque da atual; preview documentos ao selecionar destino | `Dialog` | Lista de estágios da mesma versão + `StageDocument` (gap) | **Parcial** — transição existe; preview de docs pendente de modelo |

---

## Rota e layout (Next.js)

- **Rota:** `/[locale]/dashboard` (já existe no app; hoje pode não refletir todo o mock).
- **Layout:** header com nav do mock → substituído por **sidebar** + área de conteúdo com `max-w-*` e tokens do tema.

---

## Endpoints desejados (visão consolidada)

| Necessidade | Proposta | Notas |
|-------------|----------|--------|
| Kanban filtrado + **paginado por coluna** | `GET .../kanban` + `GET .../kanban/columns/{stageId}/patients` | Implementado (offset na coluna; `status` no Kanban com cap in-memory 500/etapa) |
| Resumo métricas | `GET .../dashboard-summary` | Implementado (aceita `opmeSupplierId`) |
| Alertas (**paginados**) | `GET .../dashboard-alerts?limit=` | MVP danger-only; evoluir para cursor e convênio |
| Transição | `POST /api/v1/patient-pathways/{id}/transition` | Já existe |
| Criar paciente | Fluxo atual de clientes + matrícula | Já existe em partes |

---

## Gaps de schema / produto (relembrar)

- P1: `Client.email`, OPME, `assignedToUserId` — filtros e modal alinhados ao mock.  
- P3: convênio, alertas agregados "aguardando exames".  
- `StageDocument` — preview no modal de fase.  
- Regra exata ok/warning/danger: comparar `enteredStageAt` com `alertWarningDays` / `alertCriticalDays` da **etapa atual** (não mais hardcoded 7/15 no texto da UI).

---

## Checklist backend (página completa)

- [x] Kanban + filtros `search`/`status`/`opmeSupplierId`/`limit` + paginação por coluna.  
- [x] **Métricas** `dashboard-summary` (aceita `opmeSupplierId`).  
- [x] **Alertas** MVP (`dashboard-alerts`, aceita `opmeSupplierId`).  
- [x] Filtro **OPME** no Kanban e métricas/alertas (`opmeSupplierId`; `__unassigned__` = sem fornecedor).  
- [ ] Segundo `pathwayId` na mesma view (multi-fluxo simultâneo) — fora do MVP atual.  
- [x] Export CSV do pipeline **visível** coerente com filtros atuais (MVP client-side).

---

## Checklist frontend (página completa)

- [x] Bloco pipeline na home: métricas → alertas → filtros → colunas (abaixo dos gráficos atuais).  
- [x] Cards de métrica ligados ao filtro de status.  
- [x] Barra de ações com **Relatórios** + **Exportar CSV** do pipeline visível.  
- [x] Ação de **limpar filtros** na barra de filtros.  
- [x] **DnD** entre colunas no Kanban (`@dnd-kit`).  
- [x] Modais novo paciente e alterar fase com APIs reais (preview de docs por etapa segue gap de produto).  
- [x] i18n para todos os rótulos — cards/insights reescritos com cópia neutra (ICU `plural`); chaves dev removidas; rótulos SLA derivados dos dados reais.
- [x] Filtros sincronizados na **URL** (`?search=&status=&opme=&pathway=`) com debounce no campo de busca.

---

## Documentação relacionada

- [../dashboard-kanban-dynamic-columns.md](../dashboard-kanban-dynamic-columns.md) — **somente** pipeline colunas + DnD.  
- [../listings-pagination-and-filters.md](../listings-pagination-and-filters.md) — paginação e filtros transversais.  
- [../execution-plan.md](../execution-plan.md) — Fase 0 (API núcleo); Fase 2 deve contemplar **dashboard completo**, não só Kanban.  
- [../persistence-api-and-transitions.md](../persistence-api-and-transitions.md)  
- [../SUBMANAGER-INTERFACES-AND-DATA.md](../../SUBMANAGER-INTERFACES-AND-DATA.md)  
- Wizard: `src/features/clients/app/components/new-client-wizard.tsx`
