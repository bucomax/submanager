import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "whsec_test";

const mocks = vi.hoisted(() => ({
  findBySlug: vi.fn(),
  findTenantApp: vi.fn(),
  createMany: vi.fn(),
}));

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: { dispatchKey: { createMany: mocks.createMany } } }));
vi.mock("@/infrastructure/repositories/app.repository", () => ({
  appPrismaRepository: { findBySlug: mocks.findBySlug, findTenantApp: mocks.findTenantApp },
}));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { POST } = await import("./route");

function sign(body: string, secret = SECRET) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

async function send(payload: Record<string, unknown>, opts: { secret?: string } = {}) {
  const body = JSON.stringify(payload);
  const res = await POST(
    new Request("http://localhost/api/v1/webhooks/apps/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-signature": sign(body, opts.secret) },
      body,
    }),
    { params: Promise.resolve({ appSlug: "chat" }) },
  );
  return { status: res.status, json: await res.json() };
}

const event = { eventId: "evt-1", eventType: "chat.completed", tenantId: "t1" };

describe("POST /api/v1/webhooks/apps/[appSlug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findBySlug.mockResolvedValue({ id: "app-1", slug: "chat", metadata: { webhookSecret: SECRET } });
    mocks.findTenantApp.mockResolvedValue({ status: "active" });
    mocks.createMany.mockResolvedValue({ count: 1 });
  });

  it("should accept a signed event of an active tenant and register its idempotency key once", async () => {
    const res = await send({ ...event, timestamp: new Date().toISOString() });

    expect(res.status).toBe(200);
    expect(res.json.data).toEqual({ received: true });
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: [{ key: "app-webhook:app-1:t1:evt-1" }],
      skipDuplicates: true,
    });
  });

  it("should acknowledge a replayed eventId with 200 duplicate and not reprocess", async () => {
    mocks.createMany.mockResolvedValue({ count: 0 });

    const res = await send(event);

    expect(res.status).toBe(200);
    expect(res.json.data).toEqual({ received: true, duplicate: true });
  });

  it("should reject a stale timestamp (signed replay) before touching tenant or idempotency state", async () => {
    const old = new Date(Date.now() - 6 * 60 * 1000).toISOString();

    const res = await send({ ...event, timestamp: old });

    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe("TIMESTAMP_OUT_OF_RANGE");
    expect(mocks.findTenantApp).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("should reject an unparsable timestamp", async () => {
    const res = await send({ ...event, timestamp: "yesterday" });

    expect(res.status).toBe(422);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it.each([null, { status: "suspended" }, { status: "inactive" }, { status: "pending_config" }])(
    "should refuse tenants whose app is not active (%j) without registering the event",
    async (tenantApp) => {
      mocks.findTenantApp.mockResolvedValue(tenantApp);

      const res = await send(event);

      expect(res.status).toBe(403);
      expect(mocks.createMany).not.toHaveBeenCalled();
    },
  );

  it("should reject a bad signature before any lookup or idempotency write", async () => {
    const res = await send(event, { secret: "wrong" });

    expect(res.status).toBe(401);
    expect(mocks.findTenantApp).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});
