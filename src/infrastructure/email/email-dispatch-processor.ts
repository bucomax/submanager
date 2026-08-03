import { prisma } from "@/infrastructure/database/prisma";
import {
  getChecklistCompleteStaffHtml,
  getFilePendingReviewStaffHtml,
  getSlaAlertStaffHtml,
  getStageTransitionPatientHtml,
} from "@/infrastructure/email/email-templates";
import type { EmailDispatchJobPayload } from "@/infrastructure/queue/email-dispatch-job-types";
import { canSendEmailForTenant } from "@/infrastructure/email/email-availability";
import { recordEmailDispatchSent } from "@/infrastructure/email/email-dispatch-log";
import { sendEmail } from "@/infrastructure/email/resend.client";
import { resolveTenantSender } from "@/infrastructure/email/resolve-tenant-sender";
import { getPublicAppUrl } from "@/lib/config/urls";

function persistDispatchLogIfSent(
  tenantId: string,
  jobKind: string,
  to: string,
  result: { id?: string; error?: Error },
): void {
  if (!result.id) return;
  void recordEmailDispatchSent({
    tenantId,
    jobKind,
    to,
    resendMessageId: result.id,
  }).catch((err) => {
    console.error("[email-dispatch] EmailDispatchLog persist failed:", err);
  });
}

/**
 * Envia um job de e-mail (chamado pelo worker BullMQ ou em modo inline).
 * Não logar corpos; apenas erros de API.
 */
export async function processEmailDispatchJob(
  payload: EmailDispatchJobPayload,
): Promise<void> {
  if (!(await canSendEmailForTenant(payload.tenantId))) return;

  const base = getPublicAppUrl().replace(/\/$/, "");
  const { from, useSmtp } = await resolveTenantSender(payload.tenantId);

  if (payload.kind === "stage_transition_patient") {
    const to = payload.to.trim();
    if (!to) return;
    const { data } = payload;
    const html = getStageTransitionPatientHtml({
      patientName: data.patientName,
      clinicName: data.clinicName,
      stageName: data.stageName,
      patientMessage: data.patientMessage,
      documents: data.documents,
      portalUrl: data.portalUrl,
    });
    const text = `Olá! Você entrou na etapa "${data.stageName}" em ${data.clinicName}. Acesse o portal: ${data.portalUrl}`;
    const sent = await sendEmail({
      to,
      subject: `${data.clinicName} — Nova etapa na sua jornada (SubManager)`,
      html,
      text,
      from,
      tenantId: payload.tenantId,
      useSmtp,
    });
    persistDispatchLogIfSent(payload.tenantId, payload.kind, to, sent);
    return;
  }

  if (payload.kind === "sla_alert") {
    const users = await prisma.user.findMany({
      where: { id: { in: payload.data.targetUserIds } },
      select: { id: true, name: true, email: true },
    });
    for (const u of users) {
      const to = u.email?.trim();
      if (!to) continue;
      const patientUrl = `${base}/dashboard/clients/${payload.data.clientId}`;
      const html = getSlaAlertStaffHtml({
        staffName: u.name,
        patientName: payload.data.patientName,
        stageName: payload.data.stageName,
        daysInStage: payload.data.daysInStage,
        slaThresholdDays: payload.data.slaThresholdDays,
        clinicName: payload.data.clinicName,
        severity: payload.data.severity,
        patientUrl,
      });
      const label = payload.data.severity === "danger" ? "Alerta crítico" : "Atenção";
      const text = `${label}: ${payload.data.patientName} — ${payload.data.daysInStage} dia(s) na etapa "${payload.data.stageName}". Abrir: ${patientUrl}`;
      const sent = await sendEmail({
        to,
        subject: `SubManager — ${label}: ${payload.data.patientName} (${payload.data.stageName})`,
        html,
        text,
        from,
        tenantId: payload.tenantId,
        useSmtp,
      });
      persistDispatchLogIfSent(payload.tenantId, payload.kind, to, sent);
    }
    return;
  }

  if (payload.kind === "file_pending_review_staff") {
    const users = await prisma.user.findMany({
      where: { id: { in: payload.data.targetUserIds } },
      select: { id: true, name: true, email: true },
    });
    for (const u of users) {
      const to = u.email?.trim();
      if (!to) continue;
      const reviewUrl = `${base}/dashboard/clients/${payload.data.clientId}?tab=files`;
      const html = getFilePendingReviewStaffHtml({
        staffName: u.name,
        patientName: payload.data.patientName,
        fileName: payload.data.fileName,
        clinicName: payload.data.clinicName,
        reviewUrl,
      });
      const text = `${payload.data.patientName} enviou "${payload.data.fileName}". Revisar: ${reviewUrl}`;
      const sent = await sendEmail({
        to,
        subject: `SubManager — Novo documento: ${payload.data.fileName} (${payload.data.patientName})`,
        html,
        text,
        from,
        tenantId: payload.tenantId,
        useSmtp,
      });
      persistDispatchLogIfSent(payload.tenantId, payload.kind, to, sent);
    }
    return;
  }

  if (payload.kind === "checklist_complete_staff") {
    const users = await prisma.user.findMany({
      where: { id: { in: payload.data.targetUserIds } },
      select: { id: true, name: true, email: true },
    });
    for (const u of users) {
      const to = u.email?.trim();
      if (!to) continue;
      const patientUrl = `${base}/dashboard/clients/${payload.data.clientId}`;
      const html = getChecklistCompleteStaffHtml({
        staffName: u.name,
        patientName: payload.data.patientName,
        stageName: payload.data.stageName,
        totalRequiredItems: payload.data.totalRequiredItems,
        clinicName: payload.data.clinicName,
        patientUrl,
      });
      const text = `Checklist: ${payload.data.patientName} concluiu ${payload.data.totalRequiredItems} item(ns) obrigatório(s) em "${payload.data.stageName}". ${patientUrl}`;
      const sent = await sendEmail({
        to,
        subject: `SubManager — Checklist concluído: ${payload.data.patientName} — ${payload.data.stageName}`,
        html,
        text,
        from,
        tenantId: payload.tenantId,
        useSmtp,
      });
      persistDispatchLogIfSent(payload.tenantId, payload.kind, to, sent);
    }
  }
}
