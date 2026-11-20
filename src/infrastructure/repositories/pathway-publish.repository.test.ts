import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock("@/infrastructure/database/prisma", () => ({ prisma: prismaMock }));

const { pathwayPublishPrismaStore } = await import("./pathway-publish.repository");

describe("pathwayPublishPrismaStore.runInTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}));
  });

  it("should run the publish unit of work with a 30s timeout instead of the 5s Prisma default", async () => {
    const result = await pathwayPublishPrismaStore.runInTransaction(async () => "published");

    expect(result).toBe("published");
    expect(prismaMock.$transaction.mock.calls[0][1]).toEqual({ timeout: 30_000, maxWait: 5_000 });
  });
});
