"use client";

import { exchangePatientPortalToken } from "@/lib/api/patient-portal-client";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";

/** Troca o token do link mágico por sessão assim que há um token; `onExchanged` roda no sucesso. */
export function useExchangePatientPortalToken(
  tenantSlug: string,
  token: string,
  onExchanged: () => void,
) {
  const { mutate, isError } = useMutation({
    mutationFn: (value: string) => exchangePatientPortalToken(tenantSlug, value),
    onSuccess: onExchanged,
  });

  useEffect(() => {
    if (token) mutate(token);
  }, [token, mutate]);

  return { failed: isError };
}
