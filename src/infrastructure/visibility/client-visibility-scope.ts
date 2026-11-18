import type { Prisma } from "@prisma/client";

import type { IClientVisibilityScopeReader } from "@/application/ports/client-visibility-scope-reader.port";
import type { Actor } from "@/domain/auth/actor";
import {
  canViewClientRow,
  resolveClientScope,
  type TenantMembershipClientScope,
} from "@/domain/client/client-visibility";
import { clientPrismaRepository } from "@/infrastructure/repositories/client.repository";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";
import {
  buildAgendaEventVisibilityWhereInput,
  buildClientDetailWhere,
  buildConversationVisibilityWhereInput,
  mergeKanbanClientNestedWhereWithVisibility,
} from "@/infrastructure/visibility/client-visibility-where";
import { buildKanbanClientNestedWhere } from "@/lib/pathway/kanban-client-where";

/** Implementação Prisma do port de escopo. `super_admin` não consulta membership. */
export const prismaClientVisibilityScopeReader: IClientVisibilityScopeReader = {
  async loadScope(userId, tenantId, globalRole) {
    if (globalRole === "super_admin") return resolveClientScope(globalRole, null);
    const membership = await tenantPrismaRepository.findMembershipScopeForClientVisibility(userId, tenantId);
    return resolveClientScope(globalRole, membership);
  },
};

export function loadTenantMembershipClientScope(
  userId: string,
  tenantId: string,
  globalRole: string,
): Promise<TenantMembershipClientScope> {
  return prismaClientVisibilityScopeReader.loadScope(userId, tenantId, globalRole);
}

function loadActorScope(actor: Actor, tenantId: string): Promise<TenantMembershipClientScope> {
  return prismaClientVisibilityScopeReader.loadScope(actor.userId, tenantId, actor.globalRole);
}

/** Filtro aninhado `PatientPathway.client` para Kanban/dashboard com RBAC. */
export async function buildKanbanClientWhereForActor(
  actor: Actor,
  tenantId: string,
  search: string,
  opmeSupplierId: string | undefined,
): Promise<Prisma.ClientWhereInput> {
  const scope = await loadActorScope(actor, tenantId);
  const nested = buildKanbanClientNestedWhere(search, opmeSupplierId);
  return mergeKanbanClientNestedWhereWithVisibility(nested, scope, actor.userId);
}

export async function findTenantClientVisibleToActor<S extends Prisma.ClientSelect>(
  actor: Actor,
  tenantId: string,
  clientId: string,
  select: S,
): Promise<Prisma.ClientGetPayload<{ select: S }> | null> {
  const scope = await loadActorScope(actor, tenantId);
  return clientPrismaRepository.findFirstWhere(
    buildClientDetailWhere(tenantId, clientId, scope, actor.userId),
    select,
  ) as Promise<Prisma.ClientGetPayload<{ select: S }> | null>;
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

  return unique.filter((uid) => {
    const user = userById.get(uid);
    if (!user) return false;
    const scope = resolveClientScope(user.globalRole, membershipByUserId.get(uid) ?? null);
    return canViewClientRow(client, scope, uid);
  });
}

export async function loadConversationVisibilityWhere(
  actor: Actor,
  tenantId: string,
): Promise<Prisma.ConversationWhereInput> {
  return buildConversationVisibilityWhereInput(await loadActorScope(actor, tenantId), actor.userId);
}

export async function loadAgendaEventVisibilityWhere(
  actor: Actor,
  tenantId: string,
): Promise<Prisma.AgendaEventWhereInput> {
  return buildAgendaEventVisibilityWhereInput(await loadActorScope(actor, tenantId), actor.userId);
}
