import { beforeEach, describe, expect, it, vi } from "vitest";

const txMock = vi.hoisted(() => ({
  userAuthToken: { updateMany: vi.fn() },
  user: { update: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock("@/infrastructure/database/prisma", () => ({ prisma: prismaMock }));

const { userPrismaRepository } = await import("./user.repository");

const params = { tokenId: "tok1", userId: "u1", passwordHash: "hash", activeTenantId: "t1" };

describe("userPrismaRepository.applyPasswordResetAndConsumeToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txMock));
  });

  it("should claim the unused token and update the password when the claim wins", async () => {
    txMock.userAuthToken.updateMany.mockResolvedValue({ count: 1 });

    const consumed = await userPrismaRepository.applyPasswordResetAndConsumeToken(params);

    expect(consumed).toBe(true);
    expect(txMock.userAuthToken.updateMany.mock.calls[0][0].where).toEqual({ id: "tok1", usedAt: null });
    expect(txMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { passwordHash: "hash", sessionVersion: { increment: 1 }, activeTenantId: "t1" },
    });
  });

  it("should not touch the password when another request already consumed the token", async () => {
    txMock.userAuthToken.updateMany.mockResolvedValue({ count: 0 });

    const consumed = await userPrismaRepository.applyPasswordResetAndConsumeToken(params);

    expect(consumed).toBe(false);
    expect(txMock.user.update).not.toHaveBeenCalled();
  });

  it("should keep the active tenant untouched when the token carries none", async () => {
    txMock.userAuthToken.updateMany.mockResolvedValue({ count: 1 });

    await userPrismaRepository.applyPasswordResetAndConsumeToken({ ...params, activeTenantId: undefined });

    expect(txMock.user.update.mock.calls[0][0].data).toEqual({
      passwordHash: "hash",
      sessionVersion: { increment: 1 },
    });
  });
});
