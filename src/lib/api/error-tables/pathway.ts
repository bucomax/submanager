import type { UseCaseErrorTable } from "@/lib/api/map-use-case-error";

const PATHWAY_NOT_FOUND = { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.pathwayNotFound" } as const;
const NO_FIELDS = { status: 422, errorCode: "VALIDATION_ERROR", messageKey: "errors.noFieldsToUpdate" } as const;

export const PATHWAY_UPDATE_ERRORS: UseCaseErrorTable<"NOT_FOUND" | "NO_FIELDS_TO_UPDATE"> = {
  NOT_FOUND: PATHWAY_NOT_FOUND,
  NO_FIELDS_TO_UPDATE: NO_FIELDS,
};

export const PATHWAY_DELETE_ERRORS: UseCaseErrorTable<"NOT_FOUND" | "PATHWAY_IN_USE"> = {
  NOT_FOUND: PATHWAY_NOT_FOUND,
  PATHWAY_IN_USE: { status: 409, errorCode: "CONFLICT", messageKey: "errors.pathwayPatientsBlockDelete" },
};

export const PATHWAY_VERSION_CREATE_ERRORS: UseCaseErrorTable<"PATHWAY_NOT_FOUND" | "VERSION_CONFLICT"> = {
  PATHWAY_NOT_FOUND: PATHWAY_NOT_FOUND,
  VERSION_CONFLICT: { status: 409, errorCode: "CONFLICT", messageKey: "errors.pathwayVersionConflict" },
};

/** Jornada ou versão inexistente no tenant (publish, publish-preview). */
export const PATHWAY_VERSION_LOOKUP_ERRORS: UseCaseErrorTable<"PATHWAY_NOT_FOUND" | "VERSION_NOT_FOUND"> = {
  PATHWAY_NOT_FOUND: PATHWAY_NOT_FOUND,
  VERSION_NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.pathwayVersionNotFound" },
};

export const LINK_STAGE_DOCUMENT_ERRORS: UseCaseErrorTable<"STAGE_NOT_FOUND" | "FILE_NOT_FOUND" | "ALREADY_LINKED"> = {
  STAGE_NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.stagePublishedNotFoundInTenant" },
  FILE_NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.fileNotFoundInTenant" },
  ALREADY_LINKED: { status: 409, errorCode: "CONFLICT", messageKey: "errors.fileLinkedToStage" },
};
