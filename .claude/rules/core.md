# Regra: core

Aplica-se a **todos os arquivos** do projeto.

## Documentação de referência

| Documento | Conteúdo |
|-----------|----------|
| `docs/ARCHITECTURE.md` | Arquitetura, modelo de dados (§8), auth, RBAC, notificações |
| `docs/PRODUCT-SCOPE.md` | Escopo de produto, jornada do paciente, fases |
| `docs/submanager/business-logic.md` | Regras de negócio consolidadas |
| `docs/DEV-PHASES.md` | Fases de implementação e status |
| `docs/API-DOCS.md` | Documentação API (Scalar + OpenAPI) |

Antes de modelar entidades novas, conferir se já existe equivalente na §8 ou se a doc precisa atualizar.

## Escopo técnico

- **Dentro do repo:** painel multi-tenant, orquestração da jornada, persistência, GCS (objetos), APIs `/api/v1`, webhooks que recebem callbacks de IA/chatbot.
- **Fora do repo:** implementação do canal WhatsApp/Meta, modelo de ML/inferência, treino — apenas clientes HTTP e contratos.

## Multi-tenant

- Todo registro de negócio com `tenantId`.
- Queries e use cases **sempre** filtram pelo tenant do contexto autenticado.
- **Nunca** aceitar `tenantId` só do body/query como verdade — derivar do JWT + `TenantMembership`, exceto `super_admin` com regra explícita e auditoria (ver §5.5 da arquitetura).

## RBAC

- `User.globalRole`: `super_admin` | `user` — gestão de tenants e contexto cross-tenant.
- `TenantMembership.role`: `tenant_admin` | `tenant_user` — permissões dentro do tenant.
- Guards centralizados em `src/lib/auth/guards.ts`:
  - `requireSessionOr401()` — sessão + rate limit
  - `getActiveTenantIdOr400()` — resolve tenant do token
  - `assertActiveTenantMembership()` — confirma membership
  - `superAdminOr403()` — exige super_admin
  - `assertTenantAdminOrSuper()` — tenant_admin ou super_admin
- Rotas `/admin/*`: apenas `globalRole === super_admin`.
- Operações clínicas exigem papel adequado no tenant ativo.
- Visibilidade de clientes: `TenantMembershipClientScope` restringe `tenant_user` a clientes atribuídos/vinculados — filtro em `src/lib/auth/client-visibility.ts`.

## LGPD / Dados sensíveis

- Minimizar logs com CPF, telefone, conteúdo de exame — preferir IDs internos e correlação.
- Arquivos clínicos no GCS com prefixo por tenant; URLs assinadas com TTL curto.
- `AuditEvent` sem payload clínico (LGPD compliance).

## Convenções gerais

- Respostas ao usuário em **português (Brasil)**, salvo pedido em outro idioma.
- Código e símbolos exportados em **inglês**.
- Diff **mínimo** e focado na tarefa; não refatorar arquivos não relacionados.
- Não criar documentos `.md` novos sem necessidade; preferir editar os existentes.
- Ao alterar rota `/api/v1/*` → atualizar `public/openapi.json`.
- Ao alterar modelo Prisma → verificar §8 da ARCHITECTURE.md.
