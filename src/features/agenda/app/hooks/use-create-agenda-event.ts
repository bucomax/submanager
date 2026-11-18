"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { agendaKeys } from "@/features/agenda/app/hooks/query-keys";
import { createAgendaEvent } from "@/features/agenda/app/services/agenda.service";

export function useCreateAgendaEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAgendaEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agendaKeys.all }),
  });
}
