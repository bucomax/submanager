"use client";

import { useInvalidateClientData } from "@/features/clients/app/hooks/use-invalidate-client-data";
import { createPatientPathway } from "@/features/clients/app/services/clients.service";
import { useMutation } from "@tanstack/react-query";

export function useStartPatientPathway() {
  const invalidateClientData = useInvalidateClientData();
  const mutation = useMutation({
    mutationFn: ({ clientId, pathwayId }: { clientId: string; pathwayId: string }) =>
      createPatientPathway({ clientId, pathwayId }),
    onSuccess: () => {
      void invalidateClientData();
    },
  });

  return {
    submitting: mutation.isPending,
    startPathway: async (clientId: string, pathwayId: string) => {
      await mutation.mutateAsync({ clientId, pathwayId });
    },
  };
}
