"use client";

import { useQuery } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import { listTenantMembersForPicker } from "@/features/settings/app/services/tenant-settings.service";

/** Membros do tenant para selects de responsável (agenda, etapas de fluxo). Falha silenciosa: lista vazia. */
export function useTenantMemberPicker(options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: settingsKeys.memberPicker,
    queryFn: ({ signal }) => listTenantMembersForPicker({ signal }),
    select: (response) => response.members,
    enabled: options?.enabled ?? true,
  });

  return { members: query.data ?? [], loading: isQueryLoading(query) };
}
