import { notificationEmitter } from "@/infrastructure/notifications/notification-emitter";
import { enqueueEmailDispatch } from "@/infrastructure/email/email-dispatch-emitter";
import { enqueueWhatsAppDispatch } from "@/infrastructure/whatsapp/whatsapp-dispatch-emitter";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { getPublicAppUrl } from "@/lib/config/urls";
import { resolvePathwayNotificationTargetUserIds } from "@/application/use-cases/notification/resolve-notification-targets";
import type { StageDocumentBundleItem } from "@/application/use-cases/pathway/build-stage-dispatch";

export type TransitionPostCommitContext = {
  tenantId: string;
  transitionId: string;
  patientPathwayId: string;
  fromStageId: string;
  toStage: { id: string; name: string; patientMessage: string | null };
  client: { id: string; name: string; email: string | null; phone: string | null };
  currentStageAssigneeUserId: string | null;
  documents: StageDocumentBundleItem[];
};

async function notifyStaff(ctx: TransitionPostCommitContext): Promise<void> {
  const targetUserIds = await resolvePathwayNotificationTargetUserIds({
    tenantId: ctx.tenantId,
    type: "stage_transition",
    currentStageAssigneeUserId: ctx.currentStageAssigneeUserId,
  });
  await notificationEmitter.emit({
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

async function emailPatient(ctx: TransitionPostCommitContext): Promise<void> {
  const clientEmail = ctx.client.email?.trim();
  if (!clientEmail) return;
  const tenantRow = await tenantPrismaRepository.findTenantNameAndSlugById(ctx.tenantId);
  const slug = tenantRow?.slug?.trim() ?? "";
  if (!slug) return;
  const portalUrl = `${getPublicAppUrl()}/${encodeURIComponent(slug)}/patient/login`;
  await enqueueEmailDispatch(
    {
      kind: "stage_transition_patient",
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
    },
    // O id da transição evita que reentrar numa etapa já visitada seja deduplicado.
    {
      jobId: `email|st|${ctx.tenantId}|${ctx.patientPathwayId}|${ctx.toStage.id}|${ctx.transitionId}`.replace(
        /:/g,
        "_",
      ),
    },
  );
}

async function whatsAppPatient(ctx: TransitionPostCommitContext): Promise<void> {
  if (ctx.documents.length === 0 || !ctx.client.phone) return;
  await enqueueWhatsAppDispatch({
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

/**
 * Efeitos pós-commit (notificação, e-mail, WhatsApp). Cada canal falha isoladamente e é logado.
 * O chamador decide como executar (a rota usa `after()` para sobreviver ao fim da resposta em serverless).
 */
export async function runTransitionPostCommit(ctx: TransitionPostCommitContext): Promise<void> {
  const channels = [
    ["notification", notifyStaff],
    ["email", emailPatient],
    ["whatsapp", whatsAppPatient],
  ] as const;
  const results = await Promise.allSettled(channels.map(([, run]) => run(ctx)));
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`[transition] post-commit ${channels[i]![0]} failed:`, result.reason);
    }
  });
}
