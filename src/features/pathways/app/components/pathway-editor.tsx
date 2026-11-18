"use client";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PathwayEditorStagePanel } from "@/features/pathways/app/components/pathway-editor-stage-panel";
import { PathwayEditorToolbar } from "@/features/pathways/app/components/pathway-editor-toolbar";
import { PathwayPublishAlerts } from "@/features/pathways/app/components/pathway-publish-alerts";
import { PathwayRemoveStageDialog } from "@/features/pathways/app/components/pathway-remove-stage-dialog";
import { usePathwayActions } from "@/features/pathways/app/hooks/use-pathway-actions";
import { usePathwayDraftVersion } from "@/features/pathways/app/hooks/use-pathway-draft-version";
import { usePathwayEditorState } from "@/features/pathways/app/hooks/use-pathway-editor-state";
import { usePathwayPublishPreview } from "@/features/pathways/app/hooks/use-pathway-publish-preview";
import { useRemoveStageRequest } from "@/features/pathways/app/hooks/use-remove-stage-request";
import { useStageAssigneeOptions } from "@/features/pathways/app/hooks/use-stage-assignee-options";
import { useStageNodeActions } from "@/features/pathways/app/hooks/use-stage-node-actions";
import { pathwayEditorFitViewOptions } from "@/lib/pathway/graph-editor-layout";
import type { PathwayEditorProps } from "@/features/pathways/app/types/components";
import { useCanManagePathways } from "@/shared/hooks/use-can-manage-pathways";
import { Button } from "@/shared/components/ui/button";
import { Card, CardHeader } from "@/shared/components/ui/card";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

function PathwayEditorInner({ pathwayId, canManage }: PathwayEditorProps & { canManage: boolean }) {
  const readOnly = !canManage;
  const t = useTranslations("pathways.editor");
  const { resolvedTheme } = useTheme();
  const reactFlowColorMode = resolvedTheme === "dark" ? "dark" : "light";
  const draft = usePathwayDraftVersion(pathwayId, canManage);
  const { loading, error, versionId, graphJson, pathwayName, setPathwayName, reload } = draft;
  const editor = usePathwayEditorState({
    graphJson,
    pathwayName,
    syncedPathwayName: draft.syncedPathwayName,
    readOnly,
  });
  const { nodes, edges, selectedNode, setSelectedId } = editor;
  const stageActions = useStageNodeActions(editor.setNodes);
  const { options: assigneeOptions } = useStageAssigneeOptions();

  const preview = usePathwayPublishPreview(pathwayId, versionId, editor.localGraphJson, canManage);
  const { publishPreview, publishPreviewLoading, publishPreviewError } = preview;
  const { publishDisabled, handleSave, handlePublish } = usePathwayActions({
    readOnly,
    versionId,
    pathwayName,
    requirePathwayName: true,
    nodes,
    edges,
    saving: draft.saving,
    publishing: draft.publishing,
    isDraftDirty: editor.isDraftDirty,
    hasPublishableGraphChanges: draft.hasPublishableGraphChanges,
    saveDraft: draft.saveDraft,
    publishSavedDraft: draft.publishSavedDraft,
    publishPreview,
    publishPreviewLoading,
    publishPreviewError,
  });
  const removal = useRemoveStageRequest({
    nodes,
    publishPreview,
    cannotRemoveLastMessage: t("cannotRemoveLastStage"),
    onRemove: editor.removeSelectedStage,
  });

  if (error && !loading && !versionId) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-destructive text-sm">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw className="size-4" />
          {t("loadError")}
        </Button>
      </div>
    );
  }

  if (loading || !versionId) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[420px] w-full rounded-xl" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_minmax(280px,380px)]">
      <Card className="overflow-hidden p-0">
        <CardHeader className="space-y-3 border-b py-4">
          <PathwayPublishAlerts
            readOnly={readOnly}
            publishPreview={publishPreview}
            publishPreviewError={publishPreviewError}
            onRetryPreview={() => void preview.refreshPublishPreview()}
          />
          <Field className="min-w-0">
            <FieldLabel htmlFor="pathway-name">{t("pathwayName")}</FieldLabel>
            <Input
              id="pathway-name"
              value={pathwayName}
              onChange={(e) => setPathwayName(e.target.value)}
              readOnly={readOnly}
              placeholder={t("pathwayNamePlaceholder")}
              autoComplete="off"
            />
          </Field>
        </CardHeader>
        <div className="h-[min(520px,70vh)] w-full">
          <ReactFlow
            colorMode={reactFlowColorMode}
            nodes={nodes}
            edges={edges}
            onNodesChange={editor.onNodesChange}
            onEdgesChange={editor.onEdgesChange}
            onConnect={editor.onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            fitViewOptions={pathwayEditorFitViewOptions}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            edgesReconnectable={!readOnly}
            deleteKeyCode={readOnly ? null : undefined}
            elementsSelectable
          >
            <Background />
            <Controls fitViewOptions={pathwayEditorFitViewOptions} />
            <MiniMap />
          </ReactFlow>
        </div>
        {readOnly ? null : (
          <PathwayEditorToolbar
            saving={draft.saving}
            publishing={draft.publishing}
            publishDisabled={publishDisabled}
            isDraftDirty={editor.isDraftDirty}
            hasPublishableGraphChanges={draft.hasPublishableGraphChanges}
            publishPreview={publishPreview}
            publishPreviewLoading={publishPreviewLoading}
            publishPreviewError={publishPreviewError}
            onAddStage={() => editor.addStage(t("defaultStageLabel"))}
            onSave={() => void handleSave()}
            onPublish={() => void handlePublish()}
          />
        )}
      </Card>

      <PathwayRemoveStageDialog
        state={removal.dialog}
        onCancel={removal.cancel}
        onConfirm={removal.confirm}
        title={t("removeStageWithPatientsTitle")}
        getDescription={(state) =>
          t("removeStageWithPatientsDescription", { name: state.name, patientCount: state.patientCount })
        }
        cancelLabel={t("removeStageWithPatientsCancel")}
        confirmLabel={t("removeStageWithPatientsConfirm")}
      />

      <PathwayEditorStagePanel
        selectedNode={selectedNode}
        nodeCount={nodes.length}
        readOnly={readOnly}
        assigneeOptions={assigneeOptions}
        actions={stageActions}
        onRequestRemove={() => selectedNode && removal.request(selectedNode.id)}
      />
    </div>
  );
}

export function PathwayEditor(props: PathwayEditorProps) {
  const { canManage, isLoading } = useCanManagePathways();
  if (isLoading) {
    return <Skeleton className="h-[420px] w-full rounded-xl" />;
  }
  return (
    <ReactFlowProvider>
      <PathwayEditorInner {...props} canManage={canManage} />
    </ReactFlowProvider>
  );
}
