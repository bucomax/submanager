import bcrypt from "bcryptjs";
import { AuditEventType, GlobalRole } from "@prisma/client";

import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";

export type AdminSetInviteePasswordInput = {
  userId: string;
  tenantId: string;
  password: string;
  actorUserId: string;
};

export type AdminSetInviteePasswordErrorCode =
  | "USER_NOT_FOUND"
  | "MEMBERSHIP_MISSING"
  | "SELF_NOT_ALLOWED"
  | "USER_NOT_ELIGIBLE";

export type AdminSetInviteePasswordResult =
  | { ok: true; userId: string }
  | { ok: false; code: AdminSetInviteePasswordErrorCode };

/**
 * Admin sets the first password of a PENDING invitee (passwordHash === null).
 * Refuses (USER_NOT_ELIGIBLE) when the target is super_admin, already has a password, or belongs
 * to any other tenant — the password is global, so overriding it would be an account takeover
 * (even for super_admin actors: users with a password must use the reset e-mail flow).
 * Invalidates all remaining INVITE_SET_PASSWORD tokens and revokes existing sessions.
 * The actor cannot use this route on themselves.
 */
export async function runAdminSetInviteePassword(
  input: AdminSetInviteePasswordInput,
): Promise<AdminSetInviteePasswordResult> {
  const { userId, tenantId, password, actorUserId } = input;

  if (userId === actorUserId) {
    return { ok: false, code: "SELF_NOT_ALLOWED" };
  }

  const user = await userPrismaRepository.findUserForAdminSetPassword(userId, tenantId);

  if (!user) {
    return { ok: false, code: "USER_NOT_FOUND" };
  }

  if (!user.hasMembershipInTenant) {
    return { ok: false, code: "MEMBERSHIP_MISSING" };
  }

  if (
    user.globalRole === GlobalRole.super_admin ||
    user.passwordHash !== null ||
    user.hasMembershipInOtherTenant
  ) {
    return { ok: false, code: "USER_NOT_ELIGIBLE" };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await userPrismaRepository.setInitialPasswordForUser({ userId, passwordHash });

  await auditEventPrismaRepository.recordCanonical({
    tenantId,
    clientId: null,
    patientPathwayId: null,
    actorUserId,
    eventType: AuditEventType.STAFF_PASSWORD_RESET,
    payload: { userId, by: "admin_manual", actorUserId, wasPending: true },
  });

  return { ok: true, userId };
}
