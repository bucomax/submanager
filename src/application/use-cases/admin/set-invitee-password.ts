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
  | "MEMBERSHIP_MISSING"
  | "SELF_NOT_ALLOWED";

export type AdminSetInviteePasswordResult =
  | { ok: true; userId: string }
  | { ok: false; code: AdminSetInviteePasswordErrorCode };

/**
 * Admin sets or overrides the password for any tenant member.
 * Works for both pending invitees (passwordHash === null) and members who already have a password.
 * Invalidates all remaining INVITE_SET_PASSWORD tokens after setting the password.
 * The actor cannot reset their own password via this route — use the authenticated change-password flow instead.
 */
export async function runAdminSetInviteePassword(
  input: AdminSetInviteePasswordInput,
): Promise<AdminSetInviteePasswordResult> {
  const { userId, tenantId, password, actorUserId } = input;

  if (userId === actorUserId) {
    return { ok: false, code: "SELF_NOT_ALLOWED" };
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return { ok: false, code: "USER_NOT_FOUND" };
  }

  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { id: true },
  });

  if (!membership) {
    return { ok: false, code: "MEMBERSHIP_MISSING" };
  }

  const wasPending = user.passwordHash === null;

  const passwordHash = await bcrypt.hash(password, 12);

  await userPrismaRepository.setInitialPasswordForUser({ userId, passwordHash });

  await auditEventPrismaRepository.recordCanonical({
    tenantId,
    clientId: null,
    patientPathwayId: null,
    actorUserId,
    eventType: AuditEventType.STAFF_PASSWORD_RESET,
    payload: { userId, by: "admin_manual", actorUserId, wasPending },
  });

  return { ok: true, userId };
}
