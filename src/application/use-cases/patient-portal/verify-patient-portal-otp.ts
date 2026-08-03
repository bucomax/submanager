import {
  PATIENT_PORTAL_OTP_MAX_ATTEMPTS,
  PATIENT_PORTAL_SESSION_MAX_AGE_SEC,
} from "@/lib/constants/patient-portal";
import { patientPortalOtpPrismaRepository } from "@/infrastructure/repositories/patient-portal-otp.repository";
import { portalPasswordVersionMs, type PatientPortalSessionPayload } from "@/lib/auth/patient-portal-session";
import { hashPatientPortalOtpCode } from "@/lib/utils/patient-portal-otp";
import { timingSafeEqualStrings } from "@/lib/utils/timing-safe-compare";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

export type VerifyPatientPortalOtpResult =
  | { ok: true; sessionPayload: PatientPortalSessionPayload }
  | { ok: false; code: "invalid" };

export async function runVerifyPatientPortalOtp(params: {
  tenant: { id: string; slug: string };
  client: PortalClientForLogin;
  code: string;
}): Promise<VerifyPatientPortalOtpResult> {
  const { tenant, client, code } = params;

  const challenge = await patientPortalOtpPrismaRepository.findLatestActiveChallenge(
    client.id,
    tenant.id,
  );

  if (!challenge) {
    return { ok: false, code: "invalid" };
  }

  if (challenge.attempts >= PATIENT_PORTAL_OTP_MAX_ATTEMPTS) {
    return { ok: false, code: "invalid" };
  }

  const expectedHash = hashPatientPortalOtpCode(code);
  if (!timingSafeEqualStrings(expectedHash, challenge.codeHash)) {
    await patientPortalOtpPrismaRepository.incrementChallengeAttempts(challenge.id);
    return { ok: false, code: "invalid" };
  }

  await patientPortalOtpPrismaRepository.markChallengeConsumed(challenge.id);

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
