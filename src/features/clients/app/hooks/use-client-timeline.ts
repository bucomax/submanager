"use client";

import { CLIENT_TIMELINE_EVENT_CATEGORIES } from "@/domain/audit/event-category-mapper";
import { getClientTimeline } from "@/features/clients/app/services/clients.service";
import type { ClientTimelineEventCategory } from "@/types/api/clients-v1";
import type { ClientTimelineResponseData } from "@/types/api/clients-v1";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

const TIMELINE_LIMIT = 20;

export function useClientTimeline(clientId: string, refreshSignal = 0) {
  const t = useTranslations("clients.detail");
  const [data, setData] = useState<ClientTimelineResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState(
    () => new Set<ClientTimelineEventCategory>([...CLIENT_TIMELINE_EVENT_CATEGORIES]),
  );

  const categoriesQuery = useMemo(() => {
    if (selectedCategories.size === CLIENT_TIMELINE_EVENT_CATEGORIES.length) return undefined;
    return [...selectedCategories].sort().join(",");
  }, [selectedCategories]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategories]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getClientTimeline(clientId, {
        page,
        limit: TIMELINE_LIMIT,
        categories: categoriesQuery,
      });
      setData(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("timeline.loadError"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, page, t, categoriesQuery]);

  useEffect(() => {
    // `refreshSignal` não entra em `load`: é o efeito que reexecuta a busca quando o
    // detalhe do cliente sinaliza que a timeline mudou.
    void load();
  }, [load, refreshSignal]);

  const reload = useCallback(() => {
    void load();
  }, [load]);

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
    data,
    error,
    loading,
    page,
    setPage,
    reload,
    limit: TIMELINE_LIMIT,
    selectedCategories,
    toggleCategory,
    selectAllCategories,
  };
}
