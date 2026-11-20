import { logger } from "@/lib/observability/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { enqueueEmailDispatch } from "@/infrastructure/email/email-dispatch-emitter";
import { tomorrowWindowInClinicTz } from "@/lib/utils/clinic-datetime";

export type SurgeryReminderSweepSummary = {
  events: number;
  enqueued: number;
  failed: number;
  truncated: boolean;
};

const MAX_EVENTS_PER_SWEEP = 2000;

/** Itens obrigatórios do checklist da etapa atual que ainda não foram concluídos pelo paciente. */
async function countPendingRequiredItems(patientPathwayId: string, stageId: string): Promise<number> {
  const required = await prisma.pathwayStageChecklistItem.findMany({
    where: { pathwayStageId: stageId, requiredForTransition: true },
    select: { id: true },
  });
  if (required.length === 0) return 0;
  const done = await prisma.patientPathwayChecklistItem.count({
    where: {
      patientPathwayId,
      checklistItemId: { in: required.map((r) => r.id) },
      completedAt: { not: null },
    },
  });
  return Math.max(required.length - done, 0);
}

/**
 * Véspera de cirurgia: para cada compromisso do tipo `cirurgia` que começa amanhã (fuso da clínica),
 * envia lembrete por e-mail ao responsável pelo compromisso e ao responsável pela etapa atual do paciente.
 * Só tenants ativos com `notifySurgeryReminders`. Pensado para rodar uma vez por dia (fim da tarde).
 */
export async function runSurgeryReminderSweep(options: {
  budgetMs: number;
  now?: Date;
}): Promise<SurgeryReminderSweepSummary> {
  const deadline = Date.now() + options.budgetMs;
  const window = tomorrowWindowInClinicTz(options.now ?? new Date());

  const events = await prisma.agendaEvent.findMany({
    where: {
      type: "cirurgia",
      startsAt: { gte: window.start, lt: window.end },
      tenant: { isActive: true, notifySurgeryReminders: true },
    },
    orderBy: { startsAt: "asc" },
    take: MAX_EVENTS_PER_SWEEP,
    select: {
      id: true,
      tenantId: true,
      title: true,
      startsAt: true,
      durationMin: true,
      notes: true,
      ownerUserId: true,
      clientId: true,
      tenant: { select: { name: true } },
      client: { select: { name: true, deletedAt: true } },
    },
  });

  let enqueued = 0;
  let failed = 0;
  let truncated = false;

  for (const ev of events) {
    if (Date.now() >= deadline) {
      truncated = true;
      break;
    }
    try {
      const client = ev.client && !ev.client.deletedAt ? ev.client : null;
      const clientId = client ? ev.clientId : null;

      const pathway = clientId
        ? await prisma.patientPathway.findFirst({
            where: { tenantId: ev.tenantId, clientId, completedAt: null },
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              currentStageAssigneeUserId: true,
              currentStage: { select: { id: true, name: true } },
            },
          })
        : null;

      const candidates = [ev.ownerUserId, pathway?.currentStageAssigneeUserId].filter(
        (id): id is string => Boolean(id),
      );
      const members = await prisma.tenantMembership.findMany({
        where: { tenantId: ev.tenantId, userId: { in: [...new Set(candidates)] } },
        select: { userId: true },
      });
      const targetUserIds = members.map((m) => m.userId);
      if (targetUserIds.length === 0) continue;

      const pendingRequiredItems = pathway
        ? await countPendingRequiredItems(pathway.id, pathway.currentStage.id)
        : null;

      await enqueueEmailDispatch(
        {
          kind: "surgery_reminder_staff",
          tenantId: ev.tenantId,
          data: {
            eventId: ev.id,
            eventTitle: ev.title,
            patientName: client?.name?.trim() || ev.title,
            startsAtIso: ev.startsAt.toISOString(),
            durationMin: ev.durationMin,
            notes: ev.notes,
            stageName: pathway?.currentStage.name ?? null,
            pendingRequiredItems,
            clientId,
            targetUserIds,
            clinicName: ev.tenant.name?.trim() || "Clínica",
          },
        },
        { jobId: `email|surgery|${ev.id}|${window.dayKey}` },
      );
      enqueued += 1;
    } catch (err) {
      failed += 1;
      logger.error("[surgery-reminder] event failed", { eventId: ev.id, err });
    }
  }

  return { events: events.length, enqueued, failed, truncated };
}
