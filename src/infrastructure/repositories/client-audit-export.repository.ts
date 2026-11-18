import type { Prisma } from "@prisma/client";

import type { ClientAuditExportSources } from "@/application/ports/client-audit-export.port";
import { prisma } from "@/infrastructure/database/prisma";

const EXPORT_AUDIT_TAKE = 12000;
const EXPORT_TRANSITION_TAKE = 12000;

const stageTransitionTimelineInclude = {
  fromStage: { select: { id: true, name: true, stageKey: true } },
  toStage: { select: { id: true, name: true, stageKey: true } },
  actor: { select: { id: true, name: true, email: true } },
  forcedByUser: { select: { id: true, name: true, email: true } },
} satisfies Prisma.StageTransitionInclude;

export class ClientAuditExportPrismaRepository {
  async fetchSourcesForCsv(
    tenantId: string,
    clientId: string,
    from: Date,
    to: Date,
  ): Promise<ClientAuditExportSources> {
    const [audits, pathways] = await Promise.all([
      prisma.auditEvent.findMany({
        where: {
          tenantId,
          clientId,
          createdAt: { gte: from, lte: to },
        },
        orderBy: { createdAt: "desc" },
        take: EXPORT_AUDIT_TAKE,
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.patientPathway.findMany({
        where: { tenantId, clientId },
        select: { id: true },
      }),
    ]);

    const pathwayIds = pathways.map((p) => p.id);
    const transitions =
      pathwayIds.length === 0
        ? []
        : await prisma.stageTransition.findMany({
            where: {
              patientPathwayId: { in: pathwayIds },
              createdAt: { gte: from, lte: to },
            },
            orderBy: { createdAt: "desc" },
            take: EXPORT_TRANSITION_TAKE,
            include: stageTransitionTimelineInclude,
          });

    return { audits, transitions };
  }
}

export const clientAuditExportPrismaRepository = new ClientAuditExportPrismaRepository();
