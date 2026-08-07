"use client";

import { useCallback, useEffect, useState } from "react";
import { getConversationDetail } from "@/features/contacts/app/services/contacts.service";
import type { ConversationDetailResponseData } from "@/types/api/contacts-v1";

export function useConversationDetail(conversationId: string) {
  const [data, setData] = useState<ConversationDetailResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getConversationDetail(conversationId);
      setData(result);
      setError(null);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "load_error");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
