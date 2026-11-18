import { logger } from "@/lib/observability/logger";
import { AuditEventType } from "@prisma/client";
import { resolvePathwayNotificationTargetUserIds } from "@/infrastructure/notifications/resolve-notification-targets";
import { enqueueEmailDispatch } from "@/infrastructure/email/email-dispatch-emitter";
import { notificationEmitter } from "@/infrastructure/notifications/notification-emitter";
import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { patientPathwayPrismaRepository } from "@/infrastructure/repositories/patient-pathway.repository";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { patchPatientChecklistItemBodySchema } from "@/lib/validators/patient-pathway-checklist";
import type { z } from "zod";

export type PatchPatientChecklistBody = z.infer<typeof patchPatientChecklistItemBodySchema>;

export type PatchChecklistItemResult =
  | {
      ok: true;
      item: {
        checklistItemId: string;
        completed: boolean;
        completedAt: string | null;
      };
    }
  | { ok: false; code: "PP_NOT_FOUND" | "ITEM_NOT_FOUND" | "WRONG_STAGE" };

export async function runPatchPatientChecklistItem(params: {
  tenantId: string;
  actorUserId: string;
  patientPathwayId: string;
  itemId: string;
  body: PatchPatientChecklistBody;
}): Promise<PatchChecklistItemResult> {
  const { tenantId, actorUserId, patientPathwayId, itemId, body: parsed } = params;

  const patientPathwayRow = await patientPathwayPrismaRepository.findSummaryForChecklist(
    tenantId,
    patientPathwayId,
  );
  if (!patientPathwayRow || typeof patientPathwayRow !== "object") {
    return { ok: false, code: "PP_NOT_FOUND" };
  }
  const patientPathway = patientPathwayRow as {
    id: string;
    clientId: string;
    currentStageId: string;
    pathwayVersionId: string;
  };

  const checklistItemRow = await patientPathwayPrismaRepository.findChecklistItemInPathwayVersion(
    itemId,
    patientPathway.pathwayVersionId,
  );
  if (!checklistItemRow || typeof checklistItemRow !== "object") {
    return { ok: false, code: "ITEM_NOT_FOUND" };
  }
  const checklistItem = checklistItemRow as { id: string; pathwayStageId: string };

  if (checklistItem.pathwayStageId !== patientPathway.currentStageId) {
    return { ok: false, code: "WRONG_STAGE" };
  }

  const completedAt = parsed.completed ? new Date() : null;
  const completedByUserId = parsed.completed ? actorUserId : null;

  const progress = await patientPathwayPrismaRepository.upsertPatientChecklistItemProgress({
    patientPathwayId: patientPathway.id,
    checklistItemId: checklistItem.id,
    completedAt,
    completedByUserId,
  });
  const p = progress as { checklistItemId: string; completedAt: Date | null };

  if (parsed.completed) {
    const requiredCount = await patientPathwayPrismaRepository.countRequiredChecklistItemsOnStage(
      patientPathway.currentStageId,
    );
    if (requiredCount > 0) {
      const completedRequired =
        await patientPathwayPrismaRepository.countCompletedRequiredChecklistItemsOnStage(
          patientPathway.id,
          patientPathway.currentStageId,
        );
      if (completedRequired >= requiredCount) {
        const pp = await patientPathwayPrismaRepository.findPatientPathwayForChecklistCompleteNotification(
          patientPathway.id,
        );
        if (pp && typeof pp === "object") {
          const row = pp as {
            tenantId: string;
            clientId: string;
            currentStageAssigneeUserId: string | null;
            client: { name: string };
            currentStage: { name: string };
          };
          const checklistTargets = await resolvePathwayNotificationTargetUserIds({
            tenantId,
            type: "checklist_complete",
            currentStageAssigneeUserId: row.currentStageAssigneeUserId,
          });
          const stageLabel = row.currentStage.name;
          const body = `Todos os ${requiredCount} itens obrigatórios da etapa "${stageLabel}" foram concluídos.`;
          notificationEmitter
            .emit({
              tenantId,
              type: "checklist_complete",
              title: `Checklist completo: ${row.client.name}`,
              body,
              targetUserIds: checklistTargets,
              correlationId: `${patientPathway.id}:${patientPathway.currentStageId}`,
              metadata: {
                clientId: row.clientId,
                patientPathwayId: patientPathway.id,
                stageName: row.currentStage.name,
                requiredItemsCompleted: requiredCount,
              },
            })
            .catch((err) => logger.error("[notification] checklist_complete emit failed", { err }));

          const tenant = await tenantPrismaRepository.findTenantNameAndSlugById(tenantId);
          const clinicName = tenant?.name?.trim() || "Clínica";
          if (checklistTargets.length > 0) {
            enqueueEmailDispatch(
              {
                kind: "checklist_complete_staff",
                tenantId,
                data: {
                  patientName: row.client.name,
                  stageName: row.currentStage.name,
                  totalRequiredItems: requiredCount,
                  clientId: row.clientId,
                  targetUserIds: checklistTargets,
                  clinicName,
                },
              },
              { jobId: `email|cl|${tenantId}|${patientPathway.id}|${patientPathway.currentStageId}`.replace(/:/g, "_") },
            ).catch((err) =>
              logger.error("[email] checklist_complete staff enqueue failed", { err }),
            );
          }
        }
      }
    }
  }

  await auditEventPrismaRepository.recordCanonical({
    tenantId,
    clientId: patientPathway.clientId,
    patientPathwayId: patientPathway.id,
    actorUserId,
    eventType: AuditEventType.CHECKLIST_ITEM_TOGGLED,
    payload: {
      itemId: checklistItem.id,
      checked: parsed.completed,
      userId: actorUserId,
    },
  });

  return {
    ok: true,
    item: {
      checklistItemId: p.checklistItemId,
      completed: p.completedAt != null,
      completedAt: p.completedAt?.toISOString() ?? null,
    },
  };
}
