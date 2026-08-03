# Página: Detalhe do paciente

## Origem dos mocks

| Arquivo | Diferença |
|---------|-----------|
| [`paciente.html`](../../../arquivos-interfaces/paciente.html) | Layout em duas colunas: timeline + checklist + documentos à esquerda; atividades, notas, ações rápidas à direita. Dados via `localStorage` mock. |
| [`interface-paciente-detalhe.html`](../../../arquivos-interfaces/interface-paciente-detalhe.html) | Variante: timeline mais rica com checklist embutido por fase; sidebar com ações, contato, documentos, histórico; modal “Confirmar avanço” com lista de PDFs. |

**Recomendação de migração:** uma **única rota** no app que una o melhor dos dois: cabeçalho com ações (avançar, WhatsApp, editar), **timeline** com estado por etapa, **checklist da etapa atual**, **documentos**, **feed de atividades**, **notas**, **modal de transição** com pacote de documentos.

**Paginação:** o mock não traz barra de filtros globais no detalhe, mas **cada lista longa** (transições, documentos, atividades, anotações com histórico) deve ser **paginada** ou “carregar mais”. Ver [../listings-pagination-and-filters.md](../listings-pagination-and-filters.md).

---

## Rota atual

- `/[locale]/dashboard/clients/[clientId]` (dynamic segment)
- Breadcrumb: Clients → Nome

---

## Blocos de UI consolidados

| Bloco | Descrição | Componentes |
|-------|-----------|-------------|
| Header do paciente | Avatar/iniciais, nome, “desde”, badges fluxo / OPME / status, botões Avançar fase, Mensagem (WA), Editar | `Card`, `Badge`, `Button`, `Avatar` |
| Grid contato | WhatsApp, e-mail, fase atual, tempo na fase | ícones Lucide + texto |
| Timeline | Todas as etapas ordenadas; completed / current / pending | lista vertical custom ou stepper |
| Checklist fase atual | Itens marcáveis com progresso N/M | checkboxes + mutation |
| Documentos enviados | Lista nome, data, status enviado/pendente/visualizado | `Table` ou lista; link presign R2 quando existir |
| Atividades recentes | Linha do tempo de eventos | lista a partir de `StageTransition` + futuros eventos |
| Anotações | Lista cronológica + nova nota | `Textarea`, `Button`; recurso dedicado `PatientNote` |
| Ações rápidas | Agendar, solicitar exames, lembrete, histórico | botões → modais ou rotas futuras |
| Modal avanço | Lista de PDFs que serão enviados + confirmar | `Dialog`; dados de `StageDocument`/dispatch |

---

## Dados exibidos

| Dado | Origem |
|------|--------|
| Identidade | `Client` |
| Jornada | `PatientPathway` + `PathwayVersion` + `CarePathway` |
| Etapa atual | `PathwayStage` |
| Histórico de mudanças | `StageTransition` (+ `User` actor) |
| Documentos | `FileAsset` + `StageDocument` (pacote por etapa) |
| Checklist | `PathwayStageChecklistItem` + `PatientPathwayChecklistItem` (toggle só na etapa atual) |
| Anotações | `PatientNote` paginada por paciente |
| Dias na fase | `PatientPathway.enteredStageAt` |
| Responsável | `Client.assignedToUserId` |

---

## Backend

### Tabelas / models

- `Client`, `PatientPathway`, `PathwayStage`, `PathwayVersion`, `CarePathway`
- `StageTransition` (histórico)
- `User` (ator)
- `FileAsset` (arquivos)
- `PathwayStageChecklistItem`, `PatientPathwayChecklistItem`
- `PatientNote`
- Futuro: dispatch status dedicado (`ChannelDispatch`)

### Endpoints sugeridos

| Ação | Endpoint |
|------|----------|
| Detalhe completo | `GET /api/v1/clients/:id` ou `GET /api/v1/patient-pathways/by-client/:clientId` com includes profundos |
| Transição | `POST /api/v1/patient-pathways/:id/transition` com `toStageId`, `note?` |
| Checklist toggle | `PATCH /api/v1/patient-pathways/:id/checklist-items/:itemId` |
| Notas dedicadas | `GET|POST /api/v1/clients/:id/notes` |
| Arquivos na ficha | `GET /api/v1/clients/:id/files` (metadados incl. `patientPortalReviewStatus`, `uploadedBy` opcional) |
| Validar envio do portal | `PATCH /api/v1/clients/:clientId/files/:fileId/review` com `decision: approve \| reject` |
| Timeline agregada | `GET /api/v1/clients/:id/timeline` (`AuditEvent` + transições legado) |
| Preview docs da etapa destino | Embutido em `GET /api/v1/clients/:id` (etapas da versão com `documents[]`) |

### Checklist backend

- [ ] GET detalhe com tenant guard e sem vazar dados de outros tenants
- [ ] Transição reutilizando use case único
- [ ] Lista de transições ordenada `createdAt desc`, **paginada** (`page`/`cursor` + `limit`)
- [ ] Listas de documentos / atividades / notas com histórico: **paginadas**
- [ ] Extensões de schema para dispatch conforme priorização

---

## Frontend

### Rotas / arquivos

- `src/app/[locale]/(dashboard)/dashboard/clients/[clientId]/page.tsx`
- Componentes em `src/features/clients/...` ou `features/patient-pathway/...`

### Navegação

- Lista → detalhe; dashboard Kanban → detalhe; alertas → detalhe

### Checklist frontend

- [ ] Estados loading / 404 / erro
- [ ] Timeline derivada de estágios da versão do paciente + `currentStageId`
- [ ] Modal de confirmação antes de transição (quando houver dispatch)
- [ ] Link WhatsApp: `https://wa.me/` + telefone normalizado (só UI; sem logar PII indevido)
- [ ] i18n

---

## Documentação relacionada

- [../listings-pagination-and-filters.md](../listings-pagination-and-filters.md)
- [page-patients-list.md](./page-patients-list.md)
- [../persistence-api-and-transitions.md](../persistence-api-and-transitions.md)
- Skill/projeto: transição de etapa e bundle de documentos (regras de domínio)
