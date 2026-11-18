"use client";

import { arrayMove } from "@dnd-kit/sortable";
import type { Node } from "@xyflow/react";
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { buildLinearEdges } from "@/features/pathways/app/utils/linear-graph-edges";
import { isPathwayDraftDirty } from "@/features/pathways/app/utils/pathway-graph";
import {
  ensurePathwayGraphNodePositions,
  parsePathwayStageNodes,
} from "@/features/pathways/app/utils/pathway-stage-nodes";
import { createStageNode } from "@/features/pathways/app/utils/stage-node-updaters";

const EMPTY_NODES: Node[] = [];

/**
 * Rascunho local das etapas (editor em colunas), com arestas lineares derivadas.
 * O grafo do servidor é a semente: enquanto `graphJson` mantiver a mesma identidade valem as edições
 * locais; quando ele é recarregado (load, salvar, publicar) o rascunho volta a acompanhar o servidor.
 */
export function usePathwayColumnStages({
  graphJson,
  pathwayName,
  syncedPathwayName,
}: {
  graphJson: unknown;
  pathwayName: string;
  syncedPathwayName: string;
}) {
  const serverNodes = useMemo(
    () => (graphJson == null ? EMPTY_NODES : ensurePathwayGraphNodePositions(parsePathwayStageNodes(graphJson))),
    [graphJson],
  );
  const [draftNodes, setDraftNodes] = useState<{ source: unknown; nodes: Node[] } | null>(null);
  const nodes =
    draftNodes !== null && Object.is(draftNodes.source, graphJson) ? draftNodes.nodes : serverNodes;

  const setNodes: Dispatch<SetStateAction<Node[]>> = useCallback(
    (updater) =>
      setDraftNodes((previous) => {
        const current =
          previous !== null && Object.is(previous.source, graphJson) ? previous.nodes : serverNodes;
        return {
          source: graphJson,
          nodes: typeof updater === "function" ? updater(current) : updater,
        };
      }),
    [graphJson, serverNodes],
  );

  const edges = useMemo(() => buildLinearEdges(nodes), [nodes]);
  const localGraphJson = useMemo(() => ({ nodes, edges }), [nodes, edges]);
  const isDraftDirty = useMemo(
    () => isPathwayDraftDirty({ graphJson, nodes, edges, pathwayName, syncedPathwayName }),
    [graphJson, nodes, edges, pathwayName, syncedPathwayName],
  );

  function addStage(defaultLabel: string) {
    const id = `stage-${crypto.randomUUID()}`;
    setNodes((nds) => [...nds, createStageNode(id, nds.length, `${defaultLabel} ${nds.length + 1}`)]);
  }

  function removeStage(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
  }

  function moveStage(activeId: string, overId: string) {
    setNodes((prev) => {
      const oldIndex = prev.findIndex((n) => n.id === activeId);
      const newIndex = prev.findIndex((n) => n.id === overId);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  return { nodes, edges, setNodes, localGraphJson, isDraftDirty, addStage, removeStage, moveStage };
}
