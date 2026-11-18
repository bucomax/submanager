import { defaultCreatePatientPathwayDeps } from "@/infrastructure/composition/create-patient-pathway-deps";
import { postPatientPathwayBodySchema } from "@/lib/validators/pathway";
import {
  createPatientPathway,
  type CreatePatientPathwayDeps,
  type CreatePatientPathwayParams,
  type CreatePatientPathwayResult,
} from "@/application/use-cases/patient-pathway/create-patient-pathway.core";

export type {
  CreatePatientPathwayBody,
  CreatePatientPathwayDeps,
  CreatePatientPathwayErrorCode,
  CreatePatientPathwaySuccess,
} from "@/application/use-cases/patient-pathway/create-patient-pathway.core";

export { postPatientPathwayBodySchema };

/** Ponto de entrada de produção (usado pela rota); a lógica vive em `create-patient-pathway.core.ts`. */
export function runCreatePatientPathway(
  params: CreatePatientPathwayParams,
  deps: CreatePatientPathwayDeps = defaultCreatePatientPathwayDeps,
): Promise<CreatePatientPathwayResult> {
  return createPatientPathway(params, deps);
}
