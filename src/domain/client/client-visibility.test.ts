import { describe, expect, it } from "vitest";

import {
  buildClientVisibilityFlatFilter,
  canViewClientRow,
  clientScopeFromTenantMembershipRow,
  isNotificationVisibleForScope,
  resolveClientScope,
} from "./client-visibility";

const client = { assignedToUserId: "u1", opmeSupplierId: "o1" };
const user = { role: "tenant_user", restrictedToAssignedOnly: false, linkedOpmeSupplierId: null };

describe("canViewClientRow", () => {
  it("should always allow tenant admins", () => {
    expect(canViewClientRow(client, { ...user, role: "tenant_admin", restrictedToAssignedOnly: true }, "x")).toBe(true);
  });

  it("should restrict users to assigned clients when flagged", () => {
    const scope = { ...user, restrictedToAssignedOnly: true };
    expect(canViewClientRow(client, scope, "u1")).toBe(true);
    expect(canViewClientRow(client, scope, "u2")).toBe(false);
  });

  it("should restrict users linked to an OPME supplier to that supplier's clients", () => {
    const scope = { ...user, linkedOpmeSupplierId: "o2" };
    expect(canViewClientRow(client, scope, "u1")).toBe(false);
    expect(canViewClientRow(client, { ...user, linkedOpmeSupplierId: "o1" }, "u1")).toBe(true);
  });
});

const VIEWER = "user-1";
const admin = { role: "tenant_admin", restrictedToAssignedOnly: false, linkedOpmeSupplierId: null };
const assignedOnly = { role: "tenant_user", restrictedToAssignedOnly: true, linkedOpmeSupplierId: null };
const opme = { role: "tenant_user", restrictedToAssignedOnly: false, linkedOpmeSupplierId: "opme-1" };

describe("buildClientVisibilityFlatFilter", () => {
  it("should map scope to a flat filter", () => {
    expect(buildClientVisibilityFlatFilter(admin, VIEWER)).toEqual({ opmeSupplierId: null, assignedToUserId: null });
    expect(buildClientVisibilityFlatFilter(assignedOnly, VIEWER)).toEqual({
      opmeSupplierId: null,
      assignedToUserId: VIEWER,
    });
    expect(buildClientVisibilityFlatFilter(opme, VIEWER)).toEqual({ opmeSupplierId: "opme-1", assignedToUserId: null });
  });
});

describe("resolveClientScope", () => {
  it("should treat super admins as tenant admins and missing memberships as most restrictive", () => {
    expect(resolveClientScope("super_admin", null)).toEqual(admin);
    expect(resolveClientScope("user", null)).toEqual(clientScopeFromTenantMembershipRow(null));
    expect(clientScopeFromTenantMembershipRow(null)).toEqual({ ...assignedOnly });
  });
});

describe("isNotificationVisibleForScope", () => {
  const own = { assignedToUserId: VIEWER, opmeSupplierId: null };

  it("should keep notifications without client, self-register ones and visible clients", () => {
    expect(isNotificationVisibleForScope(null, undefined, assignedOnly, VIEWER)).toBe(true);
    expect(isNotificationVisibleForScope({ clientId: "c", source: "patient_self_register" }, undefined, assignedOnly, VIEWER)).toBe(true);
    expect(isNotificationVisibleForScope({ clientId: "c" }, own, assignedOnly, VIEWER)).toBe(true);
  });

  it("should hide notifications of unknown or out-of-scope clients", () => {
    expect(isNotificationVisibleForScope({ clientId: "c" }, undefined, assignedOnly, VIEWER)).toBe(false);
    expect(isNotificationVisibleForScope({ clientId: "c" }, { assignedToUserId: "x", opmeSupplierId: null }, assignedOnly, VIEWER)).toBe(false);
  });
});
