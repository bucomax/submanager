# Listagens: paginação obrigatória + filtros por página (mocks)

Este documento fixa **requisitos transversais** do produto SubManager: **nenhuma listagem “infinita”** vinda de API sem paginação (ou estratégia equivalente documentada), e **filtros** alinhados aos HTML em [`arquivos-interfaces/`](../../arquivos-interfaces/).

**Contrato sugerido (API):** `page` + `pageSize` (máx. definido, ex. 50) **ou** `cursor` + `limit` para listas de alto volume; resposta inclui `total` ou `hasMore` + `nextCursor` conforme o padrão escolhido. **Sempre** filtrar por `tenantId` do contexto autenticado.

**Contrato sugerido (UI):** controles “carregar mais” / próxima página, ou scroll infinito por página/cursor; mensagem do tipo “Mostrando X–Y de Z” quando `total` conhecido.

---

## 1. Paginação: o que entra no escopo

| Tipo de lista | Paginação / performance | Notas |
|---------------|-------------------------|--------|
| **Kanban (dashboard)** — cards **dentro de cada coluna** (`PathwayStage`) | **Obrigatória por coluna** | Cada coluna é, na prática, uma listagem de pacientes; não carregar todos os `PatientPathway` do tenant de uma vez. Ver [dashboard-kanban-dynamic-columns.md](./dashboard-kanban-dynamic-columns.md). |
| **Editor de fases (Configurações, lista DnD)** — linhas de etapas | **Obrigatória acima de um limite** (ex. 30–50 etapas) ou **virtualização** | Caso raro ter centenas de etapas; mesmo assim o contrato deve prever paginação ou lista virtualizada para não travar o DOM nem o payload do `graphJson`. |
| **Lista de pacientes** (`pacientes.html`) | **Obrigatória** | Server-side; query params espelham filtros. |
| **Alertas no dashboard** | **Obrigatória** | Lista pode crescer; mesmo MVP deve prever `limit` + próxima página ou “ver mais”. |
| **Detalhe do paciente** — atividades, documentos, transições | **Obrigatória por bloco** | Timeline completa pode ser longa; histórico de `StageTransition`, anexos e atividades com paginação ou “carregar anteriores”. |
| **Relatórios** — tabela de críticos / drill-downs | **Obrigatória** | Filtros de período não eliminam necessidade de paginar a tabela exportável. |
| **Configurações** — equipe, OPME, convites | **Obrigatória** quando a lista passar do limite da primeira página | CRUDs de tabela devem seguir o mesmo padrão. |
| **Admin / tenants (super_admin)** | **Obrigatória** | Fora do mock SubManager, mas mesma regra no painel. |

**Métricas agregadas** (cards com totais, gráficos): não são “listagem”; podem usar endpoints dedicados com **contagens** sem paginar linhas — mas as **listas** que alimentam drill-down (ex. “ver lista” de um alerta) paginam.

---

## 2. Filtros por página (inventário a partir dos mocks)

Coluna **Mock** indica o arquivo de referência. Campos devem mapear para query params estáveis na API (`snake_case` ou `camelCase` alinhado ao restante do projeto).

| Página | Mock | Filtros / busca (UI) | Parâmetros API (exemplo) |
|--------|------|----------------------|---------------------------|
| **Dashboard** | `index.html` | Busca nome/telefone; **Fluxo** (`CarePathway`); **Status** (ok / warning / danger); **OPME** | `search`, `pathwayId` (ou implícito no contexto), `status`, `opmeSupplierId` no `GET .../kanban` e nos endpoints de métricas/alertas quando existirem |
| **Lista de pacientes** | `pacientes.html` | Busca nome, telefone, **e-mail**; **Fase** (estágio); **Status**; **Fluxo** | `search`, `stageId`, `status`, `pathwayId`, `page`, `pageSize` (+ opcional `opmeSupplierId` se paridade com dashboard) |
| **Detalhe do paciente** | `paciente.html`, `interface-paciente-detalhe.html` | Sem barra global de filtros no mock; **sub-listas** paginadas (atividades, docs) podem ter filtro por tipo/data em iterações futuras | `cursor`/`page` em `GET .../transitions`, `GET .../files`, etc. |
| **Configurações** | `configuracoes.html` | Por seção: equipe (busca/papel), OPME (ativo), convites — conforme implementar | CRUD listagens com `page`, `pageSize` ou filtros específicos |
| **Relatórios** | `relatorios.html` | **Período** (7 / 30 / 90 / 365 dias ou range); **Fluxo**; **OPME** | `from`, `to` ou `periodDays`, `pathwayId`, `opmeSupplierId` em `GET .../reports/summary` e endpoints de export |

**Regra:** filtros do dashboard e da lista de pacientes devem ser **coerentes** (mesmos significados de `status` e `pathwayId`) para deep links do tipo `/clients?status=danger` a partir de relatórios ou alertas.

---

## 3. Documentos que aplicam esta regra

- [pages/page-dashboard.md](./pages/page-dashboard.md)  
- [pages/page-patients-list.md](./pages/page-patients-list.md)  
- [pages/page-patient-detail.md](./pages/page-patient-detail.md)  
- [pages/page-settings.md](./pages/page-settings.md)  
- [pages/page-reports.md](./pages/page-reports.md)  
- [dashboard-kanban-dynamic-columns.md](./dashboard-kanban-dynamic-columns.md)  
- [column-editor-drag-drop.md](./column-editor-drag-drop.md)  
- [frontend-backend-scope.md](./frontend-backend-scope.md)  
- [execution-plan.md](./execution-plan.md) (fases 2–4 mencionam listagens)

---

## 4. Critérios de aceite (resumo)

- [ ] `GET .../kanban` (ou rotas por coluna) devolve pacientes **paginados por etapa** + metadados para “carregar mais”.  
- [ ] Lista de clientes / patient-pathways: **paginação server-side** + filtros na query.  
- [ ] Editor DnD de etapas: documentado limite ou virtualização; não assumir lista curta para sempre.  
- [ ] Relatórios e alertas: tabelas/listas paginadas.  
- [ ] Detalhe: histórico e anexos paginados.
