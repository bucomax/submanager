import { logger } from "@/lib/observability/logger";
import type { INotificationEmitter } from "@/application/ports/notification-emitter.port";
import type { IEmailDispatchQueue, IWhatsAppDispatchQueue } from "@/application/ports/dispatch-queues.port";
import type { INotificationTargetResolver } from "@/application/ports/notification-target-resolver.port";
import type { ITenantProfileReader } from "@/application/ports/tenant-profile-reader.port";
import type { StageDocumentBundleItem } from "@/domain/pathway/stage-document-bundle";

export type TransitionPostCommitContext = {
  tenantId: string;
  transitionId: string;
  /** Usuário que fez a transição (recebe a confirmação de envio dos documentos). */
  actorUserId: string;
  patientPathwayId: string;
  fromStageId: string;
  toStage: { id: string; name: string; patientMessage: string | null };
  client: { id: string; name: string; email: string | null; phone: string | null };
  currentStageAssigneeUserId: string | null;
  documents: StageDocumentBundleItem[];
};

export type TransitionPostCommitDeps = {
  notificationTargets: INotificationTargetResolver;
  notifications: INotificationEmitter;
  tenants: ITenantProfileReader;
  emailQueue: IEmailDispatchQueue;
  whatsappQueue: IWhatsAppDispatchQueue;
  /** URL pública da aplicação (portal do paciente). */
  getPublicAppUrl: () => string;
};

async function notifyStaff(
  ctx: TransitionPostCommitContext,
  deps: TransitionPostCommitDeps,
): Promise<void> {
  const targetUserIds = await deps.notificationTargets.resolveForPathway({
    tenantId: ctx.tenantId,
    type: "stage_transition",
    currentStageAssigneeUserId: ctx.currentStageAssigneeUserId,
  });
  await deps.notifications.emit({
    tenantId: ctx.tenantId,
    type: "stage_transition",
    title: `${ctx.client.name} avançou para ${ctx.toStage.name}`,
    targetUserIds,
    correlationId: `${ctx.patientPathwayId}:${ctx.toStage.id}:${ctx.transitionId}`,
    metadata: {
      clientId: ctx.client.id,
      patientPathwayId: ctx.patientPathwayId,
      fromStageId: ctx.fromStageId,
      toStageId: ctx.toStage.id,
      stageName: ctx.toStage.name,
    },
  });
}

async function emailPatient(
  ctx: TransitionPostCommitContext,
  deps: TransitionPostCommitDeps,
): Promise<void> {
  const clientEmail = ctx.client.email?.trim();
  if (!clientEmail) return;
  const tenantRow = await deps.tenants.findNameAndSlug(ctx.tenantId);
  const slug = tenantRow?.slug?.trim() ?? "";
  if (!slug) return;
  const portalUrl = `${deps.getPublicAppUrl()}/${encodeURIComponent(slug)}/patient/login`;
  await deps.emailQueue.enqueueStageTransitionPatientEmail({
    tenantId: ctx.tenantId,
    to: clientEmail,
    data: {
      patientName: ctx.client.name,
      stageName: ctx.toStage.name,
      patientMessage: ctx.toStage.patientMessage,
      documents: ctx.documents.map((d) => ({ fileName: d.file.fileName })),
      portalUrl,
      clinicName: tenantRow?.name?.trim() || "Clínica",
    },
    // O id da transição evita que reentrar numa etapa já visitada seja deduplicado.
    jobId: `email|st|${ctx.tenantId}|${ctx.patientPathwayId}|${ctx.toStage.id}|${ctx.transitionId}`.replace(
      /:/g,
      "_",
    ),
  });
}

async function whatsAppPatient(
  ctx: TransitionPostCommitContext,
  deps: TransitionPostCommitDeps,
): Promise<void> {
  if (ctx.documents.length === 0 || !ctx.client.phone) return;
  await deps.whatsappQueue.enqueue({
    tenantId: ctx.tenantId,
    stageTransitionId: ctx.transitionId,
    clientId: ctx.client.id,
    recipientPhone: ctx.client.phone,
    stageName: ctx.toStage.name,
    documents: ctx.documents.map((d) => ({
      fileName: d.file.fileName,
      r2Key: d.file.r2Key,
      mimeType: d.file.mimeType,
    })),
  });
}

async function confirmDocumentDelivery(
  ctx: TransitionPostCommitContext,
  deps: TransitionPostCommitDeps,
): Promise<void> {
  if (ctx.documents.length === 0) return;
  await deps.emailQueue.enqueueDocumentDeliveryStaffEmail({
    tenantId: ctx.tenantId,
    transitionId: ctx.transitionId,
    candidateUserIds: [ctx.actorUserId, ctx.currentStageAssigneeUserId].filter((id): id is string => Boolean(id)),
    client: ctx.client,
    stageName: ctx.toStage.name,
    documents: ctx.documents.map((d) => ({ fileName: d.file.fileName })),
  });
}

/**
 * Efeitos pós-commit (notificação, e-mail, WhatsApp, confirmação de documentos à equipe). Cada canal falha isoladamente e é logado.
 * O chamador decide como executar (a rota usa `after()` para sobreviver ao fim da resposta em serverless).
 */
export async function runTransitionPostCommit(
  ctx: TransitionPostCommitContext,
  deps: TransitionPostCommitDeps,
): Promise<void> {
  const channels = [
    ["notification", notifyStaff],
    ["email", emailPatient],
    ["whatsapp", whatsAppPatient],
    ["document-delivery", confirmDocumentDelivery],
  ] as const;
  const results = await Promise.allSettled(channels.map(([, run]) => run(ctx, deps)));
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      logger.error(`[transition] post-commit ${channels[i]![0]} failed`, { err: result.reason });
    }
  });
}
