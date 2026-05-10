import { AuthTokenPurpose, GlobalRole, TenantRole } from "@prisma/client";

import { formatTaxDocumentDisplay } from "@/lib/validators/tax-document";

import type {
  InviteExistingUserToTenantParams,
  InviteNewUserToTenantParams,
  IUserRepository,
  TenantMembershipRole,
} from "@/application/ports/user-repository.port";
import type { InviteSetPasswordPreviewDto } from "@/types/api/auth-v1";
import { prisma } from "@/infrastructure/database/prisma";

export class UserPrismaRepository implements IUserRepository {
  async findById(tenantId: string, userId: string) {
    return prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        memberships: { some: { tenantId } },
      },
    });
  }

  async findMany(tenantId: string, userIds?: string[]) {
    return prisma.user.findMany({
      where: {
        deletedAt: null,
        memberships: { some: { tenantId } },
        ...(userIds && userIds.length > 0 ? { id: { in: userIds } } : {}),
      },
      orderBy: { email: "asc" },
    });
  }

  async validateTenantMembership(tenantId: string, userId: string) {
    const row = await prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { id: true },
    });
    return row != null;
  }

  async getTenantMembershipRole(tenantId: string, userId: string): Promise<TenantMembershipRole | null> {
    const row = await prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { role: true },
    });
    if (!row) return null;
    return row.role === TenantRole.tenant_admin ? "tenant_admin" : "tenant_user";
  }

  async findActiveByIdGlobal(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        globalRole: true,
        emailVerified: true,
        activeTenantId: true,
        createdAt: true,
      },
    });
  }

  async findMembershipForUser(userId: string, tenantId: string) {
    return prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
  }

  async updateUserProfile(userId: string, data: { name?: string | null; image?: string | null }) {
    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        globalRole: true,
        emailVerified: true,
      },
    });
  }

  async softDeleteUserAndSessions(userId: string) {
    const now = new Date();
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: { deletedAt: now },
      }),
    ]);
  }

  async setActiveTenantId(userId: string, tenantId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { activeTenantId: tenantId },
    });
  }

  async findUserForTenantInvite(emailNorm: string, tenantId: string) {
    const existing = await prisma.user.findFirst({
      where: { email: emailNorm },
      select: {
        id: true,
        deletedAt: true,
        passwordHash: true,
        memberships: { where: { tenantId }, select: { id: true } },
      },
    });
    if (!existing) {
      return null;
    }
    return {
      id: existing.id,
      deletedAt: existing.deletedAt,
      passwordHash: existing.passwordHash,
      hasMembershipInTenant: existing.memberships.length > 0,
    };
  }

  async inviteExistingUserToTenant(params: InviteExistingUserToTenantParams) {
    const { userId, tenantId, role, nameTrimmed, token, expiresAt, needsInviteEmail } = params;
    const prismaRole = role === "tenant_admin" ? TenantRole.tenant_admin : TenantRole.tenant_user;

    await prisma.$transaction(async (tx) => {
      if (nameTrimmed) {
        await tx.user.update({
          where: { id: userId },
          data: { name: nameTrimmed },
        });
      }

      await tx.tenantMembership.create({
        data: {
          userId,
          tenantId,
          role: prismaRole,
        },
      });

      await tx.userAuthToken.deleteMany({
        where: {
          userId,
          tenantId,
          purpose: AuthTokenPurpose.INVITE_SET_PASSWORD,
          usedAt: null,
        },
      });

      if (needsInviteEmail) {
        await tx.userAuthToken.create({
          data: {
            token,
            userId,
            tenantId,
            purpose: AuthTokenPurpose.INVITE_SET_PASSWORD,
            expiresAt,
          },
        });
      }
    });
  }

  async inviteNewUserToTenant(params: InviteNewUserToTenantParams): Promise<string> {
    const { emailNorm, name, tenantId, role, token, expiresAt } = params;
    const prismaRole = role === "tenant_admin" ? TenantRole.tenant_admin : TenantRole.tenant_user;

    const userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: emailNorm,
          name: name?.trim() || null,
          passwordHash: null,
          globalRole: GlobalRole.user,
        },
      });

      await tx.tenantMembership.create({
        data: {
          userId: user.id,
          tenantId,
          role: prismaRole,
        },
      });

      await tx.userAuthToken.create({
        data: {
          token,
          userId: user.id,
          tenantId,
          purpose: AuthTokenPurpose.INVITE_SET_PASSWORD,
          expiresAt,
        },
      });

      return user.id;
    });

    return userId;
  }

  async setInitialPasswordForUser(params: { userId: string; passwordHash: string }): Promise<void> {
    const { userId, passwordHash } = params;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      prisma.userAuthToken.updateMany({
        where: {
          userId,
          purpose: AuthTokenPurpose.INVITE_SET_PASSWORD,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  async findActiveUserForPasswordReset(emailNorm: string) {
    return prisma.user.findFirst({
      where: { email: emailNorm, deletedAt: null },
      select: { id: true, name: true, email: true, passwordHash: true },
    });
  }

  async createPasswordResetToken(params: { token: string; userId: string; expiresAt: Date }) {
    await prisma.userAuthToken.create({
      data: {
        token: params.token,
        userId: params.userId,
        purpose: AuthTokenPurpose.PASSWORD_RESET,
        expiresAt: params.expiresAt,
      },
    });
  }

  async findUserAuthTokenWithUserForReset(token: string) {
    const row = await prisma.userAuthToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      userId: row.userId,
      tenantId: row.tenantId,
      purpose: row.purpose,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
      user: { id: row.user.id, passwordHash: row.user.passwordHash },
    };
  }

  async applyPasswordResetAndConsumeToken(params: {
    tokenId: string;
    userId: string;
    passwordHash: string;
    activeTenantId: string | null | undefined;
  }) {
    const { tokenId, userId, passwordHash, activeTenantId } = params;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          ...(activeTenantId ? { activeTenantId } : {}),
        },
      }),
      prisma.userAuthToken.update({
        where: { id: tokenId },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  async findFirstTenantIdForUser(userId: string) {
    const m = await prisma.tenantMembership.findFirst({
      where: { userId },
      select: { tenantId: true },
    });
    return m?.tenantId ?? null;
  }

  async findActiveUserPasswordHash(userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, passwordHash: true },
    });
  }

  async updateUserPasswordHash(userId: string, passwordHash: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async findUsersGlobalRoleByIds(userIds: string[]) {
    if (userIds.length === 0) {
      return [];
    }
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, globalRole: true },
    });
  }

  async findTenantMembershipsScopeForUsers(tenantId: string, userIds: string[]) {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await prisma.tenantMembership.findMany({
      where: { tenantId, userId: { in: userIds } },
      select: {
        userId: true,
        role: true,
        restrictedToAssignedOnly: true,
        linkedOpmeSupplierId: true,
      },
    });
    return rows.map((m) => ({
      userId: m.userId,
      role: m.role,
      restrictedToAssignedOnly: m.restrictedToAssignedOnly,
      linkedOpmeSupplierId: m.linkedOpmeSupplierId,
    }));
  }

  async findManyForStageAssigneeSummaries(userIds: string[]) {
    if (userIds.length === 0) {
      return [];
    }
    return prisma.user.findMany({
      where: { id: { in: userIds }, deletedAt: null },
      select: { id: true, name: true, email: true },
    });
  }

  async findInviteSetPasswordPreview(token: string): Promise<InviteSetPasswordPreviewDto | null> {
    const row = await prisma.userAuthToken.findUnique({
      where: { token },
      include: {
        user: { select: { name: true, email: true, deletedAt: true } },
        tenant: { select: { name: true, taxId: true } },
      },
    });
    if (!row) {
      return null;
    }
    if (
      row.purpose !== AuthTokenPurpose.INVITE_SET_PASSWORD ||
      row.usedAt ||
      row.expiresAt < new Date() ||
      row.user.deletedAt
    ) {
      return null;
    }
    if (!row.tenantId || !row.tenant) {
      return null;
    }
    const taxRaw = row.tenant.taxId?.trim();
    return {
      userName: row.user.name?.trim() || null,
      userEmail: row.user.email,
      tenantName: row.tenant.name.trim(),
      tenantTaxIdDisplay: taxRaw ? formatTaxDocumentDisplay(taxRaw) : null,
    };
  }
}

export const userPrismaRepository = new UserPrismaRepository();
