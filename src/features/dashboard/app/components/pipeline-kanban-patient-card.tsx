"use client";

import type { KanbanPatientPathway } from "@/features/dashboard/app/types";
import { useKanbanDragOverlayMode } from "@/features/dashboard/app/components/pipeline-kanban-dnd-context";
import { stageDurationTone } from "@/features/dashboard/app/utils/kanban";
import { useRouter } from "@/i18n/navigation";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { formatPhoneBrDisplay } from "@/lib/validators/phone";
import { cn } from "@/lib/utils";
import { calendarDaysFromNow } from "@/lib/utils/date";
import { slaHealthKanbanCardClassName } from "@/lib/utils/sla-status-ui";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  CheckCircle2,
  Clock,
  Loader2,
  MoreVertical,
  MoveRight,
  Siren,
  UserRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

type PipelineKanbanPatientCardProps = {
  patientPathway: KanbanPatientPathway;
  dragDisabled: boolean;
  isTransitioning: boolean;
  onRequestChangeStage: () => void;
};

export function PipelineKanbanPatientCard({
  patientPathway: pp,
  dragDisabled,
  isTransitioning,
  onRequestChangeStage,
}: PipelineKanbanPatientCardProps) {
  const t = useTranslations("dashboard.pipeline");
  const router = useRouter();
  const dragOverlayMode = useKanbanDragOverlayMode();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: pp.id,
    disabled: dragDisabled || isTransitioning,
  });

  /** Com DragOverlay, não aplicar transform no item da lista — evita distorção em colunas flex com min-height. */
  const style =
    dragOverlayMode && isDragging
      ? { opacity: 0, transition: "none" as const }
      : transform
        ? { transform: CSS.Transform.toString(transform) }
        : undefined;

  const days = useMemo(() => calendarDaysFromNow(pp.enteredStageAt), [pp.enteredStageAt]);
  const tone = useMemo(() => stageDurationTone(pp, days), [pp, days]);

  const durationLabel = t("drag.daysInStage", { count: days });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "w-full shrink-0 rounded-[14px] border bg-card text-sm",
        "transform-gpu transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
        slaHealthKanbanCardClassName(pp.slaStatus),
        !dragDisabled && !isTransitioning && "cursor-grab touch-none active:cursor-grabbing",
        !isDragging &&
          !isTransitioning &&
          "hover:-translate-y-px hover:shadow-[0_10px_28px_-10px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.45)]",
        isDragging && !dragOverlayMode && "z-10 opacity-90 shadow-lg",
        isDragging && dragOverlayMode && "pointer-events-none",
        isTransitioning && "pointer-events-none opacity-60",
      )}
      {...(!dragDisabled && !isTransitioning ? listeners : {})}
      {...(!dragDisabled && !isTransitioning ? attributes : {})}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{pp.client.name}</p>
            <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
              {formatPhoneBrDisplay(pp.client.phone)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isTransitioning ? <Loader2 className="text-muted-foreground size-4 animate-spin" /> : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground h-8 w-8 shrink-0"
                    aria-label={t("drag.cardActions")}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-[12rem]" onPointerDown={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={() => {
                    router.push(`/dashboard/clients/${pp.client.id}`);
                  }}
                >
                  <UserRound className="size-4" />
                  {t("drag.openPatient")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onRequestChangeStage();
                  }}
                >
                  <MoveRight className="size-4" />
                  {t("drag.changeStage")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div
          className={cn(
            "mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            tone === "ok" &&
              "bg-success-soft text-success",
            tone === "warning" &&
              "bg-warning-soft text-warning",
            tone === "critical" &&
              "bg-destructive-soft text-destructive",
          )}
        >
          {tone === "critical" ? (
            <Siren className="size-3.5 shrink-0" aria-hidden />
          ) : tone === "warning" ? (
            <Clock className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
          )}
          <span className="min-w-0 truncate">{durationLabel}</span>
        </div>
      </div>
    </div>
  );
}
