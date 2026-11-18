"use client";

import { useInvalidateClientData } from "@/features/clients/app/hooks/use-invalidate-client-data";
import { completePatientPathway } from "@/features/pathways/app/services/patient-pathways.service";
import { useMutation } from "@tanstack/react-query";

export function useCompletePatientPathway() {
  const invalidateClientData = useInvalidateClientData();
  const mutation = useMutation({
    mutationFn: completePatientPathway,
    onSuccess: () => {
      void invalidateClientData();
    },
  });

  return {
    completing: mutation.isPending,
    completePathway: async (patientPathwayId: string) => {
      await mutation.mutateAsync(patientPathwayId);
    },
  };
}
