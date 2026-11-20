import type { UseCaseErrorTable } from "@/lib/api/map-use-case-error";

export const FORGOT_PASSWORD_ERRORS: UseCaseErrorTable<"EMAIL_NOT_CONFIGURED"> = {
  EMAIL_NOT_CONFIGURED: {
    status: 503,
    errorCode: "SERVICE_UNAVAILABLE",
    messageKey: "errors.passwordResetNotConfigured",
  },
};

export const RESET_PASSWORD_ERRORS: UseCaseErrorTable<
  "INVALID_TOKEN" | "TOKEN_EXPIRED" | "USE_INVITE_FOR_FIRST_PASSWORD"
> = {
  INVALID_TOKEN: { status: 400, errorCode: "INVALID_TOKEN", messageKey: "errors.invalidLinkOrUsed" },
  TOKEN_EXPIRED: { status: 400, errorCode: "TOKEN_EXPIRED", messageKey: "errors.linkExpired" },
  USE_INVITE_FOR_FIRST_PASSWORD: {
    status: 400,
    errorCode: "INVALID_TOKEN",
    messageKey: "errors.useInviteForFirstPassword",
  },
};

export const SWITCH_ACTIVE_TENANT_ERRORS: UseCaseErrorTable<"TENANT_NOT_FOUND" | "TENANT_INACTIVE" | "FORBIDDEN"> = {
  TENANT_NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.tenantNotFound" },
  TENANT_INACTIVE: { status: 403, errorCode: "TENANT_INACTIVE", messageKey: "errors.tenantInactive" },
  FORBIDDEN: { status: 403, errorCode: "FORBIDDEN", messageKey: "errors.forbiddenTenantAccess" },
};

export const CHANGE_STAFF_PASSWORD_ERRORS: UseCaseErrorTable<"NO_LOCAL_PASSWORD" | "WRONG_CURRENT_PASSWORD"> = {
  NO_LOCAL_PASSWORD: { status: 403, errorCode: "FORBIDDEN", messageKey: "errors.noLocalPassword" },
  WRONG_CURRENT_PASSWORD: {
    status: 401,
    errorCode: "INVALID_CREDENTIALS",
    messageKey: "errors.wrongCurrentPassword",
  },
};

export const PATCH_ME_ERRORS: UseCaseErrorTable<"ACCOUNT_INVALID" | "NO_FIELDS_TO_UPDATE"> = {
  ACCOUNT_INVALID: { status: 401, errorCode: "UNAUTHORIZED", messageKey: "errors.accountInvalid" },
  NO_FIELDS_TO_UPDATE: { status: 422, errorCode: "VALIDATION_ERROR", messageKey: "errors.noFieldsToUpdate" },
};
