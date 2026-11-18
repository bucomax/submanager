import type { NotificationScopeDeps } from "@/application/use-cases/notification/list-notifications-with-scope.core";
import { clientPrismaRepository } from "@/infrastructure/repositories/client.repository";
import { notificationPrismaRepository } from "@/infrastructure/repositories/notification.repository";
import { prismaClientVisibilityScopeReader } from "@/infrastructure/visibility/client-visibility-scope";

export const defaultNotificationScopeDeps: NotificationScopeDeps = {
  scopes: prismaClientVisibilityScopeReader,
  notifications: notificationPrismaRepository,
  clients: clientPrismaRepository,
};
