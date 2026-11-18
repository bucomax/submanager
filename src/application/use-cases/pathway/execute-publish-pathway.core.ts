import type { IPathwayPublishStore } from "@/application/ports/pathway-publish.port";
import type { ITenantListCache } from "@/application/ports/tenant-list-cache.port";
import { deriveStagesFromGraph } from "@/domain/pathway/graph-normalizer";
import {
  firstPreflightHttpError,
  runPathwayPublishPreflight,
  type PathwayPublishPreflightResult,
} from "@/application/use-cases/pathway/publish-pathway-preflight";
import {
  runPublishPathwayVersionTransaction,
  StageKeyConflictError,
  type PublishTransactionResult,
} from "@/application/use-cases/pathway/publish-pathway-version-transaction";

export type PublishPathwayVersionFlowErrorCode = "PATHWAY_NOT_FOUND" | "VERSION_NOT_FOUND";

export type PublishPathwayVersionSuccess = {
  version: {
    id: string;
    pathwayId: string;
    version: number;
    published: boolean;
    stages: {
      id: string;
      stageKey: string;
      name: string;
      sortOrder: number;
      patientMessage: string | null;
      alertWarningDays: number | null;
      alertCriticalDays: number | null;
      defaultAssigneeUserId: string | null;
      defaultAssigneeUserIds: string[];
    }[];
  };
};

export type PublishPathwayVersionDeps = {
  store: IPathwayPublishStore;
  cache: ITenantListCache;
};

type ApiT = (key: string, params?: Record<string, string>) => string;

export type PublishPathwayVersionFlowResult =
  | { ok: true; data: PublishPathwayVersionSuccess }
  | { ok: false; code: PublishPathwayVersionFlowErrorCode }
  | { ok: false; publishConflict: Extract<PublishTransactionResult, { ok: false }> }
  | { ok: false; preflightHttp: NonNullable<ReturnType<typeof firstPreflightHttpError>> };

/**
 * Publica uma versão de pathway: preflight, transação de persistência, revalidate caches.
 */
export async function publishPathwayVersionFlow(
  params: { tenantId: string; pathwayId: string; versionId: string; apiT: ApiT },
  deps: PublishPathwayVersionDeps,
): Promise<PublishPathwayVersionFlowResult> {
  const { tenantId, pathwayId, versionId, apiT } = params;
  const { store } = deps;

  if (!(await store.findCarePathwayIdForPublish(tenantId, pathwayId))) {
    return { ok: false, code: "PATHWAY_NOT_FOUND" };
  }

  const version = await store.findPathwayVersionForPublish(pathwayId, versionId);
  if (!version) {
    return { ok: false, code: "VERSION_NOT_FOUND" };
  }

  const preflight = await runPathwayPublishPreflight(
    { tenantId, pathwayId, versionId, graphJson: version.graphJson, apiT },
    store,
  );
  const httpErr = firstPreflightHttpError(preflight.issues);
  if (httpErr) {
    return { ok: false, preflightHttp: httpErr };
  }

  const stages = deriveStagesFromGraph(version.graphJson);
  const txResult = await store
    .runInTransaction((tx) =>
      runPublishPathwayVersionTransaction(tx, { tenantId, pathwayId, versionId, stages }),
    )
    .catch((err: unknown): PublishTransactionResult => {
      if (err instanceof StageKeyConflictError) return { ok: false, code: err.code };
      throw err;
    });
  if (!txResult.ok) {
    return { ok: false, publishConflict: txResult };
  }

  const published = await store.findVersionWithStages(versionId);

  deps.cache.revalidatePathwaysAndClientsLists(tenantId);

  if (!published) {
    return { ok: false, code: "VERSION_NOT_FOUND" };
  }

  return {
    ok: true,
    data: {
      version: {
        id: published.id,
        pathwayId: published.pathwayId,
        version: published.version,
        published: published.published,
        stages: published.stages.map((s) => ({
          id: s.id,
          stageKey: s.stageKey,
          name: s.name,
          sortOrder: s.sortOrder,
          patientMessage: s.patientMessage,
          alertWarningDays: s.alertWarningDays,
          alertCriticalDays: s.alertCriticalDays,
          defaultAssigneeUserId: s.defaultAssigneeUserId,
          defaultAssigneeUserIds: s.defaultAssigneeUserIds,
        })),
      },
    },
  };
}

export type RunPathwayPublishPreviewResult =
  | { ok: true; preview: PathwayPublishPreflightResult }
  | { ok: false; code: "PATHWAY_NOT_FOUND" | "VERSION_NOT_FOUND" };

/** Preflight sem gravar; `graphJsonOverride` permite simular um rascunho ainda não salvo. */
export async function previewPathwayPublish(
  params: {
    tenantId: string;
    pathwayId: string;
    versionId: string;
    graphJsonOverride: unknown | undefined;
    apiT: ApiT;
  },
  store: IPathwayPublishStore,
): Promise<RunPathwayPublishPreviewResult> {
  const { tenantId, pathwayId, versionId, graphJsonOverride, apiT } = params;

  if (!(await store.findCarePathwayIdForPublish(tenantId, pathwayId))) {
    return { ok: false, code: "PATHWAY_NOT_FOUND" };
  }
  const version = await store.findPathwayVersionForPublish(pathwayId, versionId);
  if (!version) {
    return { ok: false, code: "VERSION_NOT_FOUND" };
  }

  const graphJson = graphJsonOverride !== undefined ? graphJsonOverride : version.graphJson;
  const preview = await runPathwayPublishPreflight(
    { tenantId, pathwayId, versionId, graphJson, apiT },
    store,
  );
  return { ok: true, preview };
}
