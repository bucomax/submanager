import type { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

const SCAN_LIMIT = 5_000;

export class PathwaySummaryReportPrismaRepository {
  async fetchScanData(input: {
    tenantId: string;
    periodStart: Date;
    pathwayId?: string;
    opmeSupplierId?: string;
    /** Filtro de visibilidade de pacientes (RBAC) aplicado ao `client`. */
    clientVisibilityWhere: Prisma.ClientWhereInput;
  }) {
    const { tenantId, periodStart, pathwayId, opmeSupplierId, clientVisibilityWhere } = input;
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
      createdAt: { gte: periodStart },
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
          createdAt: { gte: periodStart },
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
