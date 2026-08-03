import { Prisma, TenantRole } from "@prisma/client";

import type {
  CreateTenantInput,
  ITenantRepository,
  TenantClinicProfilePatchInput,
  TenantNotificationPrefsRow,
  TenantWhatsAppPatchInput,
} from "@/application/ports/tenant-repository.port";
import { prisma } from "@/infrastructure/database/prisma";

const WHATSAPP_SELECT = {
  whatsappEnabled: true,
  whatsappPhoneNumberId: true,
  whatsappBusinessAccountId: true,
  whatsappAccessTokenEnc: true,
  whatsappVerifiedAt: true,
} as const;

const NOTIFICATION_PREFS_SELECT = {
  notifyCriticalAlerts: true,
  notifySurgeryReminders: true,
  notifyNewPatients: true,
  notifyWeeklyReport: true,
  notifyDocumentDelivery: true,
} as const;

const CLINIC_PROFILE_SELECT = {
  id: true,
  name: true,
  slug: true,
  taxId: true,
  phone: true,
  addressLine: true,
  city: true,
  postalCode: true,
  affiliatedHospitals: true,
} as const;

export class TenantPrismaRepository implements ITenantRepository {
  async findById(tenantId: string) {
    return prisma.tenant.findUnique({ where: { id: tenantId } });
  }

  async findBySlug(slug: string) {
    return prisma.tenant.findUnique({ where: { slug } });
  }

  async findAll() {
    return prisma.tenant.findMany({ orderBy: { name: "asc" } });
  }

  async findActiveBySlugCaseInsensitive(slug: string) {
    return prisma.tenant.findFirst({
      where: { slug: { equals: slug, mode: "insensitive" }, isActive: true },
      select: { id: true, name: true, slug: true },
    });
  }

  async countTenantAdmins(tenantId: string) {
    return prisma.tenantMembership.count({
      where: { tenantId, role: TenantRole.tenant_admin },
    });
  }

  async findMembership(tenantId: string, userId: string) {
    return prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
  }

  async updateTenantMembership(membershipId: string, data: unknown) {
    return prisma.tenantMembership.update({
      where: { id: membershipId },
      data: data as Prisma.TenantMembershipUpdateInput,
    });
  }

  async deleteTenantMembership(membershipId: string) {
    await prisma.tenantMembership.delete({
      where: { id: membershipId },
    });
  }

  async clearUserActiveTenantIfMatches(userId: string, tenantId: string) {
    await prisma.user.updateMany({
      where: { id: userId, activeTenantId: tenantId },
      data: { activeTenantId: null },
    });
  }

  async tenantExistsById(tenantId: string) {
    const row = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    return row != null;
  }

  async listTenantSummariesForSuperAdmin() {
    return prisma.tenant.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, isActive: true },
    });
  }

  async createTenant(params: CreateTenantInput) {
    try {
      const tenant = await prisma.tenant.create({
        data: {
          name: params.name.trim(),
          slug: params.slug,
          ...(params.taxId ? { taxId: params.taxId } : {}),
          ...(params.phone ? { phone: params.phone } : {}),
          ...(params.addressLine ? { addressLine: params.addressLine } : {}),
          ...(params.city ? { city: params.city } : {}),
          ...(params.postalCode ? { postalCode: params.postalCode } : {}),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          taxId: true,
          phone: true,
          addressLine: true,
          city: true,
          postalCode: true,
        },
      });
      return {
        ok: true as const,
        tenant,
      };
    } catch (e: unknown) {
      const isUnique =
        typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
      if (isUnique) {
        return { ok: false as const, code: "SLUG_CONFLICT" as const };
      }
      throw e;
    }
  }

  async updateTenantActive(tenantId: string, isActive: boolean) {
    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) {
      return null;
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { isActive },
      });
      if (!isActive) {
        await tx.user.updateMany({
          where: { activeTenantId: tenantId },
          data: { activeTenantId: null },
        });
      }
    });

    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, isActive: true },
    });
  }

  async listActiveTenantMembershipRows(tenantId: string) {
    const rows = await prisma.tenantMembership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            deletedAt: true,
            passwordHash: true,
          },
        },
      },
      orderBy: { user: { email: "asc" } },
    });

    return rows
      .filter((r) => r.user.deletedAt === null)
      .map((r) => ({
        userId: r.userId,
        email: r.user.email,
        name: r.user.name,
        image: r.user.image,
        role: r.role,
        restrictedToAssignedOnly: r.restrictedToAssignedOnly,
        linkedOpmeSupplierId: r.linkedOpmeSupplierId,
        hasPassword: r.user.passwordHash !== null,
      }));
  }

  async findTenantWhatsAppById(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: WHATSAPP_SELECT,
    });
  }

  async updateTenantWhatsApp(tenantId: string, patch: TenantWhatsAppPatchInput) {
    const data: Prisma.TenantUpdateInput = {};
    if (patch.whatsappEnabled !== undefined) {
      data.whatsappEnabled = patch.whatsappEnabled;
    }
    if (patch.whatsappPhoneNumberId !== undefined) {
      data.whatsappPhoneNumberId = patch.whatsappPhoneNumberId;
    }
    if (patch.whatsappBusinessAccountId !== undefined) {
      data.whatsappBusinessAccountId = patch.whatsappBusinessAccountId;
    }
    if (patch.whatsappAccessTokenEnc !== undefined) {
      data.whatsappAccessTokenEnc = patch.whatsappAccessTokenEnc;
    }
    if (patch.resetWhatsAppVerifiedAt) {
      data.whatsappVerifiedAt = null;
    }
    return prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: WHATSAPP_SELECT,
    });
  }

  async findTenantNotificationPrefsById(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: NOTIFICATION_PREFS_SELECT,
    });
  }

  async updateTenantNotificationPrefs(
    tenantId: string,
    data: Partial<TenantNotificationPrefsRow>,
  ) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: NOTIFICATION_PREFS_SELECT,
    });
  }

  async findTenantClinicProfileById(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: CLINIC_PROFILE_SELECT,
    });
  }

  async updateTenantClinicProfile(tenantId: string, data: TenantClinicProfilePatchInput) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.taxId !== undefined ? { taxId: data.taxId } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.addressLine !== undefined ? { addressLine: data.addressLine } : {}),
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(data.postalCode !== undefined ? { postalCode: data.postalCode } : {}),
        ...(data.affiliatedHospitals !== undefined ? { affiliatedHospitals: data.affiliatedHospitals } : {}),
      },
      select: CLINIC_PROFILE_SELECT,
    });
  }

  async findTenantSwitchStatus(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true },
    });
  }

  async findMembershipScopeForClientVisibility(userId: string, tenantId: string) {
    return prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: {
        role: true,
        restrictedToAssignedOnly: true,
        linkedOpmeSupplierId: true,
      },
    });
  }

  async listMembershipUserIds(tenantId: string) {
    const rows = await prisma.tenantMembership.findMany({
      where: { tenantId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async listTenantAdminUserIds(tenantId: string) {
    const rows = await prisma.tenantMembership.findMany({
      where: { tenantId, role: TenantRole.tenant_admin },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async isUserMemberOfTenant(tenantId: string, userId: string) {
    const row = await prisma.tenantMembership.findFirst({
      where: { tenantId, userId },
      select: { userId: true },
    });
    return row != null;
  }

  async findTenantNameAndSlugById(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true },
    });
  }

  async findTenantIdByWhatsappPhoneNumberId(phoneNumberId: string) {
    return prisma.tenant.findFirst({
      where: { whatsappPhoneNumberId: phoneNumberId, whatsappEnabled: true },
      select: { id: true },
    });
  }

  async findTenantEmailDomainInternal(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        emailOutboundMode: true,
        emailEnabled: true,
        emailFromName: true,
        emailFromAddress: true,
        emailResendDomainId: true,
        emailDomainName: true,
        emailDomainStatus: true,
        emailDomainDnsRecords: true,
        emailDomainVerifiedAt: true,
      },
    });
  }

  async updateTenantEmailDomainAfterSetup(
    tenantId: string,
    data: {
      emailResendDomainId: string;
      emailDomainName: string;
      emailDomainStatus: string;
      emailDomainDnsRecords: Prisma.InputJsonValue;
      emailFromName: string;
      emailFromAddress: string;
      emailEnabled: boolean;
      emailOutboundMode: import("@prisma/client").EmailOutboundMode;
    },
  ) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        emailResendDomainId: data.emailResendDomainId,
        emailDomainName: data.emailDomainName,
        emailDomainStatus: data.emailDomainStatus,
        emailDomainDnsRecords: data.emailDomainDnsRecords,
        emailFromName: data.emailFromName,
        emailFromAddress: data.emailFromAddress,
        emailEnabled: data.emailEnabled,
        emailOutboundMode: data.emailOutboundMode,
        emailDomainVerifiedAt: null,
      },
    });
  }

  async updateTenantEmailDomainFromVerify(
    tenantId: string,
    data: {
      emailDomainStatus: string;
      emailDomainDnsRecords: Prisma.InputJsonValue;
      emailDomainVerifiedAt: Date | null;
    },
  ) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        emailDomainStatus: data.emailDomainStatus,
        emailDomainDnsRecords: data.emailDomainDnsRecords,
        emailDomainVerifiedAt: data.emailDomainVerifiedAt,
      },
    });
  }

  async patchTenantEmailDomainSettings(
    tenantId: string,
    data: {
      emailOutboundMode?: import("@prisma/client").EmailOutboundMode;
      smtpEnabled?: boolean;
      emailEnabled?: boolean;
      emailFromName?: string | null;
      emailFromAddress?: string | null;
    },
  ) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data,
    });
  }

  async clearTenantEmailDomain(tenantId: string) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        emailOutboundMode: "platform",
        emailEnabled: false,
        emailFromName: null,
        emailFromAddress: null,
        emailResendDomainId: null,
        emailDomainName: null,
        emailDomainStatus: null,
        emailDomainDnsRecords: Prisma.JsonNull,
        emailDomainVerifiedAt: null,
      },
    });
  }

  async findTenantSmtpForSettings(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        smtpEnabled: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        smtpPasswordEnc: true,
        smtpFromName: true,
        smtpFromAddress: true,
      },
    });
  }

  async patchTenantSmtpSettings(
    tenantId: string,
    data: {
      emailOutboundMode?: import("@prisma/client").EmailOutboundMode;
      smtpEnabled?: boolean;
      smtpHost?: string | null;
      smtpPort?: number | null;
      smtpSecure?: boolean;
      smtpUser?: string | null;
      smtpPasswordEnc?: string | null;
      smtpFromName?: string | null;
      smtpFromAddress?: string | null;
    },
  ) {
    return prisma.tenant.update({
      where: { id: tenantId },
      data,
    });
  }
}

export const tenantPrismaRepository = new TenantPrismaRepository();
