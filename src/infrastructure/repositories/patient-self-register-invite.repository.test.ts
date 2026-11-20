import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashAuthToken } from "@/lib/auth/auth-token-hash";

const prismaMock = vi.hoisted(() => ({
  patientSelfRegisterInvite: { create: vi.fn() },
}));
vi.mock("@/infrastructure/database/prisma", () => ({ prisma: prismaMock }));

const { patientSelfRegisterInvitePrismaRepository } = await import("./patient-self-register-invite.repository");

describe("patientSelfRegisterInvitePrismaRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should persist only the sha256 hash of the raw invite token", async () => {
    prismaMock.patientSelfRegisterInvite.create.mockResolvedValue({ id: "i1" });

    await patientSelfRegisterInvitePrismaRepository.createInvite({
      tenantId: "t1",
      token: "raw-token",
      expiresAt: new Date(),
      createdByUserId: "u1",
      clientId: null,
    });

    const data = prismaMock.patientSelfRegisterInvite.create.mock.calls[0][0].data;
    expect(data.token).toBe(hashAuthToken("raw-token"));
    expect(data.token).toMatch(/^[0-9a-f]{64}$/);
    expect(data.token).not.toBe("raw-token");
  });
});
