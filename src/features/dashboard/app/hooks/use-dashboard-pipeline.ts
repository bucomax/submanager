"use client";

import { usePipelineData } from "@/features/dashboard/app/hooks/use-pipeline-data";
import { usePipelineFilters } from "@/features/dashboard/app/hooks/use-pipeline-filters";
import { usePipelineKanbanActions } from "@/features/dashboard/app/hooks/use-pipeline-kanban-actions";
import type { SlaHealthStatus } from "@/domain/pathway/sla-health";
import type {
  DashboardAlertRow,
  DashboardPathwayOption,
  DashboardPipelineOpmeOption,
  DashboardSummaryTotals,
  KanbanColumn,
  PipelineStatusFilter,
} from "@/features/dashboard/app/types";

export type UseDashboardPipelineResult = {
  withPublished: DashboardPathwayOption[];
  pathwayId: string;
  setPathwayId: (id: string) => void;
  search: string;
  setSearch: (v: string) => void;
  statusFilter: PipelineStatusFilter;
  setStatusFilter: (v: PipelineStatusFilter) => void;
  opmeSupplierId: string;
  setOpmeSupplierId: (v: string) => void;
  opmeOptions: DashboardPipelineOpmeOption[];
  summary: DashboardSummaryTotals | null;
  alerts: DashboardAlertRow[];
  columns: KanbanColumn[];
  loading: boolean;
  loadingKanbanInitial: boolean;
  loadingMoreStageId: string | null;
  loadMoreColumn: (stageId: string) => Promise<void>;
  movePatientToStage: (patientPathwayId: string, toStageId: string) => Promise<void>;
  transitioningPatientPathwayId: string | null;
  clearStatusFilter: () => void;
  clearFilters: () => void;
  toggleSlaStatusFilter: (status: SlaHealthStatus) => void;
  refreshPipeline: () => Promise<void>;
  hasActiveFilters: boolean;
};

/**
 * Orquestra o pipeline do dashboard: filtros (URL), dados (React Query) e ações do Kanban.
 * Chamadas HTTP ficam nos services; cada hook cuida de uma responsabilidade.
 */
export function useDashboardPipeline(pathways: DashboardPathwayOption[]): UseDashboardPipelineResult {
  const filters = usePipelineFilters(pathways);
  const { pathwayId, debouncedSearch, statusFilter, opmeSupplierId } = filters;
  const data = usePipelineData({ pathwayId, debouncedSearch, statusFilter, opmeSupplierId });
  const actions = usePipelineKanbanActions({
    queryKey: data.queryKey,
    columns: data.columns,
    pathwayId,
    debouncedSearch,
    statusFilter,
    opmeSupplierId,
  });

  return {
    withPublished: filters.withPublished,
    pathwayId,
    setPathwayId: filters.setPathwayId,
    search: filters.search,
    setSearch: filters.setSearch,
    statusFilter,
    setStatusFilter: filters.setStatusFilter,
    opmeSupplierId,
    setOpmeSupplierId: filters.setOpmeSupplierId,
    opmeOptions: data.opmeOptions,
    summary: data.summary,
    alerts: data.alerts,
    columns: data.columns,
    loading: data.loading,
    loadingKanbanInitial: data.loading && data.columns.length === 0,
    loadingMoreStageId: actions.loadingMoreStageId,
    loadMoreColumn: actions.loadMoreColumn,
    movePatientToStage: actions.movePatientToStage,
    transitioningPatientPathwayId: actions.transitioningPatientPathwayId,
    clearStatusFilter: filters.clearStatusFilter,
    clearFilters: filters.clearFilters,
    toggleSlaStatusFilter: filters.toggleSlaStatusFilter,
    refreshPipeline: async () => {
      await data.refreshPipeline();
    },
    hasActiveFilters: filters.hasActiveFilters,
  };
}
