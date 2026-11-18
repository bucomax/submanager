import type { IClientVisibilityScopeReader } from "@/application/ports/client-visibility-scope-reader.port";
import type { NotificationScopeBatchRow } from "@/application/ports/notification-repository.port";
import type { NotificationScopeDeps } from "@/application/use-cases/notification/list-notifications-with-scope.core";
import { resolveClientScope, type TenantMembershipScopeRow } from "@/domain/client/client-visibility";

export type FakeNotification = {
  id: string;
  tenantId: string;
  userId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  readAt: Date | null;
};

export type FakeClient = { id: string; tenantId: string; assignedToUserId: string | null; opmeSupplierId: string | null };

export type InMemoryNotificationWorld = {
  notifications: FakeNotification[];
  clients: FakeClient[];
  /** `tenantId:userId` → membership. Ausente = escopo mais restrito. */
  memberships: Map<string, TenantMembershipScopeRow>;
};

export function createInMemoryNotificationScopeDeps(world: InMemoryNotificationWorld): NotificationScopeDeps {
  const scopes: IClientVisibilityScopeReader = {
    async loadScope(userId, tenantId, globalRole) {
      return resolveClientScope(globalRole, world.memberships.get(`${tenantId}:${userId}`) ?? null);
    },
  };

  const mine = (tenantId: string, userId: string) =>
    world.notifications
      .filter((n) => n.tenantId === tenantId && n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const before = (rows: FakeNotification[], beforeCreatedAt?: Date | null) =>
    beforeCreatedAt ? rows.filter((n) => n.createdAt < beforeCreatedAt) : rows;

  return {
    scopes,
    clients: {
      async findClientsAssigneeFieldsByIds(tenantId, ids) {
        return world.clients
          .filter((c) => c.tenantId === tenantId && ids.includes(c.id))
          .map(({ id, assignedToUserId, opmeSupplierId }) => ({ id, assignedToUserId, opmeSupplierId }));
      },
    },
    notifications: {
      async findCreatedAtForCursor(tenantId, userId, id) {
        return mine(tenantId, userId).find((n) => n.id === id)?.createdAt ?? null;
      },
      async findManyPaginatedBeforeCreatedAt({ tenantId, userId, unreadOnly, beforeCreatedAt, take }) {
        const rows = mine(tenantId, userId).filter((n) => !unreadOnly || n.readAt === null);
        return before(rows, beforeCreatedAt).slice(0, take);
      },
      async findManyUnreadLightBatch({ tenantId, userId, beforeCreatedAt, take }): Promise<NotificationScopeBatchRow[]> {
        const rows = mine(tenantId, userId).filter((n) => n.readAt === null);
        return before(rows, beforeCreatedAt)
          .slice(0, take)
          .map(({ id, metadata, createdAt }) => ({ id, metadata, createdAt }));
      },
      async countUnread(tenantId, userId) {
        return mine(tenantId, userId).filter((n) => n.readAt === null).length;
      },
      async markAllRead(tenantId, userId) {
        const unread = mine(tenantId, userId).filter((n) => n.readAt === null);
        unread.forEach((n) => (n.readAt = new Date()));
        return unread.length;
      },
      async updateReadAtByIds(tenantId, userId, ids, readAt) {
        const rows = mine(tenantId, userId).filter((n) => ids.includes(n.id) && n.readAt === null);
        rows.forEach((n) => (n.readAt = readAt));
        return rows.length;
      },
    },
  };
}
