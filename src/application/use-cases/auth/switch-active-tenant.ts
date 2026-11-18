import { AuditEventType } from "@prisma/client";

import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";
import { isSuperAdminActor, type Actor } from "@/domain/auth/actor";

export type SwitchActiveTenantResult =
  | {
      ok: true;
      tenantId: string;
      tenantRole: string | null;
    }
  | { ok: false; code: "TENANT_NOT_FOUND" | "TENANT_INACTIVE" | "FORBIDDEN" };

export async function runSwitchActiveTenant(params: {
  actor: Actor;
  tenantId: string;
}): Promise<SwitchActiveTenantResult> {
  const { actor, tenantId } = params;
  const userId = actor.userId;

  const tenant = await tenantPrismaRepository.findTenantSwitchStatus(tenantId);
  if (!tenant) {
    return { ok: false, code: "TENANT_NOT_FOUND" };
  }
  if (!tenant.isActive) {
    return { ok: false, code: "TENANT_INACTIVE" };
  }

  const membershipRole = await userPrismaRepository.getTenantMembershipRole(tenantId, userId);

  if (!membershipRole && !isSuperAdminActor(actor)) {
    return { ok: false, code: "FORBIDDEN" };
  }

  await userPrismaRepository.setActiveTenantId(userId, tenantId);

  // §5.5: super_admin atuando cross-tenant (sem membership) é sempre auditado.
  if (!membershipRole) {
    await auditEventPrismaRepository.recordCanonical({
      tenantId,
      clientId: null,
      patientPathwayId: null,
      actorUserId: userId,
      eventType: AuditEventType.SUPER_ADMIN_TENANT_ENTERED,
      payload: { tenantId },
    });
  }

  return {
    ok: true,
    tenantId,
    tenantRole: membershipRole ?? null,
  };
}
