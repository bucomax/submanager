import type { StageDocumentBundleItem } from "@/domain/pathway/stage-document-bundle";

export interface IStageDocumentBundleReader {
  getStageDocumentBundle(stageId: string): Promise<StageDocumentBundleItem[]>;
}

export interface ITenantMemberPicker {
  /** Primeiro candidato (na ordem dada) que é membro do tenant. */
  pickFirstTenantMember(tenantId: string, candidateUserIds: string[]): Promise<string | null>;
}
