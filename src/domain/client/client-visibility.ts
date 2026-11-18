/** Escopo de visibilidade de pacientes derivado do `TenantMembership` (e super_admin). */
export type TenantMembershipClientScope = {
  role: string;
  restrictedToAssignedOnly: boolean;
  linkedOpmeSupplierId: string | null;
};

export type TenantMembershipScopeRow = {
  role: string;
  restrictedToAssignedOnly: boolean;
  linkedOpmeSupplierId: string | null;
};

/** `super_admin` não tem membership: enxerga tudo no tenant do contexto (equivale a `tenant_admin`). */
export const SUPER_ADMIN_CLIENT_SCOPE: TenantMembershipClientScope = {
  role: "tenant_admin",
  restrictedToAssignedOnly: false,
  linkedOpmeSupplierId: null,
};

/** Membership ausente no tenant: o escopo mais restrito. */
export function clientScopeFromTenantMembershipRow(
  membership: TenantMembershipScopeRow | null,
): TenantMembershipClientScope {
  if (!membership) {
    return { role: "tenant_user", restrictedToAssignedOnly: true, linkedOpmeSupplierId: null };
  }
  return {
    role: membership.role,
    restrictedToAssignedOnly: membership.restrictedToAssignedOnly,
    linkedOpmeSupplierId: membership.linkedOpmeSupplierId,
  };
}

export function resolveClientScope(
  globalRole: string,
  membership: TenantMembershipScopeRow | null,
): TenantMembershipClientScope {
  return globalRole === "super_admin" ? SUPER_ADMIN_CLIENT_SCOPE : clientScopeFromTenantMembershipRow(membership);
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

export function isUnrestrictedClientScope(scope: TenantMembershipClientScope): boolean {
  return scope.role === "tenant_admin" || (!scope.restrictedToAssignedOnly && !scope.linkedOpmeSupplierId);
}

/** Filtro plano de visibilidade (`null` = sem restrição naquele eixo). Usado em SQL cru (dashboard). */
export type ClientVisibilityFlatFilter = {
  opmeSupplierId: string | null;
  assignedToUserId: string | null;
};

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

/** `metadata.clientId` em payloads de notificação / JSON plano. */
export function getClientIdFromPlainMetadata(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as { clientId?: unknown }).clientId;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/** Aviso ao tenant inteiro (in-app + lista); não esconder para membros com escopo “só atribuídos”. */
export function isPatientSelfRegisterMetadata(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as { source?: unknown }).source === "patient_self_register";
}

/**
 * Notificação visível? Sem `clientId` (ou self-register) sempre; com `clientId`, o paciente
 * precisa existir no tenant e estar no escopo.
 */
export function isNotificationVisibleForScope(
  metadata: unknown,
  client: { assignedToUserId: string | null; opmeSupplierId: string | null } | undefined,
  scope: TenantMembershipClientScope,
  viewerUserId: string,
): boolean {
  if (isPatientSelfRegisterMetadata(metadata)) return true;
  if (!getClientIdFromPlainMetadata(metadata)) return true;
  if (!client) return false;
  return canViewClientRow(client, scope, viewerUserId);
}
