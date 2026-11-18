"use client";

import { clientKeys } from "@/features/clients/app/hooks/query-keys";
import { createClientNote } from "@/features/clients/app/services/client-notes.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type CreateClientNoteVariables = { clientId: string; content: string };

export function useCreateClientNote() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ clientId, content }: CreateClientNoteVariables) =>
      createClientNote(clientId, { content }),
    onSuccess: (_note, { clientId }) => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.notesAll(clientId) });
    },
  });

  return {
    creating: mutation.isPending,
    createNote: async (clientId: string, content: string) => {
      await mutation.mutateAsync({ clientId, content });
    },
  };
}
