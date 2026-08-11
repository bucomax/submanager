"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createQuickPhrase,
  deleteQuickPhrase,
  listQuickPhrases,
  updateQuickPhrase,
} from "@/features/contacts/app/services/quick-phrases.service";
import type { QuickPhraseDto, UpsertQuickPhraseRequestBody } from "@/types/api/contacts-v1";

/** CRUD de frases prontas do tenant, com update local otimista (sem refetch completo a cada mutação). */
export function useQuickPhrases() {
  const [items, setItems] = useState<QuickPhraseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listQuickPhrases();
      setItems(result);
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

  const create = useCallback(async (input: UpsertQuickPhraseRequestBody) => {
    const created = await createQuickPhrase(input);
    setItems((prev) => [...prev, created].sort((a, b) => a.title.localeCompare(b.title)));
    return created;
  }, []);

  const update = useCallback(async (id: string, input: Partial<UpsertQuickPhraseRequestBody>) => {
    const updated = await updateQuickPhrase(id, input);
    setItems((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteQuickPhrase(id);
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { items, loading, error, refresh, create, update, remove };
}
