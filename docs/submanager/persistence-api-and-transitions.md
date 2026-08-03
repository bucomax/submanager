# C — Persistência, API e transições (colunas dinâmicas)

## Modelo mental

- **`CarePathway`**: um “tipo de jornada” por tenant.  
- **`PathwayVersion`**: snapshot versionado; apenas uma versão **publicada** por pathway (ou política explícita do produto).  
- **`PathwayStage`**: cada **coluna**; campos relevantes hoje no Prisma: `stageKey`, `name`, `sortOrder`, `pathwayVersionId`, `patientMessage` opcional.  
- **`PatientPathway`**: paciente preso a uma `pathwayVersionId` publicada + `currentStageId`.

A **ordem das colunas** no editor DnD = **`sortOrder`** crescente em `PathwayStage` da versão em edição/publicada.

### Frontend e backend

Aqui está o **núcleo no servidor** (use cases, Prisma, rotas); o front apenas consome e não duplica regras. A divisão completa FE/BE por fatia está em [frontend-backend-scope.md](./frontend-backend-scope.md) (Partes A, B e C).

---

## `graphJson` vs só estágios

Com o cadastro **apenas por lista DnD** (sem React Flow na configuração):

- Opção **recomendada (MVP):** persistir estágios como **fonte de verdade** em `PathwayStage`; manter `graphJson` como **JSON derivado** mínimo (ex.: nós em linha e arestas `i → i+1`) na publicação, **ou** objeto vazio `{}` com convenção documentada, se nada mais consumir o grafo ainda.  
- Isso evita duas fontes conflitantes: quem manda na ordem é `PathwayStage.sortOrder`.

Se no futuro existir editor de grafo avançado, alinhar sincronização bidirecional em documento separado.

---

## Fluxo publicar (Configurações)

1. Usuário ordena/adiciona/remove colunas no cliente.  
2. **Salvar rascunho** (opcional): `PATCH` em versão draft ou criação de `PathwayVersion` com `published: false`.  
3. **Publicar:**  
   - Upsert de `PathwayStage` para bater com a lista (por `stageKey` ou id).  
   - Recalcular `sortOrder` 0..n-1.  
   - Marcar versão como `published: true` e despublicar anterior conforme regra.  
4. Pacientes **novos** entram na versão publicada atual; pacientes existentes: política de migração (fora do escopo mínimo — pode exigir manter `pathwayVersionId` até transição manual).

---

## Endpoints (sugestão de forma, alinhar a `/api/v1`)

| Ação | Método | Notas |
|------|--------|--------|
| Listar estágios da versão publicada | `GET /api/v1/pathways/:id/published-stages` ou embutido no dashboard payload | Ordenado por `sortOrder`. |
| Obter versão draft / criar nova versão | `GET/POST .../pathways/:id/versions` | |
| Atualizar ordem e definição de colunas | `PATCH /api/v1/pathways/:id/versions/:versionId` | Body atual: `graphJson` (fonte usada pelo editor). |
| Publicar versão | `POST /api/v1/pathways/:id/versions/:versionId/publish` | Transação: sync de `PathwayStage` + flag `published`. |
| Transição de paciente | `POST /api/v1/patient-pathways/:id/transition` | `toStageId` deve pertencer ao mesmo `pathwayVersionId`. |

Validação: sempre `tenantId` do contexto autenticado (ver regras em `ARCHITECTURE.md`).

---

## Transição entre colunas (Kanban)

- Entrada: `patientPathwayId`, `toStageId` (e opcionalmente `correlationId` para idempotência).  
- Regras:  
  - `toStageId` na mesma versão do paciente.  
  - Opcional: só permitir passos adjacentes na `sortOrder` ou qualquer etapa — **decisão de produto**; documentar na API.  
- Saída: `PatientPathway.currentStageId` atualizado, `StageTransition` gravado e `dispatchStub` com `correlationId` e bundle de `StageDocument` da etapa de destino. `ChannelDispatch` dedicado continua como evolução futura.

---

## Migrações Prisma

- Se faltar índice composto para listagem rápida: `(pathwayVersionId, sortOrder)`.  
- Garantir `@@unique([pathwayVersionId, stageKey])` já existente — ao renomear etapa, não mudar `stageKey` se houver integrações; ou política de migração.

---

## Critérios de aceite (backend)

- [ ] Ordem persistida reflete DnD após salvar/publicar.  
- [ ] Dashboard e editor leem a mesma ordenação.  
- [ ] Transição rejeita `toStageId` de outra versão ou outro tenant.  
- [ ] Publicação é atômica (transação).

---

## Relacionado

- [README.md](./README.md) — índice.  
- [column-editor-drag-drop.md](./column-editor-drag-drop.md)  
- [dashboard-kanban-dynamic-columns.md](./dashboard-kanban-dynamic-columns.md)  
- [../ARCHITECTURE.md](../ARCHITECTURE.md) — §8
