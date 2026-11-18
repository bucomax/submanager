import type { Prisma, PrismaClient } from "@prisma/client";

import type { AuditRecordInput, IAuditRecorder } from "@/application/ports/audit-recorder.port";
import { recordAuditEvent } from "@/infrastructure/audit/record-audit-event";

type Db = Prisma.TransactionClient | PrismaClient;

/** Adapter do port sobre `recordAuditEvent`; com um `tx` participa da transação. */
export function createPrismaAuditRecorder(db: Db): IAuditRecorder {
  return {
    record: (input: AuditRecordInput) =>
      recordAuditEvent(db, { ...input, payload: input.payload as Prisma.InputJsonValue }),
  };
}
