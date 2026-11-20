import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/database/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));
vi.mock("@/lib/observability/logger", () => ({ logger: { warn: vi.fn() } }));

const { runDatabasePing } = await import("./database-health");

describe("runDatabasePing", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("should be true when the query resolves", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    expect(await runDatabasePing(100)).toBe(true);
  });

  it("should be false when the query rejects, without throwing", async () => {
    queryRaw.mockRejectedValue(new Error("connect ECONNREFUSED postgres://user:pass@host"));
    expect(await runDatabasePing(100)).toBe(false);
  });

  it("should be false when the query exceeds the timeout", async () => {
    queryRaw.mockReturnValue(new Promise(() => {}));
    expect(await runDatabasePing(20)).toBe(false);
  });
});
