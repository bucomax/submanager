"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getPathway,
  getPathwayVersion,
  patchPathway,
  patchPathwayVersionDraft,
  postPathwayVersion,
  publishPathwayVersion,
} from "@/features/pathways/app/services/pathways.service";
import { createDefaultPathwayGraph } from "@/features/pathways/app/utils/default-graph";
import { savedDraftGraphDiffersFromPublished } from "@/features/pathways/app/utils/pathway-graph";
import type { PathwayVersionDetail } from "@/features/pathways/app/types/pathways";
import { useTranslations } from "next-intl";

/**
 * @param canManage `false` = somente leitura: nunca cria versão (a API retorna 403) e
 * exibe a versão publicada mais recente (ou o rascunho, se nada foi publicado).
 */
export function usePathwayDraftVersion(pathwayId: string, canManage: boolean) {
  const t = useTranslations("pathways.editor");
  const [loading, setLoading] = useState(true);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [versionNumber, setVersionNumber] = useState<number | null>(null);
  const [graphJson, setGraphJson] = useState<unknown>(null);
  const [pathwayName, setPathwayName] = useState("");
  /** Nome da jornada conforme último carregamento ou salvamento bem-sucedido do rascunho. */
  const [syncedPathwayName, setSyncedPathwayName] = useState("");
  const pathwayNameBaselineRef = useRef("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Grafo da versão publicada mais recente (para comparar com o rascunho salvo). */
  const [publishedGraphSnapshot, setPublishedGraphSnapshot] = useState<unknown | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pathway = await getPathway(pathwayId);
      const publishedSorted = pathway.versions
        .filter((version) => version.published)
        .sort((a, b) => b.version - a.version);

      let publishedDetail: PathwayVersionDetail | null = null;
      if (publishedSorted[0]) {
        publishedDetail = await getPathwayVersion(pathwayId, publishedSorted[0].id);
      }
      setPublishedGraphSnapshot(publishedDetail?.graphJson ?? null);

      const drafts = pathway.versions.filter((version) => !version.published).sort((a, b) => b.version - a.version);

      let nextVersionId: string;
      let nextVersionNumber: number;
      let nextGraphJson: unknown;

      if (!canManage) {
        const viewable = publishedDetail ?? (drafts[0] ? await getPathwayVersion(pathwayId, drafts[0].id) : null);
        if (!viewable) {
          throw new Error(t("noVersionToView"));
        }
        nextVersionId = viewable.id;
        nextVersionNumber = viewable.version;
        nextGraphJson = viewable.graphJson;
      } else if (drafts[0]) {
        nextVersionId = drafts[0].id;
        const detail = await getPathwayVersion(pathwayId, nextVersionId);
        nextVersionNumber = detail.version;
        nextGraphJson = detail.graphJson;
      } else if (publishedDetail) {
        const createdVersion = await postPathwayVersion(pathwayId, publishedDetail.graphJson);
        nextVersionId = createdVersion.id;
        nextVersionNumber = createdVersion.version;
        nextGraphJson = publishedDetail.graphJson;
      } else {
        const emptyGraph = createDefaultPathwayGraph();
        const createdVersion = await postPathwayVersion(pathwayId, emptyGraph);
        nextVersionId = createdVersion.id;
        nextVersionNumber = createdVersion.version;
        nextGraphJson = emptyGraph;
      }

      setVersionId(nextVersionId);
      setVersionNumber(nextVersionNumber);
      setGraphJson(nextGraphJson);
      setPathwayName(pathway.name);
      pathwayNameBaselineRef.current = pathway.name;
      setSyncedPathwayName(pathway.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadError"));
      setVersionId(null);
      setVersionNumber(null);
      setGraphJson(null);
      setPathwayName("");
      pathwayNameBaselineRef.current = "";
      setSyncedPathwayName("");
      setPublishedGraphSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [pathwayId, t, canManage]);

  const hasPublishableGraphChanges = useMemo(
    () => savedDraftGraphDiffersFromPublished(graphJson, publishedGraphSnapshot),
    [graphJson, publishedGraphSnapshot],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  async function persistPathwayNameIfChanged(): Promise<void> {
    const trimmed = pathwayName.trim();
    if (!trimmed) {
      throw new Error(t("pathwayNameRequired"));
    }
    if (trimmed === pathwayNameBaselineRef.current) return;
    await patchPathway(pathwayId, { name: trimmed });
    pathwayNameBaselineRef.current = trimmed;
    setPathwayName(trimmed);
  }

  async function saveDraft(nextGraphJson: unknown) {
    if (!versionId) return;
    setSaving(true);
    try {
      await persistPathwayNameIfChanged();
      const snapshot =
        nextGraphJson != null &&
        typeof nextGraphJson === "object" &&
        !Array.isArray(nextGraphJson) &&
        "nodes" in (nextGraphJson as object) &&
        "edges" in (nextGraphJson as object)
          ? structuredClone(nextGraphJson)
          : nextGraphJson;
      await patchPathwayVersionDraft(pathwayId, versionId, snapshot);
      setGraphJson(snapshot);
      setSyncedPathwayName(pathwayNameBaselineRef.current);
    } finally {
      setSaving(false);
    }
  }

  /** Publica o rascunho já salvo no servidor. Use após `saveDraft` (ou quando não houver alterações locais). */
  async function publishSavedDraft() {
    if (!versionId || !savedDraftGraphDiffersFromPublished(graphJson, publishedGraphSnapshot)) return;
    setPublishing(true);
    try {
      await publishPathwayVersion(pathwayId, versionId);
      await reload();
    } finally {
      setPublishing(false);
    }
  }

  return {
    loading,
    error,
    versionId,
    versionNumber,
    graphJson,
    pathwayName,
    setPathwayName,
    syncedPathwayName,
    saving,
    publishing,
    saveDraft,
    publishSavedDraft,
    hasPublishableGraphChanges,
    reload,
  };
}
