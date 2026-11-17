import bcrypt from "bcryptjs";
import {
  PATIENT_PORTAL_PASSWORD_LOCKOUT_MS,
  PATIENT_PORTAL_PASSWORD_MAX_FAILED_ATTEMPTS,
  PATIENT_PORTAL_SESSION_MAX_AGE_SEC,
} from "@/lib/constants/patient-portal";
import { patientPortalLoginLockoutPrismaRepository as lockout } from "@/infrastructure/repositories/patient-portal-login-lockout.repository";
import {
  portalPasswordVersionMs,
  type PatientPortalSessionPayload,
} from "@/lib/auth/patient-portal-session";
import { findClientForPortalLogin } from "@/application/use-cases/client/find-client-for-portal-login";
import type { ParsedPortalLogin } from "@/domain/auth/patient-portal-login-identifier";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

export type VerifyPatientPortalPasswordResult =
  | { ok: true; sessionPayload: PatientPortalSessionPayload }
  | {
      ok: false;
      reason: "client_not_found" | "password_not_set" | "invalid_password" | "locked";
      /** Definido quando o cliente existe (para auditoria de falha). */
      client?: PortalClientForLogin;
    };

export async function runVerifyPatientPortalPassword(params: {
  tenant: { id: string; slug: string };
  identifier: ParsedPortalLogin;
  password: string;
}): Promise<VerifyPatientPortalPasswordResult> {
  const { tenant, identifier, password } = params;

  const client = await findClientForPortalLogin(tenant.id, identifier);
  if (!client) {
    return { ok: false, reason: "client_not_found" };
  }

  if (!client.portalPasswordHash) {
    return { ok: false, reason: "password_not_set", client };
  }

  // Bloqueado: mesma resposta de senha inválida, sem sequer comparar (não dá para "adivinhar" durante o lock).
  if (await lockout.isLocked(client.id, new Date())) {
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

  const exp = Math.floor(Date.now() / 1000) + PATIENT_PORTAL_SESSION_MAX_AGE_SEC;
  const sessionPayload: PatientPortalSessionPayload = {
    clientId: client.id,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    exp,
    pwdv: portalPasswordVersionMs(client.portalPasswordChangedAt),
  };

  return { ok: true, sessionPayload };
}
