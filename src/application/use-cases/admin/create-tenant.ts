import type { CreatedTenantRow } from "@/application/ports/tenant-repository.port";
import type { InviteTenantMemberErrorCode } from "@/application/use-cases/admin/invite-tenant-member";
import { runInviteTenantMember } from "@/application/use-cases/admin/invite-tenant-member";
import { isEmailConfigured } from "@/infrastructure/email/resend.client";
import { prisma } from "@/infrastructure/database/prisma";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { normalizeEmail } from "@/lib/utils/email";
import { normNullable } from "@/lib/utils/string";

export type CreateTenantParams = {
  name: string;
  slug: string;
  taxId?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  city?: string | null;
  postalCode?: string | null;
  admin?: { email: string; name?: string | null } | null;
};

export type CreateTenantUseCaseErrorCode = "SLUG_CONFLICT" | InviteTenantMemberErrorCode;

export type CreateTenantUseCaseResult =
  | {
      ok: true;
      tenant: CreatedTenantRow;
      adminCreated: boolean;
      adminEmail: string | null;
      adminUserId: string | null;
      emailDispatched: boolean;
      emailError?: string;
    }
  | { ok: false; code: CreateTenantUseCaseErrorCode };

/**
 * Cria tenant (super_admin) e, opcionalmente, associa o primeiro administrador via fluxo de convite.
 */
export async function runCreateTenant(params: CreateTenantParams): Promise<CreateTenantUseCaseResult> {
  const adminEmailRaw = params.admin?.email?.trim();
  const adminEmail = adminEmailRaw ? normalizeEmail(adminEmailRaw) : null;

  if (adminEmail) {
    const user = await prisma.user.findFirst({
      where: { email: adminEmail },
      select: { deletedAt: true, passwordHash: true },
    });
    if (user?.deletedAt) {
      return { ok: false, code: "EMAIL_DISABLED_ACCOUNT" };
    }
    const needsEmail = !user || user.passwordHash === null;
    if (needsEmail && !isEmailConfigured()) {
      return { ok: false, code: "EMAIL_NOT_CONFIGURED" };
    }
  }

  const result = await tenantPrismaRepository.createTenant({
    name: params.name,
    slug: params.slug,
    taxId: normNullable(params.taxId),
    phone: normNullable(params.phone),
    addressLine: normNullable(params.addressLine),
    city: normNullable(params.city),
    postalCode: normNullable(params.postalCode),
  });

  if (!result.ok) {
    return result;
  }

  const { tenant } = result;

  if (!adminEmail) {
    return {
      ok: true,
      tenant,
      adminCreated: false,
      adminEmail: null,
      adminUserId: null,
      emailDispatched: false,
    };
  }

  const hadUserBefore = Boolean(
    await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } }),
  );

  const inviteResult = await runInviteTenantMember({
    email: adminEmail,
    name: params.admin?.name?.trim() || undefined,
    tenantId: tenant.id,
    role: "tenant_admin",
  });

  if (!inviteResult.ok) {
    return inviteResult;
  }

  const inviteData = inviteResult.data;

  return {
    ok: true,
    tenant,
    adminCreated: !hadUserBefore,
    adminEmail,
    adminUserId: inviteData.userId,
    emailDispatched: inviteData.kind === "invite" ? inviteData.emailDispatched : false,
    emailError: inviteData.kind === "invite" ? inviteData.emailError : undefined,
  };
}
