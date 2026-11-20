import { logger } from "@/lib/observability/logger";
import { AuditEventType } from "@prisma/client";
import { randomBytes } from "crypto";
import { z } from "zod";

import type { TenantMembershipRole } from "@/application/ports/user-repository.port";
import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { getInviteSetPasswordHtml, getTenantMemberAddedHtml } from "@/infrastructure/email/email-templates";
import { getPublicAppUrl } from "@/lib/config/urls";
import { canSendEmailForTenant } from "@/infrastructure/email/email-availability";
import { resolveTenantSender } from "@/infrastructure/email/resolve-tenant-sender";
import { sendEmail, buildInviteSetPasswordUrl } from "@/infrastructure/email/resend.client";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";
import { normalizeEmail } from "@/lib/utils/email";
import { formatTaxDocumentDisplay } from "@/lib/validators/tax-document";
import { adminInviteSchema } from "@/lib/validators/auth";

export type InviteTenantMemberInput = z.infer<typeof adminInviteSchema>;

export { adminInviteSchema };

export type InviteTenantMemberErrorCode =
  | "EMAIL_NOT_CONFIGURED"
  | "TENANT_NOT_FOUND"
  | "EMAIL_DISABLED_ACCOUNT"
  | "USER_ALREADY_MEMBER";

export type InviteTenantMemberSuccess =
  | {
      kind: "readded";
      userId: string;
      email: string;
      emailDispatched: false;
    }
  | {
      kind: "invite";
      userId: string;
      email: string;
      emailDispatched: boolean;
      emailError?: string;
    };

function buildInviteEmailSubject(clinicName: string): string {
  const name = clinicName.trim();
  if (!name) {
    return "Defina sua senha do SubManager";
  }
  const max = 88;
  const shortened = name.length > max ? `${name.slice(0, max - 1)}…` : name;
  return `Convite da ${shortened}: defina sua senha no SubManager`;
}

async function sendInviteSetPasswordEmail(
  emailNorm: string,
  name: string | null | undefined,
  token: string,
  tenant: { name: string; taxId: string | null; id: string },
): Promise<{ error?: Error }> {
  const setPasswordUrl = buildInviteSetPasswordUrl(token);
  const taxRaw = tenant.taxId?.trim();
  const tenantTaxIdDisplay = taxRaw ? formatTaxDocumentDisplay(taxRaw) : null;
  const { from, useSmtp } = await resolveTenantSender(tenant.id);
  return sendEmail({
    to: emailNorm,
    from,
    subject: buildInviteEmailSubject(tenant.name),
    html: getInviteSetPasswordHtml({
      name: name?.trim() || null,
      setPasswordUrl,
      tenantName: tenant.name.trim(),
      tenantTaxIdDisplay,
    }),
    tenantId: tenant.id,
    useSmtp,
  });
}


/**
 * Usuário existente (com senha) foi adicionado a uma clínica: avisa por e-mail e registra auditoria.
 * Best-effort — nunca bloqueia nem lança.
 */
async function notifyExistingUserAddedToTenant(params: {
  userId: string;
  emailNorm: string;
  name: string | null | undefined;
  role: TenantMembershipRole;
  tenant: { id: string; name: string };
  actorUserId?: string;
}): Promise<void> {
  const { userId, emailNorm, name, role, tenant, actorUserId } = params;
  try {
    await auditEventPrismaRepository.recordCanonical({
      tenantId: tenant.id,
      clientId: null,
      patientPathwayId: null,
      actorUserId: actorUserId ?? null,
      eventType: AuditEventType.TENANT_MEMBER_ADDED,
      payload: { userId, role, actorUserId: actorUserId ?? null },
    });
  } catch (err) {
    logger.warn("[invite] failed to record audit for existing user added to tenant", { userId, err });
  }

  try {
    if (!(await canSendEmailForTenant(tenant.id))) return;
    const { from, useSmtp } = await resolveTenantSender(tenant.id);
    const { error } = await sendEmail({
      to: emailNorm,
      from,
      subject: `Você foi adicionado à ${tenant.name.trim()} no SubManager`,
      html: getTenantMemberAddedHtml({ name: name ?? null, tenantName: tenant.name, appUrl: getPublicAppUrl() }),
      text: `Sua conta SubManager foi adicionada à clínica ${tenant.name.trim()}. Sua senha não foi alterada. Se você não esperava este acesso, entre em contato com a clínica ou com o suporte.`,
      tenantId: tenant.id,
      useSmtp,
    });
    if (error) {
      logger.warn("[invite] failed to send added-to-tenant notice", { userId, err: error });
    }
  } catch (err) {
    logger.warn("[invite] failed to send added-to-tenant notice", { userId, err });
  }
}

/**
 * Convida usuário ao tenant: cria conta sem senha e envia link para definir senha (Resend).
 * Usuário existente com senha é adicionado direto e recebe aviso por e-mail (best-effort).
 */
export async function runInviteTenantMember(
  input: InviteTenantMemberInput,
  options: { actorUserId?: string } = {},
): Promise<
  { ok: true; data: InviteTenantMemberSuccess } | { ok: false; code: InviteTenantMemberErrorCode }
> {
  const { email, name, tenantId, role } = input;
  const emailNorm = normalizeEmail(email);
  const rolePort: TenantMembershipRole = role;

  const tenant = await tenantPrismaRepository.findById(tenantId);
  if (!tenant) {
    return { ok: false, code: "TENANT_NOT_FOUND" };
  }
  const tenantForEmail = { id: tenant.id, name: tenant.name, taxId: tenant.taxId };

  const existing = await userPrismaRepository.findUserForTenantInvite(emailNorm, tenantId);

  if (existing) {
    if (existing.deletedAt) {
      return { ok: false, code: "EMAIL_DISABLED_ACCOUNT" };
    }
    if (existing.hasMembershipInTenant) {
      return { ok: false, code: "USER_ALREADY_MEMBER" };
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const needsInviteEmail = existing.passwordHash === null;
    if (needsInviteEmail && !(await canSendEmailForTenant(tenantId))) {
      return { ok: false, code: "EMAIL_NOT_CONFIGURED" };
    }
    const trimmedName = name?.trim();

    await userPrismaRepository.inviteExistingUserToTenant({
      userId: existing.id,
      tenantId,
      role: rolePort,
      nameTrimmed: trimmedName || undefined,
      token,
      expiresAt,
      needsInviteEmail,
    });

    if (!needsInviteEmail) {
      await notifyExistingUserAddedToTenant({
        userId: existing.id,
        emailNorm,
        name: trimmedName,
        role: rolePort,
        tenant: tenantForEmail,
        actorUserId: options.actorUserId,
      });
      return {
        ok: true,
        data: {
          kind: "readded",
          userId: existing.id,
          email: emailNorm,
          emailDispatched: false,
        },
      };
    }

    const { error: sendError } = await sendInviteSetPasswordEmail(emailNorm, name, token, tenantForEmail);
    if (sendError) {
      logger.error("Erro ao enviar convite", { err: sendError });
      return {
        ok: true,
        data: {
          kind: "invite",
          userId: existing.id,
          email: emailNorm,
          emailDispatched: false,
          emailError: sendError.message,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: "invite",
        userId: existing.id,
        email: emailNorm,
        emailDispatched: true,
      },
    };
  }

  if (!(await canSendEmailForTenant(tenantId))) {
    return { ok: false, code: "EMAIL_NOT_CONFIGURED" };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const newUserId = await userPrismaRepository.inviteNewUserToTenant({
    emailNorm,
    name: name?.trim() || null,
    tenantId,
    role: rolePort,
    token,
    expiresAt,
  });

  const { error: sendError } = await sendInviteSetPasswordEmail(emailNorm, name, token, tenantForEmail);
  if (sendError) {
    logger.error("Erro ao enviar convite", { err: sendError });
    return {
      ok: true,
      data: {
        kind: "invite",
        userId: newUserId,
        email: emailNorm,
        emailDispatched: false,
        emailError: sendError.message,
      },
    };
  }

  return {
    ok: true,
    data: {
      kind: "invite",
      userId: newUserId,
      email: emailNorm,
      emailDispatched: true,
    },
  };
}
