import bcrypt from "bcryptjs";
import { AuditEventType } from "@prisma/client";

import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";
import { prisma } from "@/infrastructure/database/prisma";

export type AdminSetInviteePasswordInput = {
  userId: string;
  tenantId: string;
  password: string;
  actorUserId: string;
};

export type AdminSetInviteePasswordErrorCode =
  | "USER_NOT_FOUND"
  | "USER_HAS_PASSWORD"
  | "MEMBERSHIP_MISSING";

export type AdminSetInviteePasswordResult =
  | { ok: true; userId: string }
  | { ok: false; code: AdminSetInviteePasswordErrorCode };

/**
 * Admin sets the password for a pending invitee (passwordHash === null).
 * Only works when the user has no password yet and belongs to the given tenant.
 * Invalidates all remaining INVITE_SET_PASSWORD tokens after setting the password.
 */
export async function runAdminSetInviteePassword(
  input: AdminSetInviteePasswordInput,
): Promise<AdminSetInviteePasswordResult> {
  const { userId, tenantId, password, actorUserId } = input;

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return { ok: false, code: "USER_NOT_FOUND" };
  }

  if (user.passwordHash !== null) {
    return { ok: false, code: "USER_HAS_PASSWORD" };
  }

  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { id: true },
  });

  if (!membership) {
    return { ok: false, code: "MEMBERSHIP_MISSING" };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await userPrismaRepository.setInitialPasswordForUser({ userId, passwordHash });

  await auditEventPrismaRepository.recordCanonical({
    tenantId,
    clientId: null,
    patientPathwayId: null,
    actorUserId,
    eventType: AuditEventType.STAFF_PASSWORD_RESET,
    payload: { userId, by: "admin_manual", actorUserId },
  });

  return { ok: true, userId };
}
