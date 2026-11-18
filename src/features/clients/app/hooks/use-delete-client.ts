"use client";

import { useInvalidateClientData } from "@/features/clients/app/hooks/use-invalidate-client-data";
import { softDeleteClient } from "@/features/clients/app/services/clients.service";
import { useMutation } from "@tanstack/react-query";

export function useDeleteClient() {
  const invalidateClientData = useInvalidateClientData();
  const mutation = useMutation({
    mutationFn: softDeleteClient,
    onSuccess: () => {
      void invalidateClientData();
    },
  });

  return {
    deleting: mutation.isPending,
    deleteClient: (clientId: string) => mutation.mutateAsync(clientId),
  };
}
