import type { AdminSetInviteePasswordErrorCode } from "@/application/use-cases/admin/set-invitee-password";
import type { CreateTenantUseCaseErrorCode } from "@/application/use-cases/admin/create-tenant";
import type { InviteTenantMemberErrorCode } from "@/application/use-cases/admin/invite-tenant-member";
import type { UseCaseErrorTable } from "@/lib/api/map-use-case-error";

const INVITE_SHARED = {
  EMAIL_NOT_CONFIGURED: { status: 503, errorCode: "SERVICE_UNAVAILABLE", messageKey: "errors.invitesNotConfigured" },
  EMAIL_DISABLED_ACCOUNT: { status: 409, errorCode: "CONFLICT", messageKey: "errors.emailDisabledAccount" },
  USER_ALREADY_MEMBER: { status: 409, errorCode: "CONFLICT", messageKey: "errors.userAlreadyMember" },
} as const;

export const INVITE_MEMBER_ERRORS: UseCaseErrorTable<InviteTenantMemberErrorCode> = {
  ...INVITE_SHARED,
  TENANT_NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.tenantNotFound" },
};

export const CREATE_TENANT_ERRORS: UseCaseErrorTable<CreateTenantUseCaseErrorCode> = {
  ...INVITE_SHARED,
  SLUG_CONFLICT: { status: 409, errorCode: "CONFLICT", messageKey: "errors.tenantSlugConflict" },
  // O tenant acabou de ser criado: "não encontrado" aqui é falha interna, não 404 para o cliente.
  TENANT_NOT_FOUND: { status: 500, errorCode: "INTERNAL_ERROR", messageKey: "errors.internalError" },
};

export const SET_INVITEE_PASSWORD_ERRORS: UseCaseErrorTable<AdminSetInviteePasswordErrorCode> = {
  USER_NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.userNotFound" },
  MEMBERSHIP_MISSING: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.membershipNotFound" },
  SELF_NOT_ALLOWED: { status: 403, errorCode: "FORBIDDEN", messageKey: "errors.cannotResetOwnPassword" },
  USER_NOT_ELIGIBLE: { status: 403, errorCode: "FORBIDDEN", messageKey: "errors.cannotSetPasswordForActiveUser" },
};

const TENANT_NOT_FOUND = { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.tenantNotFound" } as const;
const MEMBER_NOT_FOUND = { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.memberNotFoundInTenant" } as const;

export const UPDATE_TENANT_MEMBER_ERRORS: UseCaseErrorTable<
  "TENANT_NOT_FOUND" | "MEMBER_NOT_FOUND" | "USER_NOT_FOUND" | "OPME_NOT_FOUND" | "LAST_ADMIN"
> = {
  TENANT_NOT_FOUND,
  MEMBER_NOT_FOUND,
  USER_NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.userNotFound" },
  OPME_NOT_FOUND: { status: 422, errorCode: "VALIDATION_ERROR", messageKey: "errors.opmeSupplierNotFound" },
  LAST_ADMIN: { status: 409, errorCode: "CONFLICT", messageKey: "errors.tenantMustHaveAdmin" },
};

export const REMOVE_TENANT_MEMBER_ERRORS: UseCaseErrorTable<"TENANT_NOT_FOUND" | "MEMBER_NOT_FOUND" | "LAST_ADMIN"> = {
  TENANT_NOT_FOUND,
  MEMBER_NOT_FOUND,
  LAST_ADMIN: { status: 409, errorCode: "CONFLICT", messageKey: "errors.cannotRemoveOnlyAdmin" },
};
