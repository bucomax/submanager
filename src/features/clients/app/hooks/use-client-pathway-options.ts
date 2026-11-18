"use client";

import { clientKeys } from "@/features/clients/app/hooks/query-keys";
import { listPathwaysForTenant } from "@/features/clients/app/services/clients.service";
import { getErrorMessage } from "@/lib/utils/error-message";
import type { PathwayOption } from "@/features/clients/app/types/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const NO_PATHWAYS: PathwayOption[] = [];

type UseClientPathwayOptionsParams = {
  enabled: boolean;
  fallbackErrorMessage: string;
};

export function useClientPathwayOptions({
  enabled,
  fallbackErrorMessage,
}: UseClientPathwayOptionsParams) {
  const query = useQuery({
    queryKey: clientKeys.pathways,
    queryFn: ({ signal }) => listPathwaysForTenant({ signal }),
    enabled,
  });

  const pathways = query.data ?? (query.isError ? NO_PATHWAYS : null);
  const eligiblePathways = useMemo(
    () => (pathways ?? NO_PATHWAYS).filter((pathway) => pathway.publishedVersion != null),
    [pathways],
  );

  return {
    pathways,
    eligiblePathways,
    loading: query.isFetching,
    error: query.isError ? getErrorMessage(query.error, fallbackErrorMessage) : null,
    reload: () => void query.refetch(),
  };
}
