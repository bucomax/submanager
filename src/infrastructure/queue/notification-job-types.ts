import type { NotificationType } from "@prisma/client";

export type NotificationJobPayload = {
  tenantId: string;
  type: NotificationType;
  title: string;
  body?: string;
  metadata?: Record<string, unknown>;
  userIds: string[];
  /** Gravada em cada `Notification`; `createMany({ skipDuplicates })` descarta repetidas por usuário. */
  dedupeKey?: string;
};
