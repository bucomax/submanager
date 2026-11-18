import { defaultPatientPortalDeps } from "@/infrastructure/composition/patient-portal-deps";
import {
  requestPatientPortalOtp,
  type RequestPatientPortalOtpDeps,
  type RequestPatientPortalOtpResult,
} from "@/application/use-cases/patient-portal/request-patient-portal-otp.core";

export type {
  RequestPatientPortalOtpDeps,
  RequestPatientPortalOtpResult,
} from "@/application/use-cases/patient-portal/request-patient-portal-otp.core";

/** Ponto de entrada de produção (usado pela rota); a lógica vive em `request-patient-portal-otp.core.ts`. */
export function runRequestPatientPortalOtp(
  params: Parameters<typeof requestPatientPortalOtp>[0],
  deps: RequestPatientPortalOtpDeps = defaultPatientPortalDeps,
): Promise<RequestPatientPortalOtpResult> {
  return requestPatientPortalOtp(params, deps);
}
