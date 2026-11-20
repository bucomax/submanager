import type { UseCaseErrorTable } from "@/lib/api/map-use-case-error";

export const CREATE_PATIENT_PATHWAY_ERRORS: UseCaseErrorTable<
  "CLIENT_NOT_FOUND" | "ACTIVE_PATHWAY_EXISTS" | "PATHWAY_NOT_FOUND" | "NO_PUBLISHED_VERSION"
> = {
  CLIENT_NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.patientNotFoundInTenant" },
  ACTIVE_PATHWAY_EXISTS: { status: 409, errorCode: "CONFLICT", messageKey: "errors.patientAlreadyInJourney" },
  PATHWAY_NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.pathwayNotFound" },
  NO_PUBLISHED_VERSION: { status: 409, errorCode: "CONFLICT", messageKey: "errors.noPublishedVersionWithStages" },
};

const STAGE_CONFLICT = { status: 409, errorCode: "CONFLICT", messageKey: "errors.stageTransitionConflict" } as const;

/** `CHECKLIST_BLOCKED` carrega `pendingItems` e é tratado no handler. */
export const TRANSITION_STAGE_ERRORS: UseCaseErrorTable<
  | "PATIENT_PATHWAY_NOT_FOUND"
  | "PATHWAY_ALREADY_COMPLETED"
  | "TARGET_STAGE_NOT_FOUND"
  | "ALREADY_IN_TARGET_STAGE"
  | "LOCK_CONFLICT"
  | "STAGE_CONFLICT"
  | "OVERRIDE_REASON_REQUIRED"
> = {
  PATIENT_PATHWAY_NOT_FOUND: {
    status: 404,
    errorCode: "NOT_FOUND",
    messageKey: "errors.patientPathwayInstanceNotFound",
  },
  PATHWAY_ALREADY_COMPLETED: { status: 409, errorCode: "CONFLICT", messageKey: "errors.pathwayAlreadyCompleted" },
  TARGET_STAGE_NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.invalidStageForVersion" },
  ALREADY_IN_TARGET_STAGE: { status: 422, errorCode: "VALIDATION_ERROR", messageKey: "errors.patientAlreadyInStage" },
  LOCK_CONFLICT: STAGE_CONFLICT,
  STAGE_CONFLICT,
  OVERRIDE_REASON_REQUIRED: {
    status: 422,
    errorCode: "VALIDATION_ERROR",
    messageKey: "errors.validationOverrideReasonMin",
  },
};

export const COMPLETE_PATIENT_PATHWAY_ERRORS: UseCaseErrorTable<"NOT_FOUND" | "ALREADY_COMPLETED"> = {
  NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.patientPathwayInstanceNotFound" },
  ALREADY_COMPLETED: { status: 409, errorCode: "CONFLICT", messageKey: "errors.pathwayAlreadyCompleted" },
};

export const PATCH_CHECKLIST_ITEM_ERRORS: UseCaseErrorTable<"PP_NOT_FOUND" | "ITEM_NOT_FOUND" | "WRONG_STAGE"> = {
  PP_NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.patientPathwayNotFound" },
  ITEM_NOT_FOUND: { status: 404, errorCode: "NOT_FOUND", messageKey: "errors.checklistItemNotFound" },
  WRONG_STAGE: { status: 422, errorCode: "VALIDATION_ERROR", messageKey: "errors.checklistOnlyCurrentStage" },
};
