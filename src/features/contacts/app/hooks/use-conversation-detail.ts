"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { contactKeys } from "@/features/contacts/app/hooks/query-keys";
import { getConversationDetail, sendMessage as sendMessageRequest } from "@/features/contacts/app/services/contacts.service";
import {
  createLeadNote,
  deleteLeadNote,
  listLeadNotes,
  updateLeadNote,
} from "@/features/contacts/app/services/notes.service";
import type {
  ConversationDetailResponseData,
  LeadNoteDto,
  MessageDto,
  UpsertLeadNoteRequestBody,
} from "@/types/api/contacts-v1";

let optimisticIdCounter = 0;

/**
 * `conversationId` vazio ("") = nenhuma conversa selecionada ainda — não busca nada.
 * Permite chamar o hook incondicionalmente no componente pai (ex.: antes de o
 * usuário escolher uma conversa), sem violar as regras de hooks do React.
 */
export function useConversationDetail(conversationId: string) {
  const queryClient = useQueryClient();
  const enabled = Boolean(conversationId);
  const detailKey = contactKeys.conversationDetail(conversationId);
  const notesKey = contactKeys.leadNotes(conversationId);

  // Conversa viva: staleTime 0 para rebuscar mensagens novas ao reabrir.
  const detailQuery = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => getConversationDetail(conversationId, { signal }),
    enabled,
    staleTime: 0,
  });
  const notesQuery = useQuery({
    queryKey: notesKey,
    queryFn: ({ signal }) => listLeadNotes(conversationId, { signal }),
    enabled,
    staleTime: 0,
  });
  const { refetch: refetchDetail } = detailQuery;
  const { refetch: refetchNotes } = notesQuery;

  const refresh = useCallback(async () => {
    if (!enabled) return;
    await refetchDetail();
  }, [enabled, refetchDetail]);

  const refreshNotes = useCallback(async () => {
    if (!enabled) return;
    await refetchNotes();
  }, [enabled, refetchNotes]);

  const patchMessages = useCallback(
    (updater: (messages: MessageDto[]) => MessageDto[]) =>
      queryClient.setQueryData<ConversationDetailResponseData>(detailKey, (prev) =>
        prev ? { ...prev, messages: updater(prev.messages) } : prev,
      ),
    [queryClient, detailKey],
  );

  const sendMutation = useMutation({
    mutationFn: (body: string) => sendMessageRequest(conversationId, { body }),
  });
  const { mutateAsync: sendAsync } = sendMutation;

  /** Envia mensagem outbound com atualização otimista (bolha "sent" imediata; substitui pela resposta real). */
  const sendMessage = useCallback(
    async (body: string) => {
      const optimisticId = `optimistic-${optimisticIdCounter++}`;
      const optimisticMessage: MessageDto = {
        id: optimisticId,
        direction: "outbound",
        type: "text",
        body,
        status: "sent",
        createdAt: new Date().toISOString(),
      };
      patchMessages((messages) => [...messages, optimisticMessage]);

      try {
        const sent = await sendAsync(body);
        patchMessages((messages) => messages.map((m) => (m.id === optimisticId ? sent : m)));
      } catch {
        patchMessages((messages) =>
          messages.map((m) => (m.id === optimisticId ? { ...m, status: "failed" as const } : m)),
        );
        throw new Error("send_error");
      }
    },
    [patchMessages, sendAsync],
  );

  const patchNotes = useCallback(
    (updater: (notes: LeadNoteDto[]) => LeadNoteDto[]) =>
      queryClient.setQueryData<LeadNoteDto[]>(notesKey, (prev) => updater(prev ?? [])),
    [queryClient, notesKey],
  );

  const createNoteMutation = useMutation({
    mutationFn: (input: UpsertLeadNoteRequestBody) => createLeadNote(conversationId, input),
    onSuccess: (note) => patchNotes((prev) => [note, ...prev]),
  });
  const updateNoteMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<UpsertLeadNoteRequestBody> }) =>
      updateLeadNote(id, input),
    onSuccess: (updated, { id }) => patchNotes((prev) => prev.map((n) => (n.id === id ? updated : n))),
  });
  const deleteNoteMutation = useMutation({
    mutationFn: deleteLeadNote,
    onSuccess: (_data, id) => patchNotes((prev) => prev.filter((n) => n.id !== id)),
  });
  const { mutateAsync: createNoteAsync } = createNoteMutation;
  const { mutateAsync: updateNoteAsync } = updateNoteMutation;
  const { mutateAsync: deleteNoteAsync } = deleteNoteMutation;

  const createNote = useCallback(
    (input: UpsertLeadNoteRequestBody) => createNoteAsync(input),
    [createNoteAsync],
  );
  const updateNote = useCallback(
    (id: string, input: Partial<UpsertLeadNoteRequestBody>) => updateNoteAsync({ id, input }),
    [updateNoteAsync],
  );
  const deleteNote = useCallback((id: string) => deleteNoteAsync(id), [deleteNoteAsync]);

  return {
    data: detailQuery.data ?? null,
    loading: enabled && isQueryLoading(detailQuery),
    error: detailQuery.error ? detailQuery.error.message || "load_error" : null,
    refresh,
    sendMessage,
    notes: notesQuery.data ?? [],
    notesLoading: enabled && isQueryLoading(notesQuery),
    refreshNotes,
    createNote,
    updateNote,
    deleteNote,
  };
}
