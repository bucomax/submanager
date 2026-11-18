"use client";

import type { Node } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { normalizeStageDefaultAssigneeUserIds } from "@/domain/pathway/graph-normalizer";
import { PathwayStageChecklistBlock } from "@/features/pathways/app/components/pathway-stage-checklist-block";
import { PathwayStageDefaultAssigneesField } from "@/features/pathways/app/components/pathway-stage-default-assignees-field";
import { PathwayStageDocumentsBlock } from "@/features/pathways/app/components/pathway-stage-documents-block";
import type { useStageNodeActions } from "@/features/pathways/app/hooks/use-stage-node-actions";
import type { StageSlaField } from "@/features/pathways/app/types/column-editor";
import { cn } from "@/lib/utils";
import { LabeledNonNegativeIntegerUnitField } from "@/shared/components/forms";
import type { LabeledSelectOption } from "@/shared/components/forms/labeled-select";
import { Button } from "@/shared/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";

type PathwayEditorStagePanelProps = {
  selectedNode: Node | null;
  nodeCount: number;
  readOnly: boolean;
  assigneeOptions: LabeledSelectOption[];
  actions: ReturnType<typeof useStageNodeActions>;
  onRequestRemove: () => void;
};

function readDays(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : undefined;
}

/** Painel lateral de propriedades da etapa selecionada no canvas. */
export function PathwayEditorStagePanel({
  selectedNode,
  nodeCount,
  readOnly,
  assigneeOptions,
  actions,
  onRequestRemove,
}: PathwayEditorStagePanelProps) {
  const t = useTranslations("pathways.editor");
  const tCol = useTranslations("pathways.columnEditor");

  const selectedId = selectedNode?.id ?? null;
  const selectedData = selectedNode?.data as Record<string, unknown> | undefined;
  const selectedAssigneeIds = normalizeStageDefaultAssigneeUserIds(
    selectedData as Parameters<typeof normalizeStageDefaultAssigneeUserIds>[0],
  );
  const updateSla = (field: StageSlaField, value: number | undefined) =>
    selectedId && actions.updateSla(selectedId, field, value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("stagePropsTitle")}</CardTitle>
        <CardDescription>{t("stagePropsDescription")}</CardDescription>
        {selectedNode && !readOnly ? (
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
                      disabled={nodeCount <= 1}
                      onClick={onRequestRemove}
                      aria-label={t("removeStageAria")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                }
              />
              <TooltipContent side="left">
                {nodeCount <= 1 ? t("cannotRemoveLastStage") : t("removeStage")}
              </TooltipContent>
            </Tooltip>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5 pb-6">
        {!selectedNode || !selectedId ? (
          <p className="text-muted-foreground text-sm">{t("selectNode")}</p>
        ) : (
          <fieldset disabled={readOnly} className="m-0 min-w-0 space-y-5 border-0 p-0">
            <div className="border-border/60 bg-muted/10 space-y-3 rounded-xl border p-4">
              <Field className="min-w-0">
                <FieldLabel htmlFor="stage-label">{tCol("stageName")}</FieldLabel>
                <Input
                  id="stage-label"
                  value={String(selectedNode.data?.label ?? "")}
                  onChange={(e) => actions.updateData(selectedId, { label: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LabeledNonNegativeIntegerUnitField
                  id="stage-warn"
                  label={tCol("alertWarningDays")}
                  unitLabel={tCol("daysUnit")}
                  value={readDays(selectedData?.alertWarningDays)}
                  onChange={(v) => updateSla("alertWarningDays", v)}
                />
                <LabeledNonNegativeIntegerUnitField
                  id="stage-crit"
                  label={tCol("alertCriticalDays")}
                  unitLabel={tCol("daysUnit")}
                  value={readDays(selectedData?.alertCriticalDays)}
                  onChange={(v) => updateSla("alertCriticalDays", v)}
                />
              </div>
              <PathwayStageDefaultAssigneesField
                idPrefix="flow-selected"
                selectedUserIds={selectedAssigneeIds}
                memberOptions={assigneeOptions}
                onChange={(userIds) => actions.updateDefaultAssignees(selectedId, userIds)}
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
                  onChange={(e) => actions.updateData(selectedId, { patientMessage: e.target.value })}
                  className={cn(
                    "border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 mt-2 flex min-h-[4.5rem] w-full rounded-lg border px-2.5 py-2 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
                  )}
                />
              </Field>
            </div>
            <PathwayStageChecklistBlock
              checklistItems={selectedNode.data?.checklistItems}
              onAdd={() => actions.addChecklistItem(selectedId)}
              onUpdate={(itemId, label) => actions.updateChecklistItem(selectedId, itemId, label)}
              onUpdateRequired={(itemId, required) =>
                actions.updateChecklistItemRequired(selectedId, itemId, required)
              }
              onRemove={(itemId) => actions.removeChecklistItem(selectedId, itemId)}
            />
            <PathwayStageDocumentsBlock
              stageDocuments={selectedNode.data?.stageDocuments}
              onDocumentsAdded={(items) => actions.addDocuments(selectedId, items)}
              onRemove={(fileAssetId) => actions.removeDocument(selectedId, fileAssetId)}
            />
          </fieldset>
        )}
      </CardContent>
    </Card>
  );
}
