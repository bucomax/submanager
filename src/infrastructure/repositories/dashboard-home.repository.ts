import { Prisma } from "@prisma/client";

import type {
  DashboardClientVisibility,
  DayCount,
  IDashboardHomeRepository,
} from "@/application/ports/dashboard-home-repository.port";
import { prisma } from "@/infrastructure/database/prisma";
import { DASHBOARD_CHART_TIMEZONE } from "@/lib/utils/dashboard-chart-calendar";

type DayCountRow = { day: string; count: bigint };

/** Colunas `timestamp` (sem tz) guardam UTC; agrupa por dia civil no fuso do dashboard, no banco. */
function mapDayCounts(rows: DayCountRow[]): DayCount[] {
  return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
}

function clientWhereFromVisibility(visibility: DashboardClientVisibility): Prisma.ClientWhereInput {
  return {
    ...(visibility.opmeSupplierId ? { opmeSupplierId: visibility.opmeSupplierId } : {}),
    ...(visibility.assignedToUserId ? { assignedToUserId: visibility.assignedToUserId } : {}),
  };
}

/** JOIN em `Client` (alias `c`) aplicando o escopo do usuário; `PatientPathway` deve estar com alias `pp`. */
function clientVisibilityJoin(visibility: DashboardClientVisibility): Prisma.Sql {
  return Prisma.sql`JOIN "Client" c ON c."id" = pp."clientId"
        AND (${visibility.opmeSupplierId}::text IS NULL OR c."opmeSupplierId" = ${visibility.opmeSupplierId})
        AND (${visibility.assignedToUserId}::text IS NULL OR c."assignedToUserId" = ${visibility.assignedToUserId})`;
}

export class DashboardHomePrismaRepository implements IDashboardHomeRepository {
  async fetchPathwayOptions(tenantId: string) {
    return prisma.carePathway.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        versions: {
          where: { published: true },
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, version: true },
        },
      },
    });
  }

  async countActivePathways(tenantId: string, visibility: DashboardClientVisibility) {
    return prisma.patientPathway.count({
      where: { tenantId, completedAt: null, client: clientWhereFromVisibility(visibility) },
    });
  }

  async countTransitionsSince(tenantId: string, since: Date, visibility: DashboardClientVisibility) {
    return prisma.stageTransition.count({
      where: {
        createdAt: { gte: since },
        patientPathway: { tenantId, client: clientWhereFromVisibility(visibility) },
      },
    });
  }

  async countAwaitingAction(tenantId: string, staleThreshold: Date, visibility: DashboardClientVisibility) {
    return prisma.patientPathway.count({
      where: {
        tenantId,
        completedAt: null,
        updatedAt: { lte: staleThreshold },
        client: clientWhereFromVisibility(visibility),
      },
    });
  }

  async countCompletedSince(tenantId: string, since: Date, visibility: DashboardClientVisibility) {
    return prisma.patientPathway.count({
      where: {
        tenantId,
        completedAt: { gte: since },
        client: clientWhereFromVisibility(visibility),
      },
    });
  }

  async countTransitionsByDay(tenantId: string, since: Date, visibility: DashboardClientVisibility) {
    const rows = await prisma.$queryRaw<DayCountRow[]>`
      SELECT to_char((st."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${DASHBOARD_CHART_TIMEZONE}, 'YYYY-MM-DD') AS day,
             COUNT(*) AS count
      FROM "StageTransition" st
      JOIN "PatientPathway" pp ON pp."id" = st."patientPathwayId"
      ${clientVisibilityJoin(visibility)}
      WHERE pp."tenantId" = ${tenantId} AND st."createdAt" >= ${since}
      GROUP BY 1`;
    return mapDayCounts(rows);
  }

  async countPathwaysWithTransitionSince(tenantId: string, since: Date, visibility: DashboardClientVisibility) {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT st."patientPathwayId") AS count
      FROM "StageTransition" st
      JOIN "PatientPathway" pp ON pp."id" = st."patientPathwayId"
      ${clientVisibilityJoin(visibility)}
      WHERE pp."tenantId" = ${tenantId} AND st."createdAt" >= ${since}`;
    return Number(rows[0]?.count ?? 0);
  }

  async countCompletionsByDay(tenantId: string, since: Date, visibility: DashboardClientVisibility) {
    const rows = await prisma.$queryRaw<DayCountRow[]>`
      SELECT to_char((pp."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${DASHBOARD_CHART_TIMEZONE}, 'YYYY-MM-DD') AS day,
             COUNT(*) AS count
      FROM "PatientPathway" pp
      ${clientVisibilityJoin(visibility)}
      WHERE pp."tenantId" = ${tenantId} AND pp."completedAt" >= ${since}
      GROUP BY 1`;
    return mapDayCounts(rows);
  }

  async countStartsByDay(tenantId: string, since: Date, visibility: DashboardClientVisibility) {
    const rows = await prisma.$queryRaw<DayCountRow[]>`
      SELECT to_char((pp."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${DASHBOARD_CHART_TIMEZONE}, 'YYYY-MM-DD') AS day,
             COUNT(*) AS count
      FROM "PatientPathway" pp
      ${clientVisibilityJoin(visibility)}
      WHERE pp."tenantId" = ${tenantId} AND pp."createdAt" >= ${since}
      GROUP BY 1`;
    return mapDayCounts(rows);
  }
}

export const dashboardHomePrismaRepository = new DashboardHomePrismaRepository();
