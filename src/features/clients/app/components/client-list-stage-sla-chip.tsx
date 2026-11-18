"use client";

import type { SlaHealthStatus } from "@/domain/pathway/sla-health";
import { cn } from "@/lib/utils";
import { Siren } from "lucide-react";
import { useTranslations } from "next-intl";

/** Mesmo chip de tempo + tom de SLA do cartão do Kanban (`pipeline-kanban-patient-card`). */
export function ListStageDaysSlaChip({
  pathwayId,
  patientPathwayId,
  daysInStage,
  slaStatus,
  journeyCompletedAt,
}: {
  pathwayId: string | null;
  patientPathwayId: string | null;
  daysInStage: number | null;
  slaStatus: SlaHealthStatus | null;
  journeyCompletedAt: string | null;
}) {
  const t = useTranslations("clients.list");
  const tPipeline = useTranslations("dashboard.pipeline");
  const onPathway = Boolean(pathwayId ?? patientPathwayId);
  if (!onPathway) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (journeyCompletedAt) {
    return (
      <span className="text-muted-foreground inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium">
        {t("journeyCompletedShort")}
      </span>
    );
  }
  const count = daysInStage ?? 0;
  const durationLabel = tPipeline("drag.daysInStage", { count });
  const tone =
    slaStatus === "danger" ? "critical" : slaStatus === "warning" ? "warning" : "ok";
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        tone === "ok" &&
          "bg-success-soft text-success",
        tone === "warning" &&
          "bg-warning-soft text-warning",
        tone === "critical" &&
          "bg-destructive-soft text-destructive",
      )}
    >
      {tone === "critical" ? (
        <Siren className="size-3.5 shrink-0 text-destructive" aria-hidden />
      ) : null}
      <span className="min-w-0 truncate">{durationLabel}</span>
    </div>
  );
}
