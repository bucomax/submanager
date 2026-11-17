"use client";

import { postPathwayPublishPreview } from "@/features/pathways/app/services/pathways.service";
import type { PathwayPublishPreviewDto } from "@/types/api/pathways-v1";
import { useCallback, useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 400;

/**
 * Pré-validação alinhada ao POST `…/publish` (debounce sobre o grafo local ou rascunho salvo).
 */
export function usePathwayPublishPreview(
  pathwayId: string,
  versionId: string | null,
  /** Grafo atual do editor (`{ nodes, edges }`). Enviado ao preview para incluir alterações não salvas. */
  localGraphJson: unknown,
  /** `false` evita chamadas ao preview (somente admin pode publicar). */
  enabled = true,
) {
  const [preview, setPreview] = useState<PathwayPublishPreviewDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const refreshPublishPreview = useCallback(
    async (graph: unknown) => {
      if (!versionId || !enabled) return;
      const my = ++seq.current;
      setLoading(true);
      setError(null);
      try {
        const p = await postPathwayPublishPreview(pathwayId, versionId, { graphJson: graph });
        if (seq.current === my) {
          setPreview(p);
        }
      } catch (e) {
        if (seq.current === my) {
          setError(e instanceof Error ? e.message : "Error");
          setPreview(null);
        }
      } finally {
        if (seq.current === my) {
          setLoading(false);
        }
      }
    },
    [pathwayId, versionId, enabled],
  );

  useEffect(() => {
    if (!versionId || !enabled) {
      setPreview(null);
      setError(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void refreshPublishPreview(localGraphJson);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [versionId, enabled, localGraphJson, refreshPublishPreview]);

  return {
    publishPreview: preview,
    publishPreviewLoading: loading,
    publishPreviewError: error,
    refreshPublishPreview,
  };
}
