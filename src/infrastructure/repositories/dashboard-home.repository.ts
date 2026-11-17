import type { DayCount, IDashboardHomeRepository } from "@/application/ports/dashboard-home-repository.port";
import { prisma } from "@/infrastructure/database/prisma";
import { DASHBOARD_CHART_TIMEZONE } from "@/lib/utils/dashboard-chart-calendar";

type DayCountRow = { day: string; count: bigint };

/** Colunas `timestamp` (sem tz) guardam UTC; agrupa por dia civil no fuso do dashboard, no banco. */
function mapDayCounts(rows: DayCountRow[]): DayCount[] {
  return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
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

  async countActivePathways(tenantId: string) {
    return prisma.patientPathway.count({
      where: { tenantId, completedAt: null },
    });
  }

  async countTransitionsSince(tenantId: string, since: Date) {
    return prisma.stageTransition.count({
      where: {
        createdAt: { gte: since },
        patientPathway: { tenantId },
      },
    });
  }

  async countAwaitingAction(tenantId: string, staleThreshold: Date) {
    return prisma.patientPathway.count({
      where: {
        tenantId,
        completedAt: null,
        updatedAt: { lte: staleThreshold },
      },
    });
  }

  async countCompletedSince(tenantId: string, since: Date) {
    return prisma.patientPathway.count({
      where: {
        tenantId,
        completedAt: { gte: since },
      },
    });
  }

  async countTransitionsByDay(tenantId: string, since: Date) {
    const rows = await prisma.$queryRaw<DayCountRow[]>`
      SELECT to_char((st."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${DASHBOARD_CHART_TIMEZONE}, 'YYYY-MM-DD') AS day,
             COUNT(*) AS count
      FROM "StageTransition" st
      JOIN "PatientPathway" pp ON pp."id" = st."patientPathwayId"
      WHERE pp."tenantId" = ${tenantId} AND st."createdAt" >= ${since}
      GROUP BY 1`;
    return mapDayCounts(rows);
  }

  async countPathwaysWithTransitionSince(tenantId: string, since: Date) {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT st."patientPathwayId") AS count
      FROM "StageTransition" st
      JOIN "PatientPathway" pp ON pp."id" = st."patientPathwayId"
      WHERE pp."tenantId" = ${tenantId} AND st."createdAt" >= ${since}`;
    return Number(rows[0]?.count ?? 0);
  }

  async countCompletionsByDay(tenantId: string, since: Date) {
    const rows = await prisma.$queryRaw<DayCountRow[]>`
      SELECT to_char((pp."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${DASHBOARD_CHART_TIMEZONE}, 'YYYY-MM-DD') AS day,
             COUNT(*) AS count
      FROM "PatientPathway" pp
      WHERE pp."tenantId" = ${tenantId} AND pp."completedAt" >= ${since}
      GROUP BY 1`;
    return mapDayCounts(rows);
  }

  async countStartsByDay(tenantId: string, since: Date) {
    const rows = await prisma.$queryRaw<DayCountRow[]>`
      SELECT to_char((pp."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${DASHBOARD_CHART_TIMEZONE}, 'YYYY-MM-DD') AS day,
             COUNT(*) AS count
      FROM "PatientPathway" pp
      WHERE pp."tenantId" = ${tenantId} AND pp."createdAt" >= ${since}
      GROUP BY 1`;
    return mapDayCounts(rows);
  }
}

export const dashboardHomePrismaRepository = new DashboardHomePrismaRepository();
