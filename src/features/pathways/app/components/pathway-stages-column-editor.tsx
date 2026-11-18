"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ExternalLink, Loader2, Plus, RefreshCw, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { PathwayPublishAlerts } from "@/features/pathways/app/components/pathway-publish-alerts";
import { PathwayPublishButton } from "@/features/pathways/app/components/pathway-publish-button";
import { PathwayRemoveStageDialog } from "@/features/pathways/app/components/pathway-remove-stage-dialog";
import { PathwaySortableStageRow } from "@/features/pathways/app/components/pathway-sortable-stage-row";
import { usePathwayActions } from "@/features/pathways/app/hooks/use-pathway-actions";
import { usePathwayColumnStages } from "@/features/pathways/app/hooks/use-pathway-column-stages";
import { usePathwayDraftVersion } from "@/features/pathways/app/hooks/use-pathway-draft-version";
import { usePathwayPublishPreview } from "@/features/pathways/app/hooks/use-pathway-publish-preview";
import { useRemoveStageRequest } from "@/features/pathways/app/hooks/use-remove-stage-request";
import { useStageAssigneeOptions } from "@/features/pathways/app/hooks/use-stage-assignee-options";
import { useStageNodeActions } from "@/features/pathways/app/hooks/use-stage-node-actions";
import type { PathwayStagesColumnEditorProps } from "@/features/pathways/app/types/column-editor";
import { Link } from "@/i18n/navigation";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardFooter } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useCanManagePathways } from "@/shared/hooks/use-can-manage-pathways";

export function PathwayStagesColumnEditor({ pathwayId }: PathwayStagesColumnEditorProps) {
  const t = useTranslations("pathways.columnEditor");
  const tEditor = useTranslations("pathways.editor");
  const { canManage } = useCanManagePathways();
  const readOnly = !canManage;
  const draft = usePathwayDraftVersion(pathwayId, canManage);
  const { loading, error, versionId, pathwayName, reload } = draft;
  const stages = usePathwayColumnStages({
    graphJson: draft.graphJson,
    pathwayName,
    syncedPathwayName: draft.syncedPathwayName,
  });
  const { nodes, edges } = stages;
  const stageActions = useStageNodeActions(stages.setNodes);
  const { options: assigneeOptions } = useStageAssigneeOptions();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const preview = usePathwayPublishPreview(pathwayId, versionId, stages.localGraphJson, canManage);
  const { publishPreview, publishPreviewLoading, publishPreviewError } = preview;
  const { publishDisabled, handleSave, handlePublish } = usePathwayActions({
    readOnly,
    versionId,
    pathwayName,
    requirePathwayName: false,
    nodes,
    edges,
    saving: draft.saving,
    publishing: draft.publishing,
    isDraftDirty: stages.isDraftDirty,
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
    cannotRemoveLastMessage: t("cannotRemoveLast"),
    onRemove: stages.removeStage,
  });

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    stages.moveStage(String(active.id), String(over.id));
  }

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
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      <Card className="py-0">
        <CardContent className="space-y-2 py-0">
          <PathwayPublishAlerts
            readOnly={readOnly}
            publishPreview={publishPreview}
            publishPreviewError={publishPreviewError}
            onRetryPreview={() => void preview.refreshPublishPreview()}
          />
          <p className="text-muted-foreground text-sm">{t("listHint")}</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
                <ul className="flex flex-col gap-2" role="list">
                  {nodes.map((node) => (
                    <li key={node.id} className="list-none">
                      <PathwaySortableStageRow
                        node={node}
                        assigneeOptions={assigneeOptions}
                        onUpdateDefaultAssignees={stageActions.updateDefaultAssignees}
                        onUpdateLabel={(id, label) => stageActions.updateData(id, { label })}
                        onUpdateSla={stageActions.updateSla}
                        onAddChecklistItem={stageActions.addChecklistItem}
                        onUpdateChecklistItem={stageActions.updateChecklistItem}
                        onUpdateChecklistItemRequired={stageActions.updateChecklistItemRequired}
                        onRemoveChecklistItem={stageActions.removeChecklistItem}
                        onAddStageDocuments={stageActions.addDocuments}
                        onRemoveStageDocument={stageActions.removeDocument}
                        onRemove={removal.request}
                        disableRemove={readOnly || nodes.length <= 1}
                      />
                    </li>
                  ))}
                </ul>
              </fieldset>
            </SortableContext>
          </DndContext>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-2 border-t">
          {readOnly ? null : (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => stages.addStage(tEditor("defaultStageLabel"))}>
                <Plus className="size-4" />
                {tEditor("addStage")}
              </Button>
              <Button type="button" size="sm" onClick={() => void handleSave()} disabled={draft.saving}>
                {draft.saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {tEditor("save")}
              </Button>
              <PathwayPublishButton
                publishing={draft.publishing}
                saving={draft.saving}
                disabled={publishDisabled}
                isDraftDirty={stages.isDraftDirty}
                hasPublishableGraphChanges={draft.hasPublishableGraphChanges}
                publishPreview={publishPreview}
                publishPreviewLoading={publishPreviewLoading}
                publishPreviewError={publishPreviewError}
                onPublish={() => void handlePublish()}
              />
            </>
          )}
          <Button nativeButton={false} variant="ghost" size="sm" render={<Link href={`/dashboard/pathways/${pathwayId}`} />}>
            <ExternalLink className="size-4" />
            {t("openFlowEditor")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
