import type { IAuditRecorder } from "@/application/ports/audit-recorder.port";
import type { IClientRepository } from "@/application/ports/client-repository.port";
import type { ITenantListCache } from "@/application/ports/tenant-list-cache.port";
import type { IUserRepository } from "@/application/ports/user-repository.port";
import { AuditEventType } from "@/domain/audit/audit-event-type";

export type DeleteClientResult =
  | { ok: true }
  | { ok: false; code: "FORBIDDEN" | "NOT_FOUND" };

export type DeleteClientDeps = {
  clients: Pick<IClientRepository, "delete">;
  memberships: Pick<IUserRepository, "getTenantMembershipRole">;
  audit: IAuditRecorder;
  cache: Pick<ITenantListCache, "revalidateClientsList" | "revalidateOpmeSuppliersList">;
};

/**
 * Remove paciente (soft delete): RBAC (super_admin ou tenant_admin), persistência, cache, auditoria.
 */
export async function deleteClient(
  params: { tenantId: string; actorUserId: string; clientDbId: string; isSuperAdmin: boolean },
  deps: DeleteClientDeps,
): Promise<DeleteClientResult> {
  const { tenantId, actorUserId, clientDbId, isSuperAdmin } = params;

  if (!isSuperAdmin) {
    const role = await deps.memberships.getTenantMembershipRole(tenantId, actorUserId);
    if (role !== "tenant_admin") {
      return { ok: false, code: "FORBIDDEN" };
    }
  }

  const deleted = await deps.clients.delete(tenantId, clientDbId, actorUserId);
  if (!deleted) {
    return { ok: false, code: "NOT_FOUND" };
  }

  deps.cache.revalidateClientsList(tenantId);
  deps.cache.revalidateOpmeSuppliersList(tenantId);

  await deps.audit.record({
    tenantId,
    clientId: clientDbId,
    patientPathwayId: null,
    actorUserId,
    type: AuditEventType.PATIENT_DELETED,
    payload: { clientId: clientDbId, deletedByUserId: actorUserId },
  });

  return { ok: true };
}
