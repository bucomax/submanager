# SubManager — documentação (índice)

Ponto de entrada único: este arquivo **só agrega links** para os documentos por tema. O conteúdo detalhado fica nos arquivos listados abaixo.

---

## Decisão de produto (resumo)

- **Cadastro de fases (Configurações):** apenas **drag-and-drop** para criar e **ordenar colunas** de forma dinâmica (lista de etapas ordenável + adicionar/remover colunas).
- **Dashboard (`index.html`):** ordem do mock = **métricas (4 cards) → alertas → barra de ações → filtros → pipeline (Kanban)** + modais. O **pipeline** segue **exatamente as colunas** da configuração (versão publicada), na mesma ordem — ver [pages/page-dashboard.md](./pages/page-dashboard.md) para a página inteira e [dashboard-kanban-dynamic-columns.md](./dashboard-kanban-dynamic-columns.md) só para o Kanban.

---

## Banco de dados (o que criar no Prisma)

Lista consolidada de **migrations** e prioridades (**P0 / P1 / P2 / P3**), separada do texto das páginas:

**[database-backlog.md](./database-backlog.md)**

*(Antes isso estava só como “gaps” em `SUBMANAGER-INTERFACES-AND-DATA.md` e nos `page-*.md`.)*

---

## Plano de execução (ordem de desenvolvimento)

**Qual etapa vem primeiro?** — descrito explicitamente aqui (começar pelo núcleo back: publicar estágios + transição):

**[execution-plan.md](./execution-plan.md)**

---

## Front × Back (leitura obrigatória para implementação)

Cada entrega combina **frontend e backend**. O detalhamento do que cada parte precisa fazer está em:

**[frontend-backend-scope.md](./frontend-backend-scope.md)**

Resumo: **A** (editor DnD) e **B** (Kanban) não são “só front” — exigem APIs e use cases no servidor; **C** é o contrato e a persistência que ambos consomem. Uma linha de `PathwayStage` no banco **não** vira um projeto FE/BE separado: o código trata **N** colunas dinamicamente.

---

## Documentos por parte

| Parte | Documento | Escopo |
|-------|-----------|--------|
| **Banco (migrations)** | [database-backlog.md](./database-backlog.md) | O que criar/alterar no Prisma; P0–P3. |
| **Ordem de execução** | [execution-plan.md](./execution-plan.md) | Fases 0–5; primeira etapa = API jornada + transição. |
| **Lógica de negócio consolidada** | [business-logic.md](./business-logic.md) | Regras atuais de cadastro, jornada, bundle documental, responsável, OPME e gaps restantes. |
| **Front × Back** | [frontend-backend-scope.md](./frontend-backend-scope.md) | Tabelas por entrega: o que o back expõe / o que o front implementa. |
| **A — Editor de colunas (Configurações)** | [column-editor-drag-drop.md](./column-editor-drag-drop.md) | UI com DnD, adicionar/remover/renomear etapas, rascunho vs publicar, validações. |
| **B — Pipeline (Kanban) no dashboard** | [dashboard-kanban-dynamic-columns.md](./dashboard-kanban-dynamic-columns.md) | Subseção “Visão por etapas”: colunas dinâmicas, cards, DnD → transição. Métricas/alertas/ações: [pages/page-dashboard.md](./pages/page-dashboard.md). |
| **C — Persistência, API e transições** | [persistence-api-and-transitions.md](./persistence-api-and-transitions.md) | `PathwayStage.sortOrder`, `PathwayVersion`, `graphJson` enxuto ou só estágios, endpoints, use case de transição. |
| **D — Referência visual e gaps gerais** | [../SUBMANAGER-INTERFACES-AND-DATA.md](../SUBMANAGER-INTERFACES-AND-DATA.md) | Mocks `arquivos-interfaces`, tema Shadcn, gaps de banco complementares (SLA, OPME, etc.). |
| **E — Arquitetura do monorepo** | [../ARCHITECTURE.md](../ARCHITECTURE.md) | Multi-tenant, §8 modelo de dados, RBAC. |
| **Listagens e filtros** | [listings-pagination-and-filters.md](./listings-pagination-and-filters.md) | Paginação obrigatória (incl. cards por coluna do Kanban e lista DnD de etapas acima de limite); filtros por página mock. |

---

## Ordem sugerida de leitura para implementação

1. [execution-plan.md](./execution-plan.md) — **por onde começar** e fases.  
2. [business-logic.md](./business-logic.md) — regras consolidadas que o código já aplica.  
3. [database-backlog.md](./database-backlog.md) — o que migrar no banco e quando.  
4. [frontend-backend-scope.md](./frontend-backend-scope.md) — divisão FE/BE por fatia.  
5. [persistence-api-and-transitions.md](./persistence-api-and-transitions.md) — contrato publicar/transicionar.  
6. [column-editor-drag-drop.md](./column-editor-drag-drop.md) + [dashboard-kanban-dynamic-columns.md](./dashboard-kanban-dynamic-columns.md) + [pages/page-dashboard.md](./pages/page-dashboard.md) (escopo completo do `index.html`).  
7. [`pages/README.md`](./pages/README.md) — detalhe por página do mock.  
8. [listings-pagination-and-filters.md](./listings-pagination-and-filters.md) — paginação e filtros.  
9. [../SUBMANAGER-INTERFACES-AND-DATA.md](../SUBMANAGER-INTERFACES-AND-DATA.md) — tema e gaps gerais.

---

## Migração página a página (mocks → Next)

Cada HTML em `arquivos-interfaces` tem **documento dedicado** (UI, dados, tabelas, endpoints, checklists FE/BE) + índice e matriz entidade×página:

- **[`pages/README.md`](./pages/README.md)** — índice e convenções  
- **[`pages/entity-to-pages-matrix.md`](./pages/entity-to-pages-matrix.md)** — visão por model Prisma  
- [`pages/page-dashboard.md`](./pages/page-dashboard.md) — `index.html`  
- [`pages/page-patients-list.md`](./pages/page-patients-list.md) — `pacientes.html`  
- [`pages/page-patient-detail.md`](./pages/page-patient-detail.md) — `paciente.html` + `interface-paciente-detalhe.html`  
- [`pages/page-settings.md`](./pages/page-settings.md) — `configuracoes.html`  
- [`pages/page-reports.md`](./pages/page-reports.md) — `relatorios.html`

---

## Pasta de protótipos HTML

- [`arquivos-interfaces/`](../../arquivos-interfaces/) — referência visual; o fluxo de **cadastro de fases** no produto passa a ser **somente DnD de colunas**, não o mock estático linha a linha.
