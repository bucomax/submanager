"use client";

import {
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { isPathwayDraftDirty, parsePathwayGraph } from "@/features/pathways/app/utils/pathway-graph";
import { ensurePathwayGraphNodePositions } from "@/features/pathways/app/utils/pathway-stage-nodes";
import { createStageNode } from "@/features/pathways/app/utils/stage-node-updaters";

/**
 * Estado local do canvas (nós, arestas, seleção) semeado pelo `graphJson` salvo, mais o cálculo de "sujo".
 */
export function usePathwayEditorState({
  graphJson,
  pathwayName,
  syncedPathwayName,
  readOnly,
}: {
  graphJson: unknown;
  pathwayName: string;
  syncedPathwayName: string;
  readOnly: boolean;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  /**
   * A seleção fica presa ao grafo que a originou: quando `graphJson` é recarregado
   * (load, salvar, publicar) ela se anula sozinha no render, sem efeito de reset.
   */
  const [selection, setSelection] = useState<{ source: unknown; id: string } | null>(null);
  const selectedId =
    selection !== null && Object.is(selection.source, graphJson) ? selection.id : null;
  const setSelectedId = useCallback(
    (id: string | null) => setSelection(id === null ? null : { source: graphJson, id }),
    [graphJson],
  );
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  useLayoutEffect(() => {
    if (graphJson == null) return;
    const parsed = parsePathwayGraph(graphJson);
    setNodes(ensurePathwayGraphNodePositions(parsed.nodes));
    setEdges(parsed.edges);
  }, [graphJson, setEdges, setNodes]);

  const isDraftDirty = useMemo(
    () => isPathwayDraftDirty({ graphJson, nodes, edges, pathwayName, syncedPathwayName }),
    [graphJson, nodes, edges, pathwayName, syncedPathwayName],
  );
  const localGraphJson = useMemo(() => ({ nodes, edges }), [nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (readOnly) return;
      setEdges((eds) => addEdge(params, eds));
    },
    [readOnly, setEdges],
  );

  function addStage(defaultLabel: string) {
    const id = `stage-${crypto.randomUUID()}`;
    setNodes((nds) => [...nds, createStageNode(id, nds.length, `${defaultLabel} ${nds.length + 1}`)]);
    setSelectedId(id);
  }

  function removeSelectedStage() {
    if (!selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }

  return {
    nodes,
    edges,
    setNodes,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectedId,
    setSelectedId,
    selectedNode,
    isDraftDirty,
    localGraphJson,
    addStage,
    removeSelectedStage,
  };
}
