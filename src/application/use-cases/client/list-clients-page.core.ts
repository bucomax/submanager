import type { Prisma } from "@prisma/client";

import type { IClientRepository } from "@/application/ports/client-repository.port";
import type { IClientVisibilityScopeReader } from "@/application/ports/client-visibility-scope-reader.port";
import type { IClientsListPageReader } from "@/application/ports/clients-list-page.port";
import type { Actor } from "@/domain/auth/actor";
import { buildPagination, type ApiPagination } from "@/lib/api/pagination";
import {
  buildClientsListBaseWhere,
  serializeClientListItem,
  type ClientListRow,
} from "@/application/use-cases/client/serialize-client-list";
import type { TenantMembershipClientScope } from "@/domain/client/client-visibility";
import type { ClientsListQuery } from "@/lib/validators/clients-list-query";

export type ListClientsPageDeps = {
  scopes: IClientVisibilityScopeReader;
  clients: Pick<IClientRepository, "findManyForClientsListScan">;
  listPage: IClientsListPageReader;
  /** Combina o filtro de listagem com a restrição de visibilidade do escopo (Prisma `where`). */
  visibleWhere: (
    base: Prisma.ClientWhereInput,
    scope: TenantMembershipClientScope,
    viewerUserId: string,
  ) => Prisma.ClientWhereInput;
};

/** Tamanho do lote quando o status SLA exige cálculo em memória (sem cache). */
const STATUS_FILTER_SCAN_BATCH = 400;

export type ListClientsPageSuccess = {
  data: ReturnType<typeof serializeClientListItem>[];
  pagination: ApiPagination;
  statusFilterCapped: boolean;
};

/**
 * Lista paginada de pacientes (dashboard): RBAC, filtro opcional por SLA/status em memória ou página SQL.
 */
export async function listClientsPage(
  params: { tenantId: string; actor: Actor; query: ClientsListQuery },
  deps: ListClientsPageDeps,
): Promise<ListClientsPageSuccess> {
  const { tenantId, actor, query } = params;
  const { limit, page, q, pathwayId, stageId, status: statusFilter } = query;

  const clientScope = await deps.scopes.loadScope(actor.userId, tenantId, actor.globalRole);

  const offset = (page - 1) * limit;
  const now = new Date();

  const baseWhere = buildClientsListBaseWhere({ tenantId, q, pathwayId, stageId });
  const where = deps.visibleWhere(baseWhere, clientScope, actor.userId);

  if (statusFilter) {
    const pageRows: ReturnType<typeof serializeClientListItem>[] = [];
    let matchedCount = 0;
    let skip = 0;

    while (true) {
      const batch = await deps.clients.findManyForClientsListScan({
        where,
        skip,
        take: STATUS_FILTER_SCAN_BATCH,
      });
      if (batch.length === 0) break;

      for (const client of batch) {
        const row = serializeClientListItem(client as ClientListRow, now);
        const matchesStatus =
          statusFilter === "completed"
            ? row.journeyCompletedAt != null
            : row.slaStatus === statusFilter;
        if (!matchesStatus) continue;
        if (matchedCount >= offset && pageRows.length < limit) {
          pageRows.push(row);
        }
        matchedCount += 1;
      }

      if (batch.length < STATUS_FILTER_SCAN_BATCH) break;
      skip += batch.length;
    }

    return {
      data: pageRows,
      pagination: buildPagination(page, limit, matchedCount),
      statusFilterCapped: false,
    };
  }

  const { items, total } = await deps.listPage.getPage({
    tenantId,
    viewerUserId: actor.userId,
    globalRole: actor.globalRole,
    scope: clientScope,
    limit,
    page,
    q,
    pathwayId,
    stageId,
  });

  return {
    data: items.map((c) => serializeClientListItem(c, now)),
    pagination: buildPagination(page, limit, total),
    statusFilterCapped: false,
  };
}
