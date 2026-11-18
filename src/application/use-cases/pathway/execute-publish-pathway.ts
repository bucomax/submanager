import { defaultPublishPathwayVersionDeps } from "@/infrastructure/composition/publish-pathway-deps";
import {
  publishPathwayVersionFlow,
  type PublishPathwayVersionDeps,
  type PublishPathwayVersionFlowResult,
} from "@/application/use-cases/pathway/execute-publish-pathway.core";

export type {
  PublishPathwayVersionDeps,
  PublishPathwayVersionFlowErrorCode,
  PublishPathwayVersionSuccess,
} from "@/application/use-cases/pathway/execute-publish-pathway.core";

/** Ponto de entrada de produção (usado pela rota); a lógica vive em `execute-publish-pathway.core.ts`. */
export function runPublishPathwayVersionFlow(
  params: Parameters<typeof publishPathwayVersionFlow>[0],
  deps: PublishPathwayVersionDeps = defaultPublishPathwayVersionDeps,
): Promise<PublishPathwayVersionFlowResult> {
  return publishPathwayVersionFlow(params, deps);
}
