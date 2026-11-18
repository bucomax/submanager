"use client";

import { useInvalidateClientData } from "@/features/clients/app/hooks/use-invalidate-client-data";
import { updateClient } from "@/features/clients/app/services/clients.service";
import type { PatchClientRequestBody } from "@/types/api/clients-v1";
import { useMutation } from "@tanstack/react-query";

type UpdateClientVariables = { clientId: string; body: PatchClientRequestBody };

export function useUpdateClient() {
  const invalidateClientData = useInvalidateClientData();
  const mutation = useMutation({
    mutationFn: ({ clientId, body }: UpdateClientVariables) => updateClient(clientId, body),
    onSuccess: () => {
      void invalidateClientData();
    },
  });

  return {
    updating: mutation.isPending,
    updateClientById: (clientId: string, body: PatchClientRequestBody) =>
      mutation.mutateAsync({ clientId, body }),
  };
}
