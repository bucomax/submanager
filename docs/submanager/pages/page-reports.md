# Página: Relatórios

## Origem do mock

- **Arquivo:** [`arquivos-interfaces/relatorios.html`](../../../arquivos-interfaces/relatorios.html)
- **Foco:** métricas, gráficos (barras, pizza simulada), tabela de pacientes críticos, export PDF/Excel.

## Objetivo no produto

Visão **analítica** do tenant: indicadores no período, distribuição por fase/status/fluxo/OPME, lista acionável de casos críticos, **exportação** de dados.

**Paginação e filtros:** [../listings-pagination-and-filters.md](../listings-pagination-and-filters.md). **Filtros do mock** (`relatorios.html`): **período** (7 / 30 / 90 dias — o mock também sugere 365 em produto), **fluxo**, **OPME**. Tabelas (ex. pacientes críticos) e exportações grandes devem usar **páginas/cursor**, não carregar tudo na primeira resposta.

---

## Rota sugerida

- Atual: `/[locale]/dashboard/reports`

---

## Blocos de UI (mock → implementação)

| Bloco | Conteúdo | Implementação |
|-------|-----------|----------------|
| Cabeçalho | Título, subtítulo, export | **Implementado:** export CSV client-side do resumo atual |
| Filtros | Período (7/30/90/365d), tipo de fluxo, OPME | **Implementado:** `Select` por período, jornada e fornecedor |
| Stats grid | KPIs do recorte | **Implementado:** pacientes no recorte, críticos, transições no período, jornadas com pacientes |
| Gráfico pacientes por fase | Barras horizontais | **Implementado no MVP:** barras simples em cards (CSS), sem lib de chart |
| Gráfico status | Pizza/ donut | **Implementado no MVP:** distribuição em barras por SLA |
| Gráfico por fluxo | Barras | **Implementado:** group by `CarePathway` |
| Gráfico por OPME | Barras | **Implementado:** group by fornecedor / sem fornecedor |
| Tabela críticos | Nome, fase, dias, fluxo, status, Ver | **Implementado:** lista paginada + link para [page-patient-detail.md](./page-patient-detail.md) |

---

## Dados e agregações

| Métrica | Dependência de dados |
|---------|----------------------|
| Pacientes no recorte | Contagem `PatientPathway` criada dentro de `periodDays`, com filtros de jornada/OPME |
| Cirurgias realizadas / agendadas | **Gap:** eventos ou estágio específico + datas (`surgeryDate`) — mock usa campo fictício |
| Tempo médio (dias) | **Gap:** soma de permanências por etapa ou lead time total — precisa histórico com datas |
| Críticos | Mesma regra do dashboard (SLA), dentro do recorte |
| Transições no período | `COUNT(StageTransition)` com `createdAt >= periodStart` |
| Por fase | `GROUP BY currentStageId` no recorte |
| Por status | Derivado SLA |
| Por fluxo | `GROUP BY pathwayId` |
| Por OPME | `GROUP BY opmeSupplierId` + bucket “sem fornecedor” |

---

## Backend

### Natureza dos endpoints

- **Implementado no MVP:** `GET /api/v1/reports/summary?periodDays=&pathwayId=&opmeSupplierId=&page=&limit=`
- Resposta estruturada: `{ generatedAt, filters, kpis, byStage[], byStatus[], byPathway[], byOpme[], criticalPatients: { data[], pagination } }`
- Autorização: tenant do usuário; possivelmente só `tenant_admin` para export completo (definir)

### Tabelas base

- `PatientPathway`, `Client`, `PathwayStage`, `CarePathway`, `StageTransition` (para métricas temporais futuras)

### Checklist backend

- [x] Query read-only inicial por tenant com filtros de jornada e OPME
- [ ] Fuso horário explícito em ranges de data
- [x] Tabela críticos com **paginação**
- [x] Export CSV client-side do resumo atual
- [ ] Endpoint export streamado ou job assíncrono se volume alto
- [ ] PDF: biblioteca no servidor ou “imprimir” só no cliente no MVP

---

## Frontend

### Checklist frontend

- [ ] Sincronizar filtros com URL ou estado global
- [x] Loading skeleton nos cards e gráficos
- [x] Gráficos simples com labels visíveis
- [ ] “Ver todos” críticos → lista pré-filtrada em `/clients?status=danger`
- [x] i18n

---

## Documentação relacionada

- [../listings-pagination-and-filters.md](../listings-pagination-and-filters.md)
- [page-dashboard.md](./page-dashboard.md) (métricas podem compartilhar lógica)
- [../SUBMANAGER-INTERFACES-AND-DATA.md](../../SUBMANAGER-INTERFACES-AND-DATA.md) (gaps)
- [page-patients-list.md](./page-patients-list.md)
