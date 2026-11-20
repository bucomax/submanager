import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashAuthToken } from "@/lib/auth/auth-token-hash";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  patientSelfRegisterInvite: { findFirst: vi.fn() },
}));
vi.mock("@/infrastructure/database/prisma", () => ({ prisma: prismaMock }));

const { patientSelfRegisterPrismaStore } = await import("./patient-self-register-flow.repository");

describe("patientSelfRegisterPrismaStore invite lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.patientSelfRegisterInvite.findFirst.mockResolvedValue(null);
  });

  it("should look up the preview by hash (or legacy raw value), never by the raw token alone", async () => {
    await patientSelfRegisterPrismaStore.findInviteForPreview("raw-token");

    expect(prismaMock.patientSelfRegisterInvite.findFirst.mock.calls[0][0].where).toEqual({
      token: { in: [hashAuthToken("raw-token"), "raw-token"] },
    });
  });

  it("should look up the invite inside the transaction by hash (or legacy raw value)", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({ patientSelfRegisterInvite: prismaMock.patientSelfRegisterInvite }),
    );

    await patientSelfRegisterPrismaStore.runSerializable((tx) => tx.findInviteByToken("raw-token"));

    expect(prismaMock.patientSelfRegisterInvite.findFirst.mock.calls[0][0].where).toEqual({
      token: { in: [hashAuthToken("raw-token"), "raw-token"] },
    });
  });
});
