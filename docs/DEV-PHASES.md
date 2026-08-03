# Etapas de desenvolvimento

Ordem geral histórica: **backend** (APIs, dados, e-mail, storage) → **frontend** (login → perfil → shell → jornada). **Estado atual:** núcleo B0–B11 e F1–F8 está **entregue**; evolução segue [docs/submanager/execution-plan.md](./submanager/execution-plan.md).

**E-mail:** referência de layout kaber.ai; no repo iDoctor: `src/infrastructure/email/email-templates.ts`. Variáveis Resend/GCS só em `.env` (ver `.env.example`).

---

## Status — backend

| Fase | Estado | Descrição |
|------|--------|-----------|
| B0 | ✅ | Bootstrap Next.js, pastas, Docker Postgres, `.env.example` |
| B1 | ✅ | Prisma auth + multi-tenant + migrations + seed |
| B2 | ✅ | NextAuth Credentials + JWT + `/login` |
| B3 | ✅ | Middleware (`/dashboard`) |
| B4 | ✅ | Prisma singleton + `api-response` |
| B5 | ✅ | `/api/v1/health`, `/me`, Scalar + OpenAPI |
| B6 | ✅ | Tenant ativo, `GET /tenants`, admin cria tenant, switcher + card super_admin em settings |
| B7 | ✅ | Resend + templates HTML |
| B8 | ✅ | Recuperação de senha + convite / definir senha |
| B9 | ✅ | Perfil, soft delete, membros admin |
| B10 | ✅ | Client + FileAsset + GCS presign |
| B11 | ✅ | Jornada (`CarePathway`, versões, `graphJson`, etapas, `PatientPathway`, transição + stub) |
| **B12** | ✅ | **Notificações in-app** + **BullMQ** (fila `notifications`) + **Redis** + **SSE** (`/api/v1/notifications/stream`); ver `docs/ARCHITECTURE.md` §7.4–7.5 |

---

## Status — frontend

| Fase | Estado | Descrição |
|------|--------|-----------|
| F1 | ✅ | Login + esqueci senha |
| F2 | ✅ | Redefinir senha + definir senha (convite); *confirmar e-mail opcional: ainda não* |
| F3 | ✅ | Perfil e permissões em `/dashboard/settings` |
| F4 | ✅ | Soft delete da conta |
| F5 | ✅ | Convite de usuário (admin) |
| F6 | ✅ | Shell, sidebar, tema, tenant switcher |
| F7 | ✅ | Wizard novo paciente |
| F8 | ✅ | Editor XYFlow, lista de jornadas, ficha/transição de paciente |
| **F9** | ✅ | **Sininho de notificações** + painel (lista cursor) + **EventSource (SSE)** para badge/tempo real |

---

## Detalhe backend (referência)

### B6 — RBAC e tenant

- `super_admin`: `POST /api/v1/admin/tenants`, `GET /api/v1/tenants`, `POST /api/v1/auth/context` + `TenantSwitcher`; card dedicado em settings para criar/trocar contexto.

### B9–B11

Conforme seções anteriores do repositório: perfil, clientes, jornada e transição. Critérios de pronto atendidos.

### B12 — Notificações + filas (implementado)

- **Redis** (ex.: `docker-compose`) + `REDIS_URL`.
- **BullMQ:** fila `notifications`, worker via `src/instrumentation.ts`; emissão pelo port `INotificationEmitter` (adapter enfileira; worker persiste `Notification` e publica pub/sub).
- **SSE:** `GET /api/v1/notifications/stream` para push ao browser; lista/contagem/read seguem rotas REST em `/api/v1/notifications/*`.

### Linha do tempo do paciente (`AuditEvent`)

- Tabela `AuditEvent` + enum de tipo; helper `recordAuditEvent` (`src/infrastructure/audit/record-audit-event.ts`).
- `GET /api/v1/clients/:id/timeline` (merge com `StageTransition` legado, dedup por `transitionId` no payload do audit).
- UI na ficha: `ClientDetailTimelineSection`; doc em `docs/ARCHITECTURE.md` §8.

---

## Detalhe frontend (referência)

### Padrão de features

- [FRONTEND-FEATURES.md](./FRONTEND-FEATURES.md) · regra `.cursor/rules/frontend-feature.mdc`.

### F3–F8

Perfil em settings (conta legada `/dashboard/account` redireciona), wizard paciente, editor de jornada — todos ✅.

### F9 — Notificações

- Feature `src/features/notifications/`: hook com SSE, painel, i18n `notifications`.

---

## Integrações (I1–I3)

| Fase | Conteúdo | Estado |
|------|----------|--------|
| I1 | WhatsApp (dispatch real) | ⬜ congelado |
| I2 | IA + webhooks | ⬜ congelado |
| I3 | Filas / retries **operacionais** (dispatch, exports pesados, jobs clínicos) | 🟨 **parcial:** BullMQ + Redis já usados para **notificações in-app**; restante conforme produto |

**Nota:** O que está implementado (B12) não substitui I1/I2; documentação de contratos e stubs permanece até reabertura do escopo.

---

## Checklist rápido

| Área | Estado |
|------|--------|
| Backend B0–B12 | ✅ |
| Linha do tempo / `AuditEvent` + `GET /clients/:id/timeline` | ✅ ver `docs/ARCHITECTURE.md` §8 |
| Frontend F1–F9 | ✅ |
| Integrações I1–I2 | ⬜ adiadas |
| I3 (filas além de notificações) | 🟨 quando necessário |

---

## Comandos úteis

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

*(Subir **Redis** no compose para BullMQ/SSE em dev.)*

---

## Próximo passo

Alinhado ao [execution-plan.md](./submanager/execution-plan.md): refinamentos de **4.2** sob demanda; **4.1.4** como placeholder; gaps clínicos leves e backlog; **I1–I2** e dispatch real só após reabrir integrações.
