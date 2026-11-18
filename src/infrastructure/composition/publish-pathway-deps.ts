import type { PublishPathwayVersionDeps } from "@/application/use-cases/pathway/execute-publish-pathway.core";
import { pathwayPublishPrismaStore } from "@/infrastructure/repositories/pathway-publish.repository";
import { tenantListCache } from "@/infrastructure/composition/shared-adapters";

export const defaultPublishPathwayVersionDeps: PublishPathwayVersionDeps = {
  store: pathwayPublishPrismaStore,
  cache: tenantListCache,
};
