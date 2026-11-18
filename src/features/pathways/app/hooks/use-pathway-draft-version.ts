"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { pathwayKeys } from "@/features/pathways/app/hooks/query-keys";
import { loadPathwayEditorState } from "@/features/pathways/app/services/pathway-editor-state.service";
import {
  patchPathway,
  patchPathwayVersionDraft,
  publishPathwayVersion,
} from "@/features/pathways/app/services/pathways.service";
import type { PathwayEditorState } from "@/features/pathways/app/types/pathway-editor";
import { savedDraftGraphDiffersFromPublished } from "@/features/pathways/app/utils/pathway-graph";
import { useSyncedDraft } from "@/shared/hooks/use-synced-draft";
import { isQueryLoading } from "@/shared/utils/query-loading";

function cloneGraphSnapshot(graphJson: unknown): unknown {
  const isGraph =
    graphJson != null &&
    typeof graphJson === "object" &&
    !Array.isArray(graphJson) &&
    "nodes" in graphJson &&
    "edges" in graphJson;
  return isGraph ? structuredClone(graphJson) : graphJson;
}

/**
 * @param canManage `false` = somente leitura: nunca cria versão (a API retorna 403) e
 * exibe a versão publicada mais recente (ou o rascunho, se nada foi publicado).
 */
export function usePathwayDraftVersion(pathwayId: string, canManage: boolean) {
  const t = useTranslations("pathways.editor");
  const queryClient = useQueryClient();
  const queryKey = pathwayKeys.editor(pathwayId, canManage);

  // Estado de trabalho (rascunho em edição): nunca reaproveitar cache nem rebuscar sozinho,
  // senão o grafo local do editor seria sobrescrito no meio da edição.
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => loadPathwayEditorState(pathwayId, canManage, t("noVersionToView"), { signal }),
    staleTime: 0,
    gcTime: 0,
    refetchOnReconnect: false,
  });
  const { refetch } = query;
  const state = query.data ?? null;

  const [pathwayName, setPathwayName] = useSyncedDraft(state?.pathwayName ?? "");
  const versionId = state?.versionId ?? null;
  const graphJson = state?.graphJson ?? null;

  const hasPublishableGraphChanges = useMemo(
    () => savedDraftGraphDiffersFromPublished(graphJson, state?.publishedGraphSnapshot ?? null),
    [graphJson, state?.publishedGraphSnapshot],
  );

  const saveMutation = useMutation({
    mutationFn: async (nextGraphJson: unknown) => {
      const trimmed = pathwayName.trim();
      if (!trimmed) {
        throw new Error(t("pathwayNameRequired"));
      }
      const baseline = queryClient.getQueryData<PathwayEditorState>(queryKey)?.pathwayName;
      if (trimmed !== baseline) {
        await patchPathway(pathwayId, { name: trimmed });
        queryClient.setQueryData<PathwayEditorState>(queryKey, (prev) =>
          prev ? { ...prev, pathwayName: trimmed } : prev,
        );
      }
      const snapshot = cloneGraphSnapshot(nextGraphJson);
      await patchPathwayVersionDraft(pathwayId, versionId!, snapshot);
      return snapshot;
    },
    onSuccess: (snapshot) =>
      queryClient.setQueryData<PathwayEditorState>(queryKey, (prev) =>
        prev ? { ...prev, graphJson: snapshot } : prev,
      ),
  });
  const { mutateAsync: saveAsync } = saveMutation;

  const publishMutation = useMutation({
    mutationFn: () => publishPathwayVersion(pathwayId, versionId!),
    // Mantém `publishing` até o estado recarregado refletir a nova versão publicada.
    onSuccess: () => refetch(),
  });
  const { mutateAsync: publishAsync } = publishMutation;

  async function saveDraft(nextGraphJson: unknown) {
    if (!versionId) return;
    await saveAsync(nextGraphJson);
  }

  /** Publica o rascunho já salvo no servidor. Use após `saveDraft` (ou quando não houver alterações locais). */
  async function publishSavedDraft() {
    if (!versionId || !hasPublishableGraphChanges) return;
    await publishAsync();
  }

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    loading: isQueryLoading(query),
    error: query.error ? query.error.message || t("loadError") : null,
    versionId,
    versionNumber: state?.versionNumber ?? null,
    graphJson,
    pathwayName,
    setPathwayName,
    syncedPathwayName: state?.pathwayName ?? "",
    saving: saveMutation.isPending,
    publishing: publishMutation.isPending,
    saveDraft,
    publishSavedDraft,
    hasPublishableGraphChanges,
    reload,
  };
}
