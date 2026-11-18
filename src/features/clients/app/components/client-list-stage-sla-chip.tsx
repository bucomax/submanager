"use client";

import type { SlaHealthStatus } from "@/domain/pathway/sla-health";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
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
      <span className="text-muted-foreground bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
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
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "ok" &&
          "bg-success-soft text-success",
        tone === "warning" &&
          "bg-warning-soft text-warning",
        tone === "critical" &&
          "bg-destructive-soft text-destructive",
      )}
    >
      {/* Kit: cor nunca sozinha, cada tom tem o seu ícone. */}
      {tone === "critical" ? (
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
      ) : tone === "warning" ? (
        <Clock className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 truncate">{durationLabel}</span>
    </div>
  );
}
