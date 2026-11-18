import { defaultPublishPathwayVersionDeps } from "@/infrastructure/composition/publish-pathway-deps";
import {
  previewPathwayPublish,
  type RunPathwayPublishPreviewResult,
} from "@/application/use-cases/pathway/execute-publish-pathway.core";
import type { ApiT } from "@/lib/api/i18n";

export type { RunPathwayPublishPreviewResult };

export function runPathwayPublishPreview(
  params: {
    tenantId: string;
    pathwayId: string;
    versionId: string;
    graphJsonOverride: unknown | undefined;
    apiT: ApiT;
  },
  store = defaultPublishPathwayVersionDeps.store,
): Promise<RunPathwayPublishPreviewResult> {
  return previewPathwayPublish(
    { ...params, apiT: params.apiT as (key: string, p?: Record<string, string>) => string },
    store,
  );
}
