# Front × Back — o que cada entrega precisa

## Premissa

Toda fatia abaixo exige **frontend e backend** em conjunto: o painel consome APIs validadas no servidor; o servidor expõe contratos que o app realmente usa. **Não há “só etapa de front” ou “só etapa de back”** para essas funcionalidades.

**Nota sobre “cada etapa”:** no produto, **uma linha de `PathwayStage`** não gera um projeto FE/BE separado — o mesmo código renderiza **N colunas** dinamicamente. O que se implementa **uma vez** é: editor que manipula a lista de estágios + API que persiste + Kanban que lê a lista ordenada.

**Listagens:** ver [listings-pagination-and-filters.md](./listings-pagination-and-filters.md) — **paginação** em todas as respostas que devolvem listas (incluindo **por coluna** no Kanban); **filtros** documentados por página mock.

---

## Parte A — Editor de fases (Configurações, DnD)

Documento de UX/comportamento: [column-editor-drag-drop.md](./column-editor-drag-drop.md).

| Camada | O que fazer |
|--------|-------------|
| **Backend** | Rotas `/api/v1` (ou use cases chamados por elas) para: listar estágios da versão em edição; criar/atualizar ordem com `PUT` (array ordenado); opcional `PATCH` rascunho; `POST …/publish` em transação; validar `tenantId`, unicidade `(pathwayVersionId, stageKey)`, regra de exclusão (sem pacientes em `currentStageId` ou política definida); retornar erros de domínio mapeados para HTTP. |
| **Frontend** | Rota no app (ex.: settings/pathway ou dentro de configurações); lista **@dnd-kit** sortable; inputs de nome; botões adicionar/remover; estados **loading / erro / sucesso**; chamadas às APIs acima; confirmação antes de publicar; invalidação de cache (React Query ou equivalente) após publicar para o dashboard refletir colunas novas. |
| **Contrato** | Tipos compartilhados (`src/types/` ou schema Zod) alinhados ao JSON de request/response — [persistence-api-and-transitions.md](./persistence-api-and-transitions.md). |

---

## Parte B — Pipeline Kanban no dashboard (colunas dinâmicas)

A **página** dashboard inclui também métricas, alertas, barra de ações e filtros — ver [pages/page-dashboard.md](./pages/page-dashboard.md). **Esta parte** cobre só o bloco **pipeline** (equivalente à seção “Visão por Etapas” do mock).

Documento do pipeline: [dashboard-kanban-dynamic-columns.md](./dashboard-kanban-dynamic-columns.md).

| Camada | O que fazer |
|--------|-------------|
| **Backend** | Endpoint(s) que devolvem **estágios publicados ordenados** + **pacientes por etapa com paginação** (`limit`/`cursor` por `stageId` ou contrato equivalente), sempre filtrados por tenant; endpoint de **transição** (`POST …/transition`) com as mesmas regras para clique ou DnD. **Métricas e alertas** do topo: endpoints dedicados — ver [pages/page-dashboard.md](./pages/page-dashboard.md) e [listings-pagination-and-filters.md](./listings-pagination-and-filters.md). |
| **Frontend** | **Fetch** colunas + pacientes **por página em cada coluna**; **uma coluna por `PathwayStage`** na ordem de `sortOrder`; cards; **DnD entre colunas** → API de transição; toast/erro/refetch; empty states; responsivo. **Filtros** + query params no `GET` quando o back suportar. |
| **Contrato** | DTO estável para “coluna + pacientes” ou dois GETs coordenados; resposta de transição com paciente atualizado ou 4xx com código de erro de domínio. |

---

## Parte C — Núcleo persistência / transição (compartilhado)

Documento: [persistence-api-and-transitions.md](./persistence-api-and-transitions.md).

| Camada | O que fazer |
|--------|-------------|
| **Backend** | Prisma/migrations se necessário; use case **PublishPathwayVersion** (sync `PathwayStage` + `sortOrder` + `published`); use case **TransitionPatientStage** (validações, `PatientPathway`, `StageTransition`, dispatch futuro); testes de integração nos casos críticos (tenant, versão, etapa inválida). |
| **Frontend** | Não implementa regra de negócio duplicada: só envia payloads corretos e exibe erros; opcional **OpenAPI / tipos gerados** para não divergir do back. |

---

## Ordem prática de trabalho (sugerida)

1. **Back primeiro:** contratos da Parte C + endpoints mínimos de listagem de estágios e publicação.  
2. **Front A** em paralelo ou logo após: editor contra API real ou mock alinhado ao contrato.  
3. **Back:** endpoint agregado Kanban + transição estável; depois métricas/alertas conforme [pages/page-dashboard.md](./pages/page-dashboard.md).  
4. **Front B:** pipeline consumindo API real; em seguida demais blocos do dashboard na ordem do mock.

---

## Onde isso aparece no índice

- [README.md](./README.md) — lista este arquivo na tabela de documentos.
