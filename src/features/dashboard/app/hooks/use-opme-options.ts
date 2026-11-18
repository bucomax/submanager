"use client";

import { dashboardKeys } from "@/features/dashboard/app/hooks/query-keys";
import type { DashboardPipelineOpmeOption } from "@/features/dashboard/app/types";
import { listOpmeSuppliers } from "@/features/settings/app/services/tenant-settings.service";
import { useQuery } from "@tanstack/react-query";

const NO_OPTIONS: DashboardPipelineOpmeOption[] = [];

/** Fornecedores OPME (inclusive inativos) como opções de filtro; falha silenciosa mantém o filtro funcional. */
export function useOpmeOptions(): DashboardPipelineOpmeOption[] {
  const query = useQuery({
    queryKey: dashboardKeys.opmeOptions,
    queryFn: async ({ signal }): Promise<DashboardPipelineOpmeOption[]> => {
      const res = await listOpmeSuppliers({ limit: 100, includeInactive: true }, { signal });
      return res.data.map((s) => ({ value: s.id, label: s.name }));
    },
  });
  return query.data ?? NO_OPTIONS;
}
