"use client";

import type { SlaHealthStatus } from "@/domain/pathway/sla-health";
import type { DashboardSummaryTotals, PipelineStatusFilter } from "@/features/dashboard/app/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Siren, Users } from "lucide-react";
import { useTranslations } from "next-intl";

type PipelineStatsGridProps = {
  summary: DashboardSummaryTotals | null;
  loading: boolean;
  statusFilter: PipelineStatusFilter;
  onClearStatus: () => void;
  onToggleSlaStatus: (status: SlaHealthStatus) => void;
};

export function PipelineStatsGrid({
  summary,
  loading,
  statusFilter,
  onClearStatus,
  onToggleSlaStatus,
}: PipelineStatsGridProps) {
  const t = useTranslations("dashboard.pipeline");

  if (summary) {
    /**
     * Kit: os totais por prazo são filtros. Cartão neutro com ponto e palavra do tom; o escolhido ganha contorno em tinta.
     * Cor nunca sozinha: ícone + rótulo + número.
     */
    const tile =
      "bg-card flex flex-col gap-1 rounded-2xl border-[1.5px] px-4 py-3.5 text-left transition-[border-color,box-shadow,background-color] duration-150 hover:border-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
    const selected = "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)] dark:border-primary dark:shadow-[inset_0_0_0_1px_var(--primary)]";
    const items = [
      { key: "", label: t("stats.total"), value: summary.total, Icon: Users, tone: "text-muted-foreground", onClick: onClearStatus },
      { key: "ok", label: t("stats.ok"), value: summary.ok, Icon: CheckCircle2, tone: "text-success", onClick: () => onToggleSlaStatus("ok") },
      { key: "warning", label: t("stats.warning"), value: summary.warning, Icon: AlertTriangle, tone: "text-warning", onClick: () => onToggleSlaStatus("warning") },
      { key: "danger", label: t("stats.danger"), value: summary.danger, Icon: Siren, tone: "text-destructive", onClick: () => onToggleSlaStatus("danger") },
    ] as const;

    return (
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {items.map(({ key, label, value, Icon, tone, onClick }) => {
          const isOn = statusFilter === key;
          return (
            <button key={key || "all"} type="button" onClick={onClick} aria-pressed={isOn} className={cn(tile, isOn && selected)}>
              <span className={cn("flex items-center gap-1.5 text-[13px] font-semibold", tone)}>
                <Icon className="size-4" aria-hidden />
                {label}
              </span>
              <span className="text-foreground text-[26px] leading-tight font-extrabold tracking-[-0.03em] tabular-nums">{value}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[5.25rem] rounded-2xl" />
        ))}
      </div>
    );
  }

  return null;
}
