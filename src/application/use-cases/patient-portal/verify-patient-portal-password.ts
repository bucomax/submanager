import { defaultPatientPortalDeps } from "@/infrastructure/composition/patient-portal-deps";
import {
  verifyPatientPortalPassword,
  type VerifyPatientPortalPasswordDeps,
  type VerifyPatientPortalPasswordResult,
} from "@/application/use-cases/patient-portal/verify-patient-portal-password.core";

export type {
  VerifyPatientPortalPasswordDeps,
  VerifyPatientPortalPasswordResult,
} from "@/application/use-cases/patient-portal/verify-patient-portal-password.core";

/** Ponto de entrada de produção (usado pela rota); a lógica vive em `verify-patient-portal-password.core.ts`. */
export function runVerifyPatientPortalPassword(
  params: Parameters<typeof verifyPatientPortalPassword>[0],
  deps: VerifyPatientPortalPasswordDeps = defaultPatientPortalDeps,
): Promise<VerifyPatientPortalPasswordResult> {
  return verifyPatientPortalPassword(params, deps);
}
