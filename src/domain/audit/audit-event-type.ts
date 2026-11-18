/**
 * Tipos de `AuditEvent` usados pelos casos de uso críticos.
 * Os valores espelham o enum Prisma `AuditEventType` (a infra faz a ponte).
 */
export const AuditEventType = {
  STAGE_TRANSITION: "STAGE_TRANSITION",
  PATIENT_PATHWAY_STARTED: "PATIENT_PATHWAY_STARTED",
  SELF_REGISTER_COMPLETED: "SELF_REGISTER_COMPLETED",
  PATIENT_PORTAL_PASSWORD_SET: "PATIENT_PORTAL_PASSWORD_SET",
  PATIENT_CONSENT_GIVEN: "PATIENT_CONSENT_GIVEN",
  PATIENT_CREATED: "PATIENT_CREATED",
  PATIENT_UPDATED: "PATIENT_UPDATED",
  PATIENT_DELETED: "PATIENT_DELETED",
} as const;

export type AuditEventTypeName = (typeof AuditEventType)[keyof typeof AuditEventType];
