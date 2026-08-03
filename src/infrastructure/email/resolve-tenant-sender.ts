import { prisma } from "@/infrastructure/database/prisma";
import type { EmailOutboundMode } from "@prisma/client";

const DEFAULT_FROM = process.env.EMAIL_FROM ?? "SubManager <onboarding@resend.dev>";

/**
 * Modo `smtp` + credenciais completas, independente de `smtpEnabled` (o modo define o uso).
 */
function isSmtpModeReady(
  t: {
    emailOutboundMode: EmailOutboundMode;
    smtpHost: string | null;
    smtpUser: string | null;
    smtpPasswordEnc: string | null;
    smtpFromAddress: string | null;
  } | null,
): boolean {
  if (!t || t.emailOutboundMode !== "smtp") {
    return false;
  }
  return Boolean(
    t.smtpHost?.trim() &&
      t.smtpUser?.trim() &&
      t.smtpPasswordEnc &&
      t.smtpFromAddress?.trim(),
  );
}

/**
 * Resolve o `from` e se o envio usa SMTP (Nodemailer) ou API Resend.
 */
export async function resolveTenantSender(tenantId: string): Promise<{
  from: string;
  isCustomDomain: boolean;
  useSmtp: boolean;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      emailOutboundMode: true,
      smtpFromName: true,
      smtpFromAddress: true,
      smtpHost: true,
      smtpUser: true,
      smtpPasswordEnc: true,
      emailEnabled: true,
      emailFromName: true,
      emailFromAddress: true,
      emailDomainStatus: true,
    },
  });

  if (isSmtpModeReady(tenant)) {
    const name = (tenant?.smtpFromName?.trim() || "Notificações").replace(/[<>]/g, "");
    const address = tenant!.smtpFromAddress!.trim();
    return {
      from: `${name} <${address}>`,
      isCustomDomain: true,
      useSmtp: true,
    };
  }

  if (
    tenant?.emailOutboundMode === "resend_domain" &&
    tenant.emailEnabled &&
    (tenant.emailDomainStatus ?? "").toLowerCase() === "verified" &&
    tenant.emailFromAddress?.trim()
  ) {
    const name = (tenant.emailFromName?.trim() || "Notificações").replace(/[<>]/g, "");
    const address = tenant.emailFromAddress.trim();
    return {
      from: `${name} <${address}>`,
      isCustomDomain: true,
      useSmtp: false,
    };
  }

  return {
    from: DEFAULT_FROM,
    isCustomDomain: false,
    useSmtp: false,
  };
}
