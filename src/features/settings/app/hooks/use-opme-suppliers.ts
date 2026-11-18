"use client";

import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isQueryLoading } from "@/shared/utils/query-loading";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { settingsKeys } from "@/features/settings/app/hooks/query-keys";
import {
  createOpmeSupplier,
  listOpmeSuppliers,
} from "@/features/settings/app/services/tenant-settings.service";
import type { ApiPagination } from "@/lib/api/pagination";
import { useDebouncedState } from "@/shared/hooks/use-debounce";

const PAGE_SIZE = 10;

const EMPTY_PAGINATION: ApiPagination = {
  page: 1,
  limit: PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

export function useOpmeSuppliers() {
  const t = useTranslations("settings.opme");
  const { data: session, status: sessionStatus } = useSession();
  const queryClient = useQueryClient();
  const [query, debouncedQuery, setQuery] = useDebouncedState("", { trim: true });
  // A página vale só para a busca em que foi escolhida: trocar a busca volta para a 1ª sem efeito.
  const [pageState, setPageState] = useState({ query: "", page: 1 });
  const page = pageState.query === debouncedQuery ? pageState.page : 1;
  const setPage = useCallback(
    (next: number | ((current: number) => number)) =>
      setPageState((prev) => {
        const current = prev.query === debouncedQuery ? prev.page : 1;
        return { query: debouncedQuery, page: typeof next === "function" ? next(current) : next };
      }),
    [debouncedQuery],
  );

  const canCreate =
    session?.user?.tenantRole === "tenant_admin" || session?.user?.globalRole === "super_admin";

  const list = useQuery({
    queryKey: settingsKeys.opme({ page, q: debouncedQuery || undefined }),
    queryFn: ({ signal }) =>
      listOpmeSuppliers(
        { page, limit: PAGE_SIZE, q: debouncedQuery || undefined, includeInactive: true },
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
  const { refetch } = list;

  const rows = useMemo(() => list.data?.data ?? [], [list.data]);
  const pagination = list.data?.pagination ?? EMPTY_PAGINATION;

  const rangeLabel = useMemo(() => {
    if (pagination.totalItems === 0) {
      return t("range", { from: 0, to: 0, total: 0 });
    }
    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(from + rows.length - 1, pagination.totalItems);
    return t("range", { from, to, total: pagination.totalItems });
  }, [pagination, rows.length, t]);

  const createMutation = useMutation({
    mutationFn: (name: string) => createOpmeSupplier(name),
    onSuccess: () => {
      setPage(1);
      // Também invalida os pickers (clientes) que listam fornecedores.
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKeys.opmeAll }),
        queryClient.invalidateQueries({ queryKey: settingsKeys.pickers }),
      ]);
    },
  });
  const { mutateAsync: createAsync } = createMutation;

  const createSupplier = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      await createAsync(trimmed);
    },
    [createAsync],
  );

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    sessionStatus,
    canCreate,
    query,
    setQuery,
    page,
    setPage,
    rows,
    loading: isQueryLoading(list),
    error: list.error ? list.error.message || t("listError") : null,
    pagination,
    rangeLabel,
    creating: createMutation.isPending,
    reload,
    createSupplier,
  };
}
