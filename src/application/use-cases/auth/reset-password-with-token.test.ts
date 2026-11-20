import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthTokenPurpose } from "@prisma/client";

const state = vi.hoisted(() => ({
  findToken: vi.fn(),
  applyReset: vi.fn(),
  findFirstTenantId: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(async () => "new-hash") } }));
vi.mock("@/infrastructure/repositories/user.repository", () => ({
  userPrismaRepository: {
    findUserAuthTokenWithUserForReset: state.findToken,
    applyPasswordResetAndConsumeToken: state.applyReset,
    findFirstTenantIdForUser: state.findFirstTenantId,
  },
}));
vi.mock("@/infrastructure/repositories/audit-event.repository", () => ({
  auditEventPrismaRepository: { recordCanonical: state.recordAudit },
}));

const { runResetPasswordWithToken } = await import("./reset-password-with-token");

function tokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tok1",
    userId: "u1",
    tenantId: "t1",
    purpose: AuthTokenPurpose.PASSWORD_RESET,
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    user: { id: "u1", passwordHash: "old-hash" },
    ...overrides,
  };
}

describe("runResetPasswordWithToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.findToken.mockResolvedValue(tokenRow());
    state.applyReset.mockResolvedValue(true);
  });

  it("should reset the password and audit when the token is consumed", async () => {
    const result = await runResetPasswordWithToken({ token: "raw", newPassword: "Str0ng!pass" });

    expect(result).toEqual({ ok: true });
    expect(state.applyReset).toHaveBeenCalledWith({
      tokenId: "tok1",
      userId: "u1",
      passwordHash: "new-hash",
      activeTenantId: "t1",
    });
    expect(state.recordAudit).toHaveBeenCalledTimes(1);
  });

  it("should reject as invalid token and skip the audit when a parallel request consumed it first", async () => {
    state.applyReset.mockResolvedValue(false);

    const result = await runResetPasswordWithToken({ token: "raw", newPassword: "Str0ng!pass" });

    expect(result).toEqual({ ok: false, code: "INVALID_TOKEN" });
    expect(state.recordAudit).not.toHaveBeenCalled();
  });

  it("should reject an already used token before hashing the password", async () => {
    state.findToken.mockResolvedValue(tokenRow({ usedAt: new Date() }));

    const result = await runResetPasswordWithToken({ token: "raw", newPassword: "Str0ng!pass" });

    expect(result).toEqual({ ok: false, code: "INVALID_TOKEN" });
    expect(state.applyReset).not.toHaveBeenCalled();
  });
});
