import { defaultPatientSelfRegisterDeps } from "@/infrastructure/composition/patient-self-register-deps";
import { publicPatientSelfRegisterBodySchema } from "@/lib/validators/client";
import {
  completePatientSelfRegister,
  loadPatientSelfRegisterInvitePreviewWith,
  type CompletePatientSelfRegisterResult,
  type PatientSelfRegisterDeps,
  type PatientSelfRegisterGetPreview,
  type ProcessPatientSelfRegisterBody,
} from "@/application/use-cases/self-register/process-patient-self-register.core";

export type {
  CompletePatientSelfRegisterErrorCode,
  PatientSelfRegisterDeps,
  PatientSelfRegisterGetPreview,
  ProcessPatientSelfRegisterBody,
} from "@/application/use-cases/self-register/process-patient-self-register.core";

export { publicPatientSelfRegisterBodySchema };

/** Pontos de entrada de produção (usados pela rota); a lógica vive em `process-patient-self-register.core.ts`. */
export function loadPatientSelfRegisterInvitePreview(
  request: Request,
  token: string,
  deps: Pick<PatientSelfRegisterDeps, "store" | "validateInviteTenantSlug"> = defaultPatientSelfRegisterDeps,
): Promise<PatientSelfRegisterGetPreview> {
  return loadPatientSelfRegisterInvitePreviewWith(request, token, deps);
}

export function runCompletePatientSelfRegister(
  request: Request,
  data: ProcessPatientSelfRegisterBody,
  deps: PatientSelfRegisterDeps = defaultPatientSelfRegisterDeps,
): Promise<CompletePatientSelfRegisterResult> {
  return completePatientSelfRegister(request, data, deps);
}
