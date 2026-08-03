import { prisma } from "@/infrastructure/database/prisma";
import { notificationEmitter } from "@/infrastructure/notifications/notification-emitter";
import { getPatientSelfRegisteredStaffHtml } from "@/infrastructure/email/email-templates";
import { canSendEmailForTenant } from "@/infrastructure/email/email-availability";
import { resolveTenantSender } from "@/infrastructure/email/resolve-tenant-sender";
import { sendEmail } from "@/infrastructure/email/resend.client";
import { getPublicAppUrl } from "@/lib/config/urls";

type NotifyParams = {
  tenantId: string;
  clientId: string;
  patientName: string;
  clinicName: string;
};

/**
 * Notifica membros do tenant após cadastro público do paciente:
 * - **Painel:** notificação in-app tipo `new_patient` para todos os membros (sem filtrar por
 *   «só atribuídos»; preferência «novos pacientes» é ignorada — evento explícito de auto-cadastro).
 * - **E-mail:** mesmo alcance (todos com e-mail no tenant), quando `RESEND_API_KEY` está configurada.
 */
export async function notifyStaffPatientSelfRegistered(params: NotifyParams): Promise<void> {
  const { tenantId, clientId, patientName, clinicName } = params;
  const base = getPublicAppUrl().replace(/\/$/, "");
  const openPatientUrl = `${base}/dashboard/clients/${clientId}`;

  await notificationEmitter.emit({
    tenantId,
    type: "new_patient",
    title: `Novo paciente (auto-cadastro): ${patientName}`,
    body: `Cadastro concluído pelo link. Escolha a jornada de tratamento no painel.`,
    correlationId: clientId,
    ignoreTenantNotificationPreference: true,
    skipClientVisibilityFilter: true,
    metadata: {
      clientId,
      source: "patient_self_register",
    },
  });

  /** E-mail: mesmo layout dos outros templates SubManager (`email-templates.ts`). */
  if (!(await canSendEmailForTenant(tenantId))) {
    return;
  }

  const { from, useSmtp } = await resolveTenantSender(tenantId);

  const memberships = await prisma.tenantMembership.findMany({
    where: { tenantId },
    include: {
      user: { select: { id: true, email: true, name: true, deletedAt: true } },
    },
  });

  const recipients = memberships
    .map((m) => m.user)
    .filter((u) => u.deletedAt == null && u.email.trim().length > 0);

  await Promise.allSettled(
    recipients.map((user) =>
      sendEmail({
        to: user.email,
        from,
        subject: `SubManager — Novo paciente: ${patientName}`,
        html: getPatientSelfRegisteredStaffHtml({
          staffName: user.name,
          patientName,
          clinicName,
          openPatientUrl,
        }),
        text: `${patientName} concluiu o cadastro em ${clinicName}. Abra: ${openPatientUrl}`,
        tenantId,
        useSmtp,
      }),
    ),
  );
}
