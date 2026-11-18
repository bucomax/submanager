import { describe, expect, it } from "vitest";

import { isSelfRegisterInviteUsable } from "./self-register-invite";

const now = new Date("2026-06-01T12:00:00Z");
const valid = { usedAt: null, expiresAt: new Date("2026-06-02T00:00:00Z"), tenantIsActive: true };

describe("isSelfRegisterInviteUsable", () => {
  it("should accept an unused, unexpired invite of an active tenant", () => {
    expect(isSelfRegisterInviteUsable(valid, now)).toBe(true);
  });

  it("should reject used, expired (boundary included) and inactive-tenant invites", () => {
    expect(isSelfRegisterInviteUsable({ ...valid, usedAt: now }, now)).toBe(false);
    expect(isSelfRegisterInviteUsable({ ...valid, expiresAt: now }, now)).toBe(false);
    expect(isSelfRegisterInviteUsable({ ...valid, tenantIsActive: false }, now)).toBe(false);
  });
});
