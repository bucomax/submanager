import { prisma } from "@/infrastructure/database/prisma";
import type { TenantMembershipClientScope } from "@/domain/client/client-visibility";
import { mergeClientWhereWithVisibility } from "@/infrastructure/visibility/client-visibility-where";
import {
  buildClientsListBaseWhere,
  CLIENT_LIST_INCLUDE,
  reviveClientListRows,
  type ClientListRow,
} from "@/infrastructure/repositories/client-query-shapes";

type CachedClientsListArgs = {
  tenantId: string;
  viewerUserId: string;
  globalRole: string;
  scope: TenantMembershipClientScope;
  limit: number;
  page: number;
  q?: string;
  pathwayId?: string;
  stageId?: string;
};

async function loadClientsListPageFromDb(args: CachedClientsListArgs): Promise<{
  items: ClientListRow[];
  total: number;
}> {
  const { tenantId, viewerUserId, scope, limit, page, q, pathwayId, stageId } = args;
  const offset = (page - 1) * limit;
  const baseWhere = buildClientsListBaseWhere({ tenantId, q, pathwayId, stageId });
  const where = mergeClientWhereWithVisibility(baseWhere, scope, viewerUserId);
  const [items, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      include: CLIENT_LIST_INCLUDE,
    }),
    prisma.client.count({ where }),
  ]);
  return { items, total };
}

/**
 * Mesma consulta que a listagem em cache, **sem** `unstable_cache` — uso após mutações (ex.: exclusão lógica)
 * quando o cliente refaz o GET imediatamente e o tag pode ainda não refletir no cache incremental.
 */
export async function getClientsListPageWithoutCache(args: CachedClientsListArgs): Promise<{
  items: ClientListRow[];
  total: number;
}> {
  const raw = await loadClientsListPageFromDb(args);
  return {
    items: reviveClientListRows(raw.items),
    total: raw.total,
  };
}

