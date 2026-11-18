import { beforeEach, describe, expect, it } from "vitest";

import {
  createInMemoryNotificationScopeDeps,
  type FakeNotification,
  type InMemoryNotificationWorld,
} from "@/application/testing/in-memory-notification-scope";
import {
  assertNotificationVisibleToClientScope,
  countUnreadNotificationsWithClientScope,
  isNotificationMetadataVisibleToViewer,
  listNotificationsWithClientScope,
  markAllUnreadNotificationsReadWithClientScope,
} from "@/application/use-cases/notification/list-notifications-with-scope.core";
import type { Actor } from "@/domain/auth/actor";

const TENANT = "t1";
const ME = "u-me";

const actor = (globalRole = "user"): Actor => ({ userId: ME, globalRole, tenantId: TENANT, tenantRole: null });
const day = (n: number) => new Date(Date.UTC(2026, 0, n));

function notification(id: string, day_: number, metadata: Record<string, unknown> | null, tenantId = TENANT): FakeNotification {
  return { id, tenantId, userId: ME, metadata, createdAt: day(day_), readAt: null };
}

describe("notification listing with client scope", () => {
  let world: InMemoryNotificationWorld;

  beforeEach(() => {
    world = {
      notifications: [
        notification("n-own", 5, { clientId: "c-own" }),
        notification("n-other", 4, { clientId: "c-other" }),
        notification("n-plain", 3, null),
        notification("n-selfreg", 2, { clientId: "c-other", source: "patient_self_register" }),
        notification("n-foreign", 1, { clientId: "c-foreign" }),
      ],
      clients: [
        { id: "c-own", tenantId: TENANT, assignedToUserId: ME, opmeSupplierId: null },
        { id: "c-other", tenantId: TENANT, assignedToUserId: "someone", opmeSupplierId: null },
        { id: "c-foreign", tenantId: "t2", assignedToUserId: ME, opmeSupplierId: null },
      ],
      memberships: new Map([
        [`${TENANT}:${ME}`, { role: "tenant_user", restrictedToAssignedOnly: true, linkedOpmeSupplierId: null }],
      ]),
    };
  });

  const deps = () => createInMemoryNotificationScopeDeps(world);
  const list = (extra: Partial<Parameters<typeof listNotificationsWithClientScope>[0]> = {}, g = "user") =>
    listNotificationsWithClientScope(
      { actor: actor(g), tenantId: TENANT, userId: ME, limit: 10, cursor: undefined, unreadOnly: false, ...extra },
      deps(),
    );

  it("should hide notifications about clients outside the assigned-only scope or tenant", async () => {
    const { rows } = await list();
    expect(rows.map((n) => n.id)).toEqual(["n-own", "n-plain", "n-selfreg"]);
  });

  it("should show everything to tenant admins and super admins", async () => {
    world.memberships.set(`${TENANT}:${ME}`, { role: "tenant_admin", restrictedToAssignedOnly: false, linkedOpmeSupplierId: null });
    expect((await list()).rows).toHaveLength(5);
    world.memberships.clear();
    expect((await list({}, "super_admin")).rows).toHaveLength(5);
  });

  it("should treat a missing membership as the most restrictive scope", async () => {
    world.memberships.clear();
    expect((await list()).rows.map((n) => n.id)).toEqual(["n-own", "n-plain", "n-selfreg"]);
  });

  it("should paginate by cursor over the filtered rows", async () => {
    const first = await list({ limit: 2 });
    expect(first.rows.map((n) => n.id)).toEqual(["n-own", "n-plain"]);
    expect(first.nextCursor).toBe("n-plain");

    const second = await list({ limit: 2, cursor: first.nextCursor! });
    expect(second.rows.map((n) => n.id)).toEqual(["n-selfreg"]);
    expect(second.nextCursor).toBeNull();
  });

  it("should return an empty page for an unknown cursor", async () => {
    expect(await list({ cursor: "missing" })).toEqual({ rows: [], nextCursor: null });
  });

  it("should count only visible unread notifications", async () => {
    expect(await countUnreadNotificationsWithClientScope(actor(), TENANT, ME, deps())).toBe(3);
  });

  it("should mark as read only the notifications the user can see", async () => {
    expect(await markAllUnreadNotificationsReadWithClientScope(actor(), TENANT, ME, deps())).toBe(3);
    const unread = world.notifications.filter((n) => n.readAt === null).map((n) => n.id);
    expect(unread.sort()).toEqual(["n-foreign", "n-other"]);
  });

  it("should assert visibility of a single notification and of SSE metadata", async () => {
    expect(await assertNotificationVisibleToClientScope(actor(), TENANT, ME, { id: "x", metadata: { clientId: "c-own" } }, deps())).toBe(true);
    expect(await assertNotificationVisibleToClientScope(actor(), TENANT, ME, { id: "x", metadata: { clientId: "c-other" } }, deps())).toBe(false);
    expect(
      await isNotificationMetadataVisibleToViewer({ userId: ME, globalRole: "user", tenantId: TENANT, metadata: { clientId: "c-other" } }, deps()),
    ).toBe(false);
    expect(
      await isNotificationMetadataVisibleToViewer({ userId: ME, globalRole: "user", tenantId: TENANT, metadata: undefined }, deps()),
    ).toBe(true);
  });
});
