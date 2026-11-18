import type { Notification } from "@prisma/client";

import type { IClientRepository } from "@/application/ports/client-repository.port";
import type { IClientVisibilityScopeReader } from "@/application/ports/client-visibility-scope-reader.port";
import type {
  INotificationRepository,
  NotificationScopeBatchRow,
} from "@/application/ports/notification-repository.port";
import type { Actor } from "@/domain/auth/actor";
import {
  getClientIdFromPlainMetadata,
  isNotificationVisibleForScope,
  isUnrestrictedClientScope,
  type TenantMembershipClientScope,
} from "@/domain/client/client-visibility";

export type NotificationScopeDeps = {
  scopes: IClientVisibilityScopeReader;
  notifications: Pick<
    INotificationRepository,
    | "findCreatedAtForCursor"
    | "findManyPaginatedBeforeCreatedAt"
    | "findManyUnreadLightBatch"
    | "countUnread"
    | "markAllRead"
    | "updateReadAtByIds"
  >;
  clients: Pick<IClientRepository, "findClientsAssigneeFieldsByIds">;
};

type ScopeViewer = Pick<Actor, "userId" | "globalRole">;
type NotificationRow = { id: string; metadata: unknown };

const CHUNK = 200;

function loadScope(deps: NotificationScopeDeps, viewer: ScopeViewer, tenantId: string) {
  return deps.scopes.loadScope(viewer.userId, tenantId, viewer.globalRole);
}

/**
 * Mantém só notificações cujo `metadata.clientId` aponta para paciente do tenant dentro do escopo.
 * Notificações sem `clientId` (ou de self-register) permanecem.
 */
async function filterByClientScope(
  deps: NotificationScopeDeps,
  rows: NotificationRow[],
  tenantId: string,
  scope: TenantMembershipClientScope,
  viewerUserId: string,
): Promise<NotificationRow[]> {
  if (isUnrestrictedClientScope(scope)) return rows;

  const clientIds = [
    ...new Set(rows.map((r) => getClientIdFromPlainMetadata(r.metadata)).filter((id): id is string => id !== null)),
  ];
  if (clientIds.length === 0) return rows;

  const clients = await deps.clients.findClientsAssigneeFieldsByIds(tenantId, clientIds);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  return rows.filter((n) =>
    isNotificationVisibleForScope(
      n.metadata,
      clientById.get(getClientIdFromPlainMetadata(n.metadata) ?? ""),
      scope,
      viewerUserId,
    ),
  );
}

type ListParams = {
  actor: Actor;
  tenantId: string;
  userId: string;
  limit: number;
  cursor: string | undefined;
  unreadOnly: boolean;
};

async function listUnrestricted(deps: NotificationScopeDeps, p: ListParams) {
  const { tenantId, userId, limit, cursor, unreadOnly } = p;
  const cursorCreatedAt = cursor
    ? await deps.notifications.findCreatedAtForCursor(tenantId, userId, cursor)
    : undefined;
  if (cursor && cursorCreatedAt === null) return { rows: [], nextCursor: null };

  const rows = (await deps.notifications.findManyPaginatedBeforeCreatedAt({
    tenantId,
    userId,
    unreadOnly,
    beforeCreatedAt: cursorCreatedAt ?? undefined,
    take: limit + 1,
  })) as Notification[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { rows: page, nextCursor: hasMore ? page[page.length - 1]!.id : null };
}

/** Lista notificações com paginação por cursor, aplicando escopo de paciente quando necessário. */
export async function listNotificationsWithClientScope(
  params: ListParams,
  deps: NotificationScopeDeps,
): Promise<{ rows: Notification[]; nextCursor: string | null }> {
  const { actor, tenantId, userId, limit, cursor, unreadOnly } = params;
  const scope = await loadScope(deps, actor, tenantId);
  if (isUnrestrictedClientScope(scope)) return listUnrestricted(deps, params);

  let fetchBefore: Date | null = null;
  if (cursor) {
    fetchBefore = await deps.notifications.findCreatedAtForCursor(tenantId, userId, cursor);
    if (fetchBefore === null) return { rows: [], nextCursor: null };
  }

  const page: Notification[] = [];
  while (page.length < limit + 1) {
    const batch = (await deps.notifications.findManyPaginatedBeforeCreatedAt({
      tenantId,
      userId,
      unreadOnly,
      beforeCreatedAt: fetchBefore ?? undefined,
      take: CHUNK,
    })) as Notification[];
    if (batch.length === 0) break;

    fetchBefore = batch[batch.length - 1]!.createdAt;
    const allowed = new Set(
      (await filterByClientScope(deps, batch, tenantId, scope, userId)).map((f) => f.id),
    );
    for (const n of batch) {
      if (!allowed.has(n.id)) continue;
      page.push(n);
      if (page.length >= limit + 1) break;
    }
    if (batch.length < CHUNK) break;
  }

  const hasMore = page.length > limit;
  const slice = hasMore ? page.slice(0, limit) : page;
  return { rows: slice, nextCursor: hasMore ? slice[slice.length - 1]!.id : null };
}

/** Percorre as não lidas em lotes, entregando ao callback as que passam no escopo. */
async function forEachVisibleUnreadBatch(
  deps: NotificationScopeDeps,
  args: { tenantId: string; userId: string; scope: TenantMembershipClientScope },
  onVisible: (visible: NotificationRow[]) => Promise<void>,
): Promise<void> {
  let fetchBefore: Date | null = null;
  for (;;) {
    const batch: NotificationScopeBatchRow[] = await deps.notifications.findManyUnreadLightBatch({
      tenantId: args.tenantId,
      userId: args.userId,
      beforeCreatedAt: fetchBefore ?? undefined,
      take: CHUNK,
    });
    if (batch.length === 0) break;

    fetchBefore = batch[batch.length - 1]!.createdAt;
    const visible = await filterByClientScope(
      deps,
      batch.map((b) => ({ id: b.id, metadata: b.metadata })),
      args.tenantId,
      args.scope,
      args.userId,
    );
    await onVisible(visible);
    if (batch.length < CHUNK) break;
  }
}

export async function countUnreadNotificationsWithClientScope(
  actor: ScopeViewer,
  tenantId: string,
  userId: string,
  deps: NotificationScopeDeps,
): Promise<number> {
  const scope = await loadScope(deps, actor, tenantId);
  if (isUnrestrictedClientScope(scope)) return deps.notifications.countUnread(tenantId, userId);

  let total = 0;
  await forEachVisibleUnreadBatch(deps, { tenantId, userId, scope }, async (visible) => {
    total += visible.length;
  });
  return total;
}

export async function markAllUnreadNotificationsReadWithClientScope(
  actor: ScopeViewer,
  tenantId: string,
  userId: string,
  deps: NotificationScopeDeps,
): Promise<number> {
  const scope = await loadScope(deps, actor, tenantId);
  if (isUnrestrictedClientScope(scope)) return deps.notifications.markAllRead(tenantId, userId);

  const now = new Date();
  let total = 0;
  await forEachVisibleUnreadBatch(deps, { tenantId, userId, scope }, async (visible) => {
    if (visible.length === 0) return;
    total += await deps.notifications.updateReadAtByIds(tenantId, userId, visible.map((v) => v.id), now);
  });
  return total;
}

export async function assertNotificationVisibleToClientScope(
  actor: ScopeViewer,
  tenantId: string,
  userId: string,
  notification: Pick<Notification, "id" | "metadata">,
  deps: NotificationScopeDeps,
): Promise<boolean> {
  const scope = await loadScope(deps, actor, tenantId);
  const visible = await filterByClientScope(deps, [notification], tenantId, scope, userId);
  return visible.length > 0;
}

/**
 * SSE / payloads sem sessão completa: aplica a mesma regra de `metadata.clientId` que a API REST.
 */
export async function isNotificationMetadataVisibleToViewer(
  params: { userId: string; globalRole: string; tenantId: string; metadata: unknown },
  deps: NotificationScopeDeps,
): Promise<boolean> {
  const metadata =
    params.metadata === undefined || params.metadata === null
      ? null
      : (JSON.parse(JSON.stringify(params.metadata)) as unknown);
  const scope = await loadScope(deps, params, params.tenantId);
  const visible = await filterByClientScope(deps, [{ id: "sse", metadata }], params.tenantId, scope, params.userId);
  return visible.length > 0;
}
