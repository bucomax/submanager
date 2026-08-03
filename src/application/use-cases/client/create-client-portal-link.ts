import { randomBytes } from "crypto";
import { AuditEventType } from "@prisma/client";
import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { patientPortalLinkTokenPrismaRepository } from "@/infrastructure/repositories/patient-portal-link-token.repository";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { resolvePathwayNotificationTargetUserIds } from "@/application/use-cases/notification/resolve-notification-targets";
import { getPatientPortalMagicLinkHtml } from "@/infrastructure/email/email-templates";
import { canSendEmailForTenant } from "@/infrastructure/email/email-availability";
import { resolveTenantSender } from "@/infrastructure/email/resolve-tenant-sender";
import { sendEmail } from "@/infrastructure/email/resend.client";
import { notificationEmitter } from "@/infrastructure/notifications/notification-emitter";
import { patientPathwayPrismaRepository } from "@/infrastructure/repositories/patient-pathway.repository";
import { getPublicAppUrl } from "@/lib/config/urls";
import { PATIENT_PORTAL_LINK_TTL_MS } from "@/lib/constants/patient-portal";
import type { PostClientPortalLinkResponse } from "@/types/api/patient-portal-v1";

export type CreateClientPortalLinkResult =
  | { ok: true; data: PostClientPortalLinkResponse }
  | {
      ok: false;
      code: "TENANT_SLUG_MISSING" | "EMAIL_NOT_CONFIGURED" | "EMAIL_SEND_FAILED";
    };

export async function runCreateClientPortalLink(params: {
  tenantId: string;
  actorUserId: string;
  client: { id: string; name: string; email: string | null };
  sendEmailFlag: boolean;
}): Promise<CreateClientPortalLinkResult> {
  const { tenantId, actorUserId, client, sendEmailFlag } = params;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + PATIENT_PORTAL_LINK_TTL_MS);
  const singleUse = sendEmailFlag;

  const tokenRow = await patientPortalLinkTokenPrismaRepository.createPortalLinkToken({
    clientId: client.id,
    token,
    expiresAt,
    singleUse,
  });

  await auditEventPrismaRepository.recordCanonical({
    tenantId,
    clientId: client.id,
    patientPathwayId: null,
    actorUserId,
    eventType: AuditEventType.PATIENT_PORTAL_LINK_GENERATED,
    payload: {
      tokenId: tokenRow.id,
      singleUse,
      ttlMs: PATIENT_PORTAL_LINK_TTL_MS,
    },
  });

  const tenant = await tenantPrismaRepository.findTenantNameAndSlugById(tenantId);
  const clinicName = tenant?.name ?? "Clínica";
  const tenantSlug = tenant?.slug ?? "";
  if (!tenantSlug) {
    return { ok: false, code: "TENANT_SLUG_MISSING" };
  }

  const enterUrl = `${getPublicAppUrl()}/${tenantSlug}/patient/enter?token=${encodeURIComponent(token)}`;

  let emailSent = false;
  const email = client.email?.trim() ?? "";
  if (sendEmailFlag && email) {
    if (!(await canSendEmailForTenant(tenantId))) {
      return { ok: false, code: "EMAIL_NOT_CONFIGURED" };
    }

    const { from, useSmtp } = await resolveTenantSender(tenantId);
    const { error } = await sendEmail({
      to: email,
      from,
      subject: `${clinicName} — Acesso ao seu acompanhamento (SubManager)`,
      html: getPatientPortalMagicLinkHtml({
        patientName: client.name,
        clinicName,
        enterUrl,
        singleUse,
      }),
      text: `Olá, ${client.name}. Acesse seu acompanhamento: ${enterUrl}`,
      tenantId,
      useSmtp,
    });
    if (error) {
      return { ok: false, code: "EMAIL_SEND_FAILED" };
    }
    emailSent = true;

    const ppRow = await patientPathwayPrismaRepository.findActiveAssigneeByClientId(
      tenantId,
      client.id,
    );
    const targetUserIds = (
      await resolvePathwayNotificationTargetUserIds({
        tenantId,
        type: "patient_portal_link_sent",
        currentStageAssigneeUserId: ppRow?.currentStageAssigneeUserId ?? null,
      })
    ).filter((id) => id !== actorUserId);
    if (targetUserIds.length > 0) {
      notificationEmitter
        .emit({
          tenantId,
          type: "patient_portal_link_sent",
          title: `Link do portal enviado para ${client.name}`,
          body: "Um link de acesso ao portal do paciente foi enviado por e-mail.",
          targetUserIds,
          correlationId: `portal-link:${tokenRow.id}`,
          metadata: {
            clientId: client.id,
            source: "portal_link_email",
            ...(ppRow ? { patientPathwayId: ppRow.id } : {}),
          },
        })
        .catch((err) =>
          console.error("[create-client-portal-link] in-app notification failed:", err),
        );
    }
  }

  const data: PostClientPortalLinkResponse = {
    enterUrl,
    emailSent,
    expiresAt: expiresAt.toISOString(),
  };

  return { ok: true, data };
}
