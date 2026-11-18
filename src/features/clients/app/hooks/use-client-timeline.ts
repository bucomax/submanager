"use client";

import { CLIENT_TIMELINE_EVENT_CATEGORIES } from "@/domain/audit/event-category-mapper";
import { clientKeys } from "@/features/clients/app/hooks/query-keys";
import { getClientTimeline } from "@/features/clients/app/services/clients.service";
import { getErrorMessage } from "@/lib/utils/error-message";
import type { ClientTimelineEventCategory } from "@/types/api/clients-v1";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

const TIMELINE_LIMIT = 20;

export function useClientTimeline(clientId: string) {
  const t = useTranslations("clients.detail");
  const [selectedCategories, setSelectedCategories] = useState(
    () => new Set<ClientTimelineEventCategory>([...CLIENT_TIMELINE_EVENT_CATEGORIES]),
  );

  const categoriesQuery = useMemo(() => {
    if (selectedCategories.size === CLIENT_TIMELINE_EVENT_CATEGORIES.length) return undefined;
    return [...selectedCategories].sort().join(",");
  }, [selectedCategories]);

  /** A página fica atrelada ao filtro que a originou: trocar categorias volta à página 1 sem efeito. */
  const filtersKey = categoriesQuery ?? "";
  const [pageState, setPageState] = useState({ filtersKey, page: 1 });
  const page = pageState.filtersKey === filtersKey ? pageState.page : 1;
  const setPage = useCallback(
    (next: number | ((current: number) => number)) =>
      setPageState((prev) => {
        const current = prev.filtersKey === filtersKey ? prev.page : 1;
        return { filtersKey, page: typeof next === "function" ? next(current) : next };
      }),
    [filtersKey],
  );

  const query = useQuery({
    queryKey: clientKeys.timeline(clientId, { page, categories: filtersKey }),
    queryFn: ({ signal }) =>
      getClientTimeline(
        clientId,
        { page, limit: TIMELINE_LIMIT, categories: categoriesQuery },
        { signal },
      ),
    placeholderData: keepPreviousData,
  });

  const toggleCategory = useCallback((c: ClientTimelineEventCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) {
        if (next.size <= 1) return prev;
        next.delete(c);
      } else {
        next.add(c);
      }
      return next;
    });
  }, []);

  const selectAllCategories = useCallback(() => {
    setSelectedCategories(new Set(CLIENT_TIMELINE_EVENT_CATEGORIES));
  }, []);

  return {
    data: query.isError ? null : (query.data ?? null),
    error: query.isError ? getErrorMessage(query.error, t("timeline.loadError")) : null,
    loading: query.isFetching,
    page,
    setPage,
    reload: () => query.refetch(),
    limit: TIMELINE_LIMIT,
    selectedCategories,
    toggleCategory,
    selectAllCategories,
  };
}
