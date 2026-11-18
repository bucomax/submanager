import { defineKeys } from "@/shared/lib/query/query-keys";

const base = defineKeys("pathways");

export const pathwayKeys = {
  ...base,
  list: base.scope("list"),
  /** Estado de edição (rascunho + publicada) de um fluxo; `canManage` muda o que é carregado/criado. */
  editor: (pathwayId: string, canManage: boolean) => base.scope("editor", pathwayId, canManage),
  publishPreview: (pathwayId: string, versionId: string | null, graphSignature: string) =>
    base.scope("publish-preview", pathwayId, versionId, graphSignature),
  patientPathway: (patientPathwayId: string) => base.scope("patient-pathway", patientPathwayId),
};
