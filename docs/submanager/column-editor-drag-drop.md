# A — Editor de fases: colunas apenas com drag-and-drop

## Objetivo

Na área de **Configurações → Fases do tratamento** (ou rota equivalente), o usuário define a jornada como uma **lista ordenada de colunas**:

- Cada coluna = uma **etapa** (`PathwayStage`) com nome exibido no Kanban.
- **Criar** nova coluna, **reordenar** por **drag-and-drop**, **editar** título e metadados operacionais da etapa (**SLA** + **checklist**).
- **Remover** coluna só se permitido pela regra de negócio (ex.: sem pacientes na etapa, ou apenas em rascunho).

Não há canvas de grafo nesta tela: **somente DnD em lista** (ou lista vertical de “cards de coluna” arrastáveis).

### Frontend e backend

Esta entrega **não é só front**: a lista só é útil com APIs de versão/estágios e **publicar** no servidor. Ver tabela **Parte A** em [frontend-backend-scope.md](./frontend-backend-scope.md).

---

## Comportamento da UI

1. **Lista ordenável**  
   - Biblioteca recomendada: **`@dnd-kit/core` + `@dnd-kit/sortable`** (acessível, compatível com React 19).  
   - Alternativa já usada no ecossistema: manter uma única abordagem no projeto.  
   - **Paginação / virtualização:** a lista de etapas (cada linha arrastável) também é uma listagem; acima de um limite (ex. 30–50) usar **lista virtualizada** ou carregar por páginas com UX clara — ver [listings-pagination-and-filters.md](./listings-pagination-and-filters.md). O `graphJson` não deve crescer sem teto no cliente.

2. **Ações por coluna**  
   - Inline ou menu: renomear, duplicar (opcional), excluir.  
   - Botão global: **“Adicionar etapa”** (insere no fim ou após seleção).

3. **Estados**  
   - **Rascunho:** edições locais ou em `PathwayVersion` não publicada.  
   - **Publicar:** persiste ordem definitiva e sincroniza `PathwayStage` + `sortOrder` (detalhes em [persistence-api-and-transitions.md](./persistence-api-and-transitions.md)).

4. **Validação**  
   - Mínimo de 1 etapa.  
   - Nome não vazio; `stageKey` estável gerado no backend ou no cliente (slug único por versão).  
   - Ao excluir: validar pacientes em `currentStageId` apontando para essa etapa.

5. **Tema**  
   - Reutilizar `Card`, `Button`, `Input`, `GripVertical` (Lucide), espaçamentos do `AppShell`.  
   - Feedback de arraste: sombra/borda com tokens `--border` / `ring`.

---

## Fora de escopo desta tela (por ora)

- Ramos condicionais tipo fluxograma (isso seria outro documento se voltar a um editor de grafo).  
- Anexar documentos por etapa: pode permanecer subformulário abaixo de cada coluna em iteração futura, sem mudar o modelo DnD da ordem.
- Checklist por etapa: pode viver no mesmo editor de colunas/draft do `graphJson`, desde que continue materializado ao publicar.

---

## Critérios de aceite

- [ ] Ordem das colunas na configuração = ordem das colunas no dashboard após publicar.  
- [ ] DnD funciona com teclado/s leitores (via @dnd-kit).  
- [ ] Lista de etapas comporta **muitos itens** sem travar (virtualização ou paginação).  
- [ ] Publicação cria ou atualiza `PathwayStage` com `sortOrder` consistente.  
- [ ] Não é necessário `@xyflow/react` nesta tela.

---

## Relacionado

- [listings-pagination-and-filters.md](./listings-pagination-and-filters.md)  
- [README.md](./README.md) — índice.  
- [persistence-api-and-transitions.md](./persistence-api-and-transitions.md) — como salvar e publicar.  
- [dashboard-kanban-dynamic-columns.md](./dashboard-kanban-dynamic-columns.md) — consumo no painel.
