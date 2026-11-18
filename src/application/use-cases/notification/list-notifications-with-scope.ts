import type { Notification } from "@prisma/client";

import {
  assertNotificationVisibleToClientScope as assertVisibleCore,
  countUnreadNotificationsWithClientScope as countUnreadCore,
  isNotificationMetadataVisibleToViewer as isMetadataVisibleCore,
  listNotificationsWithClientScope as listCore,
  markAllUnreadNotificationsReadWithClientScope as markAllReadCore,
  type NotificationScopeDeps,
} from "@/application/use-cases/notification/list-notifications-with-scope.core";
import type { Actor } from "@/domain/auth/actor";
import { defaultNotificationScopeDeps } from "@/infrastructure/composition/notification-scope-deps";

export type { NotificationScopeDeps };

/** Pontos de entrada de produção (usados pelas rotas); a lógica vive em `*.core.ts`. */
export function listNotificationsWithClientScope(
  params: Parameters<typeof listCore>[0],
  deps: NotificationScopeDeps = defaultNotificationScopeDeps,
): ReturnType<typeof listCore> {
  return listCore(params, deps);
}

export function countUnreadNotificationsWithClientScope(
  actor: Actor,
  tenantId: string,
  userId: string,
  deps: NotificationScopeDeps = defaultNotificationScopeDeps,
): Promise<number> {
  return countUnreadCore(actor, tenantId, userId, deps);
}

export function markAllUnreadNotificationsReadWithClientScope(
  actor: Actor,
  tenantId: string,
  userId: string,
  deps: NotificationScopeDeps = defaultNotificationScopeDeps,
): Promise<number> {
  return markAllReadCore(actor, tenantId, userId, deps);
}

export function assertNotificationVisibleToClientScope(
  actor: Actor,
  tenantId: string,
  userId: string,
  notification: Pick<Notification, "id" | "metadata">,
  deps: NotificationScopeDeps = defaultNotificationScopeDeps,
): Promise<boolean> {
  return assertVisibleCore(actor, tenantId, userId, notification, deps);
}

export function isNotificationMetadataVisibleToViewer(
  params: Parameters<typeof isMetadataVisibleCore>[0],
  deps: NotificationScopeDeps = defaultNotificationScopeDeps,
): Promise<boolean> {
  return isMetadataVisibleCore(params, deps);
}
