"use client";

import { useCallback, useMemo } from "react";
import { keepPreviousData, useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { contactKeys } from "@/features/contacts/app/hooks/query-keys";
import { getConversationsList } from "@/features/contacts/app/services/contacts.service";
import type {
  ConversationChannel,
  ConversationStatus,
  ConversationsListResponseData,
} from "@/types/api/contacts-v1";

const PAGE_SIZE = 20;

export type UseConversationsListParams = {
  search: string;
  channelFilter?: ConversationChannel;
  stageFilter?: ConversationStatus;
};

/** Lista de conversas com scroll infinito (cursor) — coluna 1 da tela de Conversas. */
export function useConversationsList(params: UseConversationsListParams) {
  const queryClient = useQueryClient();
  const { search, channelFilter, stageFilter } = params;
  const queryKey = useMemo(
    () => contactKeys.conversations({ q: search, channel: channelFilter, status: stageFilter }),
    [search, channelFilter, stageFilter],
  );

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      getConversationsList(
        {
          channel: channelFilter,
          status: stageFilter,
          q: search || undefined,
          cursor: pageParam,
          limit: PAGE_SIZE,
        },
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    // Caixa de entrada: sempre rebusca ao montar (mensagens novas chegam por fora do app).
    staleTime: 0,
  });
  const { fetchNextPage, refetch, isFetchingNextPage, hasNextPage } = query;

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);
  const totalItems = query.data?.pages.at(-1)?.totalItems ?? 0;

  const loadMore = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) return;
    // Falha ao paginar não derruba a lista já carregada — usuário pode tentar rolar de novo.
    await fetchNextPage().catch(() => undefined);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  /** Atualiza a etapa de um item localmente (usado após mudar etapa no painel do lead). */
  const patchLocalStage = useCallback(
    (conversationId: string, status: ConversationStatus) => {
      queryClient.setQueryData<InfiniteData<ConversationsListResponseData, string | undefined>>(
        queryKey,
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              data: page.data.map((item) => (item.id === conversationId ? { ...item, status } : item)),
            })),
          },
      );
    },
    [queryClient, queryKey],
  );

  return {
    items,
    totalItems,
    loading: isQueryLoading(query),
    loadingMore: isFetchingNextPage,
    error: query.error ? query.error.message || "load_error" : null,
    hasMore: Boolean(hasNextPage),
    loadMore,
    refresh,
    patchLocalStage,
  };
}
