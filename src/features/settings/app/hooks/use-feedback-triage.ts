"use client";

import { useCallback, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import {
  listFeedback,
  updateFeedback,
} from "@/features/settings/app/services/feedback-triage.service";
import type {
  FeedbackListResponseData,
  FeedbackStatus,
  FeedbackType,
  ListFeedbackQueryParams,
} from "@/types/api/feedback-v1";

/** Estado e ações da fila de triagem de feedback (`super_admin`). */
export function useFeedbackTriage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ListFeedbackQueryParams>({ page: 1, limit: 20 });

  // Erro: o interceptor do apiClient já mostrou o toast; a query guarda o erro sem rejeição solta.
  const query = useQuery({
    queryKey: settingsKeys.feedback(filters),
    queryFn: ({ signal }) => listFeedback(filters, { signal }),
    placeholderData: keepPreviousData,
  });
  const { refetch } = query;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FeedbackStatus }) =>
      updateFeedback(id, { status }),
    onSuccess: ({ feedback }) => {
      queryClient.setQueryData<FeedbackListResponseData>(settingsKeys.feedback(filters), (current) =>
        current
          ? { ...current, data: current.data.map((row) => (row.id === feedback.id ? feedback : row)) }
          : current,
      );
    },
    // O reload devolve o Select ao estado real do servidor em vez de deixar a UI otimista desalinhada.
    onError: () => refetch(),
  });
  const { mutateAsync: statusAsync } = statusMutation;

  const changeStatus = useCallback(
    async (id: string, status: FeedbackStatus) => {
      try {
        await statusAsync({ id, status });
      } catch {
        // O interceptor já avisou o usuário; onError do mutation recarrega a fila.
      }
    },
    [statusAsync],
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
    rows: query.data?.data ?? [],
    pagination: query.data?.pagination ?? null,
    loading: isQueryLoading(query),
    pendingId: statusMutation.isPending ? statusMutation.variables.id : null,
    filters,
    setPage,
    setStatusFilter,
    setTypeFilter,
    changeStatus,
  };
}
