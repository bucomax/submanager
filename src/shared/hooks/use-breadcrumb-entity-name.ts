"use client";

import { useQuery } from "@tanstack/react-query";
import { defineKeys } from "@/shared/lib/query/query-keys";
import { fetchBreadcrumbEntityName, type BreadcrumbEntityKind } from "@/shared/services/breadcrumb.service";

const breadcrumbKeys = defineKeys("breadcrumb");

const ENTITY_KINDS: readonly string[] = ["clients", "pathways", "patient-pathways"];

/**
 * Resolve o ID do 2º segmento (`/dashboard/<kind>/<id>`) para um nome legível.
 * Falha (401/404) mantém o segmento bruto: devolve `null`.
 */
export function useBreadcrumbEntityName(segments: string[]): string | null {
  const [first, second] = segments;
  const enabled = segments.length === 2 && ENTITY_KINDS.includes(first ?? "") && Boolean(second) && second !== "new";

  const query = useQuery({
    queryKey: breadcrumbKeys.scope(first, second),
    queryFn: ({ signal }) => fetchBreadcrumbEntityName(first as BreadcrumbEntityKind, second!, { signal }),
    enabled,
    // O nome pode mudar por edição (cliente/fluxo renomeado): rebusca a cada navegação.
    staleTime: 0,
  });

  return enabled ? (query.data ?? null) : null;
}
