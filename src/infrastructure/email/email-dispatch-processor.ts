import { prisma } from "@/infrastructure/database/prisma";
import { canSendEmailForTenant } from "@/infrastructure/email/email-availability";
import { deliverEmail, type DeliveryContext } from "@/infrastructure/email/email-delivery";
import { EmailDispatchRetryableError } from "@/infrastructure/email/email-send-error";
import { getStageTransitionPatientHtml } from "@/infrastructure/email/email-templates";
import { resolveTenantSender } from "@/infrastructure/email/resolve-tenant-sender";
import { buildStaffMailPlan, type StaffMailPlan } from "@/infrastructure/email/staff-mail-plans";
import type { EmailDispatchJobPayload } from "@/infrastructure/queue/email-dispatch-job-types";
import { filterUserIdsWhoCanViewClient } from "@/infrastructure/visibility/client-visibility-scope";
import { getPublicAppUrl } from "@/lib/config/urls";
import { logger } from "@/lib/observability/logger";

export type EmailDispatchRunOptions = {
  /**
   * Identifica esta instância do job no worker BullMQ (`jobId:timestamp`). Habilita pular, nos retries,
   * destinatários já enviados. Sem ela (modo inline) não há retry nem rastreio por destinatário.
   */
  runKey?: string;
};

type StageTransitionPatientPayload = Extract<EmailDispatchJobPayload, { kind: "stage_transition_patient" }>;

async function sendStageTransitionToPatient(
  ctx: DeliveryContext,
  payload: StageTransitionPatientPayload,
): Promise<void> {
  const to = payload.to.trim();
  if (!to) return;
  const { data } = payload;
  await deliverEmail(
    ctx,
    { to, ref: "patient" },
    {
      subject: `${data.clinicName}: nova etapa no seu tratamento`,
      html: getStageTransitionPatientHtml({
        patientName: data.patientName,
        clinicName: data.clinicName,
        stageName: data.stageName,
        patientMessage: data.patientMessage,
        documents: data.documents,
        portalUrl: data.portalUrl,
      }),
      text: `Olá! Você entrou na etapa "${data.stageName}" em ${data.clinicName}. Acesse o portal: ${data.portalUrl}`,
    },
  );
}

/**
 * Envia um e-mail por membro da equipe (só quem tem e-mail). Ponto único do filtro de visibilidade (LGPD):
 * com `clientId`, só recebe quem enxerga o paciente, igual às notificações in-app.
 */
async function sendToStaff(ctx: DeliveryContext, plan: StaffMailPlan): Promise<void> {
  const userIds = plan.clientId
    ? await filterUserIdsWhoCanViewClient(ctx.tenantId, plan.clientId, plan.targetUserIds)
    : plan.targetUserIds;
  if (userIds.length < plan.targetUserIds.length) {
    logger.debug("[email-dispatch] recipients filtered by client visibility", {
      tenantId: ctx.tenantId,
      kind: ctx.kind,
      before: plan.targetUserIds.length,
      after: userIds.length,
    });
  }
  if (userIds.length === 0) return;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  for (const user of users) {
    const to = user.email?.trim();
    if (!to) continue;
    await deliverEmail(ctx, { to, ref: user.id }, plan.build(user.name));
  }
}

/**
 * Processa um job de e-mail (worker BullMQ ou modo inline). Não loga corpos nem endereços.
 * Lança `EmailDispatchRetryableError` ao final se algum destinatário falhou por motivo transitório
 * (429/5xx/rede) — o worker então reprocessa o job e o retry pula quem já recebeu. Falhas permanentes
 * (endereço/credencial inválidos) são só logadas: reprocessar não adianta.
 */
export async function processEmailDispatchJob(
  payload: EmailDispatchJobPayload,
  options: EmailDispatchRunOptions = {},
): Promise<void> {
  if (!(await canSendEmailForTenant(payload.tenantId))) return;

  const { from, useSmtp } = await resolveTenantSender(payload.tenantId);
  const ctx: DeliveryContext = {
    tenantId: payload.tenantId,
    kind: payload.kind,
    from,
    useSmtp,
    runKey: options.runKey,
    failures: { retryable: 0, permanent: 0 },
  };

  if (payload.kind === "stage_transition_patient") {
    await sendStageTransitionToPatient(ctx, payload);
  } else {
    const base = getPublicAppUrl().replace(/\/$/, "");
    await sendToStaff(ctx, buildStaffMailPlan(payload, base));
  }

  if (ctx.failures.retryable > 0) {
    throw new EmailDispatchRetryableError(payload.kind, ctx.failures.retryable);
  }
}
