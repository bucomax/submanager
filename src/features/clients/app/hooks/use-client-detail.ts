"use client";

import { clientKeys } from "@/features/clients/app/hooks/query-keys";
import { getClientDetail } from "@/features/clients/app/services/clients.service";
import { getErrorMessage } from "@/lib/utils/error-message";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

const TRANSITIONS_LIMIT = 20;

export function useClientDetail(clientId: string) {
  const t = useTranslations("clients.detail");
  const query = useQuery({
    queryKey: clientKeys.detail(clientId),
    queryFn: ({ signal }) =>
      getClientDetail(clientId, { page: 1, limit: TRANSITIONS_LIMIT }, { signal }),
  });

  return {
    data: query.isError ? null : (query.data ?? null),
    error: query.isError ? getErrorMessage(query.error, t("loadError")) : null,
    loading: query.isFetching,
    reload: () => void query.refetch(),
    transitionsLimit: TRANSITIONS_LIMIT,
  };
}
