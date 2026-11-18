"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { Node } from "@xyflow/react";
import type { StageSlaField } from "@/features/pathways/app/types/column-editor";
import type { SelectedPathwayNodeUpdate } from "@/features/pathways/app/types/components";
import * as updaters from "@/features/pathways/app/utils/stage-node-updaters";

type StageDocumentInput = { fileAssetId: string; fileName: string; mimeType: string };

/** Ações por etapa (id) sobre o estado de nós; o chamador decide de onde vem o id (lista de colunas ou seleção do canvas). */
export function useStageNodeActions(setNodes: Dispatch<SetStateAction<Node[]>>) {
  return useMemo(
    () => ({
      updateData: (id: string, partial: SelectedPathwayNodeUpdate) =>
        setNodes((nds) => updaters.updateStageData(nds, id, partial)),
      updateSla: (id: string, field: StageSlaField, value: number | undefined) =>
        setNodes((nds) => updaters.updateStageSla(nds, id, field, value)),
      updateDefaultAssignees: (id: string, userIds: string[]) =>
        setNodes((nds) => updaters.updateStageDefaultAssignees(nds, id, userIds)),
      addChecklistItem: (id: string) => setNodes((nds) => updaters.addStageChecklistItem(nds, id)),
      updateChecklistItem: (id: string, itemId: string, label: string) =>
        setNodes((nds) => updaters.updateStageChecklistItemLabel(nds, id, itemId, label)),
      updateChecklistItemRequired: (id: string, itemId: string, required: boolean) =>
        setNodes((nds) => updaters.updateStageChecklistItemRequired(nds, id, itemId, required)),
      removeChecklistItem: (id: string, itemId: string) =>
        setNodes((nds) => updaters.removeStageChecklistItem(nds, id, itemId)),
      addDocuments: (id: string, items: StageDocumentInput[]) => {
        if (items.length === 0) return;
        setNodes((nds) => updaters.addStageDocuments(nds, id, items));
      },
      removeDocument: (id: string, fileAssetId: string) =>
        setNodes((nds) => updaters.removeStageDocument(nds, id, fileAssetId)),
    }),
    [setNodes],
  );
}
