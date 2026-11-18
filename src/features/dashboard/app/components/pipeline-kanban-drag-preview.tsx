"use client";

import type { KanbanPatientPathway } from "@/features/dashboard/app/types";
import { stageDurationTone } from "@/features/dashboard/app/utils/kanban";
import { calendarDaysFromNow } from "@/lib/utils/date";
import { slaHealthKanbanCardClassName } from "@/lib/utils/sla-status-ui";
import { cn } from "@/lib/utils";
import { formatPhoneBrDisplay } from "@/lib/validators/phone";
import { Siren } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

/** Pré-visualização espelhada do card no {@link DragOverlay} (fora do fluxo flex da coluna). */
export function PipelineKanbanDragPreview({ pp }: { pp: KanbanPatientPathway }) {
  const t = useTranslations("dashboard.pipeline");
  const days = useMemo(() => calendarDaysFromNow(pp.enteredStageAt), [pp.enteredStageAt]);
  const tone = useMemo(() => stageDurationTone(pp, days), [pp, days]);
  const durationLabel = t("drag.daysInStage", { count: days });

  return (
    <div
      className={cn(
        "w-[min(280px,calc(100vw-2rem))] cursor-grabbing rounded-lg border bg-card text-sm shadow-lg",
        "transform-gpu",
        slaHealthKanbanCardClassName(pp.slaStatus),
      )}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{pp.client.name}</p>
            <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">{formatPhoneBrDisplay(pp.client.phone)}</p>
          </div>
        </div>
        <div
          className={cn(
            "mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
            tone === "ok" && "bg-success-soft text-success",
            tone === "warning" && "bg-warning-soft text-warning",
            tone === "critical" && "bg-destructive-soft text-destructive",
          )}
        >
          {tone === "critical" ? (
            <Siren className="size-3.5 shrink-0 text-destructive" aria-hidden />
          ) : null}
          <span className="min-w-0 truncate">{durationLabel}</span>
        </div>
      </div>
    </div>
  );
}
