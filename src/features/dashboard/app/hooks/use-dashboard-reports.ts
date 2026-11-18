"use client";

import { dashboardKeys } from "@/features/dashboard/app/hooks/query-keys";
import { useOpmeOptions } from "@/features/dashboard/app/hooks/use-opme-options";
import { getReportsSummary } from "@/features/dashboard/app/services/reports.service";
import type { DashboardReportFilterOption } from "@/features/dashboard/app/types";
import { buildReportsCsv } from "@/features/dashboard/app/utils/export-reports-csv";
import { listPathways } from "@/features/pathways/app/services/pathways.service";
import { getErrorMessage } from "@/lib/utils/error-message";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

const DEFAULT_PERIOD_DAYS = 30;
const DEFAULT_LIMIT = 10;
const MAX_EXPORT_ROWS = 1000;
const NO_OPTIONS: DashboardReportFilterOption[] = [];

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dashboard-reports-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function useDashboardReports() {
  const t = useTranslations("dashboard.reports");
  const [periodDays, setPeriodDays] = useState(DEFAULT_PERIOD_DAYS);
  const [pathwayId, setPathwayId] = useState("");
  const [opmeSupplierId, setOpmeSupplierId] = useState("");

  /** A página fica atrelada aos filtros que a originaram: trocar filtro volta à página 1 sem efeito. */
  const filtersKey = `${periodDays}|${pathwayId}|${opmeSupplierId}`;
  const [pageState, setPageState] = useState({ filtersKey, page: 1 });
  const page = pageState.filtersKey === filtersKey ? pageState.page : 1;
  const setPage = (next: number | ((current: number) => number)) =>
    setPageState({ filtersKey, page: typeof next === "function" ? next(page) : next });

  // Os filtros continuam funcionais sem listas; o erro principal aparece no carregamento do relatório.
  const pathwaysQuery = useQuery({
    queryKey: dashboardKeys.reportPathwayOptions,
    queryFn: async ({ signal }): Promise<DashboardReportFilterOption[]> => {
      const pathways = await listPathways({ signal });
      return pathways.map((pathway) => ({ value: pathway.id, label: pathway.name }));
    },
  });
  const opmeOptions = useOpmeOptions();

  const filters = { periodDays, pathwayId, opmeSupplierId };
  const reportQuery = useQuery({
    queryKey: dashboardKeys.reports({ ...filters, page }),
    queryFn: ({ signal }) =>
      getReportsSummary(
        {
          periodDays,
          pathwayId: pathwayId || undefined,
          opmeSupplierId: opmeSupplierId || undefined,
          page,
          limit: DEFAULT_LIMIT,
        },
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
  const data = reportQuery.isError ? null : (reportQuery.data ?? null);

  const exportMutation = useMutation({
    mutationFn: async () => {
      const totalItems = data?.criticalPatients.pagination.totalItems;
      const exportData = await getReportsSummary({
        periodDays,
        pathwayId: pathwayId || undefined,
        opmeSupplierId: opmeSupplierId || undefined,
        page: 1,
        limit: totalItems ? Math.min(totalItems, MAX_EXPORT_ROWS) : DEFAULT_LIMIT,
      });
      downloadCsv(buildReportsCsv(exportData));
    },
  });

  const periodOptions = useMemo<DashboardReportFilterOption[]>(
    () => [
      { value: "7", label: t("filters.period7") },
      { value: "30", label: t("filters.period30") },
      { value: "90", label: t("filters.period90") },
      { value: "365", label: t("filters.period365") },
    ],
    [t],
  );

  return {
    periodDays,
    setPeriodDays: (value: string) => setPeriodDays(Number(value)),
    pathwayId,
    setPathwayId,
    opmeSupplierId,
    setOpmeSupplierId,
    page,
    setPage,
    data,
    loading: reportQuery.isFetching,
    error: reportQuery.isError ? getErrorMessage(reportQuery.error, t("loadError")) : null,
    exporting: exportMutation.isPending,
    reload: () => void reportQuery.refetch(),
    exportCsv: () => exportMutation.mutateAsync(),
    pathwayOptions: pathwaysQuery.data ?? NO_OPTIONS,
    opmeOptions,
    periodOptions,
  };
}
