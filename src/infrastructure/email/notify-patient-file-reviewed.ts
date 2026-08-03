import { prisma } from "@/infrastructure/database/prisma";
import { getFileReviewResultPatientHtml } from "@/infrastructure/email/email-templates";
import { canSendEmailForTenant } from "@/infrastructure/email/email-availability";
import { resolveTenantSender } from "@/infrastructure/email/resolve-tenant-sender";
import { sendEmail } from "@/infrastructure/email/resend.client";
import { decryptTenantSecret } from "@/infrastructure/crypto/tenant-secret";
import { sendTextMessage } from "@/infrastructure/whatsapp/whatsapp-cloud-client";
import { getPublicAppUrl } from "@/lib/config/urls";

type NotifyParams = {
  tenantId: string;
  clientId: string;
  fileName: string;
  decision: "approve" | "reject";
  rejectReason?: string;
};

/**
 * Notifica o paciente apos revisao de arquivo enviado pelo portal:
 * - **E-mail:** se o paciente tem e-mail cadastrado e Resend esta configurado.
 * - **WhatsApp:** se o tenant tem WhatsApp habilitado e o paciente tem telefone.
 */
export async function notifyPatientFileReviewed(params: NotifyParams): Promise<void> {
  const { tenantId, clientId, fileName, decision, rejectReason } = params;

  const [client, tenant] = await Promise.all([
    prisma.client.findFirst({
      where: { id: clientId, tenantId },
      select: {
        name: true,
        email: true,
        phone: true,
        isMinor: true,
        guardianEmail: true,
        guardianPhone: true,
      },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        slug: true,
        whatsappEnabled: true,
        whatsappPhoneNumberId: true,
        whatsappAccessTokenEnc: true,
      },
    }),
  ]);

  if (!client || !tenant) return;

  const { from, useSmtp } = await resolveTenantSender(tenantId);
  const base = getPublicAppUrl().replace(/\/$/, "");
  const portalUrl = `${base}/${encodeURIComponent(tenant.slug)}/patient`;

  const clinicName = tenant.name;
  const patientName = client.name?.trim() || "Paciente";

  const patientEmail = client.email?.trim() ?? "";
  const guardianEmailTrim = client.isMinor ? (client.guardianEmail?.trim() ?? "") : "";
  const emailRecipients = new Set<string>();
  if (patientEmail) emailRecipients.add(patientEmail);
  if (guardianEmailTrim && guardianEmailTrim.toLowerCase() !== patientEmail.toLowerCase()) {
    emailRecipients.add(guardianEmailTrim);
  }

  // --- E-mail ---
  if ((await canSendEmailForTenant(tenantId)) && emailRecipients.size > 0) {
    const isApproved = decision === "approve";
    const subject = isApproved
      ? `SubManager — Documento aprovado: ${fileName}`
      : `SubManager — Documento precisa de ajustes: ${fileName}`;

    const html = getFileReviewResultPatientHtml({
      patientName,
      clinicName,
      fileName,
      decision,
      rejectReason,
      portalUrl,
    });
    const text = isApproved
      ? `Seu documento "${fileName}" foi aprovado pela ${clinicName}. Acesse: ${portalUrl}`
      : `Seu documento "${fileName}" precisa de ajustes. ${rejectReason ? `Motivo: ${rejectReason}. ` : ""}Acesse: ${portalUrl}`;

    for (const to of emailRecipients) {
      sendEmail({ to, from, subject, html, text, tenantId, useSmtp }).catch((err) =>
        console.error("[notify-file-reviewed] email failed:", err),
      );
    }
  }

  // --- WhatsApp ---
  if (tenant.whatsappEnabled && tenant.whatsappPhoneNumberId && tenant.whatsappAccessTokenEnc) {
    const isApproved = decision === "approve";
    const message = isApproved
      ? `${clinicName}: Seu documento "${fileName}" foi aprovado. Acesse o portal para acompanhar sua jornada: ${portalUrl}`
      : `${clinicName}: Seu documento "${fileName}" precisa de ajustes.${rejectReason ? ` Motivo: ${rejectReason}.` : ""} Acesse o portal: ${portalUrl}`;

    const phones = new Set<string>();
    const p = client.phone?.replace(/\D/g, "") ?? "";
    if (p.length >= 10) phones.add(client.phone!.trim());
    if (client.isMinor) {
      const g = client.guardianPhone?.replace(/\D/g, "") ?? "";
      if (g.length >= 10 && g !== p) {
        phones.add(client.guardianPhone!.trim());
      }
    }

    try {
      const accessToken = decryptTenantSecret(tenant.whatsappAccessTokenEnc);
      for (const to of phones) {
        await sendTextMessage(tenant.whatsappPhoneNumberId, accessToken, to, message);
      }
    } catch (err) {
      console.error("[notify-file-reviewed] whatsapp failed:", err);
    }
  }
}
