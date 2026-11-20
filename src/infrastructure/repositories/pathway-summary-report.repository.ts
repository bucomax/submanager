import type { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

const SCAN_LIMIT = 5_000;

export class PathwaySummaryReportPrismaRepository {
  async fetchScanData(input: {
    tenantId: string;
    periodStart: Date;
    /** Fim exclusivo do período; sem ele, o período é aberto (até agora). */
    periodEnd?: Date;
    pathwayId?: string;
    opmeSupplierId?: string;
    /** Filtro de visibilidade de pacientes (RBAC) aplicado ao `client`. */
    clientVisibilityWhere: Prisma.ClientWhereInput;
  }) {
    const { tenantId, periodStart, periodEnd, pathwayId, opmeSupplierId, clientVisibilityWhere } = input;
    const createdInPeriod = { gte: periodStart, ...(periodEnd ? { lt: periodEnd } : {}) };
    const clientWhere: Prisma.ClientWhereInput = {
      AND: [
        {
          deletedAt: null,
          ...(opmeSupplierId ? { opmeSupplierId } : {}),
        },
        clientVisibilityWhere,
      ],
    };

    const patientPathwayWhere = {
      tenantId,
      createdAt: createdInPeriod,
      ...(pathwayId ? { pathwayId } : {}),
      client: clientWhere,
    };

    const [rows, transitionsInPeriod] = await Promise.all([
      prisma.patientPathway.findMany({
        where: patientPathwayWhere,
        take: SCAN_LIMIT,
        select: {
          id: true,
          enteredStageAt: true,
          pathway: {
            select: {
              id: true,
              name: true,
            },
          },
          currentStage: {
            select: {
              id: true,
              name: true,
              sortOrder: true,
              alertWarningDays: true,
              alertCriticalDays: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              phone: true,
              opmeSupplier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.stageTransition.count({
        where: {
          createdAt: createdInPeriod,
          patientPathway: {
            tenantId,
            ...(pathwayId ? { pathwayId } : {}),
            client: clientWhere,
          },
        },
      }),
    ]);

    return { rows, transitionsInPeriod };
  }
}

export const pathwaySummaryReportPrismaRepository = new PathwaySummaryReportPrismaRepository();
