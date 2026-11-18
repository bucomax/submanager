import { prisma } from "@/infrastructure/database/prisma";
import { resolvePathwayNotificationTargetUserIds } from "@/infrastructure/notifications/resolve-notification-targets";
import { notificationEmitter } from "@/infrastructure/notifications/notification-emitter";

/**
 * Após aprovação/rejeição de documento do portal, notifica responsáveis (assignee + admins),
 * excluindo o ator.
 */
export async function emitFileReviewDecidedStaffNotification(input: {
  tenantId: string;
  clientId: string;
  clientName: string;
  fileId: string;
  fileName: string;
  decision: "approve" | "reject";
  rejectReason?: string;
  actorUserId: string;
}): Promise<void> {
  const pp = await prisma.patientPathway.findFirst({
    where: { tenantId: input.tenantId, clientId: input.clientId, completedAt: null },
    select: { id: true, currentStageAssigneeUserId: true },
  });

  const raw = await resolvePathwayNotificationTargetUserIds({
    tenantId: input.tenantId,
    type: "patient_portal_file_pending",
    currentStageAssigneeUserId: pp?.currentStageAssigneeUserId ?? null,
  });
  const targetUserIds = raw.filter((id) => id !== input.actorUserId);
  if (targetUserIds.length === 0) return;

  const isApprove = input.decision === "approve";
  const title = isApprove
    ? `Documento aprovado: ${input.fileName} (${input.clientName})`
    : `Documento devolvido: ${input.fileName} (${input.clientName})`;
  const body =
    !isApprove && input.rejectReason?.trim() ? `Motivo: ${input.rejectReason.trim()}` : undefined;

  await notificationEmitter.emit({
    tenantId: input.tenantId,
    type: "patient_portal_file_pending",
    title,
    body,
    targetUserIds,
    correlationId: `file-review:${input.fileId}`,
    metadata: {
      clientId: input.clientId,
      fileId: input.fileId,
      decision: input.decision,
      ...(pp ? { patientPathwayId: pp.id } : {}),
    },
  });
}
