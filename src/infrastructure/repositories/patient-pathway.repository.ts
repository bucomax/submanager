import type { Prisma } from "@prisma/client";

import type {
  CreateStageTransitionInput,
  IPatientPathwayRepository,
} from "@/application/ports/patient-pathway-repository.port";
import { prisma } from "@/infrastructure/database/prisma";

export class PatientPathwayPrismaRepository implements IPatientPathwayRepository {
  async findById(tenantId: string, patientPathwayId: string) {
    return prisma.patientPathway.findFirst({
      where: { id: patientPathwayId, tenantId },
      include: {
        client: { select: { id: true, name: true, phone: true, tenantId: true } },
        pathway: { select: { id: true, name: true, tenantId: true } },
        pathwayVersion: { select: { id: true, version: true, published: true } },
        currentStage: true,
      },
    });
  }

  /** Existe no tenant e o paciente passa no filtro de visibilidade (RBAC). */
  async existsWithClientWhere(
    tenantId: string,
    patientPathwayId: string,
    clientWhere: Prisma.ClientWhereInput,
  ): Promise<boolean> {
    const row = await prisma.patientPathway.findFirst({
      where: { id: patientPathwayId, tenantId, client: clientWhere },
      select: { id: true },
    });
    return row != null;
  }

  async findActive(tenantId: string, clientId: string) {
    return prisma.patientPathway.findMany({
      where: { tenantId, clientId, completedAt: null },
      orderBy: { updatedAt: "desc" },
    });
  }

  async findCompleted(tenantId: string, clientId: string) {
    return prisma.patientPathway.findMany({
      where: { tenantId, clientId, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
    });
  }

  async update(tenantId: string, patientPathwayId: string, patch: Record<string, unknown>) {
    const existing = await prisma.patientPathway.findFirst({
      where: { id: patientPathwayId, tenantId },
      select: { id: true },
    });
    if (!existing) return null;

    return prisma.patientPathway.update({
      where: { id: patientPathwayId },
      data: patch as Prisma.PatientPathwayUpdateInput,
    });
  }

  async createTransition(input: CreateStageTransitionInput) {
    const pp = await prisma.patientPathway.findFirst({
      where: { id: input.patientPathwayId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!pp) {
      throw new Error("Patient pathway not found for tenant");
    }

    const row = await prisma.stageTransition.create({
      data: {
        patientPathwayId: input.patientPathwayId,
        fromStageId: input.fromStageId,
        toStageId: input.toStageId,
        actorUserId: input.actorUserId,
        note: input.note ?? null,
        forcedByUserId: input.forcedByUserId ?? null,
        ruleOverrideReason: input.ruleOverrideReason ?? null,
      },
      select: { id: true },
    });
    return row;
  }

  async findSummaryForChecklist(tenantId: string, patientPathwayId: string) {
    return prisma.patientPathway.findFirst({
      where: { id: patientPathwayId, tenantId },
      select: { id: true, clientId: true, currentStageId: true, pathwayVersionId: true },
    });
  }

  async findChecklistItemInPathwayVersion(itemId: string, pathwayVersionId: string) {
    return prisma.pathwayStageChecklistItem.findFirst({
      where: {
        id: itemId,
        pathwayStage: { pathwayVersionId },
      },
      select: { id: true, pathwayStageId: true },
    });
  }

  async upsertPatientChecklistItemProgress(params: {
    patientPathwayId: string;
    checklistItemId: string;
    completedAt: Date | null;
    completedByUserId: string | null;
  }) {
    const { patientPathwayId, checklistItemId, completedAt, completedByUserId } = params;
    return prisma.patientPathwayChecklistItem.upsert({
      where: {
        patientPathwayId_checklistItemId: {
          patientPathwayId,
          checklistItemId,
        },
      },
      update: { completedAt, completedByUserId },
      create: {
        patientPathwayId,
        checklistItemId,
        completedAt,
        completedByUserId,
      },
      select: { checklistItemId: true, completedAt: true },
    });
  }

  async countChecklistItemsOnStage(pathwayStageId: string) {
    return prisma.pathwayStageChecklistItem.count({
      where: { pathwayStageId },
    });
  }

  async countCompletedChecklistItemsOnStage(patientPathwayId: string, pathwayStageId: string) {
    return prisma.patientPathwayChecklistItem.count({
      where: {
        patientPathwayId,
        checklistItem: { pathwayStageId },
        completedAt: { not: null },
      },
    });
  }

  async countRequiredChecklistItemsOnStage(pathwayStageId: string) {
    return prisma.pathwayStageChecklistItem.count({
      where: { pathwayStageId, requiredForTransition: true },
    });
  }

  async countCompletedRequiredChecklistItemsOnStage(
    patientPathwayId: string,
    pathwayStageId: string,
  ) {
    return prisma.patientPathwayChecklistItem.count({
      where: {
        patientPathwayId,
        completedAt: { not: null },
        checklistItem: { pathwayStageId, requiredForTransition: true },
      },
    });
  }

  async findPatientPathwayForChecklistCompleteNotification(patientPathwayId: string) {
    return prisma.patientPathway.findUnique({
      where: { id: patientPathwayId },
      select: {
        tenantId: true,
        clientId: true,
        currentStageAssigneeUserId: true,
        client: { select: { name: true } },
        currentStage: { select: { name: true } },
      },
    });
  }

  async listChannelDispatchesForPatientPathway(tenantId: string, patientPathwayId: string) {
    const pp = await prisma.patientPathway.findFirst({
      where: { id: patientPathwayId, tenantId },
      select: { id: true },
    });
    if (!pp) {
      return null;
    }

    return prisma.channelDispatch.findMany({
      where: {
        stageTransition: { patientPathwayId },
        tenantId,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        stageTransitionId: true,
        channel: true,
        status: true,
        externalMessageId: true,
        recipientPhone: true,
        documentFileName: true,
        errorDetail: true,
        sentAt: true,
        deliveredAt: true,
        readAt: true,
        confirmedAt: true,
        confirmationPayload: true,
        createdAt: true,
      },
    });
  }

  async loadPatientPathwayDetailPayload(tenantId: string, patientPathwayId: string) {
    const row = await prisma.patientPathway.findFirst({
      where: { id: patientPathwayId, tenantId },
      include: {
        client: { select: { id: true, name: true, phone: true, caseDescription: true } },
        pathway: { select: { id: true, name: true, description: true } },
        pathwayVersion: {
          select: {
            id: true,
            version: true,
            stages: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                name: true,
                stageKey: true,
                sortOrder: true,
                alertWarningDays: true,
                alertCriticalDays: true,
                defaultAssigneeUserId: true,
              },
            },
          },
        },
        currentStage: true,
        currentStageAssignee: { select: { id: true, name: true, email: true } },
        transitions: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            fromStage: { select: { id: true, name: true, stageKey: true } },
            toStage: { select: { id: true, name: true, stageKey: true } },
            actor: { select: { id: true, name: true, email: true } },
            forcedByUser: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    const [checklistTemplate, checklistProgress] = await Promise.all([
      prisma.pathwayStageChecklistItem.findMany({
        where: { pathwayStageId: row.currentStageId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, label: true, requiredForTransition: true },
      }),
      prisma.patientPathwayChecklistItem.findMany({
        where: { patientPathwayId: row.id },
        select: { checklistItemId: true, completedAt: true },
      }),
    ]);
    const completedAtByItemId = new Map(
      checklistProgress.map((p) => [p.checklistItemId, p.completedAt]),
    );
    const currentStageChecklist = checklistTemplate.map((ci) => {
      const completedAt = completedAtByItemId.get(ci.id) ?? null;
      return {
        id: ci.id,
        label: ci.label,
        requiredForTransition: ci.requiredForTransition,
        completed: completedAt != null,
        completedAt: completedAt?.toISOString() ?? null,
      };
    });

    return {
      patientPathway: {
        id: row.id,
        client: row.client,
        pathway: row.pathway,
        pathwayVersion: row.pathwayVersion,
        currentStage: row.currentStage,
        currentStageAssignee: row.currentStageAssignee
          ? {
              id: row.currentStageAssignee.id,
              name: row.currentStageAssignee.name,
              email: row.currentStageAssignee.email,
            }
          : null,
        currentStageChecklist,
        transitions: row.transitions.map((tr) => ({
          id: tr.id,
          fromStage: tr.fromStage,
          toStage: tr.toStage,
          note: tr.note,
          ruleOverrideReason: tr.ruleOverrideReason,
          forcedBy: tr.forcedByUser
            ? {
                id: tr.forcedByUser.id,
                name: tr.forcedByUser.name,
                email: tr.forcedByUser.email,
              }
            : null,
          actor: {
            id: tr.actor.id,
            name: tr.actor.name,
            email: tr.actor.email,
          },
          dispatchStub: tr.dispatchStub,
          createdAt: tr.createdAt.toISOString(),
        })),
        enteredStageAt: row.enteredStageAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  async findForCompletion(tenantId: string, patientPathwayId: string) {
    return prisma.patientPathway.findFirst({
      where: { id: patientPathwayId, tenantId },
      select: { id: true, completedAt: true, clientId: true },
    });
  }

  async completePatientPathwayWithSnapshot(tenantId: string, patientPathwayId: string) {
    const res = await prisma.patientPathway.updateMany({
      where: { id: patientPathwayId, tenantId, completedAt: null },
      data: { completedAt: new Date() },
    });
    if (res.count === 0) {
      return null;
    }
    const row = await prisma.patientPathway.findFirst({
      where: { id: patientPathwayId, tenantId },
      select: {
        id: true,
        completedAt: true,
        client: { select: { id: true, name: true } },
        pathway: { select: { id: true, name: true } },
        currentStage: { select: { id: true, name: true } },
      },
    });
    if (!row?.completedAt) {
      return null;
    }
    return {
      id: row.id,
      completedAt: row.completedAt,
      client: row.client,
      pathway: row.pathway,
      currentStage: row.currentStage,
    };
  }

  async runInTransaction<T>(fn: (tx: unknown) => Promise<T>) {
    return prisma.$transaction(fn as (tx: Prisma.TransactionClient) => Promise<T>);
  }

  async findForStageTransition(tenantId: string, patientPathwayId: string) {
    return prisma.patientPathway.findFirst({
      where: { id: patientPathwayId, tenantId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true, assignedToUserId: true } },
        currentStage: { select: { id: true, name: true, stageKey: true } },
      },
    });
  }

  async countPatientPathwaysWhere(where: unknown) {
    return prisma.patientPathway.count({
      where: where as Prisma.PatientPathwayWhereInput,
    });
  }

  async findManyPatientPathwaysQuery(params: {
    where: unknown;
    skip?: number;
    take?: number;
    orderBy?: unknown;
    include?: unknown;
    select?: unknown;
  }) {
    const args: Prisma.PatientPathwayFindManyArgs = {
      where: params.where as Prisma.PatientPathwayWhereInput,
    };
    if (params.skip !== undefined) args.skip = params.skip;
    if (params.take !== undefined) args.take = params.take;
    if (params.orderBy !== undefined) {
      args.orderBy = params.orderBy as Prisma.PatientPathwayOrderByWithRelationInput | Prisma.PatientPathwayOrderByWithRelationInput[];
    }
    if (params.include !== undefined) {
      args.include = params.include as Prisma.PatientPathwayInclude;
    }
    if (params.select !== undefined) {
      args.select = params.select as Prisma.PatientPathwaySelect;
    }
    return prisma.patientPathway.findMany(args);
  }

  async findFirstActivePatientPathwayByClientId(clientId: string) {
    return prisma.patientPathway.findFirst({
      where: { clientId, completedAt: null },
      select: { id: true },
    });
  }

  async findActiveAssigneeByClientId(tenantId: string, clientId: string) {
    return prisma.patientPathway.findFirst({
      where: { tenantId, clientId, completedAt: null },
      select: { id: true, currentStageAssigneeUserId: true },
    });
  }
}

export const patientPathwayPrismaRepository = new PatientPathwayPrismaRepository();
