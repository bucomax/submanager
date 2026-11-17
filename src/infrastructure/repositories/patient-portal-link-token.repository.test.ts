import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  patientPortalLinkToken: { findUnique: vi.fn(), create: vi.fn() },
}));
vi.mock("@/infrastructure/database/prisma", () => ({ prisma: prismaMock }));

const { hashPortalLinkToken, patientPortalLinkTokenPrismaRepository } = await import(
  "./patient-portal-link-token.repository"
);

describe("patientPortalLinkTokenPrismaRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should persist only the sha256 hash of the raw token", async () => {
    prismaMock.patientPortalLinkToken.create.mockResolvedValue({ id: "t1" });
    await patientPortalLinkTokenPrismaRepository.createPortalLinkToken({
      clientId: "c1",
      token: "raw-token",
      expiresAt: new Date(),
      singleUse: true,
    });
    const data = prismaMock.patientPortalLinkToken.create.mock.calls[0][0].data;
    expect(data.token).toBe(hashPortalLinkToken("raw-token"));
    expect(data.token).toMatch(/^[0-9a-f]{64}$/);
    expect(data.token).not.toBe("raw-token");
  });

  it("should look up by the hash, never by the raw token", async () => {
    prismaMock.patientPortalLinkToken.findUnique.mockResolvedValue(null);
    await patientPortalLinkTokenPrismaRepository.findByTokenForMagicLinkExchange("raw-token");
    expect(prismaMock.patientPortalLinkToken.findUnique.mock.calls[0][0].where).toEqual({
      token: hashPortalLinkToken("raw-token"),
    });
  });
});
