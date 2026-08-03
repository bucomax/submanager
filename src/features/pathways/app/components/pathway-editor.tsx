"use client";

import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PATHWAY_STAGE_NONE_ASSIGNEE } from "@/features/pathways/app/utils/stage-default-assignee";
import { PathwayStageChecklistBlock } from "@/features/pathways/app/components/pathway-stage-checklist-block";
import { PathwayStageDefaultAssigneesField } from "@/features/pathways/app/components/pathway-stage-default-assignees-field";
import { PathwayStageDocumentsBlock } from "@/features/pathways/app/components/pathway-stage-documents-block";
import { usePathwayDraftVersion } from "@/features/pathways/app/hooks/use-pathway-draft-version";
import { usePathwayPublishPreview } from "@/features/pathways/app/hooks/use-pathway-publish-preview";
import { listTenantMembersForPicker } from "@/features/settings/app/services/tenant-settings.service";
import { isPathwayDraftDirty, parsePathwayGraph } from "@/features/pathways/app/utils/pathway-graph";
import { normalizeStageDefaultAssigneeUserIds } from "@/domain/pathway/graph-normalizer";
import { pathwayEditorFitViewOptions, pathwayEditorGraphNodePosition } from "@/lib/pathway/graph-editor-layout";
import { setStageNodeDefaultAssignees } from "@/lib/pathway/stage-node-assignees";
import {
  ensurePathwayGraphNodePositions,
  updatePathwayStageNodeChecklistItems,
  updatePathwayStageNodeStageDocuments,
} from "@/features/pathways/app/utils/pathway-stage-nodes";
import type { PathwayEditorProps, SelectedPathwayNodeUpdate } from "@/features/pathways/app/types/components";
import type { StageSlaField } from "@/features/pathways/app/types/column-editor";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { LabeledNonNegativeIntegerUnitField } from "@/shared/components/forms";
import type { LabeledSelectOption } from "@/shared/components/forms/labeled-select";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { Field, FieldDescription, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Dialog, StandardDialogContent } from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Info, Loader2, Plus, RefreshCw, Rocket, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

function PathwayEditorInner({ pathwayId }: PathwayEditorProps) {
  const t = useTranslations("pathways.editor");
  const tCol = useTranslations("pathways.columnEditor");
  const { resolvedTheme } = useTheme();
  const reactFlowColorMode = resolvedTheme === "dark" ? "dark" : "light";
  const {
    loading,
    error,
    versionId,
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
  } = usePathwayDraftVersion(pathwayId);
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
  const [assigneeOptions, setAssigneeOptions] = useState<LabeledSelectOption[]>([]);
  const [removeStageDialog, setRemoveStageDialog] = useState<{
    stageKey: string;
    name: string;
    patientCount: number;
  } | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  const noneAssigneeLabel = t("defaultAssigneeNone");
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

  useLayoutEffect(() => {
    if (graphJson == null) return;
    const parsed = parsePathwayGraph(graphJson);
    setNodes(ensurePathwayGraphNodePositions(parsed.nodes));
    setEdges(parsed.edges);
  }, [graphJson, setEdges, setNodes]);

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
    publishing ||
    saving ||
    isDraftDirty ||
    !hasPublishableGraphChanges ||
    publishBlockedByPreview;

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges],
  );

  async function handleSave() {
    if (!versionId) return;
    try {
      await saveDraft({ nodes, edges });
      toast.success(t("saveSuccess"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("saveError");
      toast.error(msg);
    }
  }

  async function handlePublish() {
    if (!versionId || isDraftDirty || !hasPublishableGraphChanges || publishBlockedByPreview) return;
    try {
      await publishSavedDraft();
      toast.success(t("publishSuccess"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("publishError");
      toast.error(msg);
    }
  }

  function addStage() {
    const id = `stage-${crypto.randomUUID()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "default",
        position: pathwayEditorGraphNodePosition(nds.length),
        data: { label: `${t("defaultStageLabel")} ${nds.length + 1}`, patientMessage: "" },
      },
    ]);
    setSelectedId(id);
  }

  function applyRemoveSelectedStage() {
    if (!selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }

  function requestRemoveSelectedStage() {
    if (!selectedId) return;
    if (nodes.length <= 1) {
      toast.error(t("cannotRemoveLastStage"));
      return;
    }
    const count =
      publishPreview?.publishedStagePatientCounts.find((r) => r.stageKey === selectedId)?.patientCount ?? 0;
    if (count > 0) {
      const n = nodes.find((x) => x.id === selectedId);
      setRemoveStageDialog({
        stageKey: selectedId,
        name: String(n?.data?.label ?? selectedId),
        patientCount: count,
      });
      return;
    }
    applyRemoveSelectedStage();
  }

  function updateSelectedData(partial: SelectedPathwayNodeUpdate) {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedId
          ? {
              ...n,
              data: {
                ...n.data,
                ...(partial.label !== undefined ? { label: partial.label } : {}),
                ...(partial.patientMessage !== undefined ? { patientMessage: partial.patientMessage } : {}),
              },
            }
          : n,
      ),
    );
  }

  function updateSelectedSla(field: StageSlaField, value: number | undefined) {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedId) return n;
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

  function updateSelectedDefaultAssignees(userIds: string[]) {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedId) return n;
        const nextData = { ...n.data } as Record<string, unknown>;
        setStageNodeDefaultAssignees(nextData, userIds);
        return { ...n, data: nextData };
      }),
    );
  }

  function addChecklistItemSelected() {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== selectedId
          ? n
          : {
              ...n,
              data: updatePathwayStageNodeChecklistItems(n.data, (items) => [
                ...items,
                { id: `checklist-${crypto.randomUUID()}`, label: "" },
              ]),
            },
      ),
    );
  }

  function updateChecklistItemSelected(itemId: string, label: string) {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== selectedId
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

  function updateChecklistItemRequiredSelected(itemId: string, requiredForTransition: boolean) {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== selectedId
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

  function removeChecklistItemSelected(itemId: string) {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== selectedId
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

  function addStageDocumentsSelected(items: { fileAssetId: string; fileName: string; mimeType: string }[]) {
    if (!selectedId || items.length === 0) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== selectedId
          ? n
          : {
              ...n,
              data: updatePathwayStageNodeStageDocuments(n.data, (docs) => [...docs, ...items]),
            },
      ),
    );
  }

  function removeStageDocumentSelected(fileAssetId: string) {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id !== selectedId
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

  const selectedData = selectedNode?.data as Record<string, unknown> | undefined;
  const warnRaw = selectedData?.alertWarningDays;
  const critRaw = selectedData?.alertCriticalDays;
  const warnDays =
    typeof warnRaw === "number" && Number.isFinite(warnRaw) ? Math.max(0, Math.floor(warnRaw)) : undefined;
  const critDays =
    typeof critRaw === "number" && Number.isFinite(critRaw) ? Math.max(0, Math.floor(critRaw)) : undefined;

  const selectedAssigneeIds = normalizeStageDefaultAssigneeUserIds(
    selectedData as Parameters<typeof normalizeStageDefaultAssigneeUserIds>[0],
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_minmax(280px,380px)]">
      <Card className="overflow-hidden p-0">
        <CardHeader className="space-y-3 border-b py-4">
          <Alert variant="info">
            <Info className="size-4 shrink-0" aria-hidden />
            <AlertDescription>{t("draftHint")}</AlertDescription>
          </Alert>
          {publishPreviewError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{t("publishPreviewFailed")}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-destructive/50"
                  onClick={() => void refreshPublishPreview(localGraphJson)}
                >
                  {t("publishPreviewRetry")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {publishPreview && !publishPreview.canPublish ? (
            <Alert variant="destructive">
              <AlertDescription className="space-y-2">
                <p className="font-medium text-destructive">{t("publishPreviewBlockedTitle")}</p>
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
                        <li key={r.stageKey}>{t("publishPreviewPatientsRow", { name: r.name, count: r.patientCount })}</li>
                      ))}
                  </ul>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <Field className="min-w-0">
            <FieldLabel htmlFor="pathway-name">{t("pathwayName")}</FieldLabel>
            <Input
              id="pathway-name"
              value={pathwayName}
              onChange={(e) => setPathwayName(e.target.value)}
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
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            fitViewOptions={pathwayEditorFitViewOptions}
            nodesDraggable
            nodesConnectable
            elementsSelectable
          >
            <Background />
            <Controls fitViewOptions={pathwayEditorFitViewOptions} />
            <MiniMap />
          </ReactFlow>
        </div>
        <CardFooter className="flex flex-wrap items-center gap-2 border-t">
          <Button type="button" variant="outline" size="sm" onClick={addStage}>
            <Plus className="size-4" />
            {t("addStage")}
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t("save")}
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
                {t("publish")}
              </Button>
            );
            if (isDraftDirty && !publishing && !saving) {
              return (
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex">{publishBtn}</span>} />
                  <TooltipContent side="top" className="max-w-xs">
                    {t("publishDisabledUnsavedTooltip")}
                  </TooltipContent>
                </Tooltip>
              );
            }
            if (!hasPublishableGraphChanges && !publishing && !saving) {
              return (
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex">{publishBtn}</span>} />
                  <TooltipContent side="top" className="max-w-xs">
                    {t("publishDisabledNoChangesTooltip")}
                  </TooltipContent>
                </Tooltip>
              );
            }
            if (publishPreviewLoading && !publishing && !saving) {
              return (
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex">{publishBtn}</span>} />
                  <TooltipContent side="top" className="max-w-xs">
                    {t("publishDisabledValidatingTooltip")}
                  </TooltipContent>
                </Tooltip>
              );
            }
            if (publishPreviewError && !publishing && !saving) {
              return (
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex">{publishBtn}</span>} />
                  <TooltipContent side="top" className="max-w-xs">
                    {t("publishPreviewFailed")}
                  </TooltipContent>
                </Tooltip>
              );
            }
            if (publishPreview && !publishPreview.canPublish && !publishing && !saving) {
              return (
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex">{publishBtn}</span>} />
                  <TooltipContent side="top" className="max-w-xs">
                    {t("publishDisabledPreviewTooltip")}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return publishBtn;
          })()}
        </CardFooter>
      </Card>

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
                    setRemoveStageDialog(null);
                    applyRemoveSelectedStage();
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

      <Card>
        <CardHeader>
          <CardTitle>{t("stagePropsTitle")}</CardTitle>
          <CardDescription>{t("stagePropsDescription")}</CardDescription>
          {selectedNode ? (
            <CardAction>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={nodes.length <= 1}
                        onClick={requestRemoveSelectedStage}
                        aria-label={t("removeStageAria")}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </span>
                  }
                />
                <TooltipContent side="left">
                  {nodes.length <= 1 ? t("cannotRemoveLastStage") : t("removeStage")}
                </TooltipContent>
              </Tooltip>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-5 pb-6">
          {!selectedNode ? (
            <p className="text-muted-foreground text-sm">{t("selectNode")}</p>
          ) : (
            <>
              <div className="border-border/60 bg-muted/10 space-y-3 rounded-xl border p-4">
                <Field className="min-w-0">
                  <FieldLabel htmlFor="stage-label">{tCol("stageName")}</FieldLabel>
                  <Input
                    id="stage-label"
                    value={String(selectedNode.data?.label ?? "")}
                    onChange={(e) => updateSelectedData({ label: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <LabeledNonNegativeIntegerUnitField
                    id="stage-warn"
                    label={tCol("alertWarningDays")}
                    unitLabel={tCol("daysUnit")}
                    value={warnDays}
                    onChange={(v) => updateSelectedSla("alertWarningDays", v)}
                  />
                  <LabeledNonNegativeIntegerUnitField
                    id="stage-crit"
                    label={tCol("alertCriticalDays")}
                    unitLabel={tCol("daysUnit")}
                    value={critDays}
                    onChange={(v) => updateSelectedSla("alertCriticalDays", v)}
                  />
                </div>
                <PathwayStageDefaultAssigneesField
                  idPrefix="flow-selected"
                  selectedUserIds={selectedAssigneeIds}
                  memberOptions={
                    assigneeOptions.length > 0
                      ? assigneeOptions
                      : [{ value: PATHWAY_STAGE_NONE_ASSIGNEE, label: noneAssigneeLabel }]
                  }
                  onChange={updateSelectedDefaultAssignees}
                  label={t("defaultAssigneeLabel")}
                />
              </div>
              <div className="border-border/60 bg-muted/10 space-y-2 rounded-xl border p-4">
                <Field>
                  <FieldLabel htmlFor="stage-msg">{t("patientMessage")}</FieldLabel>
                  <FieldDescription className="text-xs">{t("patientMessageHint")}</FieldDescription>
                  <textarea
                    id="stage-msg"
                    rows={4}
                    value={String(selectedNode.data?.patientMessage ?? "")}
                    onChange={(e) => updateSelectedData({ patientMessage: e.target.value })}
                    className={cn(
                      "border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 mt-2 flex min-h-[4.5rem] w-full rounded-lg border px-2.5 py-2 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
                    )}
                  />
                </Field>
              </div>
              <PathwayStageChecklistBlock
                checklistItems={selectedNode.data?.checklistItems}
                onAdd={addChecklistItemSelected}
                onUpdate={updateChecklistItemSelected}
                onUpdateRequired={updateChecklistItemRequiredSelected}
                onRemove={removeChecklistItemSelected}
              />
              <PathwayStageDocumentsBlock
                stageDocuments={selectedNode.data?.stageDocuments}
                onDocumentsAdded={addStageDocumentsSelected}
                onRemove={removeStageDocumentSelected}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PathwayEditor(props: PathwayEditorProps) {
  return (
    <ReactFlowProvider>
      <PathwayEditorInner {...props} />
    </ReactFlowProvider>
  );
}
