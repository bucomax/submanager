"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { contactKeys } from "@/features/contacts/app/hooks/query-keys";
import {
  createQuickPhrase,
  deleteQuickPhrase,
  listQuickPhrases,
  updateQuickPhrase,
} from "@/features/contacts/app/services/quick-phrases.service";
import type { QuickPhraseDto, UpsertQuickPhraseRequestBody } from "@/types/api/contacts-v1";

/** CRUD de frases prontas do tenant, com update local no cache (sem refetch completo a cada mutação). */
export function useQuickPhrases() {
  const queryClient = useQueryClient();
  const patchCache = (updater: (current: QuickPhraseDto[]) => QuickPhraseDto[]) =>
    queryClient.setQueryData<QuickPhraseDto[]>(contactKeys.quickPhrases, (current) =>
      updater(current ?? []),
    );

  const query = useQuery({
    queryKey: contactKeys.quickPhrases,
    queryFn: ({ signal }) => listQuickPhrases({ signal }),
  });
  const { refetch } = query;

  const createMutation = useMutation({
    mutationFn: createQuickPhrase,
    onSuccess: (created) =>
      patchCache((prev) => [...prev, created].sort((a, b) => a.title.localeCompare(b.title))),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<UpsertQuickPhraseRequestBody> }) =>
      updateQuickPhrase(id, input),
    onSuccess: (updated, { id }) => patchCache((prev) => prev.map((p) => (p.id === id ? updated : p))),
  });
  const removeMutation = useMutation({
    mutationFn: deleteQuickPhrase,
    onSuccess: (_data, id) => patchCache((prev) => prev.filter((p) => p.id !== id)),
  });
  const { mutateAsync: createAsync } = createMutation;
  const { mutateAsync: updateAsync } = updateMutation;
  const { mutateAsync: removeAsync } = removeMutation;

  const create = useCallback((input: UpsertQuickPhraseRequestBody) => createAsync(input), [createAsync]);
  const update = useCallback(
    (id: string, input: Partial<UpsertQuickPhraseRequestBody>) => updateAsync({ id, input }),
    [updateAsync],
  );
  const remove = useCallback((id: string) => removeAsync(id), [removeAsync]);
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    items: query.data ?? [],
    loading: isQueryLoading(query),
    error: query.error ? query.error.message || "load_error" : null,
    refresh,
    create,
    update,
    remove,
  };
}
