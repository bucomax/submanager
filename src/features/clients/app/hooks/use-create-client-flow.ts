"use client";

import { useInvalidateClientData } from "@/features/clients/app/hooks/use-invalidate-client-data";
import {
  createClient,
  createPatientPathway,
} from "@/features/clients/app/services/clients.service";
import type { CreateClientRequestBody } from "@/types/api/clients-v1";
import { useMutation } from "@tanstack/react-query";

type CreateClientFlowInput = {
  payload: CreateClientRequestBody;
  pathwayId: string;
};

export function useCreateClientFlow() {
  const invalidateClientData = useInvalidateClientData();
  const mutation = useMutation({
    mutationFn: async ({ payload, pathwayId }: CreateClientFlowInput) => {
      const client = await createClient(payload);
      await createPatientPathway({ clientId: client.id, pathwayId });
      return client;
    },
    // O cliente pode ter sido criado mesmo que a jornada falhe: sempre refletir na lista.
    onSettled: () => {
      void invalidateClientData();
    },
  });

  return {
    submitting: mutation.isPending,
    submitClientFlow: (input: CreateClientFlowInput) => mutation.mutateAsync(input),
  };
}
