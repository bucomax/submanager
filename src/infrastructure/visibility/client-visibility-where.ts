import type { Prisma } from "@prisma/client";

import { isUnrestrictedClientScope, type TenantMembershipClientScope } from "@/domain/client/client-visibility";

const EMPTY_WHERE: Prisma.ClientWhereInput = {};

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
  const base: Prisma.ClientWhereInput = { id: clientId, tenantId, deletedAt: null };
  return mergeClientWhereWithVisibility(base, scope, viewerUserId);
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
