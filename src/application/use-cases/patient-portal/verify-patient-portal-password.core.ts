import bcrypt from "bcryptjs";

import type { IPatientPortalLoginLockout } from "@/application/ports/patient-portal-login-lockout.port";
import type { IPortalLoginClientFinder } from "@/application/ports/patient-portal-login-client.port";
import type { ParsedPortalLogin } from "@/domain/auth/patient-portal-login-identifier";
import {
  buildPatientPortalSessionClaims,
  type PatientPortalSessionClaims,
} from "@/domain/auth/patient-portal-session";
import { spendPasswordCompareTime } from "@/lib/auth/dummy-password-compare";
import {
  PATIENT_PORTAL_PASSWORD_LOCKOUT_MS,
  PATIENT_PORTAL_PASSWORD_MAX_FAILED_ATTEMPTS,
  PATIENT_PORTAL_SESSION_MAX_AGE_SEC,
} from "@/lib/constants/patient-portal";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

export type VerifyPatientPortalPasswordResult =
  | { ok: true; sessionPayload: PatientPortalSessionClaims }
  | {
      ok: false;
      reason: "client_not_found" | "password_not_set" | "invalid_password" | "locked";
      /** Definido quando o cliente existe (para auditoria de falha). */
      client?: PortalClientForLogin;
    };

export type VerifyPatientPortalPasswordDeps = {
  clients: IPortalLoginClientFinder;
  lockout: IPatientPortalLoginLockout;
};

export async function verifyPatientPortalPassword(
  params: { tenant: { id: string; slug: string }; identifier: ParsedPortalLogin; password: string },
  deps: VerifyPatientPortalPasswordDeps,
): Promise<VerifyPatientPortalPasswordResult> {
  const { tenant, identifier, password } = params;
  const { lockout } = deps;

  // Todo desfecho de falha gasta um bcrypt (real ou fictício): a latência não revela se o CPF existe.
  const client = await deps.clients.findForPortalLogin(tenant.id, identifier);
  if (!client) {
    await spendPasswordCompareTime(password);
    return { ok: false, reason: "client_not_found" };
  }

  if (!client.portalPasswordHash) {
    await spendPasswordCompareTime(password);
    return { ok: false, reason: "password_not_set", client };
  }

  // Bloqueado: mesma resposta de senha inválida, sem comparar com o hash real (não dá para "adivinhar" durante o lock).
  if (await lockout.isLocked(client.id, new Date())) {
    await spendPasswordCompareTime(password);
    return { ok: false, reason: "locked", client };
  }

  const match = await bcrypt.compare(password, client.portalPasswordHash);
  if (!match) {
    await lockout.registerFailedAttempt(client.id, {
      now: new Date(),
      maxFailures: PATIENT_PORTAL_PASSWORD_MAX_FAILED_ATTEMPTS,
      lockMs: PATIENT_PORTAL_PASSWORD_LOCKOUT_MS,
    });
    return { ok: false, reason: "invalid_password", client };
  }

  await lockout.resetFailedAttempts(client.id);

  return {
    ok: true,
    sessionPayload: buildPatientPortalSessionClaims({
      tenant,
      client,
      nowMs: Date.now(),
      maxAgeSec: PATIENT_PORTAL_SESSION_MAX_AGE_SEC,
    }),
  };
}
