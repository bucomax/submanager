import type { ClientReferenceError } from "@/application/use-cases/client/validate-client-references";
import type { UseCaseErrorTable } from "@/lib/api/map-use-case-error";

export const CLIENT_REFERENCE_ERRORS: UseCaseErrorTable<ClientReferenceError> = {
  INVALID_ASSIGNEE: { status: 422, errorCode: "VALIDATION_ERROR", messageKey: "errors.invalidAssigneeForTenant" },
  INVALID_OPME_SUPPLIER: { status: 422, errorCode: "VALIDATION_ERROR", messageKey: "errors.invalidOpmeSupplier" },
};

export const CLIENT_PORTAL_LINK_ERRORS: UseCaseErrorTable<
  "TENANT_SLUG_MISSING" | "EMAIL_NOT_CONFIGURED" | "EMAIL_SEND_FAILED"
> = {
  TENANT_SLUG_MISSING: { status: 503, errorCode: "SERVICE_UNAVAILABLE", messageKey: "errors.tenantNotFound" },
  EMAIL_NOT_CONFIGURED: { status: 503, errorCode: "SERVICE_UNAVAILABLE", messageKey: "errors.invitesNotConfigured" },
  EMAIL_SEND_FAILED: { status: 503, errorCode: "SERVICE_UNAVAILABLE", messageKey: "errors.emailSendFailedGeneric" },
};

export const CLIENT_DELETE_ERRORS: UseCaseErrorTable<"FORBIDDEN" | "NOT_FOUND"> = {
  FORBIDDEN: { status: 403, errorCode: "FORBIDDEN", messageKey: "errors.deletePatientForbidden" },
  NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.patientNotFound" },
};

const CLIENT_FILE_NOT_FOUND = { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.clientFileNotFound" } as const;

export const CLIENT_FILE_DELETE_ERRORS: UseCaseErrorTable<"FILE_NOT_FOUND" | "STORAGE_DELETE_FAILED"> = {
  FILE_NOT_FOUND: CLIENT_FILE_NOT_FOUND,
  STORAGE_DELETE_FAILED: {
    status: 503,
    errorCode: "SERVICE_UNAVAILABLE",
    messageKey: "errors.fileStorageDeleteFailed",
  },
};

export const CLIENT_FILE_REVIEW_ERRORS: UseCaseErrorTable<"FILE_NOT_FOUND" | "NOT_PENDING"> = {
  FILE_NOT_FOUND: CLIENT_FILE_NOT_FOUND,
  NOT_PENDING: { status: 409, errorCode: "INVALID_STATE", messageKey: "errors.fileNotPendingPortalReview" },
};
