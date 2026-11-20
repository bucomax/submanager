import type { NotificationType } from "@prisma/client";

export type EmitNotificationInput = {
  tenantId: string;
  type: NotificationType;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
  /** When empty, notifies all members of the tenant. */
  targetUserIds?: string[];
  /**
   * Deterministic key for deduplication (e.g. patientPathwayId, transitionId): BullMQ jobId and,
   * when `dedupeKey` is omitted, also the per-user `Notification.dedupeKey` (`<type>|<correlationId>`).
   */
  correlationId?: string;
  /**
   * Atomic per-user dedupe (`Notification @@unique([userId, dedupeKey])`): a user never gets two
   * notifications with the same key, in queue or inline mode. Overrides the key derived from `correlationId`.
   */
  dedupeKey?: string;
  /**
   * Quando true, ignora preferências do tenant (`notifyNewPatients`, etc.) para este envio.
   * Usar só em eventos críticos explícitos (ex.: auto-cadastro pelo link/QR).
   */
  ignoreTenantNotificationPreference?: boolean;
  /**
   * Quando true, não restringe destinatários pelo escopo de visibilidade do paciente
   * (`metadata.clientId`). Usar em avisos operacionais ao tenant inteiro (ex.: auto-cadastro).
   */
  skipClientVisibilityFilter?: boolean;
};

export interface INotificationEmitter {
  emit(input: EmitNotificationInput): Promise<void>;
}
