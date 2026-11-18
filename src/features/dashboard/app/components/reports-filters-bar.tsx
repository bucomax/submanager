"use client";

import type { DashboardReportFilterOption } from "@/features/dashboard/app/types";
import { LabeledSelect } from "@/shared/components/forms/labeled-select";
import { Button } from "@/shared/components/ui/button";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";

type ReportsFiltersBarProps = {
  periodDays: number;
  onPeriodDaysChange: (value: string) => void;
  pathwayId: string;
  onPathwayIdChange: (value: string) => void;
  opmeSupplierId: string;
  onOpmeSupplierIdChange: (value: string) => void;
  periodOptions: DashboardReportFilterOption[];
  pathwayOptions: DashboardReportFilterOption[];
  opmeOptions: DashboardReportFilterOption[];
  loading: boolean;
  exporting: boolean;
  onReload: () => void;
  onExportCsv: () => void;
};

export function ReportsFiltersBar({
  periodDays,
  onPeriodDaysChange,
  pathwayId,
  onPathwayIdChange,
  opmeSupplierId,
  onOpmeSupplierIdChange,
  periodOptions,
  pathwayOptions,
  opmeOptions,
  loading,
  exporting,
  onReload,
  onExportCsv,
}: ReportsFiltersBarProps) {
  const t = useTranslations("dashboard.reports");

  return (
    <div className="bg-card grid gap-4 rounded-[20px] border p-5 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
      <LabeledSelect
        id="reports-period"
        label={t("filters.period")}
        value={String(periodDays)}
        onValueChange={onPeriodDaysChange}
        options={periodOptions}
      />
      <LabeledSelect
        id="reports-pathway"
        label={t("filters.pathway")}
        value={pathwayId || "all"}
        onValueChange={(value) => onPathwayIdChange(value === "all" ? "" : value)}
        options={[{ value: "all", label: t("filters.allPathways") }, ...pathwayOptions]}
      />
      <LabeledSelect
        id="reports-opme"
        label={t("filters.opme")}
        value={opmeSupplierId || "all"}
        onValueChange={(value) => onOpmeSupplierIdChange(value === "all" ? "" : value)}
        options={[{ value: "all", label: t("filters.allOpme") }, ...opmeOptions]}
      />
      <div className="flex items-center gap-2 lg:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onReload} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {t("refresh")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onExportCsv} disabled={exporting}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {t("exportCsv")}
        </Button>
      </div>
    </div>
  );
}
