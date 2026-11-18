"use client";

import { useMemo } from "react";
import { ArrowRightLeft, GitBranch, Siren, Users, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { ReportsBreakdownCard } from "@/features/dashboard/app/components/reports-breakdown-card";
import { ReportsCriticalPatientsCard } from "@/features/dashboard/app/components/reports-critical-patients-card";
import { ReportsFiltersBar } from "@/features/dashboard/app/components/reports-filters-bar";
import { useDashboardReports } from "@/features/dashboard/app/hooks/use-dashboard-reports";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

function ReportsLoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[5.25rem] w-full rounded-xl sm:h-[5.5rem]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

export function DashboardReportsSection() {
  const t = useTranslations("dashboard.reports");
  const {
    periodDays,
    setPeriodDays,
    pathwayId,
    setPathwayId,
    opmeSupplierId,
    setOpmeSupplierId,
    page,
    setPage,
    data,
    loading,
    error,
    exporting,
    reload,
    exportCsv,
    pathwayOptions,
    opmeOptions,
    periodOptions,
  } = useDashboardReports();

  const statusRows = useMemo(
    () =>
      (data?.byStatus ?? []).map((row) => ({
        id: row.status,
        label: t(`status.${row.status}`),
        count: row.count,
      })),
    [data?.byStatus, t],
  );

  const opmeRows = useMemo(
    () =>
      (data?.byOpme ?? []).map((row) => ({
        ...row,
        label: row.label ?? t("unassignedOpme"),
      })),
    [data?.byOpme, t],
  );

  if (loading && !data && !error) {
    return <ReportsLoadingState />;
  }

  return (
    <div className="space-y-4">
      <ReportsFiltersBar
        periodDays={periodDays}
        onPeriodDaysChange={setPeriodDays}
        pathwayId={pathwayId}
        onPathwayIdChange={setPathwayId}
        opmeSupplierId={opmeSupplierId}
        onOpmeSupplierIdChange={setOpmeSupplierId}
        periodOptions={periodOptions}
        pathwayOptions={pathwayOptions}
        opmeOptions={opmeOptions}
        loading={loading}
        exporting={exporting}
        onReload={() => void reload()}
        onExportCsv={() => void exportCsv()}
      />

      {error ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Kit: indicadores numa faixa só; cor apenas onde há estado (críticos). */}
      <div className="bg-card grid grid-cols-2 overflow-hidden rounded-[20px] border xl:grid-cols-4">
        {(
          [
            ["cards.patientsInScope", data?.kpis.patientsInScope ?? 0, Users, ""],
            [
              "cards.criticalPatients",
              data?.kpis.criticalPatients ?? 0,
              Siren,
              (data?.kpis.criticalPatients ?? 0) > 0 ? "text-destructive font-semibold" : "",
            ],
            ["cards.transitionsInPeriod", data?.kpis.transitionsInPeriod ?? 0, ArrowRightLeft, ""],
            ["cards.pathwaysInScope", data?.kpis.pathwaysInScope ?? 0, GitBranch, ""],
          ] as const satisfies ReadonlyArray<
            readonly [Parameters<typeof t>[0], number, LucideIcon, string]
          >
        ).map(([labelKey, value, Icon, tone], i) => (
          <div
            key={labelKey}
            className={cn(
              "flex min-w-0 flex-col gap-1.5 px-6 py-5",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t xl:border-t-0",
              i === 2 && "xl:border-l",
            )}
          >
            <p className={cn("text-muted-foreground flex items-center gap-1.5 text-[13px]", tone)}>
              <Icon className="size-4 shrink-0" aria-hidden />
              {t(labelKey)}
            </p>
            <p className="text-foreground text-[34px] leading-none font-extrabold tracking-[-0.04em] tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ReportsBreakdownCard
          title={t("charts.byStageTitle")}
          description={t("charts.byStageDescription")}
          rows={(data?.byStage ?? []).map((row) => ({ ...row, label: row.label ?? "-" }))}
          empty={t("empty")}
        />
        <ReportsBreakdownCard
          title={t("charts.byStatusTitle")}
          description={t("charts.byStatusDescription")}
          rows={statusRows}
          empty={t("empty")}
        />
        <ReportsBreakdownCard
          title={t("charts.byPathwayTitle")}
          description={t("charts.byPathwayDescription")}
          rows={(data?.byPathway ?? []).map((row) => ({ ...row, label: row.label ?? "-" }))}
          empty={t("empty")}
        />
        <ReportsBreakdownCard
          title={t("charts.byOpmeTitle")}
          description={t("charts.byOpmeDescription")}
          rows={opmeRows}
          empty={t("empty")}
        />
      </div>

      {data ? (
        <ReportsCriticalPatientsCard
          criticalPatients={data.criticalPatients}
          loading={loading}
          onPageChange={(nextPage) => {
            if (nextPage === page) return;
            setPage(nextPage);
          }}
        />
      ) : null}
    </div>
  );
}
