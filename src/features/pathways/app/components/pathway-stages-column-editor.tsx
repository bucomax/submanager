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
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Node } from "@xyflow/react";
import { ExternalLink, Info, Loader2, Plus, RefreshCw, Rocket, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PATHWAY_STAGE_NONE_ASSIGNEE } from "@/features/pathways/app/utils/stage-default-assignee";
import { setStageNodeDefaultAssignees } from "@/lib/pathway/stage-node-assignees";
import { PathwaySortableStageRow } from "@/features/pathways/app/components/pathway-sortable-stage-row";
import { usePathwayDraftVersion } from "@/features/pathways/app/hooks/use-pathway-draft-version";
import { usePathwayPublishPreview } from "@/features/pathways/app/hooks/use-pathway-publish-preview";
import { listTenantMembersForPicker } from "@/features/settings/app/services/tenant-settings.service";
import { isPathwayDraftDirty } from "@/features/pathways/app/utils/pathway-graph";
import { buildLinearEdges } from "@/features/pathways/app/utils/linear-graph-edges";
import {
  ensurePathwayGraphNodePositions,
  parsePathwayStageNodes,
  updatePathwayStageNodeChecklistItems,
  updatePathwayStageNodeStageDocuments,
} from "@/features/pathways/app/utils/pathway-stage-nodes";
import { pathwayEditorGraphNodePosition } from "@/lib/pathway/graph-editor-layout";
import type { PathwayStagesColumnEditorProps, StageSlaField } from "@/features/pathways/app/types/column-editor";
import type { LabeledSelectOption } from "@/shared/components/forms/labeled-select";
import { Link } from "@/i18n/navigation";
import { toast } from "@/lib/toast";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardFooter } from "@/shared/components/ui/card";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Skeleton } from "@/shared/components/ui/skeleton";

const EMPTY_NODES: Node[] = [];

export function PathwayStagesColumnEditor({ pathwayId }: PathwayStagesColumnEditorProps) {
  const t = useTranslations("pathways.columnEditor");
  const tEditor = useTranslations("pathways.editor");
  const {
    loading,
    error,
    versionId,
    graphJson,
    pathwayName,
    syncedPathwayName,
    saving,
    publishing,
    saveDraft,
    publishSavedDraft,
    hasPublishableGraphChanges,
    reload,
  } = usePathwayDraftVersion(pathwayId);
  /**
   * Rascunho local das etapas. O grafo do servidor é a semente: enquanto `graphJson`
   * mantiver a mesma identidade valem as edições locais; quando ele é recarregado
   * (load, salvar, publicar) o rascunho volta a acompanhar o servidor — mesmo efeito
   * do antigo `useLayoutEffect` de reset, porém derivado no render.
   */
  const serverNodes = useMemo(
    () => (graphJson == null ? EMPTY_NODES : ensurePathwayGraphNodePositions(parsePathwayStageNodes(graphJson))),
    [graphJson],
  );
  const [draftNodes, setDraftNodes] = useState<{ source: unknown; nodes: Node[] } | null>(null);
  const nodes =
    draftNodes !== null && Object.is(draftNodes.source, graphJson) ? draftNodes.nodes : serverNodes;
  const setNodes = useCallback(
    (updater: Node[] | ((previous: Node[]) => Node[])) =>
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
  const [assigneeOptions, setAssigneeOptions] = useState<LabeledSelectOption[]>([]);
  const [removeStageDialog, setRemoveStageDialog] = useState<{
    stageKey: string;
    name: string;
    patientCount: number;
  } | null>(null);

  const edges = useMemo(() => buildLinearEdges(nodes), [nodes]);

  const noneAssigneeLabel = tEditor("defaultAssigneeNone");
  useEffect(() => {
    let cancelled = false;
    void listTenantMembersForPicker({ skipErrorToast: true })
      .then((data) => {
        if (cancelled) return;
        setAssigneeOptions([
          { value: PATHWAY_STAGE_NONE_ASSIGNEE, label: noneAssigneeLabel },
          ...data.members.map((m) => ({
            value: m.userId,
            label: m.name?.trim() ? `${m.name} (${m.email})` : m.email,
          })),
        ]);
      })
      .catch(() => {
        if (!cancelled) {
          setAssigneeOptions([{ value: PATHWAY_STAGE_NONE_ASSIGNEE, label: noneAssigneeLabel }]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [noneAssigneeLabel]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const isDraftDirty = useMemo(
    () =>
      isPathwayDraftDirty({
        graphJson,
        nodes,
        edges,
        pathwayName,
        syncedPathwayName,
      }),
    [graphJson, nodes, edges, pathwayName, syncedPathwayName],
  );

  const localGraphJson = useMemo(() => ({ nodes, edges }), [nodes, edges]);
  const {
    publishPreview,
    publishPreviewLoading,
    publishPreviewError,
    refreshPublishPreview,
  } = usePathwayPublishPreview(pathwayId, versionId, localGraphJson);

  const publishBlockedByPreview =
    publishPreviewLoading ||
    publishPreviewError != null ||
    (publishPreview != null && !publishPreview.canPublish);

  const publishDisabled =
    publishing || saving || isDraftDirty || !hasPublishableGraphChanges || publishBlockedByPreview;

  function graphPayload() {
    return { nodes, edges };
  }

  async function handleSave() {
    if (!versionId) return;
    try {
      await saveDraft(graphPayload());
      toast.success(tEditor("saveSuccess"));
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  async function handlePublish() {
    if (!versionId || isDraftDirty || !hasPublishableGraphChanges || publishBlockedByPreview) return;
    try {
      await publishSavedDraft();
      toast.success(tEditor("publishSuccess"));
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setNodes((prev) => {
      const oldIndex = prev.findIndex((n) => n.id === active.id);
      const newIndex = prev.findIndex((n) => n.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function addStage() {
    const id = `stage-${crypto.randomUUID()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "default",
        position: pathwayEditorGraphNodePosition(nds.length),
        data: { label: `${tEditor("defaultStageLabel")} ${nds.length + 1}`, patientMessage: "" },
      },
    ]);
  }

  function updateLabel(id: string, label: string) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n,
      ),
    );
  }

  function updateSla(id: string, field: StageSlaField, value: number | undefined) {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        const nextData = { ...n.data } as Record<string, unknown>;
        if (value === undefined) {
          delete nextData[field];
        } else {
          nextData[field] = value;
        }
        return { ...n, data: nextData };
      }),
    );
  }

  function updateDefaultAssignees(stageId: string, userIds: string[]) {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== stageId) return n;
        const nextData = { ...n.data } as Record<string, unknown>;
        setStageNodeDefaultAssignees(nextData, userIds);
        return { ...n, data: nextData };
      }),
    );
  }

  function addChecklistItem(stageId: string) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== stageId
          ? n
          : {
              ...n,
              data: updatePathwayStageNodeChecklistItems(n.data, (items) => [
                ...items,
                {
                  id: `checklist-${crypto.randomUUID()}`,
                  label: "",
                },
              ]),
            },
      ),
    );
  }

  function updateChecklistItem(stageId: string, itemId: string, label: string) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== stageId
          ? n
          : {
              ...n,
              data: updatePathwayStageNodeChecklistItems(n.data, (items) =>
                items.map((item) => (item.id === itemId ? { ...item, label } : item)),
              ),
            },
      ),
    );
  }

  function updateChecklistItemRequired(stageId: string, itemId: string, requiredForTransition: boolean) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== stageId
          ? n
          : {
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
            },
      ),
    );
  }

  function removeChecklistItem(stageId: string, itemId: string) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== stageId
          ? n
          : {
              ...n,
              data: updatePathwayStageNodeChecklistItems(n.data, (items) =>
                items.filter((item) => item.id !== itemId),
              ),
            },
      ),
    );
  }

  function addStageDocuments(
    stageId: string,
    items: { fileAssetId: string; fileName: string; mimeType: string }[],
  ) {
    if (items.length === 0) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== stageId
          ? n
          : {
              ...n,
              data: updatePathwayStageNodeStageDocuments(n.data, (docs) => [...docs, ...items]),
            },
      ),
    );
  }

  function removeStageDocument(stageId: string, fileAssetId: string) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== stageId
          ? n
          : {
              ...n,
              data: updatePathwayStageNodeStageDocuments(n.data, (docs) =>
                docs.filter((d) => d.fileAssetId !== fileAssetId),
              ),
            },
      ),
    );
  }

  function applyRemoveStage(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
  }

  function requestRemoveStage(id: string) {
    if (nodes.length <= 1) {
      toast.error(t("cannotRemoveLast"));
      return;
    }
    const count =
      publishPreview?.publishedStagePatientCounts.find((r) => r.stageKey === id)?.patientCount ?? 0;
    if (count > 0) {
      const node = nodes.find((n) => n.id === id);
      setRemoveStageDialog({
        stageKey: id,
        name: String(node?.data?.label ?? id),
        patientCount: count,
      });
      return;
    }
    applyRemoveStage(id);
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
      <Dialog
        open={removeStageDialog !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveStageDialog(null);
        }}
      >
        {removeStageDialog ? (
          <StandardDialogContent
            title={t("removeStageWithPatientsTitle")}
            description={t("removeStageWithPatientsDescription", {
              name: removeStageDialog.name,
              patientCount: removeStageDialog.patientCount,
            })}
            size="sm"
            footer={
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => setRemoveStageDialog(null)}>
                  {t("removeStageWithPatientsCancel")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const id = removeStageDialog.stageKey;
                    setRemoveStageDialog(null);
                    applyRemoveStage(id);
                  }}
                >
                  {t("removeStageWithPatientsConfirm")}
                </Button>
              </>
            }
          >
            <span className="sr-only">{t("removeStageWithPatientsTitle")}</span>
          </StandardDialogContent>
        ) : null}
      </Dialog>

      <Card className="py-0">
        <CardContent className="space-y-2 py-0">
          <Alert variant="info">
            <Info className="size-4 shrink-0" aria-hidden />
            <AlertDescription>{tEditor("draftHint")}</AlertDescription>
          </Alert>
          {publishPreviewError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{tEditor("publishPreviewFailed")}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-destructive/50"
                  onClick={() => void refreshPublishPreview(localGraphJson)}
                >
                  {tEditor("publishPreviewRetry")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {publishPreview && !publishPreview.canPublish ? (
            <Alert variant="destructive">
              <AlertDescription className="space-y-2">
                <p className="font-medium text-destructive">{tEditor("publishPreviewBlockedTitle")}</p>
                <ul className="list-inside list-disc text-sm">
                  {publishPreview.issues.map((issue) => (
                    <li key={issue.code}>{issue.message}</li>
                  ))}
                </ul>
                {publishPreview.publishedStagePatientCounts.some((r) => r.patientCount > 0) ? (
                  <ul className="border-border/60 text-muted-foreground mt-2 space-y-0.5 border-t pt-2 text-xs">
                    {publishPreview.publishedStagePatientCounts
                      .filter((r) => r.patientCount > 0)
                      .map((r) => (
                        <li key={r.stageKey}>
                          {tEditor("publishPreviewPatientsRow", { name: r.name, count: r.patientCount })}
                        </li>
                      ))}
                  </ul>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <p className="text-muted-foreground text-sm">{t("listHint")}</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2" role="list">
                {nodes.map((node) => (
                  <li key={node.id} className="list-none">
                    <PathwaySortableStageRow
                      node={node}
                      assigneeOptions={
                        assigneeOptions.length > 0
                          ? assigneeOptions
                          : [{ value: PATHWAY_STAGE_NONE_ASSIGNEE, label: noneAssigneeLabel }]
                      }
                      onUpdateDefaultAssignees={updateDefaultAssignees}
                      onUpdateLabel={updateLabel}
                      onUpdateSla={updateSla}
                      onAddChecklistItem={addChecklistItem}
                      onUpdateChecklistItem={updateChecklistItem}
                      onUpdateChecklistItemRequired={updateChecklistItemRequired}
                      onRemoveChecklistItem={removeChecklistItem}
                      onAddStageDocuments={addStageDocuments}
                      onRemoveStageDocument={removeStageDocument}
                      onRemove={requestRemoveStage}
                      disableRemove={nodes.length <= 1}
                    />
                  </li>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-2 border-t">
          <Button type="button" variant="outline" size="sm" onClick={addStage}>
            <Plus className="size-4" />
            {tEditor("addStage")}
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {tEditor("save")}
          </Button>
          {(() => {
            const publishBtn = (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void handlePublish()}
                disabled={publishDisabled}
              >
                {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                {tEditor("publish")}
              </Button>
            );
            if (isDraftDirty && !publishing && !saving) {
              return (
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex">{publishBtn}</span>} />
                  <TooltipContent side="top" className="max-w-xs">
                    {tEditor("publishDisabledUnsavedTooltip")}
                  </TooltipContent>
                </Tooltip>
              );
            }
            if (!hasPublishableGraphChanges && !publishing && !saving) {
              return (
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex">{publishBtn}</span>} />
                  <TooltipContent side="top" className="max-w-xs">
                    {tEditor("publishDisabledNoChangesTooltip")}
                  </TooltipContent>
                </Tooltip>
              );
            }
            if (publishPreviewLoading && !publishing && !saving) {
              return (
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex">{publishBtn}</span>} />
                  <TooltipContent side="top" className="max-w-xs">
                    {tEditor("publishDisabledValidatingTooltip")}
                  </TooltipContent>
                </Tooltip>
              );
            }
            if (publishPreviewError && !publishing && !saving) {
              return (
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex">{publishBtn}</span>} />
                  <TooltipContent side="top" className="max-w-xs">
                    {tEditor("publishPreviewFailed")}
                  </TooltipContent>
                </Tooltip>
              );
            }
            if (publishPreview && !publishPreview.canPublish && !publishing && !saving) {
              return (
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex">{publishBtn}</span>} />
                  <TooltipContent side="top" className="max-w-xs">
                    {tEditor("publishDisabledPreviewTooltip")}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return publishBtn;
          })()}
          <Button nativeButton={false} variant="ghost" size="sm" render={<Link href={`/dashboard/pathways/${pathwayId}`} />}>
            <ExternalLink className="size-4" />
            {t("openFlowEditor")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
