"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { pathwayKeys } from "@/features/pathways/app/hooks/query-keys";
import { listPathways } from "@/features/pathways/app/services/pathways.service";
import { isQueryLoading } from "@/shared/utils/query-loading";

export function usePathways() {
  const t = useTranslations("pathways.list");
  const query = useQuery({
    queryKey: pathwayKeys.list,
    queryFn: ({ signal }) => listPathways({ signal }),
  });
  const { refetch } = query;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    // `null` enquanto carrega; falha vira lista vazia (como antes).
    pathways: query.data ?? (query.isError ? [] : null),
    loading: isQueryLoading(query),
    error: query.error ? query.error.message || t("loadError") : null,
    reload,
  };
}
