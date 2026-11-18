"use client";

import { useState } from "react";
import type { Node } from "@xyflow/react";
import { toast } from "@/lib/toast";
import type { PathwayPublishPreviewDto } from "@/types/api/pathways-v1";

export type RemoveStageDialogState = {
  stageKey: string;
  name: string;
  patientCount: number;
};

/**
 * Remoção de etapa: bloqueia a última etapa e pede confirmação quando há pacientes na etapa publicada
 * (contagem vem do preview de publicação).
 */
export function useRemoveStageRequest({
  nodes,
  publishPreview,
  cannotRemoveLastMessage,
  onRemove,
}: {
  nodes: Node[];
  publishPreview: PathwayPublishPreviewDto | null;
  cannotRemoveLastMessage: string;
  onRemove: (stageId: string) => void;
}) {
  const [dialog, setDialog] = useState<RemoveStageDialogState | null>(null);

  function request(stageId: string) {
    if (nodes.length <= 1) {
      toast.error(cannotRemoveLastMessage);
      return;
    }
    const count =
      publishPreview?.publishedStagePatientCounts.find((r) => r.stageKey === stageId)?.patientCount ?? 0;
    if (count > 0) {
      const node = nodes.find((n) => n.id === stageId);
      setDialog({ stageKey: stageId, name: String(node?.data?.label ?? stageId), patientCount: count });
      return;
    }
    onRemove(stageId);
  }

  function confirm() {
    if (!dialog) return;
    const id = dialog.stageKey;
    setDialog(null);
    onRemove(id);
  }

  return { dialog, request, confirm, cancel: () => setDialog(null) };
}
