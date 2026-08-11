"use client";

import { useCallback, useEffect, useState } from "react";
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

export function useConversationDetail(conversationId: string) {
  const [data, setData] = useState<ConversationDetailResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<LeadNoteDto[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);

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

  const refreshNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const result = await listLeadNotes(conversationId);
      setNotes(result);
    } catch {
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void refresh();
    void refreshNotes();
  }, [refresh, refreshNotes]);

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
      setData((prev) => (prev ? { ...prev, messages: [...prev.messages, optimisticMessage] } : prev));

      try {
        const sent = await sendMessageRequest(conversationId, { body });
        setData((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((m) => (m.id === optimisticId ? sent : m)),
              }
            : prev,
        );
      } catch {
        setData((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === optimisticId ? { ...m, status: "failed" as const } : m,
                ),
              }
            : prev,
        );
        throw new Error("send_error");
      }
    },
    [conversationId],
  );

  const createNote = useCallback(
    async (input: UpsertLeadNoteRequestBody) => {
      const note = await createLeadNote(conversationId, input);
      setNotes((prev) => [note, ...prev]);
      return note;
    },
    [conversationId],
  );

  const updateNote = useCallback(async (id: string, input: Partial<UpsertLeadNoteRequestBody>) => {
    const updated = await updateLeadNote(id, input);
    setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
    return updated;
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    await deleteLeadNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return {
    data,
    loading,
    error,
    refresh,
    sendMessage,
    notes,
    notesLoading,
    refreshNotes,
    createNote,
    updateNote,
    deleteNote,
  };
}
