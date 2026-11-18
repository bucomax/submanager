import type { IPatientPortalOtpRepository } from "@/application/ports/patient-portal-otp-repository.port";
import {
  buildPatientPortalSessionClaims,
  type PatientPortalSessionClaims,
} from "@/domain/auth/patient-portal-session";
import {
  PATIENT_PORTAL_OTP_MAX_ATTEMPTS,
  PATIENT_PORTAL_SESSION_MAX_AGE_SEC,
} from "@/lib/constants/patient-portal";
import { hashPatientPortalOtpCode } from "@/lib/utils/patient-portal-otp";
import { timingSafeEqualStrings } from "@/lib/utils/timing-safe-compare";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

export type VerifyPatientPortalOtpResult =
  | { ok: true; sessionPayload: PatientPortalSessionClaims }
  | { ok: false; code: "invalid" };

export type VerifyPatientPortalOtpDeps = {
  otp: Pick<
    IPatientPortalOtpRepository,
    "findLatestActiveChallenge" | "reserveChallengeAttempt" | "consumeChallengeIfPending"
  >;
};

export async function verifyPatientPortalOtp(
  params: { tenant: { id: string; slug: string }; client: PortalClientForLogin; code: string },
  deps: VerifyPatientPortalOtpDeps,
): Promise<VerifyPatientPortalOtpResult> {
  const { tenant, client, code } = params;
  const { otp } = deps;

  const challenge = await otp.findLatestActiveChallenge(client.id, tenant.id);
  if (!challenge) {
    return { ok: false, code: "invalid" };
  }

  // Reserva a tentativa ANTES de comparar: palpites paralelos não escapam do limite.
  if (!(await otp.reserveChallengeAttempt(challenge.id, PATIENT_PORTAL_OTP_MAX_ATTEMPTS))) {
    return { ok: false, code: "invalid" };
  }

  const expectedHash = hashPatientPortalOtpCode(code);
  if (!timingSafeEqualStrings(expectedHash, challenge.codeHash)) {
    return { ok: false, code: "invalid" };
  }

  if (!(await otp.consumeChallengeIfPending(challenge.id))) {
    return { ok: false, code: "invalid" };
  }

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
