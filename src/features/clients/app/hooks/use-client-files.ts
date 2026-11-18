"use client";

import { clientKeys } from "@/features/clients/app/hooks/query-keys";
import { listClientFiles } from "@/features/clients/app/services/clients.service";
import { getErrorMessage } from "@/lib/utils/error-message";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

const DEFAULT_LIMIT = 10;

export function useClientFiles(clientId: string) {
  const t = useTranslations("clients.detail.files");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: clientKeys.files(clientId, page),
    queryFn: ({ signal }) => listClientFiles(clientId, { page, limit: DEFAULT_LIMIT }, { signal }),
    placeholderData: keepPreviousData,
  });

  return {
    data: query.isError ? null : (query.data ?? null),
    error: query.isError ? getErrorMessage(query.error, t("loadError")) : null,
    loading: query.isFetching,
    page,
    setPage,
    reload: () => void query.refetch(),
    limit: DEFAULT_LIMIT,
  };
}
