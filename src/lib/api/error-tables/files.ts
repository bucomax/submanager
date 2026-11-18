import type { UseCaseErrorTable } from "@/lib/api/map-use-case-error";

/** `MIME_MISMATCH` recebe `details: { declaredMime }` no handler. */
export const STAFF_FILE_REGISTER_ERRORS: UseCaseErrorTable<
  | "INVALID_KEY"
  | "MIME_MISMATCH"
  | "FILE_TOO_LARGE"
  | "STORAGE_UNAVAILABLE"
  | "CONFLICT"
  | "DATABASE_SCHEMA_PENDING"
  | "INTERNAL"
> = {
  INVALID_KEY: { status: 403, errorCode: "FORBIDDEN", messageKey: "errors.invalidObjectKey" },
  MIME_MISMATCH: { status: 422, errorCode: "VALIDATION_ERROR", messageKey: "errors.fileMimeTypeMismatch" },
  FILE_TOO_LARGE: { status: 413, errorCode: "PAYLOAD_TOO_LARGE", messageKey: "errors.fileTooLarge" },
  STORAGE_UNAVAILABLE: { status: 503, errorCode: "SERVICE_UNAVAILABLE", messageKey: "errors.storageNotConfigured" },
  CONFLICT: { status: 409, errorCode: "CONFLICT", messageKey: "errors.fileAlreadyRegistered" },
  DATABASE_SCHEMA_PENDING: {
    status: 503,
    errorCode: "DATABASE_SCHEMA_PENDING",
    messageKey: "errors.databaseSchemaOutdated",
  },
  INTERNAL: { status: 500, errorCode: "INTERNAL_ERROR", messageKey: "errors.internalError" },
};
