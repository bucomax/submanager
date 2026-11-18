import { defaultPatientPortalDeps } from "@/infrastructure/composition/patient-portal-deps";
import {
  verifyPatientPortalOtp,
  type VerifyPatientPortalOtpDeps,
  type VerifyPatientPortalOtpResult,
} from "@/application/use-cases/patient-portal/verify-patient-portal-otp.core";

export type {
  VerifyPatientPortalOtpDeps,
  VerifyPatientPortalOtpResult,
} from "@/application/use-cases/patient-portal/verify-patient-portal-otp.core";

/** Ponto de entrada de produção (usado pela rota); a lógica vive em `verify-patient-portal-otp.core.ts`. */
export function runVerifyPatientPortalOtp(
  params: Parameters<typeof verifyPatientPortalOtp>[0],
  deps: VerifyPatientPortalOtpDeps = defaultPatientPortalDeps,
): Promise<VerifyPatientPortalOtpResult> {
  return verifyPatientPortalOtp(params, deps);
}
