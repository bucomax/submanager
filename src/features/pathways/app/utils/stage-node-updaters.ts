import type { Node } from "@xyflow/react";
import { pathwayEditorGraphNodePosition } from "@/lib/pathway/graph-editor-layout";
import { setStageNodeDefaultAssignees } from "@/lib/pathway/stage-node-assignees";
import {
  updatePathwayStageNodeChecklistItems,
  updatePathwayStageNodeStageDocuments,
} from "@/features/pathways/app/utils/pathway-stage-nodes";
import type { SelectedPathwayNodeUpdate } from "@/features/pathways/app/types/components";
import type { StageSlaField } from "@/features/pathways/app/types/column-editor";

/** Updaters puros `(nodes) => nodes` das etapas, compartilhados pelo editor de fluxo e pelo editor em colunas. */

type StageDocumentInput = { fileAssetId: string; fileName: string; mimeType: string };

function mapNode(nodes: Node[], id: string, update: (node: Node) => Node): Node[] {
  return nodes.map((node) => (node.id === id ? update(node) : node));
}

export function createStageNode(id: string, index: number, label: string): Node {
  return {
    id,
    type: "default",
    position: pathwayEditorGraphNodePosition(index),
    data: { label, patientMessage: "" },
  };
}

export function updateStageData(nodes: Node[], id: string, partial: SelectedPathwayNodeUpdate): Node[] {
  return mapNode(nodes, id, (n) => ({
    ...n,
    data: {
      ...n.data,
      ...(partial.label !== undefined ? { label: partial.label } : {}),
      ...(partial.patientMessage !== undefined ? { patientMessage: partial.patientMessage } : {}),
    },
  }));
}

export function updateStageSla(
  nodes: Node[],
  id: string,
  field: StageSlaField,
  value: number | undefined,
): Node[] {
  return mapNode(nodes, id, (n) => {
    const nextData = { ...n.data } as Record<string, unknown>;
    if (value === undefined) {
      delete nextData[field];
    } else {
      nextData[field] = value;
    }
    return { ...n, data: nextData };
  });
}

export function updateStageDefaultAssignees(nodes: Node[], id: string, userIds: string[]): Node[] {
  return mapNode(nodes, id, (n) => {
    const nextData = { ...n.data } as Record<string, unknown>;
    setStageNodeDefaultAssignees(nextData, userIds);
    return { ...n, data: nextData };
  });
}

export function addStageChecklistItem(nodes: Node[], id: string): Node[] {
  return mapNode(nodes, id, (n) => ({
    ...n,
    data: updatePathwayStageNodeChecklistItems(n.data, (items) => [
      ...items,
      { id: `checklist-${crypto.randomUUID()}`, label: "" },
    ]),
  }));
}

export function updateStageChecklistItemLabel(nodes: Node[], id: string, itemId: string, label: string): Node[] {
  return mapNode(nodes, id, (n) => ({
    ...n,
    data: updatePathwayStageNodeChecklistItems(n.data, (items) =>
      items.map((item) => (item.id === itemId ? { ...item, label } : item)),
    ),
  }));
}

export function updateStageChecklistItemRequired(
  nodes: Node[],
  id: string,
  itemId: string,
  requiredForTransition: boolean,
): Node[] {
  return mapNode(nodes, id, (n) => ({
    ...n,
    data: updatePathwayStageNodeChecklistItems(n.data, (items) =>
      items.map((item) => {
        if (item.id !== itemId) return item;
        if (!requiredForTransition) {
          const rest = { ...item };
          delete rest.requiredForTransition;
          return rest;
        }
        return { ...item, requiredForTransition: true };
      }),
    ),
  }));
}

export function removeStageChecklistItem(nodes: Node[], id: string, itemId: string): Node[] {
  return mapNode(nodes, id, (n) => ({
    ...n,
    data: updatePathwayStageNodeChecklistItems(n.data, (items) => items.filter((item) => item.id !== itemId)),
  }));
}

export function addStageDocuments(nodes: Node[], id: string, items: StageDocumentInput[]): Node[] {
  return mapNode(nodes, id, (n) => ({
    ...n,
    data: updatePathwayStageNodeStageDocuments(n.data, (docs) => [...docs, ...items]),
  }));
}

export function removeStageDocument(nodes: Node[], id: string, fileAssetId: string): Node[] {
  return mapNode(nodes, id, (n) => ({
    ...n,
    data: updatePathwayStageNodeStageDocuments(n.data, (docs) =>
      docs.filter((d) => d.fileAssetId !== fileAssetId),
    ),
  }));
}
