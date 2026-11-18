import { describe, expect, it } from "vitest";

import { buildPatientPortalSessionClaims, portalPasswordVersionMs } from "./patient-portal-session";

describe("patient portal session claims", () => {
  it("should expire maxAgeSec after now and carry the tenant slug", () => {
    const claims = buildPatientPortalSessionClaims({
      tenant: { id: "t", slug: "clinica" },
      client: { id: "c", portalPasswordChangedAt: null },
      nowMs: 1_000_500,
      maxAgeSec: 60,
    });
    expect(claims).toEqual({ clientId: "c", tenantId: "t", tenantSlug: "clinica", exp: 1_060, pwdv: 0 });
  });

  it("should version the session by the password change timestamp", () => {
    const at = new Date("2026-02-01T00:00:00Z");
    expect(portalPasswordVersionMs(at)).toBe(at.getTime());
    expect(portalPasswordVersionMs(undefined)).toBe(0);
  });
});
