"use client";

import { usePipelineUrlFilters } from "@/features/dashboard/app/hooks/use-pipeline-url-filters";
import type { SlaHealthStatus } from "@/domain/pathway/sla-health";
import type { DashboardPathwayOption, PipelineStatusFilter } from "@/features/dashboard/app/types";
import { DEBOUNCE_MS, useDebouncedCallback, useDebouncedState } from "@/shared/hooks/use-debounce";
import { useCallback, useMemo, useState } from "react";

/** Filtros do pipeline (fluxo, busca, SLA, OPME) sincronizados com a query string da URL. */
export function usePipelineFilters(pathways: DashboardPathwayOption[]) {
  const { fromUrl, pushFilters } = usePipelineUrlFilters();

  const withPublished = useMemo(
    () => pathways.filter((p) => p.publishedVersion != null),
    [pathways],
  );
  const fallbackPathwayId = withPublished[0]?.id ?? "";
  const urlPathwayId =
    fromUrl.pathwayId && withPublished.some((p) => p.id === fromUrl.pathwayId) ? fromUrl.pathwayId : "";

  const [selectedPathwayId, setPathwayIdRaw] = useState(() => urlPathwayId || fallbackPathwayId);
  /** Sem seleção, cai no primeiro fluxo publicado (derivado — sem efeito para "corrigir" o estado). */
  const pathwayId = selectedPathwayId || fallbackPathwayId;
  const [search, debouncedSearch, setSearchRaw] = useDebouncedState(fromUrl.search, {
    trim: true,
    delayMs: DEBOUNCE_MS.search,
  });
  const [statusFilter, setStatusFilterRaw] = useState<PipelineStatusFilter>(fromUrl.status);
  const [opmeSupplierId, setOpmeSupplierIdRaw] = useState(fromUrl.opmeSupplierId);

  const syncUrlDebounced = useDebouncedCallback(
    (filters: Parameters<typeof pushFilters>[0]) => pushFilters(filters),
    DEBOUNCE_MS.search,
  );

  const setPathwayId = useCallback(
    (v: string) => {
      setPathwayIdRaw(v);
      pushFilters({ pathwayId: v });
    },
    [pushFilters],
  );

  const setSearch = useCallback(
    (v: string) => {
      setSearchRaw(v);
      syncUrlDebounced({ search: v });
    },
    [setSearchRaw, syncUrlDebounced],
  );

  const setStatusFilter = useCallback(
    (v: PipelineStatusFilter) => {
      setStatusFilterRaw(v);
      pushFilters({ status: v });
    },
    [pushFilters],
  );

  const setOpmeSupplierId = useCallback(
    (v: string) => {
      setOpmeSupplierIdRaw(v);
      pushFilters({ opmeSupplierId: v });
    },
    [pushFilters],
  );

  const clearStatusFilter = useCallback(() => setStatusFilter(""), [setStatusFilter]);

  const clearFilters = useCallback(() => {
    setSearchRaw("");
    setStatusFilterRaw("");
    setOpmeSupplierIdRaw("");
    pushFilters({ search: "", status: "", opmeSupplierId: "" });
  }, [pushFilters, setSearchRaw]);

  const toggleSlaStatusFilter = useCallback(
    (status: SlaHealthStatus) => {
      setStatusFilterRaw((s) => {
        const next = s === status ? "" : status;
        pushFilters({ status: next });
        return next;
      });
    },
    [pushFilters],
  );

  return {
    withPublished,
    pathwayId,
    setPathwayId,
    search,
    debouncedSearch,
    setSearch,
    statusFilter,
    setStatusFilter,
    opmeSupplierId,
    setOpmeSupplierId,
    clearStatusFilter,
    clearFilters,
    toggleSlaStatusFilter,
    hasActiveFilters: Boolean(search.trim() || statusFilter || opmeSupplierId),
  };
}
