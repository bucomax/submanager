"use client";

import { useQuery } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { getAppDetail } from "@/features/apps/app/services/apps.service";
import { appKeys } from "@/features/apps/app/hooks/query-keys";

export function useAppDetail(appId: string | undefined) {
  const query = useQuery({
    queryKey: appKeys.detail(appId),
    queryFn: ({ signal }) => getAppDetail(appId!, { signal }),
    enabled: Boolean(appId),
  });

  return { data: query.data ?? null, loading: isQueryLoading(query), refresh: query.refetch };
}
