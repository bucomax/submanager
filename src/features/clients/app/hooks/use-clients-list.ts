"use client";

import {
  listClients,
  listPathwaysForTenant,
  listPublishedStagesForPathway,
} from "@/features/clients/app/services/clients.service";
import type {
  ClientListItemDto,
  ClientListStatusFilter,
  PathwayOption,
  PublishedStageRowDto,
} from "@/features/clients/app/types/api";
import type { ApiPagination } from "@/lib/api/pagination";
import { DEBOUNCE_MS, useDebouncedState } from "@/shared/hooks/use-debounce";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 50;
const NO_STAGES: PublishedStageRowDto[] = [];

export function useClientsList() {
  const t = useTranslations("clients.list");
  const [q, debouncedQ, setQ] = useDebouncedState("", {
    trim: true,
    delayMs: DEBOUNCE_MS.search,
  });

  const [pathwayFilter, setPathwayFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  /**
   * A página fica atrelada à combinação de filtros que a originou: qualquer mudança de
   * filtro volta para a página 1 no próprio render, sem efeito de reset.
   */
  const filtersKey = [debouncedQ, pathwayFilter, stageFilter, statusFilter].join("\u0000");
  const [pageState, setPageState] = useState({ filtersKey, page: 1 });
  const page = pageState.filtersKey === filtersKey ? pageState.page : 1;

  const [pathways, setPathways] = useState<PathwayOption[] | null>(null);
  const [pathwaysError, setPathwaysError] = useState<string | null>(null);

  /** Etapas publicadas do fluxo selecionado, guardadas com o fluxo que as originou. */
  const [loadedStages, setLoadedStages] = useState<{
    pathwayId: string;
    rows: PublishedStageRowDto[];
    error: string | null;
  } | null>(null);

  const [rows, setRows] = useState<ClientListItemDto[] | null>(null);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);
  const [statusFilterCapped, setStatusFilterCapped] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await listPathwaysForTenant();
        if (!cancelled) {
          setPathways(data);
          setPathwaysError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setPathwaysError(e instanceof Error ? e.message : t("pathwaysLoadError"));
          setPathways([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (pathwayFilter === "all") return;

    let cancelled = false;
    void (async () => {
      try {
        const data = await listPublishedStagesForPathway(pathwayFilter);
        if (!cancelled) {
          setLoadedStages({ pathwayId: pathwayFilter, rows: data, error: null });
        }
      } catch (e) {
        if (!cancelled) {
          setLoadedStages({
            pathwayId: pathwayFilter,
            rows: [],
            error: e instanceof Error ? e.message : t("stagesLoadError"),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathwayFilter, t]);

  const stagesForFilter =
    pathwayFilter !== "all" && loadedStages?.pathwayId === pathwayFilter ? loadedStages : null;
  const stages: PublishedStageRowDto[] | null =
    pathwayFilter === "all" ? NO_STAGES : (stagesForFilter?.rows ?? null);
  const stagesError = stagesForFilter?.error ?? null;

  const fetchListPage = useCallback(
    async (opts?: { fresh?: boolean }) => {
      return listClients({
        limit: PAGE_SIZE,
        page,
        q: debouncedQ || undefined,
        pathwayId: pathwayFilter === "all" ? undefined : pathwayFilter,
        stageId: stageFilter === "all" ? undefined : stageFilter,
        status: statusFilter === "all" ? undefined : (statusFilter as ClientListStatusFilter),
        fresh: opts?.fresh === true,
      });
    },
    [debouncedQ, page, pathwayFilter, stageFilter, statusFilter],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await fetchListPage(undefined);
        if (!cancelled) {
          setRows(payload.data);
          setPagination(payload.pagination);
          setStatusFilterCapped(payload.statusFilterCapped);
          setListError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setListError(e instanceof Error ? e.message : t("loadError"));
          setRows([]);
          setPagination(null);
          setStatusFilterCapped(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchListPage, t]);

  const setPathwayFilterAndResetStage = useCallback((value: string) => {
    setPathwayFilter(value);
    setStageFilter("all");
  }, []);

  const reloadList = useCallback(() => {
    void (async () => {
      try {
        const payload = await fetchListPage({ fresh: true });
        setRows(payload.data);
        setPagination(payload.pagination);
        setStatusFilterCapped(payload.statusFilterCapped);
        setListError(null);
      } catch (e) {
        setListError(e instanceof Error ? e.message : t("loadError"));
        setRows([]);
        setPagination(null);
        setStatusFilterCapped(false);
      }
    })();
  }, [fetchListPage, t]);

  const retry = useCallback(() => {
    void reloadList();
  }, [reloadList]);

  const limit = pagination?.limit ?? PAGE_SIZE;
  const totalItems = pagination?.totalItems ?? 0;
  const from = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalItems);
  const canPrev = pagination?.hasPreviousPage ?? false;
  const canNext = pagination?.hasNextPage ?? false;

  const goPrev = useCallback(() => {
    setPageState({ filtersKey, page: Math.max(1, page - 1) });
  }, [filtersKey, page]);

  const goNext = useCallback(() => {
    setPageState({ filtersKey, page: page + 1 });
  }, [filtersKey, page]);

  const listLoading = rows === null && !listError;
  const stagesLoading = pathwayFilter !== "all" && stages === null;

  return {
    rows,
    total: totalItems,
    limit,
    page,
    from,
    to,
    canPrev,
    canNext,
    statusFilterCapped,
    listError,
    pathways,
    pathwaysError,
    stages,
    stagesError,
    stagesLoading,
    search: q,
    setSearch: setQ,
    pathwayFilter,
    setPathwayFilter: setPathwayFilterAndResetStage,
    stageFilter,
    setStageFilter,
    statusFilter,
    setStatusFilter,
    retry,
    reloadList,
    goPrev,
    goNext,
    loading: listLoading,
    hasActiveSearch: Boolean(debouncedQ),
  };
}
