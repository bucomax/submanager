import type { UseCaseErrorTable } from "@/lib/api/map-use-case-error";

const TENANT_NOT_FOUND = { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.tenantNotFound" } as const;
const RESEND_NOT_CONFIGURED = {
  status: 503,
  errorCode: "SERVICE_UNAVAILABLE",
  messageKey: "errors.emailResendNotConfigured",
} as const;

export const EMAIL_DOMAIN_SETUP_ERRORS: UseCaseErrorTable<
  "TENANT_NOT_FOUND" | "RESEND_NOT_CONFIGURED" | "ALREADY_HAS_DOMAIN" | "RESEND_DUPLICATE" | "RESEND_ERROR"
> = {
  TENANT_NOT_FOUND,
  RESEND_NOT_CONFIGURED,
  ALREADY_HAS_DOMAIN: { status: 409, errorCode: "CONFLICT", messageKey: "errors.emailDomainAlreadyConfigured" },
  RESEND_DUPLICATE: { status: 409, errorCode: "CONFLICT", messageKey: "errors.emailDomainResendDuplicate" },
  RESEND_ERROR: { status: 502, errorCode: "BAD_GATEWAY", messageKey: "errors.emailDomainResendCreateFailed" },
};

export const EMAIL_DOMAIN_PATCH_ERRORS: UseCaseErrorTable<"TENANT_NOT_FOUND" | "DOMAIN_NOT_VERIFIED" | "VALIDATION"> = {
  TENANT_NOT_FOUND,
  DOMAIN_NOT_VERIFIED: { status: 412, errorCode: "PRECONDITION_FAILED", messageKey: "errors.emailDomainNotVerified" },
  VALIDATION: { status: 422, errorCode: "VALIDATION_ERROR", messageKey: "errors.emailFromAddressMustMatchDomain" },
};

export const EMAIL_DOMAIN_REMOVE_ERRORS: UseCaseErrorTable<
  "TENANT_NOT_FOUND" | "RESEND_NOT_CONFIGURED" | "RESEND_ERROR"
> = {
  TENANT_NOT_FOUND,
  // Comportamento preservado: sem Resend configurado, remover responde como tenant inexistente.
  RESEND_NOT_CONFIGURED: TENANT_NOT_FOUND,
  RESEND_ERROR: { status: 502, errorCode: "BAD_GATEWAY", messageKey: "errors.emailDomainResendRemoveFailed" },
};

export const EMAIL_DOMAIN_VERIFY_ERRORS: UseCaseErrorTable<
  "TENANT_NOT_FOUND" | "RESEND_NOT_CONFIGURED" | "NO_DOMAIN" | "RESEND_ERROR"
> = {
  TENANT_NOT_FOUND,
  RESEND_NOT_CONFIGURED,
  NO_DOMAIN: { status: 412, errorCode: "PRECONDITION_FAILED", messageKey: "errors.emailDomainNotConfigured" },
  RESEND_ERROR: { status: 502, errorCode: "BAD_GATEWAY", messageKey: "errors.emailDomainResendVerifyFailed" },
};

export const SMTP_PATCH_ERRORS: UseCaseErrorTable<
  "TENANT_NOT_FOUND" | "ENCRYPTION_KEY" | "INVALID_SMTP_WHEN_ENABLING" | "VALIDATION"
> = {
  TENANT_NOT_FOUND,
  ENCRYPTION_KEY: { status: 500, errorCode: "INTERNAL_ERROR", messageKey: "errors.smtpEncryptionKeyInvalid" },
  INVALID_SMTP_WHEN_ENABLING: {
    status: 422,
    errorCode: "UNPROCESSABLE_ENTITY",
    messageKey: "errors.smtpInvalidWhenEnabling",
  },
  VALIDATION: { status: 422, errorCode: "VALIDATION_ERROR", messageKey: "errors.invalidJson" },
};

export const SMTP_TEST_ERRORS: UseCaseErrorTable<"TENANT_NOT_FOUND" | "INCOMPLETE" | "SEND_FAILED"> = {
  TENANT_NOT_FOUND,
  INCOMPLETE: { status: 412, errorCode: "PRECONDITION_FAILED", messageKey: "errors.smtpIncomplete" },
  SEND_FAILED: { status: 502, errorCode: "BAD_GATEWAY", messageKey: "errors.smtpTestFailed" },
};
