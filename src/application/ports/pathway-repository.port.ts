export type CreatePathwayVersionInput = {
  tenantId: string;
  pathwayId: string;
  graphJson: unknown;
  changelog?: string | null;
  actorUserId: string;
};

export type LinkStageDocumentResult =
  | {
      ok: true;
      stageDocument: {
        id: string;
        sortOrder: number;
        file: { id: string; fileName: string; mimeType: string };
      };
    }
  | { ok: false; code: "STAGE_NOT_FOUND" | "FILE_NOT_FOUND" | "ALREADY_LINKED" };

export type CreatePathwayVersionDraftResult =
  | {
      ok: true;
      version: {
        id: string;
        pathwayId: string;
        version: number;
        published: boolean;
        createdAt: string;
      };
    }
  | { ok: false; code: "PATHWAY_NOT_FOUND" | "VERSION_CONFLICT" };

export interface IPathwayRepository {
  findById(tenantId: string, pathwayId: string): Promise<unknown | null>;
  findVersion(tenantId: string, pathwayId: string, versionId: string): Promise<unknown | null>;
  createVersion(input: CreatePathwayVersionInput): Promise<unknown>;
  updateCarePathway(
    tenantId: string,
    pathwayId: string,
    data: { name?: string; description?: string | null },
  ): Promise<unknown>;
  countPatientPathwaysForPathway(pathwayId: string): Promise<number>;
  deleteCarePathway(tenantId: string, pathwayId: string): Promise<boolean>;

  linkStageDocument(params: {
    tenantId: string;
    pathwayStageId: string;
    fileAssetId: string;
  }): Promise<LinkStageDocumentResult>;

  createPathwayVersionDraft(params: {
    tenantId: string;
    pathwayId: string;
    graphJson: unknown;
  }): Promise<CreatePathwayVersionDraftResult>;

  createCarePathway(params: {
    tenantId: string;
    name: string;
    description?: string | null;
  }): Promise<unknown>;

  findCarePathwayIdForPublish(tenantId: string, pathwayId: string): Promise<{ id: string } | null>;

  findPathwayVersionForPublish(pathwayId: string, versionId: string): Promise<unknown | null>;

  runPublishTransaction(fn: (tx: unknown) => Promise<void>): Promise<void>;

  findPathwayVersionWithStagesForPublish(versionId: string): Promise<unknown | null>;

  findPathwayStageInVersion(pathwayVersionId: string, stageId: string): Promise<unknown | null>;

  findPublishedVersionWithFirstStage(pathwayId: string): Promise<unknown | null>;
}
