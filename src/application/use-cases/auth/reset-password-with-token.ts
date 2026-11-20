import bcrypt from "bcryptjs";
import { AuthTokenPurpose, AuditEventType } from "@prisma/client";

import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";

export type ResetPasswordWithTokenResult =
  | { ok: true }
  | {
      ok: false;
      code: "INVALID_TOKEN" | "TOKEN_EXPIRED" | "USE_INVITE_FOR_FIRST_PASSWORD";
    };

export async function runResetPasswordWithToken(params: {
  token: string;
  newPassword: string;
}): Promise<ResetPasswordWithTokenResult> {
  const { token, newPassword } = params;

  const row = await userPrismaRepository.findUserAuthTokenWithUserForReset(token);

  if (
    !row ||
    row.usedAt ||
    (row.purpose !== AuthTokenPurpose.PASSWORD_RESET &&
      row.purpose !== AuthTokenPurpose.INVITE_SET_PASSWORD)
  ) {
    return { ok: false, code: "INVALID_TOKEN" };
  }

  if (row.expiresAt < new Date()) {
    return { ok: false, code: "TOKEN_EXPIRED" };
  }

  if (row.purpose === AuthTokenPurpose.PASSWORD_RESET && !row.user.passwordHash) {
    return { ok: false, code: "USE_INVITE_FOR_FIRST_PASSWORD" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const consumed = await userPrismaRepository.applyPasswordResetAndConsumeToken({
    tokenId: row.id,
    userId: row.userId,
    passwordHash,
    activeTenantId: row.tenantId ?? undefined,
  });
  if (!consumed) {
    return { ok: false, code: "INVALID_TOKEN" };
  }

  let auditTenantId = row.tenantId;
  if (!auditTenantId) {
    auditTenantId = await userPrismaRepository.findFirstTenantIdForUser(row.userId);
  }
  if (auditTenantId) {
    await auditEventPrismaRepository.recordCanonical({
      tenantId: auditTenantId,
      clientId: null,
      patientPathwayId: null,
      actorUserId: row.userId,
      eventType: AuditEventType.STAFF_PASSWORD_RESET,
      payload: { userId: row.userId },
    });
  }

  return { ok: true };
}
