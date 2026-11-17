import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { clientPrismaRepository } from "@/infrastructure/repositories/client.repository";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";
import { buildKanbanClientNestedWhere } from "@/lib/pathway/kanban-client-where";

/** Escopo de visibilidade de pacientes derivado do `TenantMembership` (e super_admin). */
export type TenantMembershipClientScope = {
  role: string;
  restrictedToAssignedOnly: boolean;
  linkedOpmeSupplierId: string | null;
};

const EMPTY_WHERE: Prisma.ClientWhereInput = {};

/** Membership ausente no tenant: mesmo default que `loadTenantMembershipClientScope`. */
export function clientScopeFromTenantMembershipRow(
  membership: {
    role: string;
    restrictedToAssignedOnly: boolean;
    linkedOpmeSupplierId: string | null;
  } | null,
): TenantMembershipClientScope {
  if (!membership) {
    return {
      role: "tenant_user",
      restrictedToAssignedOnly: true,
      linkedOpmeSupplierId: null,
    };
  }
  return {
    role: membership.role,
    restrictedToAssignedOnly: membership.restrictedToAssignedOnly,
    linkedOpmeSupplierId: membership.linkedOpmeSupplierId,
  };
}

/**
 * Carrega flags de escopo no tenant ativo.
 * `super_admin` não tem membership: retorna escopo equivalente a `tenant_admin` (vê tudo no tenant do contexto).
 */
export async function loadTenantMembershipClientScope(
  userId: string,
  tenantId: string,
  globalRole: string,
): Promise<TenantMembershipClientScope> {
  if (globalRole === "super_admin") {
    return {
      role: "tenant_admin",
      restrictedToAssignedOnly: false,
      linkedOpmeSupplierId: null,
    };
  }

  const m = await tenantPrismaRepository.findMembershipScopeForClientVisibility(userId, tenantId);

  return clientScopeFromTenantMembershipRow(m);
}

/** `metadata.clientId` em payloads de notificação / JSON plano. */
export function getClientIdFromPlainMetadata(metadata: Record<string, unknown> | undefined): string | null {
  if (metadata == null) return null;
  const raw = metadata.clientId;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/** `tenant_admin` (e super_admin tratado como tal) ignora restrições. */
export function buildClientVisibilityWhereInput(
  scope: TenantMembershipClientScope,
  viewerUserId: string,
): Prisma.ClientWhereInput {
  if (scope.role === "tenant_admin") {
    return EMPTY_WHERE;
  }

  const parts: Prisma.ClientWhereInput[] = [];
  if (scope.linkedOpmeSupplierId) {
    parts.push({ opmeSupplierId: scope.linkedOpmeSupplierId });
  }
  if (scope.restrictedToAssignedOnly) {
    parts.push({ assignedToUserId: viewerUserId });
  }

  if (parts.length === 0) return EMPTY_WHERE;
  if (parts.length === 1) return parts[0]!;
  return { AND: parts };
}

export function mergeClientWhereWithVisibility(
  base: Prisma.ClientWhereInput,
  scope: TenantMembershipClientScope,
  viewerUserId: string,
): Prisma.ClientWhereInput {
  const v = buildClientVisibilityWhereInput(scope, viewerUserId);
  if (Object.keys(v).length === 0) return base;
  return { AND: [base, v] };
}

/** `client` aninhado em `PatientPathwayWhereInput` (Kanban / dashboard). */
export function mergeKanbanClientNestedWhereWithVisibility(
  nested: Prisma.ClientWhereInput,
  scope: TenantMembershipClientScope,
  viewerUserId: string,
): Prisma.ClientWhereInput {
  return mergeClientWhereWithVisibility(nested, scope, viewerUserId);
}

export function buildClientDetailWhere(
  tenantId: string,
  clientId: string,
  scope: TenantMembershipClientScope,
  viewerUserId: string,
): Prisma.ClientWhereInput {
  const base: Prisma.ClientWhereInput = {
    id: clientId,
    tenantId,
    deletedAt: null,
  };
  return mergeClientWhereWithVisibility(base, scope, viewerUserId);
}

/** Filtro aninhado `PatientPathway.client` para Kanban/dashboard com RBAC. */
export async function buildKanbanClientWhereForSession(
  session: Session,
  tenantId: string,
  search: string,
  opmeSupplierId: string | undefined,
): Promise<Prisma.ClientWhereInput> {
  const scope = await loadTenantMembershipClientScope(
    session.user.id,
    tenantId,
    session.user.globalRole,
  );
  const nested = buildKanbanClientNestedWhere(search, opmeSupplierId);
  return mergeKanbanClientNestedWhereWithVisibility(nested, scope, session.user.id);
}

export async function findTenantClientVisibleToSession<S extends Prisma.ClientSelect>(
  session: Session,
  tenantId: string,
  clientId: string,
  select: S,
): Promise<Prisma.ClientGetPayload<{ select: S }> | null> {
  const scope = await loadTenantMembershipClientScope(
    session.user.id,
    tenantId,
    session.user.globalRole,
  );
  return clientPrismaRepository.findFirstWhere(
    buildClientDetailWhere(tenantId, clientId, scope, session.user.id),
    select,
  ) as Promise<Prisma.ClientGetPayload<{ select: S }> | null>;
}

export function canViewClientRow(
  client: { assignedToUserId: string | null; opmeSupplierId: string | null },
  scope: TenantMembershipClientScope,
  viewerUserId: string,
): boolean {
  if (scope.role === "tenant_admin") return true;
  if (scope.linkedOpmeSupplierId && client.opmeSupplierId !== scope.linkedOpmeSupplierId) {
    return false;
  }
  if (scope.restrictedToAssignedOnly && client.assignedToUserId !== viewerUserId) {
    return false;
  }
  return true;
}

/**
 * Mantém apenas usuários que enxergam o paciente no tenant (OPME + só atribuídos + admin).
 * Consultas em lote para muitos destinatários (ex.: «todos os membros» com `metadata.clientId`).
 */
export async function filterUserIdsWhoCanViewClient(
  tenantId: string,
  clientId: string,
  candidateUserIds: string[],
): Promise<string[]> {
  const unique = [...new Set(candidateUserIds)];
  if (unique.length === 0) return [];

  const client = await clientPrismaRepository.findClientAssigneeSummary(tenantId, clientId);
  if (!client) return [];

  const users = await userPrismaRepository.findUsersGlobalRoleByIds(unique);
  const userById = new Map(users.map((u) => [u.id, u]));

  const memberships = await userPrismaRepository.findTenantMembershipsScopeForUsers(tenantId, unique);
  const membershipByUserId = new Map(memberships.map((m) => [m.userId, m]));

  const result: string[] = [];
  for (const uid of unique) {
    const u = userById.get(uid);
    if (!u) continue;

    const scope: TenantMembershipClientScope =
      u.globalRole === "super_admin"
        ? {
            role: "tenant_admin",
            restrictedToAssignedOnly: false,
            linkedOpmeSupplierId: null,
          }
        : clientScopeFromTenantMembershipRow(membershipByUserId.get(uid) ?? null);

    if (canViewClientRow(client, scope, uid)) {
      result.push(uid);
    }
  }
  return result;
}

function metadataClientId(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as { clientId?: unknown }).clientId;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/** Aviso ao tenant inteiro (in-app + lista); não esconder para membros com escopo “só atribuídos”. */
function metadataSourceIsPatientSelfRegister(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as { source?: unknown }).source === "patient_self_register";
}

type NotificationRow = { id: string; metadata: Prisma.JsonValue | null };

/**
 * Filtra notificações cujo `metadata.clientId` aponta para paciente fora do escopo.
 * Notificações **sem** `clientId` no metadata permanecem (ex.: evoluções futuras).
 */
export async function filterNotificationsByClientScope(
  rows: NotificationRow[],
  tenantId: string,
  scope: TenantMembershipClientScope,
  viewerUserId: string,
): Promise<NotificationRow[]> {
  if (scope.role === "tenant_admin") return rows;
  if (!scope.restrictedToAssignedOnly && !scope.linkedOpmeSupplierId) return rows;

  const clientIds = [...new Set(rows.map((r) => metadataClientId(r.metadata)).filter(Boolean))] as string[];
  if (clientIds.length === 0) return rows;

  const clients = await clientPrismaRepository.findClientsAssigneeFieldsByIds(tenantId, clientIds);
  const map = new Map(clients.map((c) => [c.id, c]));

  return rows.filter((n) => {
    if (metadataSourceIsPatientSelfRegister(n.metadata)) return true;
    const cid = metadataClientId(n.metadata);
    if (!cid) return true;
    const c = map.get(cid);
    if (!c) return false;
    return canViewClientRow(c, scope, viewerUserId);
  });
}

/** Filtro plano de visibilidade (`null` = sem restrição naquele eixo). Usado em SQL cru (dashboard). */
export type ClientVisibilityFlatFilter = {
  opmeSupplierId: string | null;
  assignedToUserId: string | null;
};

/** Mesma regra de `buildClientVisibilityWhereInput`, em forma plana. */
export function buildClientVisibilityFlatFilter(
  scope: TenantMembershipClientScope,
  viewerUserId: string,
): ClientVisibilityFlatFilter {
  if (scope.role === "tenant_admin") {
    return { opmeSupplierId: null, assignedToUserId: null };
  }
  return {
    opmeSupplierId: scope.linkedOpmeSupplierId,
    assignedToUserId: scope.restrictedToAssignedOnly ? viewerUserId : null,
  };
}

function isUnrestrictedClientScope(scope: TenantMembershipClientScope): boolean {
  return scope.role === "tenant_admin" || (!scope.restrictedToAssignedOnly && !scope.linkedOpmeSupplierId);
}

/**
 * Visibilidade de `Conversation` (lead/WhatsApp):
 * - com paciente vinculado: o paciente precisa estar no escopo do usuário;
 * - sem paciente (lead puro): usuário vinculado a fornecedor OPME nunca vê; usuário "só atribuídos"
 *   vê apenas se a conversa estiver atribuída a ele (`assignedToUserId`); irrestrito/admin vê todos.
 */
export function buildConversationVisibilityWhereInput(
  scope: TenantMembershipClientScope,
  viewerUserId: string,
): Prisma.ConversationWhereInput {
  if (isUnrestrictedClientScope(scope)) return {};
  const clientWhere = buildClientVisibilityWhereInput(scope, viewerUserId);
  if (scope.linkedOpmeSupplierId) {
    return { client: clientWhere };
  }
  return {
    OR: [{ client: clientWhere }, { clientId: null, assignedToUserId: viewerUserId }],
  };
}

/**
 * Visibilidade de `AgendaEvent`: com `clientId` segue o paciente; sem paciente mas com conversa segue a
 * conversa; sem nenhum dos dois, usuário "só atribuídos" (sem OPME) vê apenas os que ele é responsável.
 */
export function buildAgendaEventVisibilityWhereInput(
  scope: TenantMembershipClientScope,
  viewerUserId: string,
): Prisma.AgendaEventWhereInput {
  if (isUnrestrictedClientScope(scope)) return {};
  const clientWhere = buildClientVisibilityWhereInput(scope, viewerUserId);
  const parts: Prisma.AgendaEventWhereInput[] = [
    { client: clientWhere },
    { clientId: null, conversation: buildConversationVisibilityWhereInput(scope, viewerUserId) },
  ];
  if (!scope.linkedOpmeSupplierId) {
    parts.push({ clientId: null, conversationId: null, ownerUserId: viewerUserId });
  }
  return { OR: parts };
}

export async function loadConversationVisibilityWhere(
  session: Session,
  tenantId: string,
): Promise<Prisma.ConversationWhereInput> {
  const scope = await loadTenantMembershipClientScope(session.user.id, tenantId, session.user.globalRole);
  return buildConversationVisibilityWhereInput(scope, session.user.id);
}

export async function loadAgendaEventVisibilityWhere(
  session: Session,
  tenantId: string,
): Promise<Prisma.AgendaEventWhereInput> {
  const scope = await loadTenantMembershipClientScope(session.user.id, tenantId, session.user.globalRole);
  return buildAgendaEventVisibilityWhereInput(scope, session.user.id);
}
