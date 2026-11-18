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
import { clientKeys } from "@/features/clients/app/hooks/query-keys";
import { getErrorMessage } from "@/lib/utils/error-message";
import { DEBOUNCE_MS, useDebouncedState } from "@/shared/hooks/use-debounce";
import { useTranslations } from "next-intl";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

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

  const pathwaysQuery = useQuery({
    queryKey: clientKeys.pathways,
    queryFn: ({ signal }) => listPathwaysForTenant({ signal }),
  });
  const pathways: PathwayOption[] | null = pathwaysQuery.data ?? (pathwaysQuery.isError ? [] : null);
  const pathwaysError = pathwaysQuery.isError
    ? getErrorMessage(pathwaysQuery.error, t("pathwaysLoadError"))
    : null;

  const stagesQuery = useQuery({
    queryKey: clientKeys.publishedStages(pathwayFilter),
    queryFn: ({ signal }) => listPublishedStagesForPathway(pathwayFilter, { signal }),
    enabled: pathwayFilter !== "all",
  });
  const stages: PublishedStageRowDto[] | null =
    pathwayFilter === "all" ? NO_STAGES : (stagesQuery.data ?? (stagesQuery.isError ? [] : null));
  const stagesError = stagesQuery.isError
    ? getErrorMessage(stagesQuery.error, t("stagesLoadError"))
    : null;

  const listQuery = useQuery({
    queryKey: clientKeys.list({
      page,
      q: debouncedQ,
      pathwayId: pathwayFilter,
      stageId: stageFilter,
      status: statusFilter,
    }),
    queryFn: ({ signal }) =>
      listClients(
        {
          limit: PAGE_SIZE,
          page,
          q: debouncedQ || undefined,
          pathwayId: pathwayFilter === "all" ? undefined : pathwayFilter,
          stageId: stageFilter === "all" ? undefined : stageFilter,
          status: statusFilter === "all" ? undefined : (statusFilter as ClientListStatusFilter),
        },
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
  const rows: ClientListItemDto[] | null = listQuery.data?.data ?? (listQuery.isError ? [] : null);
  const pagination = listQuery.data?.pagination ?? null;
  const statusFilterCapped = listQuery.data?.statusFilterCapped ?? false;
  const listError = listQuery.isError ? getErrorMessage(listQuery.error, t("loadError")) : null;

  const setPathwayFilterAndResetStage = useCallback((value: string) => {
    setPathwayFilter(value);
    setStageFilter("all");
  }, []);

  const retry = useCallback(() => {
    void listQuery.refetch();
  }, [listQuery]);

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
    goPrev,
    goNext,
    loading: listLoading,
    hasActiveSearch: Boolean(debouncedQ),
  };
}
