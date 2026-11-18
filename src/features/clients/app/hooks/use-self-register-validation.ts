"use client";

import { clientKeys } from "@/features/clients/app/hooks/query-keys";
import { fetchPatientSelfRegisterValidation } from "@/lib/api/patient-self-register-public";
import { useQuery } from "@tanstack/react-query";

export type SelfRegisterPhase = "loading" | "invalid" | "form";

/** Valida o token do convite de auto-cadastro (público, sem sessão) e expõe tenant + prefill. */
export function useSelfRegisterValidation(token: string, tenantSlug: string | undefined) {
  const query = useQuery({
    queryKey: clientKeys.selfRegisterValidation(token, tenantSlug),
    queryFn: ({ signal }) => fetchPatientSelfRegisterValidation(token, tenantSlug, { signal }),
    enabled: token !== "",
    // O convite pode expirar/ser usado: toda abertura da página valida de novo.
    staleTime: 0,
    gcTime: 0,
  });

  const valid = query.data?.valid === true ? query.data : null;
  let phase: SelfRegisterPhase = "invalid";
  if (token !== "" && query.isPending) phase = "loading";
  else if (valid) phase = "form";

  return {
    phase,
    token: valid ? token : null,
    tenantName: valid?.tenantName ?? "",
    tenantTaxId: valid?.tenantTaxId?.trim() ? valid.tenantTaxId : null,
    formPrefill: valid?.formPrefill ?? null,
  };
}
