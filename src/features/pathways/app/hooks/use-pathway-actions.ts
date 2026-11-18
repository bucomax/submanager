"use client";

import { useTranslations } from "next-intl";
import type { Edge, Node } from "@xyflow/react";
import { toast } from "@/lib/toast";
import type { PathwayPublishPreviewDto } from "@/types/api/pathways-v1";

type UsePathwayActionsParams = {
  readOnly: boolean;
  versionId: string | null;
  pathwayName: string;
  /** Editor de fluxo valida o nome antes de salvar (com toast); o editor em colunas deixa o save decidir. */
  requirePathwayName: boolean;
  nodes: Node[];
  edges: Edge[];
  saving: boolean;
  publishing: boolean;
  isDraftDirty: boolean;
  hasPublishableGraphChanges: boolean;
  saveDraft: (graph: unknown) => Promise<void>;
  publishSavedDraft: () => Promise<void>;
  publishPreview: PathwayPublishPreviewDto | null;
  publishPreviewLoading: boolean;
  publishPreviewError: string | null;
};

/** Salvar/publicar rascunho com toasts de sucesso e as regras que bloqueiam a publicação. */
export function usePathwayActions({
  readOnly,
  versionId,
  pathwayName,
  requirePathwayName,
  nodes,
  edges,
  saving,
  publishing,
  isDraftDirty,
  hasPublishableGraphChanges,
  saveDraft,
  publishSavedDraft,
  publishPreview,
  publishPreviewLoading,
  publishPreviewError,
}: UsePathwayActionsParams) {
  const t = useTranslations("pathways.editor");

  const publishBlockedByPreview =
    publishPreviewLoading ||
    publishPreviewError != null ||
    (publishPreview != null && !publishPreview.canPublish);

  const publishDisabled =
    publishing || saving || isDraftDirty || !hasPublishableGraphChanges || publishBlockedByPreview;

  async function handleSave() {
    if (!versionId || readOnly) return;
    if (requirePathwayName && !pathwayName.trim()) {
      toast.error(t("pathwayNameRequired"));
      return;
    }
    try {
      await saveDraft({ nodes, edges });
      toast.success(t("saveSuccess"));
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  async function handlePublish() {
    if (readOnly || !versionId || isDraftDirty || !hasPublishableGraphChanges || publishBlockedByPreview) return;
    try {
      await publishSavedDraft();
      toast.success(t("publishSuccess"));
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  return { publishDisabled, handleSave, handlePublish };
}
