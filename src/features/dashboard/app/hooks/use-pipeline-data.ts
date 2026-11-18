"use client";

import { dashboardKeys } from "@/features/dashboard/app/hooks/query-keys";
import { useOpmeOptions } from "@/features/dashboard/app/hooks/use-opme-options";
import {
  getDashboardAlerts,
  getDashboardSummary,
  getKanban,
} from "@/features/dashboard/app/services/dashboard-pipeline.service";
import type {
  DashboardAlertRow,
  DashboardSummaryTotals,
  KanbanColumn,
  PipelineStatusFilter,
} from "@/features/dashboard/app/types";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export const KANBAN_PAGE_LIMIT = 25;

/** Payload do pipeline: totais, alertas e colunas do Kanban (primeira página de cada coluna). */
export type PipelineData = {
  summary: DashboardSummaryTotals;
  alerts: DashboardAlertRow[];
  columns: KanbanColumn[];
};

export type PipelineQueryFilters = {
  pathwayId: string;
  debouncedSearch: string;
  statusFilter: PipelineStatusFilter;
  opmeSupplierId: string;
};

const NO_ALERTS: DashboardAlertRow[] = [];
const NO_COLUMNS: KanbanColumn[] = [];

/** Resumo + alertas + Kanban do fluxo selecionado, e opções de fornecedor OPME do filtro. */
export function usePipelineData({
  pathwayId,
  debouncedSearch,
  statusFilter,
  opmeSupplierId,
}: PipelineQueryFilters) {
  const queryClient = useQueryClient();

  const opmeOptions = useOpmeOptions();

  const queryKey = dashboardKeys.pipeline({
    pathwayId,
    search: debouncedSearch,
    status: statusFilter,
    opmeSupplierId,
  });
  const enabled = Boolean(pathwayId);
  const pipelineQuery = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<PipelineData> => {
      const opmeParam = opmeSupplierId || undefined;
      const [sum, alerts, kanban] = await Promise.all([
        getDashboardSummary(pathwayId, { opmeSupplierId: opmeParam }, { signal }),
        getDashboardAlerts(pathwayId, { limit: 20, opmeSupplierId: opmeParam }, { signal }),
        getKanban(
          pathwayId,
          {
            search: debouncedSearch || undefined,
            status: statusFilter || undefined,
            limit: KANBAN_PAGE_LIMIT,
            opmeSupplierId: opmeParam,
          },
          { signal },
        ),
      ]);
      return { summary: sum.totals, alerts, columns: kanban.columns };
    },
    enabled,
    placeholderData: keepPreviousData,
  });

  const refreshPipeline = useCallback(
    () => queryClient.invalidateQueries({ queryKey: dashboardKeys.pipelineAll }),
    [queryClient],
  );

  const columns = pipelineQuery.data?.columns ?? NO_COLUMNS;
  // Spinner só quando os filtros mudam (ou na 1ª carga); refresh em background é silencioso.
  const loading = enabled && (pipelineQuery.isPending || pipelineQuery.isPlaceholderData);

  return {
    queryKey,
    opmeOptions,
    summary: pipelineQuery.data?.summary ?? null,
    alerts: pipelineQuery.data?.alerts ?? NO_ALERTS,
    columns,
    loading,
    refreshPipeline,
  };
}
