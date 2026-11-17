import { AuditEventType } from "@prisma/client";
import type { Session } from "next-auth";

import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";
import { requireSuperAdmin } from "@/lib/auth/guards";

export type SwitchActiveTenantResult =
  | {
      ok: true;
      tenantId: string;
      tenantRole: string | null;
    }
  | { ok: false; code: "TENANT_NOT_FOUND" | "TENANT_INACTIVE" | "FORBIDDEN" };

export async function runSwitchActiveTenant(params: {
  session: Session;
  tenantId: string;
}): Promise<SwitchActiveTenantResult> {
  const { session, tenantId } = params;
  const userId = session.user.id;

  const tenant = await tenantPrismaRepository.findTenantSwitchStatus(tenantId);
  if (!tenant) {
    return { ok: false, code: "TENANT_NOT_FOUND" };
  }
  if (!tenant.isActive) {
    return { ok: false, code: "TENANT_INACTIVE" };
  }

  const membershipRole = await userPrismaRepository.getTenantMembershipRole(tenantId, userId);

  if (!membershipRole && !requireSuperAdmin(session)) {
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
