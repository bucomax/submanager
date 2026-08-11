"use client";

import { useCallback, useEffect, useState } from "react";
import { getConversationsList } from "@/features/contacts/app/services/contacts.service";
import type {
  ConversationChannel,
  ConversationListItemDto,
  ConversationStatus,
} from "@/types/api/contacts-v1";

const PAGE_SIZE = 20;

export type UseConversationsListParams = {
  search: string;
  channelFilter?: ConversationChannel;
  stageFilter?: ConversationStatus;
};

/** Lista de conversas com scroll infinito (cursor) — coluna 1 da tela de Conversas. */
export function useConversationsList(params: UseConversationsListParams) {
  const [items, setItems] = useState<ConversationListItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { search, channelFilter, stageFilter } = params;

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getConversationsList({
        channel: channelFilter,
        status: stageFilter,
        q: search || undefined,
        limit: PAGE_SIZE,
      });
      setItems(result.data);
      setNextCursor(result.nextCursor);
      setTotalItems(result.totalItems);
      setError(null);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "load_error");
    } finally {
      setLoading(false);
    }
  }, [search, channelFilter, stageFilter]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await getConversationsList({
        channel: channelFilter,
        status: stageFilter,
        q: search || undefined,
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setItems((prev) => [...prev, ...result.data]);
      setNextCursor(result.nextCursor);
      setTotalItems(result.totalItems);
    } catch {
      // Falha ao paginar não derruba a lista já carregada — usuário pode tentar rolar de novo.
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, channelFilter, stageFilter, search]);

  /** Atualiza a etapa de um item localmente (usado após mudar etapa no painel do lead). */
  const patchLocalStage = useCallback((conversationId: string, status: ConversationStatus) => {
    setItems((prev) =>
      prev.map((item) => (item.id === conversationId ? { ...item, status } : item)),
    );
  }, []);

  return {
    items,
    totalItems,
    loading,
    loadingMore,
    error,
    hasMore: nextCursor !== null,
    loadMore,
    refresh: loadFirstPage,
    patchLocalStage,
  };
}
