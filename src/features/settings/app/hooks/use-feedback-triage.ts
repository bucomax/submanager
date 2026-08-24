"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listFeedback,
  updateFeedback,
} from "@/features/settings/app/services/feedback-triage.service";
import type {
  FeedbackDto,
  FeedbackStatus,
  ListFeedbackQueryParams,
} from "@/types/api/feedback-v1";
import type { ApiPagination } from "@/lib/api/pagination";

/** Estado e ações da fila de triagem de feedback (`super_admin`). */
export function useFeedbackTriage() {
  const [filters, setFilters] = useState<ListFeedbackQueryParams>({ page: 1, limit: 20 });
  const [rows, setRows] = useState<FeedbackDto[]>([]);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFeedback(filters);
      setRows(data.data);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = useCallback(async (id: string, status: FeedbackStatus) => {
    const { feedback } = await updateFeedback(id, { status });
    setRows((current) => current.map((row) => (row.id === id ? feedback : row)));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((current) => ({ ...current, page }));
  }, []);

  return { rows, pagination, loading, filters, setFilters, setPage, changeStatus };
}
