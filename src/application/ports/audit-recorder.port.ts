import type { AuditEventTypeName } from "@/domain/audit/audit-event-type";

export type AuditRecordInput = {
  tenantId: string;
  clientId?: string | null;
  patientPathwayId?: string | null;
  actorUserId?: string | null;
  type: AuditEventTypeName;
  /** LGPD: sem payload clínico. */
  payload: Record<string, unknown>;
};

/** Grava `AuditEvent`; quando obtido de um repositório transacional, participa da mesma transação. */
export interface IAuditRecorder {
  record(input: AuditRecordInput): Promise<void>;
}
