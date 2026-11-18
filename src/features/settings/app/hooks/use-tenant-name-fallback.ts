"use client";

import { useQuery } from "@tanstack/react-query";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import { getTenantClinicSettings } from "@/features/settings/app/services/tenant-settings.service";

/** Nome da clínica vindo da API, para quando a sessão não traz `tenantName`. Falha silenciosa. */
export function useTenantNameFallback(enabled: boolean): string | null {
  const query = useQuery({
    queryKey: settingsKeys.clinic,
    queryFn: ({ signal }) => getTenantClinicSettings({ skipErrorToast: true, signal }),
    select: (response) => response.tenant.name?.trim() || null,
    enabled,
  });
  return query.data ?? null;
}
