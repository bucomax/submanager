# Plano de execução — SubManager

Ordem prática de entrega, alinhada a [frontend-backend-scope.md](./frontend-backend-scope.md) e [database-backlog.md](./database-backlog.md). **Detalhes de API e UI** continuam nas páginas em `pages/` e em [listings-pagination-and-filters.md](./listings-pagination-and-filters.md).

---

## Congelado neste ciclo

Não há desenvolvimento ativo de **IA**, **WhatsApp (dispatch real)**, **webhooks externos** nem trilha **I1–I2** em `DEV-PHASES.md`. Stub de transição e docs de contrato permanecem; reabertura só com decisão explícita de produto.

---

## Status por fase

| Fase | Tema | Estado |
|------|------|--------|
| **0** | Publicar jornada, estágios, transição, `enteredStageAt`/SLA, Kanban API | ✅ |
| **1** | Editor de fases (DnD) + publicação em Configurações | ✅ |
| **2** | Dashboard: Kanban, métricas, alertas, filtros+URL, export CSV, DnD, modais | ✅ |
| **3.1** | Lista de pacientes paginada + filtros | ✅ |
| **3.2** | Detalhe do paciente: ficha, **linha do tempo** (`AuditEvent` + legado), transição, P1, notas, arquivos, checklist | ✅ *(integração real de envio de pacote = fora do escopo)* |
| **4.1.1** | OPME em settings (lista paginada + criação admin) | ✅ |
| **4.1.2** | Dados da clínica (`GET\|PATCH /tenant`) | ✅ |
| **4.1.3** | Preferências de notificação do tenant (flags) | ✅ |
| **4.1.4** | Integrações em settings | ⬜ placeholder |
| **4.2** | Relatórios read-only + export CSV | 🟨 parcial — KPIs, filtros, CSV; sem PDF/export assíncrono pesado |
| — | **Central in-app** (modelo `Notification`, APIs, sininho, **SSE**) + **BullMQ** fila `notifications` + Redis | ✅ ver `docs/ARCHITECTURE.md` §7.4–7.5 |
| **5+** | Gaps clínicos (convênio, campos extras), refinamentos de relatório | ⬜ sob demanda |

**Super admin:** criar tenant, listar tenants, card em settings — ✅ (já documentado em `DEV-PHASES` B6).

---

## O que falta (prioridade sugerida)

1. **4.2** — Aprofundar só se produto pedir: métricas clínicas, PDF, export assíncrono (provável BullMQ `reports-export`).
2. **4.1.4** — Manter placeholder; sem fluxos que dependam de terceiros até reabrir integrações.
3. **Fase 5 / backlog** — Campos clínicos adicionais e itens do [database-backlog.md](./database-backlog.md) conforme prioridade.
4. **Integrações I1–I2** — Congeladas (WhatsApp real, IA, webhooks).

---

## Critérios rápidos entre fases

- **0→2:** publicar = verdade do Kanban; transição = mesma API no botão e no DnD; filtros alinhados à doc de listagens.
- **3:** detalhe com deep link; lista paginada; sem vazamento cross-tenant.

---

## Referências

| Doc | Conteúdo |
|-----|----------|
| [README.md](./README.md) | Índice SubManager |
| [database-backlog.md](./database-backlog.md) | Migrations e ideias de modelo |
| [listings-pagination-and-filters.md](./listings-pagination-and-filters.md) | Paginação e filtros |
| [pages/README.md](./pages/README.md) | Páginas por entidade |
| [docs/ARCHITECTURE.md](../ARCHITECTURE.md) | Notificações, BullMQ, SSE |
