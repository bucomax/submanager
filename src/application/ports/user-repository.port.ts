import type { InviteSetPasswordPreviewDto } from "@/types/api/auth-v1";

export type TenantMembershipRole = "tenant_admin" | "tenant_user";

export type UserForTenantInviteRow = {
  id: string;
  deletedAt: Date | null;
  passwordHash: string | null;
  hasMembershipInTenant: boolean;
};

export type InviteExistingUserToTenantParams = {
  userId: string;
  tenantId: string;
  role: TenantMembershipRole;
  nameTrimmed?: string | null;
  token: string;
  expiresAt: Date;
  needsInviteEmail: boolean;
};

export type InviteNewUserToTenantParams = {
  emailNorm: string;
  name: string | null;
  tenantId: string;
  role: TenantMembershipRole;
  token: string;
  expiresAt: Date;
};

export interface IUserRepository {
  findById(tenantId: string, userId: string): Promise<unknown | null>;
  findMany(tenantId: string, userIds?: string[]): Promise<unknown[]>;
  validateTenantMembership(tenantId: string, userId: string): Promise<boolean>;
  /** `null` se não há membership no tenant. */
  getTenantMembershipRole(tenantId: string, userId: string): Promise<TenantMembershipRole | null>;
  /** Usuário ativo (não soft-deleted), p.ex. `GET /me`. */
  findActiveByIdGlobal(userId: string): Promise<unknown | null>;
  /** Membership no par user+tenant. */
  findMembershipForUser(userId: string, tenantId: string): Promise<unknown | null>;
  updateUserProfile(
    userId: string,
    data: { name?: string | null; image?: string | null },
  ): Promise<unknown>;
  /** Soft delete + remove sessões NextAuth persistidas. */
  softDeleteUserAndSessions(userId: string): Promise<void>;

  setActiveTenantId(userId: string, tenantId: string): Promise<void>;

  findUserForTenantInvite(
    emailNorm: string,
    tenantId: string,
  ): Promise<UserForTenantInviteRow | null>;

  inviteExistingUserToTenant(params: InviteExistingUserToTenantParams): Promise<void>;

  /** Returns the newly created user id. */
  inviteNewUserToTenant(params: InviteNewUserToTenantParams): Promise<string>;

  /** Sets the initial password hash and invalidates all active INVITE_SET_PASSWORD tokens. */
  setInitialPasswordForUser(params: { userId: string; passwordHash: string }): Promise<void>;

  findActiveUserForPasswordReset(emailNorm: string): Promise<{
    id: string;
    name: string | null;
    email: string;
    passwordHash: string | null;
  } | null>;

  createPasswordResetToken(params: { token: string; userId: string; expiresAt: Date }): Promise<void>;

  findUserAuthTokenWithUserForReset(token: string): Promise<{
    id: string;
    userId: string;
    tenantId: string | null;
    purpose: string;
    expiresAt: Date;
    usedAt: Date | null;
    user: { id: string; passwordHash: string | null };
  } | null>;

  applyPasswordResetAndConsumeToken(params: {
    tokenId: string;
    userId: string;
    passwordHash: string;
    activeTenantId: string | null | undefined;
  }): Promise<void>;

  findFirstTenantIdForUser(userId: string): Promise<string | null>;

  findActiveUserPasswordHash(userId: string): Promise<{ id: string; passwordHash: string | null } | null>;

  updateUserPasswordHash(userId: string, passwordHash: string): Promise<void>;

  findUsersGlobalRoleByIds(userIds: string[]): Promise<Array<{ id: string; globalRole: string }>>;

  findTenantMembershipsScopeForUsers(
    tenantId: string,
    userIds: string[],
  ): Promise<
    Array<{
      userId: string;
      role: string;
      restrictedToAssignedOnly: boolean;
      linkedOpmeSupplierId: string | null;
    }>
  >;

  /** Labels de responsáveis na ficha do paciente (timeline de etapas). */
  findManyForStageAssigneeSummaries(
    userIds: string[],
  ): Promise<Array<{ id: string; name: string | null; email: string }>>;

  /**
   * Metadados para tela de convite / e-mail (apenas token `INVITE_SET_PASSWORD` válido e não expirado).
   */
  findInviteSetPasswordPreview(token: string): Promise<InviteSetPasswordPreviewDto | null>;
}
