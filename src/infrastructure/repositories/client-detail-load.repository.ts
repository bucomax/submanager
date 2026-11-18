import type { Prisma } from "@prisma/client";

import {
  clientDetailPatientPathwaySelect,
  MAX_COMPLETED_TRANSITIONS,
} from "@/infrastructure/repositories/client-query-shapes";
import { prisma } from "@/infrastructure/database/prisma";

const stageTransitionDetailInclude = {
  fromStage: { select: { id: true, name: true, stageKey: true } },
  toStage: { select: { id: true, name: true, stageKey: true } },
  actor: { select: { id: true, name: true, email: true } },
  forcedByUser: { select: { id: true, name: true, email: true } },
} satisfies Prisma.StageTransitionInclude;

/**
 * Queries da ficha do paciente (`loadClientDetailResponseData`) — isoladas para o use case não depender de Prisma.
 */
export const clientDetailLoadPrismaRepository = {
  async loadActiveAndCompletedPathways(tenantId: string, clientId: string) {
    return Promise.all([
      prisma.patientPathway.findFirst({
        where: { clientId, tenantId, completedAt: null },
        orderBy: { updatedAt: "desc" },
        select: clientDetailPatientPathwaySelect,
      }),
      prisma.patientPathway.findMany({
        where: { clientId, tenantId, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        select: clientDetailPatientPathwaySelect,
      }),
    ]);
  },

  async loadCompletedTransitionBatches(completedPpIds: string[]) {
    return Promise.all(
      completedPpIds.map((ppId) =>
        prisma.stageTransition.findMany({
          where: { patientPathwayId: ppId },
          orderBy: { createdAt: "asc" },
          take: MAX_COMPLETED_TRANSITIONS + 1,
          include: stageTransitionDetailInclude,
        }),
      ),
    );
  },

  async loadActivePathwayTransitionPage(
    patientPathwayId: string,
    currentStageId: string,
    offset: number,
    limit: number,
  ) {
    return Promise.all([
      prisma.stageTransition.count({ where: { patientPathwayId } }),
      prisma.stageTransition.findMany({
        where: { patientPathwayId },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: stageTransitionDetailInclude,
      }),
      prisma.stageTransition.findFirst({
        where: { patientPathwayId, toStageId: currentStageId },
        orderBy: { createdAt: "desc" },
        include: stageTransitionDetailInclude,
      }),
    ]);
  },
};
