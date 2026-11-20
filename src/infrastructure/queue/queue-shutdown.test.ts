import { beforeEach, describe, expect, it, vi } from "vitest";

const closeRedisConnections = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("./redis-connection", () => ({ closeRedisConnections }));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

const { drainQueues } = await import("./queue-shutdown");

describe("drainQueues", () => {
  beforeEach(() => closeRedisConnections.mockClear());

  it("should close every worker and then the Redis connections", async () => {
    const workers = [{ close: vi.fn(async () => {}) }, { close: vi.fn(async () => {}) }];

    await drainQueues(workers, 1_000);

    for (const worker of workers) expect(worker.close).toHaveBeenCalledTimes(1);
    expect(closeRedisConnections).toHaveBeenCalledTimes(1);
  });

  it("should still close Redis when a worker rejects", async () => {
    await drainQueues([{ close: vi.fn(async () => Promise.reject(new Error("boom"))) }], 1_000);
    expect(closeRedisConnections).toHaveBeenCalledTimes(1);
  });

  it("should give up on a worker that never closes after the timeout", async () => {
    const stuck = { close: vi.fn(() => new Promise<void>(() => {})) };

    await drainQueues([stuck], 20);

    expect(closeRedisConnections).toHaveBeenCalledTimes(1);
  });
});
