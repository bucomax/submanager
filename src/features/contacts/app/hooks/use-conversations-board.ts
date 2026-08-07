"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getConversationsBoard,
  updateConversationStatus,
} from "@/features/contacts/app/services/contacts.service";
import { toast } from "@/lib/toast";
import { useTranslations } from "next-intl";
import type { ConversationStatus, ConversationsBoardResponseData } from "@/types/api/contacts-v1";

export function useConversationsBoard() {
  const t = useTranslations("contacts.board");
  const [data, setData] = useState<ConversationsBoardResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getConversationsBoard();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Move o card entre colunas na hora (otimista); reverte com refetch se a API falhar. */
  const moveConversation = useCallback(
    async (conversationId: string, toStatus: ConversationStatus) => {
      setData((prev) => {
        if (!prev) return prev;
        const fromStatus = (Object.keys(prev.columns) as ConversationStatus[]).find((status) =>
          prev.columns[status].some((c) => c.id === conversationId),
        );
        if (!fromStatus || fromStatus === toStatus) return prev;

        const card = prev.columns[fromStatus].find((c) => c.id === conversationId)!;
        return {
          columns: {
            ...prev.columns,
            [fromStatus]: prev.columns[fromStatus].filter((c) => c.id !== conversationId),
            [toStatus]: [{ ...card, status: toStatus }, ...prev.columns[toStatus]],
          },
        };
      });

      try {
        await updateConversationStatus(conversationId, toStatus);
      } catch {
        toast.error(t("moveError"));
        void refresh();
      }
    },
    [refresh, t],
  );

  return { data, loading, error, refresh, moveConversation };
}
