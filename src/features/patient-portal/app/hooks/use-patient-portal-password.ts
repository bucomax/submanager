"use client";

import { patientPortalKeys } from "@/features/patient-portal/app/hooks/query-keys";
import {
  PatientPortalUnauthorizedError,
  updatePatientPortalPassword,
  type PatientPortalPasswordUpdateBody,
} from "@/lib/api/patient-portal-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Define/altera a senha do portal; a ficha e a timeline refletem o novo estado. */
export function usePatientPortalPassword(tenantSlug: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: PatientPortalPasswordUpdateBody) => updatePatientPortalPassword(tenantSlug, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientPortalKeys.detail(tenantSlug) });
      void queryClient.invalidateQueries({ queryKey: patientPortalKeys.timelineAll(tenantSlug) });
    },
  });

  return {
    submitting: mutation.isPending,
    updatePassword: async (body: PatientPortalPasswordUpdateBody) => {
      await mutation.mutateAsync(body);
    },
  };
}

/** Sessão do portal expirada/ausente (cookie inválido). */
export function isPatientPortalSessionExpired(error: unknown): boolean {
  return error instanceof PatientPortalUnauthorizedError;
}
