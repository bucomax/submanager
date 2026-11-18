"use client";

import { useCallback, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { pathwayKeys } from "@/features/pathways/app/hooks/query-keys";
import { postPathwayPublishPreview } from "@/features/pathways/app/services/pathways.service";
import { parsePathwayGraph, pathwayDraftSignature } from "@/features/pathways/app/utils/pathway-graph";
import { useDebounce } from "@/shared/hooks/use-debounce";

const DEBOUNCE_MS = 400;

/**
 * Pré-validação alinhada ao POST `…/publish` (debounce sobre o grafo local ou rascunho salvo).
 * A key usa a assinatura do grafo: mudanças que não alteram o conteúdo (seleção, medidas do React Flow)
 * não geram nova requisição.
 */
export function usePathwayPublishPreview(
  pathwayId: string,
  versionId: string | null,
  /** Grafo atual do editor (`{ nodes, edges }`). Enviado ao preview para incluir alterações não salvas. */
  localGraphJson: unknown,
  /** `false` evita chamadas ao preview (somente admin pode publicar). */
  enabled = true,
) {
  const graph = useDebounce(localGraphJson, { delayMs: DEBOUNCE_MS });
  const signature = useMemo(() => {
    const parsed = parsePathwayGraph(graph);
    return pathwayDraftSignature(parsed.nodes, parsed.edges);
  }, [graph]);

  const query = useQuery({
    queryKey: pathwayKeys.publishPreview(pathwayId, versionId, signature),
    queryFn: ({ signal }) =>
      postPathwayPublishPreview(pathwayId, versionId!, { graphJson: graph }, { signal }),
    enabled: Boolean(versionId) && enabled,
    // O resultado depende do estado do servidor (pacientes por etapa): sempre revalida.
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
  const { refetch } = query;

  const refreshPublishPreview = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const active = Boolean(versionId) && enabled;
  return {
    publishPreview: active ? (query.data ?? null) : null,
    publishPreviewLoading: active && query.isFetching,
    publishPreviewError: active && query.error ? query.error.message || "Error" : null,
    refreshPublishPreview,
  };
}
