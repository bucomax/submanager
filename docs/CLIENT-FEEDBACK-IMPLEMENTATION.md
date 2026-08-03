# Implementacao do Feedback — Fase 1 & 2

Plano tecnico baseado nos itens entendidos do `CLIENT-FEEDBACK-2026-04-19.md`.
Escopo: **Secao A** (visual, completa) e **Secao B** (itens entendidos: B.3, B.6, B.7, B.8, B.10, B.11).

---

## Estado Atual da Ficha do Paciente

### Arquivos envolvidos

| Camada | Arquivo | Responsabilidade |
|--------|---------|------------------|
| Route | `src/app/[locale]/(dashboard)/dashboard/clients/[clientId]/page.tsx` | Thin page |
| View | `src/features/clients/app/components/client-detail-view.tsx` | Orquestrador principal |
| Perfil | `client-detail-profile-card.tsx` | Formulario de dados do paciente |
| Jornada | `client-detail-journey-panels.tsx` | Card de etapa + checklist + proximas acoes |
| Stages | `client-detail-journey-stages-list.tsx` | Timeline visual de etapas |
| Arquivos | `client-detail-files-card.tsx` | Upload/download de documentos |
| Notas | `client-detail-notes-card.tsx` | Notas clinicas |
| Timeline | `client-detail-timeline-section.tsx` | Audit trail |
| Historico | `client-completed-treatments-section.tsx` | Jornadas anteriores |
| Dashboard | `src/features/dashboard/app/components/` | Pipeline, metricas, kanban |

### Layout atual

```
Header: [Identidade] [Portal] [QR Code]   [Voltar]
────────────────────────────────────────────────────
Colunas (columns-1 lg:columns-2, gap-6):
  - Profile Card (formulario completo)
  - Case Notes (textarea)
  - Clinical Notes
  - Files Card
  - Journey Card (SLA + etapa)
  - Assignee Overview
  - Next Actions (checklist pendente)
  - Checklist Card (interativo)
  - Start Pathway / Switch Pathway
────────────────────────────────────────────────────
Full-width: Timeline + Tratamentos anteriores
```

### Problemas identificados

1. **Sem hierarquia visual** — todos os cards tem peso igual
2. **Sem separacao de contexto** — perfil, jornada, documentos e historico misturados
3. **Sem summary header** — usuario precisa rolar para entender o estado do paciente
4. **Checklist e transicao separados** — sao acao conjunta mas estao em cards distintos
5. **Tudo aberto** — sem colapso, scroll longo
6. **Botoes sem hierarquia** — multiplos botoes com mesma enfase

---

## FASE 1 — Redesign Visual da Ficha (Secao A)

### 1.1 — Patient Summary Header (A.3, A.8, A.10)

**Novo componente:** `src/features/clients/app/components/client-summary-header.tsx`

Card "hero" fixo no topo da ficha com informacoes essenciais:

```
┌──────────────────────────────────────────────────────────────┐
│ [Avatar] João Silva                    📱 (11) 99999-9999    │
│          CPF: •••.678.••• (mascarado)                        │
│                                                              │
│ ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│ │ 🟢 Exames Pré   │  │ SLA: 3d 4h   │  │ [Avançar Etapa]  │ │
│ │ Etapa atual      │  │ ██████░░ 68% │  │ botao primario   │ │
│ └─────────────────┘  └──────────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Dados:**
- Nome, telefone (link `tel:`), documento (mascarado)
- Badge da etapa atual (cor por SLA health: verde/amarelo/vermelho)
- SLA restante (dias + barra de progresso `alertWarningDays` / `alertCriticalDays`)
- Botao primario: "Avancar para [nome da proxima etapa]" (contextual — item B.6)
- Se sem pathway ativo: mostra "Iniciar jornada" como acao primaria

**Implementacao:**
- Recebe `client`, `patientPathway`, `stages[]`, `currentStage` como props
- SLA calculado a partir de `enteredStageAt` vs `alertWarningDays` / `alertCriticalDays`
- Reutiliza `SlaHealthPill` existente com tamanho maior

---

### 1.2 — Layout em Tabs (A.2, A.4)

**Alterar:** `client-detail-view.tsx`

Substituir layout de colunas por tabs com 4 secoes:

```
[Identificacao] [Jornada] [Documentos] [Historico]
```

| Tab | Componentes atuais que migram |
|-----|------------------------------|
| **Identificacao** | `client-detail-profile-card` (perfil + endereco + responsavel + contato) |
| **Jornada** | Journey Card + Checklist + Transicao + Next Actions + Assignee + Stages List + Notes |
| **Documentos** | Files Card (com filtro futuro operational/clinical) |
| **Historico** | Timeline Section + Completed Treatments |

**Implementacao:**
- Usar `Tabs` do shadcn (`@/shared/components/ui/tabs`)
- Tab ativa persistida em `searchParams` (`?tab=journey`) para deep-link
- Summary Header fica **acima** das tabs (sempre visivel)
- Tab default: `journey` (acao principal)

---

### 1.3 — Card de Transicao Unificado (A.7, A.6)

**Refatorar:** Unificar `ClientDetailChecklistCard` + `ClientDetailNextActionsCard` + botao de transicao num unico card.

**Novo componente:** `client-stage-transition-card.tsx`

```
┌─────────────────────────────────────────────────┐
│ Transicao de Etapa                              │
│                                                 │
│ Checklist (3/5 completos)  ████████░░░░ 60%     │
│ ☑ Exames de sangue                              │
│ ☑ Raio-X panoramico                             │
│ ☐ Termo de consentimento  ← obrigatorio ⚠️      │
│ ☑ Avaliacao anestesica                          │
│ ☐ Jejum confirmado        ← obrigatorio ⚠️      │
│                                                 │
│ Proxima etapa: [Select ▾ Cirurgia]              │
│ Observacao:    [textarea]                        │
│                                                 │
│         [Avancar para Cirurgia] (disabled)      │
│         "2 itens obrigatorios pendentes"         │
└─────────────────────────────────────────────────┘
```

**Comportamento:**
- Checklist interativo (toggle items) inline
- Barra de progresso do checklist
- Select da proxima etapa pre-selecionado com a proxima na ordem (sortOrder)
- Botao desabilitado se checklist incompleto, com tooltip "X itens obrigatorios pendentes"
- Botao label contextual: "Avancar para {nomeProximaEtapa}" (item B.6)
- Dialog de confirmacao ao clicar (ja existente)

---

### 1.4 — Secoes Colapsaveis (A.4)

**Implementacao:** Usar `Collapsible` do shadcn nos cards dentro de cada tab.

Cards que colapsam:
- **Assignee Overview** — colapsa por default
- **Stages List** (timeline visual) — colapsa por default
- **Completed Treatments** — ja colapsavel (accordion), manter
- **Notas Clinicas** — expandido por default, colapsavel

**Persistencia:** `localStorage` com chave `submanager:collapse:{sectionId}`. Implementar hook `useCollapsibleState(sectionId, defaultOpen)`.

---

### 1.5 — Espacamento e Hierarquia Visual (A.1, A.5, A.9, A.10)

**Alteracoes em todos os cards da ficha:**

| Propriedade | Antes | Depois |
|-------------|-------|--------|
| Gap entre cards | `gap-4` / `mb-4` | `gap-6` |
| Padding interno | `p-4` | `p-5` ou `p-6` |
| Titulo de secao | `text-sm font-medium` | `text-base font-semibold` |
| Labels | `text-sm` | `text-sm font-medium text-muted-foreground` |
| Metadata | sem padrao | `text-xs text-muted-foreground` |
| Separadores | ausentes | `Separator` entre sub-secoes ou `border-t pt-4` |

**Botoes (A.6):**
- 1 botao `default` (primario) por secao — o da acao principal
- Demais: `outline` ou `ghost`
- Botao destaque global: "Avancar etapa" no Summary Header

---

## FASE 2 — Operacional (Secao B — itens entendidos)

### 2.1 — Instrucoes por Etapa (B.8)

**Prisma — novos campos em `PathwayStage`:**

```prisma
model PathwayStage {
  // ... campos existentes
  instructions    String?   @db.Text   // O que fazer nesta etapa
  rationale       String?   @db.Text   // Por que esta etapa e importante
  delayImpact     String?   @db.Text   // Impacto de atraso
}
```

**Migration:** `npx prisma migrate dev --name add-stage-instructions`

**Editor de fluxo:** Adicionar 3 campos textarea no painel de edicao do node da etapa (ja existe `patientMessage`; adicionar campos abaixo dele).

**Arquivo do editor:** Verificar componente de edicao de stage em `src/features/pathways/` — adicionar campos no form de edicao do node.

**Ficha do paciente:** Novo card `StageInstructionsCard` na tab Jornada:

```
┌─────────────────────────────────────────────────┐
│ ℹ️ Orientacoes — Etapa: Exames Pre-operatorios  │
│                                                 │
│ O que fazer:                                    │
│ Solicitar exames de sangue (hemograma, coagulo- │
│ grama) e raio-X panoramico.                     │
│                                                 │
│ Por que:                                        │
│ Necessario para avaliacao anestesica e planeja-  │
│ mento cirurgico.                                │
│                                                 │
│ ⚠️ Impacto do atraso:                           │
│ Atrasa a cirurgia e pode exigir reagendamento.  │
└─────────────────────────────────────────────────┘
```

- Exibir somente se pelo menos 1 campo preenchido
- Colapsavel (expandido por default)

**Tipos API — `src/types/api/pathways-v1.ts`:**
- Expandir `PathwayStageDto` com `instructions`, `rationale`, `delayImpact`

---

### 2.2 — Transicao Contextual (B.6)

Ja coberto parcialmente no item 1.3 (botao contextual). Complemento:

**Botao label dinamico:**
- Calcular proxima etapa pelo `sortOrder` do `PathwayStage`
- Label: `"Avancar para {stages[currentIndex + 1].name}"`
- Se ultima etapa: `"Concluir jornada"`

**Validacao automatica (futuro):**
- Novo campo `autoValidationRules` (JSON) no `PathwayStage` — **NAO implementar agora**
- Reservar no schema como `Json?` para futura extensao
- Logica: se todos docs da etapa estao uploadados + checklist completo → habilita botao automaticamente

---

### 2.3 — Dashboard com Metricas de Gestao (B.7)

**Novas metricas (queries agregadas em `StageTransition`):**

| Metrica | Query | Componente |
|---------|-------|------------|
| Tempo medio por etapa | `AVG(enteredStageAt → transitionedAt)` agrupado por `stageId` | Card com barras horizontais |
| Gargalos | Etapas com mais pacientes parados > SLA | Card com lista ordenada |
| Funil de conversao | Pacientes por etapa num pathway (cadastro → cirurgia → alta) | Grafico de funil (recharts) |
| Taxa de conclusao | `completedAt IS NOT NULL` / total por periodo | Card com % |

**Arquivos novos:**

```
src/features/dashboard/app/components/
  dashboard-avg-stage-time-card.tsx      # Tempo medio por etapa
  dashboard-bottleneck-card.tsx          # Etapas gargalo
  dashboard-conversion-funnel-card.tsx   # Funil de conversao
  dashboard-completion-rate-card.tsx     # Taxa de conclusao
```

**API:**

```
GET /api/v1/dashboard/metrics/stage-time     → { stages: [{ name, avgHours, count }] }
GET /api/v1/dashboard/metrics/bottlenecks    → { bottlenecks: [{ stageName, patientCount, avgOverdueDays }] }
GET /api/v1/dashboard/metrics/funnel         → { stages: [{ name, patientCount, percentage }] }
GET /api/v1/dashboard/metrics/completion     → { total, completed, rate, period }
```

**Use cases:**

```
src/application/use-cases/dashboard/
  get-stage-time-metrics.ts
  get-bottleneck-metrics.ts
  get-conversion-funnel.ts
  get-completion-rate.ts
```

**Layout do dashboard:** Adicionar secao "Metricas de Gestao" abaixo do pipeline existente, com grid 2x2 dos novos cards.

---

### 2.4 — Lembretes WhatsApp Automaticos (B.3)

**Prisma — novos campos em `PathwayStage`:**

```prisma
model PathwayStage {
  // ... campos existentes
  reminderOffsetHours  Int?      // Horas antes do SLA para enviar lembrete
  reminderMessage      String?   @db.Text  // Mensagem do lembrete (template)
  followUpAfterHours   Int?      // Horas sem interacao para reenvio
}
```

**Job BullMQ:**

```
src/infrastructure/queue/jobs/
  stage-reminder.job.ts    # Lembrete por etapa
  stage-follow-up.job.ts   # Follow-up por inatividade
```

**Logica do lembrete:**
1. Job cron (ex.: a cada 1h) consulta `PatientPathway` onde:
   - `completedAt IS NULL`
   - `enteredStageAt + reminderOffsetHours` <= agora
   - Nao existe `ChannelDispatch` de tipo `reminder` para esse paciente + etapa
2. Dispara WhatsApp via port `IWhatsAppOutbound` com `reminderMessage`
3. Persiste `ChannelDispatch` com `type: "reminder"` + `correlationId`

**Logica do follow-up:**
1. Job cron consulta `PatientPathway` onde:
   - `completedAt IS NULL`
   - Ultimo `StageTransition` ou `ChannelDispatch` > `followUpAfterHours`
   - Nao excedeu limite de reenvios (max 3)
2. Reenvia mensagem da etapa ou mensagem generica
3. Persiste com `type: "follow_up"`

**Editor de fluxo:** Adicionar campos no painel de edicao do node da etapa:
- `reminderOffsetHours`: input numerico com label "Enviar lembrete X horas antes do SLA"
- `reminderMessage`: textarea com label "Mensagem do lembrete"
- `followUpAfterHours`: input numerico com label "Reenviar se sem resposta em X horas"

---

### 2.5 — Alertas de Inatividade (B.10)

**Prisma — novo campo ou uso de existente:**

Reutilizar infraestrutura de notificacoes existente (`INotificationEmitter`).

**Novo tipo de notificacao:** `patient_inactive`

**Job BullMQ:**

```
src/infrastructure/queue/jobs/
  inactivity-alert.job.ts
```

**Logica:**
1. Job cron (diario) consulta `PatientPathway` onde:
   - `completedAt IS NULL`
   - Ultimo `StageTransition.createdAt` > N dias (configuravel por tenant, default 7)
   - Nao existe notificacao `patient_inactive` nos ultimos 3 dias (dedup)
2. Gera notificacao para `tenant_admin` + responsavel da etapa (`defaultAssigneeUserId`)
3. Notificacao linka para ficha do paciente

**Configuracao por tenant:** Adicionar campo `inactivityAlertDays` no model `Tenant` (default 7).

---

### 2.6 — Integracao entre Modulos (B.11)

**Upload de documento atualiza checklist automaticamente:**

Quando um `FileAsset` e uploadado para um paciente numa etapa que tem `StageDocument` correspondente:

1. Verificar se o `FileAsset` corresponde a algum `StageDocument` da etapa atual
2. Se sim, marcar o `PathwayStageChecklistItem` correspondente como completo
3. Emitir notificacao `checklist_auto_complete`

**Implementacao:** Hook no use case de upload (`CreateFileAsset` ou equivalente) que chama `AutoCompleteChecklistOnUpload`.

**Alerta linka para ficha:**
- Notificacoes de SLA, inatividade etc. ja incluem `clientId` — garantir que o frontend faz `router.push(/dashboard/clients/{clientId}?tab=journey)`.

---

## Resumo de Arquivos Novos e Alterados

### Novos

| Arquivo | Descricao |
|---------|-----------|
| `client-summary-header.tsx` | Hero card no topo da ficha |
| `client-stage-transition-card.tsx` | Card unificado checklist + transicao |
| `stage-instructions-card.tsx` | Instrucoes da etapa atual |
| `dashboard-avg-stage-time-card.tsx` | Metrica: tempo medio por etapa |
| `dashboard-bottleneck-card.tsx` | Metrica: gargalos |
| `dashboard-conversion-funnel-card.tsx` | Metrica: funil de conversao |
| `dashboard-completion-rate-card.tsx` | Metrica: taxa de conclusao |
| `stage-reminder.job.ts` | Job de lembretes WhatsApp |
| `stage-follow-up.job.ts` | Job de follow-up |
| `inactivity-alert.job.ts` | Job de alerta de inatividade |
| `get-stage-time-metrics.ts` | Use case: metricas de tempo |
| `get-bottleneck-metrics.ts` | Use case: gargalos |
| `get-conversion-funnel.ts` | Use case: funil |
| `get-completion-rate.ts` | Use case: taxa de conclusao |
| 4 route handlers em `api/v1/dashboard/metrics/` | Endpoints de metricas |
| Migration | Novos campos em `PathwayStage` e `Tenant` |

### Alterados

| Arquivo | Alteracao |
|---------|-----------|
| `client-detail-view.tsx` | Layout: colunas → tabs; integrar summary header |
| `client-detail-journey-panels.tsx` | Extrair checklist e next actions para card unificado |
| `packages/prisma/schema.prisma` | Campos: instructions, rationale, delayImpact, reminderOffsetHours, reminderMessage, followUpAfterHours, inactivityAlertDays |
| Componente de edicao de node (editor de fluxo) | Adicionar campos de instrucoes e lembretes |
| `dashboard-home-page.tsx` | Adicionar secao de metricas de gestao |
| Cards existentes da ficha | Espacamento: gap-6, p-5/p-6, hierarquia tipografica |
| Componente de notificacao | Link para ficha com tab |

---

## Dependencias entre Itens

```
A.8 (Summary Header) ← A.3 (destaque etapa) + A.10 (prioridade visual)
A.7 (Checklist + transicao) ← A.6 (botao destaque) + B.6 (botao contextual)
A.2 (Tabs) ← A.4 (colapsavel) — secoes dentro das tabs
B.8 (Instrucoes) ← Migration PathwayStage + Editor de fluxo
B.3 (Lembretes) ← Migration PathwayStage + Job BullMQ + WhatsApp port
B.7 (Metricas) ← Use cases + API + Componentes dashboard
B.10 (Inatividade) ← Job BullMQ + Notificacoes
B.11 (Integracao) ← Upload hook + Checklist auto-complete
```

---

## Ordem de Implementacao Sugerida

### Sprint 1 — Fundacao visual

1. Migration Prisma (campos novos em `PathwayStage` e `Tenant`)
2. `client-summary-header.tsx` (A.3, A.8)
3. Layout em tabs no `client-detail-view.tsx` (A.2)
4. Espacamento e hierarquia visual em todos os cards (A.1, A.5, A.9)

### Sprint 2 — Interacao e jornada

5. `client-stage-transition-card.tsx` unificado (A.7, A.6, B.6)
6. Secoes colapsaveis com persistencia (A.4)
7. `stage-instructions-card.tsx` + campos no editor de fluxo (B.8)

### Sprint 3 — Dashboard e metricas

8. Use cases de metricas + endpoints API (B.7)
9. Componentes de dashboard: tempo medio, gargalos, funil, conclusao (B.7)

### Sprint 4 — Automacao

10. Job de lembretes WhatsApp + campos no editor (B.3)
11. Job de follow-up (B.3)
12. Job de alerta de inatividade (B.10)
13. Auto-complete de checklist por upload (B.11)

---

## Itens Fora de Escopo (dependem de respostas do cliente)

- B.1 — Proxima acao recomendada (precisa definir "contexto")
- B.2 — Motor de regras (precisa exemplos concretos)
- B.4 — Responsaveis com fallback e fila (precisa definir hierarquia)
- B.5 — Templates de documentos com geracao automatica (precisa definir quais)
- B.9 — Bloco de proximas acoes (precisa esclarecer vs B.1)
- Secao C — Prontuario clinico (modulo novo, muitas perguntas abertas)

---

*Documento gerado em 19/04/2026. Baseado no feedback de CLIENT-FEEDBACK-2026-04-19.md.*
