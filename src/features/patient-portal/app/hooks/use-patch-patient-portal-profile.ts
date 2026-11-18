"use client";

import { patientPortalKeys } from "@/features/patient-portal/app/hooks/query-keys";
import { patchPatientPortalProfile } from "@/lib/api/patient-portal-client";
import type { PatchPatientPortalProfileBody } from "@/lib/validators/patient-portal-profile";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type PatchProfileVariables = { tenantSlug: string; body: PatchPatientPortalProfileBody };

/** Autoedição da ficha pelo paciente; refaz ficha e timeline do portal. */
export function usePatchPatientPortalProfile() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ tenantSlug, body }: PatchProfileVariables) =>
      patchPatientPortalProfile(tenantSlug, body),
    onSuccess: (_data, { tenantSlug }) => {
      void queryClient.invalidateQueries({ queryKey: patientPortalKeys.detail(tenantSlug) });
      void queryClient.invalidateQueries({ queryKey: patientPortalKeys.timelineAll(tenantSlug) });
    },
  });

  return {
    saving: mutation.isPending,
    patchProfile: async (tenantSlug: string, body: PatchPatientPortalProfileBody) => {
      await mutation.mutateAsync({ tenantSlug, body });
    },
  };
}
