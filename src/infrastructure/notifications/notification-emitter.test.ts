import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createMany: vi.fn(),
  tenantFindUnique: vi.fn(),
  membershipFindMany: vi.fn(),
  filterVisible: vi.fn(),
  queueAvailable: vi.fn(),
  queueAdd: vi.fn(),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    notification: { createMany: mocks.createMany },
    tenant: { findUnique: mocks.tenantFindUnique },
    tenantMembership: { findMany: mocks.membershipFindMany },
  },
}));
vi.mock("@/infrastructure/visibility/client-visibility-scope", () => ({
  filterUserIdsWhoCanViewClient: mocks.filterVisible,
}));
vi.mock("@/infrastructure/queue/redis-connection", () => ({
  isQueueConsumerAvailable: mocks.queueAvailable,
  tripRedisCircuit: vi.fn(),
}));
vi.mock("@/infrastructure/queue/notification-queue", () => ({
  getNotificationQueue: () => ({ add: mocks.queueAdd }),
}));
vi.mock("@/lib/observability/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { notificationEmitter } = await import("./notification-emitter");

const base = {
  tenantId: "t1",
  type: "stage_transition" as const,
  title: "Maria avançou",
  targetUserIds: ["u1", "u2"],
};

const insertedRows = () => mocks.createMany.mock.calls[0]![0].data as { userId: string; dedupeKey: string | null }[];

describe("notificationEmitter dedupe", () => {
  beforeEach(() => {
    mocks.createMany.mockReset().mockResolvedValue({ count: 2 });
    mocks.tenantFindUnique.mockReset().mockResolvedValue({
      notifyCriticalAlerts: true,
      notifyNewPatients: true,
      notifyDocumentDelivery: true,
    });
    mocks.membershipFindMany.mockReset().mockResolvedValue([]);
    mocks.filterVisible.mockReset().mockImplementation(async (_t: string, _c: string, ids: string[]) => ids);
    mocks.queueAvailable.mockReset().mockReturnValue(false);
    mocks.queueAdd.mockReset().mockResolvedValue(undefined);
  });

  it("should write inline with skipDuplicates so a repeated key is a no-op", async () => {
    await notificationEmitter.emit({ ...base, dedupeKey: "sla|pp1|st1|1|critical" });

    expect(mocks.createMany.mock.calls[0]![0].skipDuplicates).toBe(true);
    expect(insertedRows()).toEqual([
      expect.objectContaining({ userId: "u1", dedupeKey: "sla|pp1|st1|1|critical" }),
      expect.objectContaining({ userId: "u2", dedupeKey: "sla|pp1|st1|1|critical" }),
    ]);
  });

  it("should derive the per-user key from correlationId when no explicit key is given (inline used to ignore it)", async () => {
    await notificationEmitter.emit({ ...base, correlationId: "pp1:st1:tr1" });

    expect(insertedRows().map((r) => r.dedupeKey)).toEqual(["stage_transition|pp1:st1:tr1", "stage_transition|pp1:st1:tr1"]);
  });

  it("should let the explicit key win over correlationId", async () => {
    await notificationEmitter.emit({ ...base, correlationId: "corr", dedupeKey: "explicit" });

    expect(insertedRows().every((r) => r.dedupeKey === "explicit")).toBe(true);
  });

  it("should leave dedupeKey null when there is nothing deterministic to dedupe on", async () => {
    await notificationEmitter.emit(base);

    expect(insertedRows().every((r) => r.dedupeKey === null)).toBe(true);
  });

  it("should carry the key into the queue payload and use it for the jobId when queued", async () => {
    mocks.queueAvailable.mockReturnValue(true);

    await notificationEmitter.emit({ ...base, dedupeKey: "sla|pp1|st1|1|critical" });

    expect(mocks.createMany).not.toHaveBeenCalled();
    const [, payload, options] = mocks.queueAdd.mock.calls[0]!;
    expect(payload).toMatchObject({ dedupeKey: "sla|pp1|st1|1|critical", userIds: ["u1", "u2"] });
    expect(options.jobId).toBe("t1|stage_transition|sla|pp1|st1|1|critical");
  });

  it("should restrict recipients by client visibility and write nothing when nobody can view the patient", async () => {
    mocks.filterVisible.mockResolvedValueOnce(["u2"]);
    await notificationEmitter.emit({ ...base, metadata: { clientId: "c1" } });
    expect(insertedRows().map((r) => r.userId)).toEqual(["u2"]);

    mocks.createMany.mockClear();
    mocks.filterVisible.mockResolvedValueOnce([]);
    await notificationEmitter.emit({ ...base, metadata: { clientId: "c1" } });
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});
