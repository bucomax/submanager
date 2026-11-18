"use client";

import { patientPortalKeys } from "@/features/patient-portal/app/hooks/query-keys";
import { fetchPatientPortalOverview, logoutPatientPortal } from "@/lib/api/patient-portal-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Verifica se há sessão de portal ativa (usado pela tela de definir senha). */
export function usePatientPortalSessionCheck(tenantSlug: string) {
  const query = useQuery({
    queryKey: patientPortalKeys.overview(tenantSlug),
    queryFn: ({ signal }) => fetchPatientPortalOverview(tenantSlug, { signal }),
  });

  return { loading: query.isPending, unauthorized: query.isError };
}

/** Encerra a sessão do portal e descarta todo dado do paciente em cache. */
export function useLogoutPatientPortal() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: logoutPatientPortal,
    onSuccess: () => queryClient.resetQueries({ queryKey: patientPortalKeys.all }),
  });

  return { logout: async () => { await mutation.mutateAsync(); } };
}
