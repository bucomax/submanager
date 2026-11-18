"use client";

import type { KanbanColumn, PipelineStatusFilter } from "@/features/dashboard/app/types";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PipelineKanbanPatientCard } from "./pipeline-kanban-patient-card";

/** Altura de referência por card + faixa entre cards (`gap-2`), para dimensionar a área de DnD. */
const KANBAN_CARD_SLOT_REM = 6.25;
const KANBAN_GAP_REM = 0.5;

type PipelineKanbanColumnProps = {
  column: KanbanColumn;
  statusFilter: PipelineStatusFilter;
  dragDisabled: boolean;
  transitioningPatientPathwayId: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRequestChangeStage: (patientPathwayId: string) => void;
};

export function PipelineKanbanColumn({
  column: col,
  statusFilter,
  dragDisabled,
  transitioningPatientPathwayId,
  loadingMore,
  onLoadMore,
  onRequestChangeStage,
}: PipelineKanbanColumnProps) {
  const t = useTranslations("dashboard.pipeline");
  const countDisplay = `${col.data.length}${col.pagination.hasNextPage ? "+" : ""}`;

  const { setNodeRef, isOver } = useDroppable({
    id: col.stage.id,
    disabled: dragDisabled,
  });

  const dndMinHeight = `calc(5 * ${KANBAN_CARD_SLOT_REM}rem + 4 * ${KANBAN_GAP_REM}rem)`;
  const dndMaxHeight = `min(calc(10 * ${KANBAN_CARD_SLOT_REM}rem + 9 * ${KANBAN_GAP_REM}rem), 85vh)`;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-surface flex w-[min(100%,280px)] shrink-0 flex-col rounded-[18px] border",
        isOver && !dragDisabled && "ring-primary ring-2 ring-offset-2 ring-offset-background",
      )}
    >
      <div className="border-b px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-medium leading-tight">{col.stage.name}</p>
          <span
            className="bg-muted-foreground/15 text-foreground/90 inline-flex min-h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums ring-1 ring-border/40 dark:bg-muted-foreground/18 dark:ring-border/50"
            aria-label={t("column.countAria", { display: countDisplay })}
          >
            {col.data.length}
            {col.pagination.hasNextPage ? "+" : ""}
          </span>
        </div>
      </div>
      <div
        className="flex flex-col gap-2 overflow-y-auto p-2"
        style={{ minHeight: dndMinHeight, maxHeight: dndMaxHeight }}
      >
        {col.data.length === 0 ? (
          <p className="text-muted-foreground px-1 py-4 text-center text-sm">{t("column.empty")}</p>
        ) : (
          col.data.map((pp) => (
            <PipelineKanbanPatientCard
              key={pp.id}
              patientPathway={pp}
              dragDisabled={dragDisabled}
              isTransitioning={transitioningPatientPathwayId === pp.id}
              onRequestChangeStage={() => onRequestChangeStage(pp.id)}
            />
          ))
        )}
        {col.pagination.hasNextPage && !statusFilter ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={loadingMore}
            onClick={() => void onLoadMore()}
          >
            {loadingMore ? <Loader2 className="size-4 animate-spin" /> : t("column.loadMore")}
          </Button>
        ) : null}
        {col.pagination.hasNextPage && statusFilter ? (
          <p className="text-muted-foreground px-1 text-center text-xs">{t("column.loadMoreDisabledWithStatus")}</p>
        ) : null}
      </div>
    </div>
  );
}
