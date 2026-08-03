# Página: Lista de pacientes

## Origem do mock

- **Arquivo:** [`arquivos-interfaces/pacientes.html`](../../../arquivos-interfaces/pacientes.html)
- **Título no mock:** SubManager — Lista de Pacientes.

## Objetivo no produto

Listar **todos os pacientes** do tenant com **busca**, **filtros** (fase, status, fluxo), alternância **cards / tabela**, **paginação** e CTA **Novo paciente** → detalhe ao clicar.

**Regra global:** [../listings-pagination-and-filters.md](../listings-pagination-and-filters.md) — listagem **sempre paginada no servidor**; filtros alinhados ao mock e ao dashboard.

---

## Filtros (mock `pacientes.html` + paridade produto)

| Filtro | Mock | API (exemplo) |
|--------|------|----------------|
| Busca | Nome, telefone, e-mail | `search` |
| Fase | Select “Todas as fases” / estágio | `stageId` (UUID do `PathwayStage` na versão publicada relevante — não valores fixos do HTML) |
| Status | ok / warning / danger | `status` |
| Fluxo | Completo, Direto, Convênio, Judicial | `pathwayId` ou tipo acordado |
| OPME | (não está no HTML; presente no dashboard) | `opmeSupplierId` opcional para alinhar com dashboard/relatórios |

---

## Rota sugerida

- `/[locale]/clients` (alinhar ao vocabulário atual do repo: entidade `Client`)
- Alternativa: `/[locale]/patients` se o produto padronizar “pacientes” na URL — manter uma só.

---

## Blocos de UI (mock → componentes alvo)

| Bloco | Implementação |
|-------|----------------|
| Cabeçalho (título + subtítulo + Novo paciente) | `Page` header pattern + `Button` |
| Barra de filtro | `Input` busca; `Select` fase / status / fluxo (+ OPME quando schema existir) |
| Toggle Cards / Tabela | `ToggleGroup` ou dois botões; mesmos dados, views diferentes |
| Grid de cards | `Card` por paciente: avatar iniciais, nome, telefone, badges fluxo/fase/OPME, status, dias na fase |
| Tabela | `Table` (shadcn) colunas: paciente (nome+email), telefone, fluxo, fase atual, dias, OPME, status |
| Paginação | `Button` prev/next + info “Mostrando X–Y de Z”; server-side preferível em escala |
| Toast | `sonner` |

---

## Dados exibidos

| Campo na UI | Fonte |
|-------------|--------|
| Nome | `Client.name` |
| Telefone | `Client.phone` |
| E-mail | **Gap:** adicionar `Client.email` opcional se quiser paridade com mock |
| Tipo de fluxo | Nome do `CarePathway` ligado ao `PatientPathway` |
| Fase atual | `PathwayStage.name` via `PatientPathway.currentStageId` |
| Dias na fase | Derivado de `enteredStageAt` (gap) ou placeholder até existir |
| OPME | Gap: `Client.opmeSupplierId` → nome |
| Status ok/warning/danger | Regra SLA vs dias na etapa (gap) |

---

## Backend

### Tabelas / models

- `Client`, `PatientPathway`, `PathwayStage`, `PathwayVersion`, `CarePathway`, `Tenant`
- Opcional join `User` se exibir “responsável”

### Endpoint sugerido

- `GET /api/v1/clients?search=&stageId=&status=&pathwayId=&opmeSupplierId=&page=&pageSize=`
  - Resposta: lista com DTO enriquecido (`currentStageName`, `pathwayName`, `daysInStage`, `healthStatus`, …)
- Ou separar `GET /api/v1/patient-pathways` com includes — evitar N+1

### Regras

- Sempre filtrar por `tenantId` do contexto autenticado
- Soft delete: respeitar `Client.deletedAt` se existir

### Checklist backend

- [ ] Listagem paginada + busca (nome, telefone, email se houver)
- [ ] Filtros por estágio, pathway, status calculado (ou MVP só estágio/pathway)
- [ ] Ordenação definida (ex.: `updatedAt` desc)

---

## Frontend

### Rotas / arquivos

- `src/app/[locale]/(dashboard)/clients/page.tsx` (ou rota já existente de clientes)
- Feature: `src/features/clients/...` — reutilizar tipos e formulários já usados no wizard

### Estado

- Query params para filtros e página (`useSearchParams`) para shareable URL
- Debounce na busca

### Checklist frontend

- [ ] Duas vistas (grid / table) com mesmo dataset
- [ ] Paginação sincronizada com API
- [ ] Link para detalhe: `/clients/[id]`
- [ ] “Novo paciente” abre wizard ou redireciona para fluxo de onboarding
- [ ] i18n

---

## Documentação relacionada

- [../listings-pagination-and-filters.md](../listings-pagination-and-filters.md)
- [page-patient-detail.md](./page-patient-detail.md)
- [page-dashboard.md](./page-dashboard.md) (pipeline complementar)
- [../SUBMANAGER-INTERFACES-AND-DATA.md](../../SUBMANAGER-INTERFACES-AND-DATA.md)
