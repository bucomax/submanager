import { describe, expect, it } from "vitest";

import { resolvePortalLoginHasPassword } from "./patient-portal-login-options";

describe("resolvePortalLoginHasPassword", () => {
  it("should answer like a patient with password when the login does not exist (no existence oracle)", () => {
    expect(resolvePortalLoginHasPassword(null)).toBe(resolvePortalLoginHasPassword({ portalPasswordHash: "$2a$12$x" }));
  });

  it("should send existing patients without a password straight to the OTP step", () => {
    expect(resolvePortalLoginHasPassword({ portalPasswordHash: null })).toBe(false);
  });
});
