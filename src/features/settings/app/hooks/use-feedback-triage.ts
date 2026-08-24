"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listFeedback,
  updateFeedback,
} from "@/features/settings/app/services/feedback-triage.service";
import type {
  FeedbackDto,
  FeedbackStatus,
  FeedbackType,
  ListFeedbackQueryParams,
} from "@/types/api/feedback-v1";
import type { ApiPagination } from "@/lib/api/pagination";

/** Estado e ações da fila de triagem de feedback (`super_admin`). */
export function useFeedbackTriage() {
  const [filters, setFilters] = useState<ListFeedbackQueryParams>({ page: 1, limit: 20 });
  const [rows, setRows] = useState<FeedbackDto[]>([]);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFeedback(filters);
      setRows(data.data);
      setPagination(data.pagination);
    } catch {
      // O interceptor do apiClient já mostrou o toast. Sem este catch, `void load()`
      // no efeito abaixo deixaria a rejeição escapar como unhandledrejection — e o
      // Sentry a capturaria como erro de aplicação nesta mesma fila de triagem.
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = useCallback(
    async (id: string, status: FeedbackStatus) => {
      setPendingId(id);
      try {
        const { feedback } = await updateFeedback(id, { status });
        setRows((current) => current.map((row) => (row.id === id ? feedback : row)));
      } catch {
        // Idem: o interceptor já avisou o usuário. O reload devolve o Select ao
        // estado real do servidor em vez de deixar a UI otimista desalinhada.
        await load();
      } finally {
        setPendingId(null);
      }
    },
    [load],
  );

  const setPage = useCallback((page: number) => {
    setFilters((current) => ({ ...current, page }));
  }, []);

  // Trocar filtro reseta a página: sem isto, filtrar na página 4 de um resultado
  // de 1 página deixa a tela vazia até o usuário perceber e voltar manualmente.
  const setStatusFilter = useCallback((status: FeedbackStatus | undefined) => {
    setFilters((current) => ({ ...current, status, page: 1 }));
  }, []);

  const setTypeFilter = useCallback((type: FeedbackType | undefined) => {
    setFilters((current) => ({ ...current, type, page: 1 }));
  }, []);

  return {
    rows,
    pagination,
    loading,
    pendingId,
    filters,
    setPage,
    setStatusFilter,
    setTypeFilter,
    changeStatus,
  };
}
