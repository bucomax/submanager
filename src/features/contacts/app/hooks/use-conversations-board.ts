"use client";

import { useCallback, useEffect, useState } from "react";
import { getConversationsBoard } from "@/features/contacts/app/services/contacts.service";
import type { ConversationsBoardResponseData } from "@/types/api/contacts-v1";

export function useConversationsBoard() {
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

  return { data, loading, error, refresh };
}
