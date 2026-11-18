"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { getAppCatalog } from "@/features/apps/app/services/apps.service";
import { appKeys } from "@/features/apps/app/hooks/query-keys";

export function useAppCatalog(params?: { category?: string; search?: string }) {
  const query = useQuery({
    queryKey: appKeys.catalog(params),
    queryFn: ({ signal }) => getAppCatalog(params, { signal }),
    placeholderData: keepPreviousData,
  });

  return { data: query.data ?? null, loading: isQueryLoading(query), refresh: query.refetch };
}
