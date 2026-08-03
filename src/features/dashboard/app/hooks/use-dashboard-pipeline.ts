"use client";

import {
  getDashboardAlerts,
  getDashboardSummary,
  getKanban,
  getKanbanColumnPatients,
} from "@/features/dashboard/app/services/dashboard-pipeline.service";
import { usePipelineUrlFilters } from "@/features/dashboard/app/hooks/use-pipeline-url-filters";
import { listOpmeSuppliers } from "@/features/settings/app/services/tenant-settings.service";
import { transitionPatientStage } from "@/features/pathways/app/services/patient-pathways.service";
import { toast } from "@/lib/toast";
import { computeSlaHealthStatus, type SlaHealthStatus } from "@/domain/pathway/sla-health";
import type {
  DashboardAlertRow,
  DashboardPathwayOption,
  DashboardPipelineOpmeOption,
  DashboardSummaryTotals,
  KanbanColumn,
  KanbanPatientPathway,
  PipelineStatusFilter,
} from "@/features/dashboard/app/types";
import { DEBOUNCE_MS, useDebouncedState } from "@/shared/hooks/use-debounce";
import { useDebouncedCallback } from "@/shared/hooks/use-debounce";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const KANBAN_PAGE_LIMIT = 25;

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
 * Orquestra dados do pipeline (summary, alertas, Kanban) e paginação por coluna.
 * Chamadas HTTP ficam no service; o hook só gerencia estado e efeitos.
 */
export function useDashboardPipeline(pathways: DashboardPathwayOption[]): UseDashboardPipelineResult {
  const t = useTranslations("dashboard.pipeline");
  const { fromUrl, pushFilters } = usePipelineUrlFilters();
  const initializedFromUrl = useRef(false);

  const withPublished = useMemo(
    () => pathways.filter((p) => p.publishedVersion != null),
    [pathways],
  );

  const fallbackPathwayId = withPublished[0]?.id ?? "";
  const urlPathwayId = fromUrl.pathwayId && withPublished.some((p) => p.id === fromUrl.pathwayId)
    ? fromUrl.pathwayId
    : "";

  const [pathwayId, setPathwayIdRaw] = useState(
    () => urlPathwayId || fallbackPathwayId,
  );
  const [search, debouncedSearch, setSearchRaw] = useDebouncedState(
    fromUrl.search,
    { trim: true, delayMs: DEBOUNCE_MS.search },
  );
  const [statusFilter, setStatusFilterRaw] = useState<PipelineStatusFilter>(fromUrl.status);
  const [opmeSupplierId, setOpmeSupplierIdRaw] = useState(fromUrl.opmeSupplierId);
  const [opmeOptions, setOpmeOptions] = useState<DashboardPipelineOpmeOption[]>([]);

  const syncUrlDebounced = useDebouncedCallback(
    (filters: Parameters<typeof pushFilters>[0]) => pushFilters(filters),
    DEBOUNCE_MS.search,
  );

  const setPathwayId = useCallback((v: string) => {
    setPathwayIdRaw(v);
    pushFilters({ pathwayId: v });
  }, [pushFilters]);

  const setSearch = useCallback((v: string) => {
    setSearchRaw(v);
    syncUrlDebounced({ search: v });
  }, [setSearchRaw, syncUrlDebounced]);

  const setStatusFilter = useCallback((v: PipelineStatusFilter) => {
    setStatusFilterRaw(v);
    pushFilters({ status: v });
  }, [pushFilters]);

  const setOpmeSupplierId = useCallback((v: string) => {
    setOpmeSupplierIdRaw(v);
    pushFilters({ opmeSupplierId: v });
  }, [pushFilters]);

  useEffect(() => {
    if (initializedFromUrl.current) return;
    initializedFromUrl.current = true;
  }, []);
  const [summary, setSummary] = useState<DashboardSummaryTotals | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlertRow[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMoreStageId, setLoadingMoreStageId] = useState<string | null>(null);
  const [transitioningPatientPathwayId, setTransitioningPatientPathwayId] = useState<string | null>(null);

  useEffect(() => {
    if (!pathwayId && withPublished[0]) {
      setPathwayId(withPublished[0].id);
    }
  }, [pathwayId, withPublished, setPathwayId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await listOpmeSuppliers({ limit: 100, includeInactive: true });
        if (cancelled) return;
        setOpmeOptions(
          res.data.map((s) => ({
            value: s.id,
            label: s.name,
          })),
        );
      } catch {
        if (!cancelled) {
          setOpmeOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!pathwayId) return;
      const silent = Boolean(options?.silent);
      if (!silent) {
        setLoading(true);
      }
      try {
        const opmeParam = opmeSupplierId || undefined;
        const [sum, al, kb] = await Promise.all([
          getDashboardSummary(pathwayId, { opmeSupplierId: opmeParam }),
          getDashboardAlerts(pathwayId, { limit: 20, opmeSupplierId: opmeParam }),
          getKanban(pathwayId, {
            search: debouncedSearch || undefined,
            status: statusFilter || undefined,
            limit: KANBAN_PAGE_LIMIT,
            opmeSupplierId: opmeParam,
          }),
        ]);
        setSummary(sum.totals);
        setAlerts(al);
        setColumns(kb.columns);
      } catch {
        /* erro: toast global no apiClient */
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [pathwayId, debouncedSearch, statusFilter, opmeSupplierId],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMoreColumn = useCallback(
    async (stageId: string) => {
      if (!pathwayId) return;
      const col = columns.find((c) => c.stage.id === stageId);
      if (!col?.pagination.hasNextPage) return;
      setLoadingMoreStageId(stageId);
      try {
        const nextPage = col.pagination.page + 1;
        const { data, pagination } = await getKanbanColumnPatients(pathwayId, stageId, {
          search: debouncedSearch || undefined,
          limit: col.pagination.limit,
          page: nextPage,
          opmeSupplierId: opmeSupplierId || undefined,
        });
        setColumns((prev) =>
          prev.map((c) =>
            c.stage.id === stageId
              ? {
                  ...c,
                  data: [...c.data, ...data],
                  pagination,
                }
              : c,
          ),
        );
      } catch {
        /* erro: toast global no apiClient */
      } finally {
        setLoadingMoreStageId(null);
      }
    },
    [pathwayId, columns, debouncedSearch, opmeSupplierId],
  );

  const movePatientToStage = useCallback(
    async (patientPathwayId: string, toStageId: string) => {
      if (statusFilter) {
        toast.error(t("drag.disabledWithStatus"));
        return;
      }
      const sourceCol = columns.find((c) => c.data.some((p) => p.id === patientPathwayId));
      const targetCol = columns.find((c) => c.stage.id === toStageId);
      if (!sourceCol || !targetCol || sourceCol.stage.id === toStageId) {
        return;
      }

      const patient = sourceCol.data.find((p) => p.id === patientPathwayId);
      if (!patient) return;

      const columnsSnapshot: KanbanColumn[] = columns.map((c) => ({
        ...c,
        data: [...c.data],
        pagination: { ...c.pagination },
      }));

      const now = new Date();
      const enteredStageAt = now.toISOString();
      const enteredDate = new Date(enteredStageAt);
      const updatedPatient: KanbanPatientPathway = {
        ...patient,
        enteredStageAt,
        updatedAt: enteredStageAt,
        currentStage: {
          id: targetCol.stage.id,
          stageKey: targetCol.stage.stageKey,
          name: targetCol.stage.name,
          sortOrder: targetCol.stage.sortOrder,
          alertWarningDays: targetCol.stage.alertWarningDays,
          alertCriticalDays: targetCol.stage.alertCriticalDays,
        },
        slaStatus: computeSlaHealthStatus(
          enteredDate,
          now,
          targetCol.stage.alertWarningDays,
          targetCol.stage.alertCriticalDays,
        ),
      };

      setColumns((prev) =>
        prev.map((c) => {
          if (c.stage.id === sourceCol.stage.id) {
            return {
              ...c,
              data: c.data.filter((p) => p.id !== patientPathwayId),
              pagination: {
                ...c.pagination,
                totalItems: Math.max(0, c.pagination.totalItems - 1),
              },
            };
          }
          if (c.stage.id === toStageId) {
            return {
              ...c,
              data: [updatedPatient, ...c.data.filter((p) => p.id !== patientPathwayId)],
              pagination: {
                ...c.pagination,
                totalItems: c.pagination.totalItems + 1,
              },
            };
          }
          return c;
        }),
      );

      setTransitioningPatientPathwayId(patientPathwayId);
      try {
        await transitionPatientStage(patientPathwayId, { toStageId });
        toast.success(t("drag.transitionSuccess"));
        await reload({ silent: true });
      } catch {
        setColumns(columnsSnapshot);
      } finally {
        setTransitioningPatientPathwayId(null);
      }
    },
    [columns, reload, statusFilter, t],
  );

  const clearStatusFilter = useCallback(() => {
    setStatusFilter("");
  }, [setStatusFilter]);

  const clearFilters = useCallback(() => {
    setSearchRaw("");
    setStatusFilterRaw("");
    setOpmeSupplierIdRaw("");
    pushFilters({ search: "", status: "", opmeSupplierId: "" });
  }, [pushFilters, setSearchRaw]);

  const toggleSlaStatusFilter = useCallback((status: SlaHealthStatus) => {
    setStatusFilterRaw((s) => {
      const next = s === status ? "" : status;
      pushFilters({ status: next });
      return next;
    });
  }, [pushFilters]);

  const refreshPipeline = useCallback(async () => {
    await reload({ silent: true });
  }, [reload]);

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter || opmeSupplierId,
  );

  return {
    withPublished,
    pathwayId,
    setPathwayId,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    opmeSupplierId,
    setOpmeSupplierId,
    opmeOptions,
    summary,
    alerts,
    columns,
    loading,
    loadingKanbanInitial: loading && columns.length === 0,
    loadingMoreStageId,
    loadMoreColumn,
    movePatientToStage,
    transitioningPatientPathwayId,
    clearStatusFilter,
    clearFilters,
    toggleSlaStatusFilter,
    refreshPipeline,
    hasActiveFilters,
  };
}
