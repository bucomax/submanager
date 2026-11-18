"use client";

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { updateConversationStatus } from "@/features/contacts/app/services/contacts.service";
import type { ConversationStatus } from "@/types/api/contacts-v1";

/** Muda a etapa (status) de uma conversa. O chamador decide como refletir o resultado na UI. */
export function useUpdateConversationStatus() {
  const mutation = useMutation({
    mutationFn: ({ conversationId, status }: { conversationId: string; status: ConversationStatus }) =>
      updateConversationStatus(conversationId, status),
  });
  const { mutateAsync } = mutation;

  const updateStatus = useCallback(
    (conversationId: string, status: ConversationStatus) => mutateAsync({ conversationId, status }),
    [mutateAsync],
  );

  return { updateStatus, updating: mutation.isPending };
}
