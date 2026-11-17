import { beforeEach, describe, expect, it, vi } from "vitest";

type Target = {
  id: string;
  globalRole: "user" | "super_admin";
  passwordHash: string | null;
  hasMembershipInTenant: boolean;
  hasMembershipInOtherTenant: boolean;
} | null;

const state = vi.hoisted(() => ({ target: null as Target, setPassword: vi.fn(), audit: vi.fn() }));

vi.mock("@/infrastructure/repositories/user.repository", () => ({
  userPrismaRepository: {
    findUserForAdminSetPassword: async () => state.target,
    setInitialPasswordForUser: state.setPassword,
  },
}));
vi.mock("@/infrastructure/repositories/audit-event.repository", () => ({
  auditEventPrismaRepository: { recordCanonical: state.audit },
}));

const { runAdminSetInviteePassword } = await import("./set-invitee-password");

const input = { userId: "victim", tenantId: "t1", password: "Str0ng!Passw0rd", actorUserId: "admin" };
const pending = {
  id: "victim",
  globalRole: "user" as const,
  passwordHash: null,
  hasMembershipInTenant: true,
  hasMembershipInOtherTenant: false,
};

describe("runAdminSetInviteePassword", () => {
  beforeEach(() => {
    state.setPassword.mockReset();
    state.audit.mockReset();
    state.target = { ...pending };
  });

  it("sets password for a pending invitee only in this tenant", async () => {
    expect(await runAdminSetInviteePassword(input)).toEqual({ ok: true, userId: "victim" });
    expect(state.setPassword).toHaveBeenCalledOnce();
    expect(state.audit).toHaveBeenCalledOnce();
  });

  it.each([
    ["super_admin", { globalRole: "super_admin" as const }],
    ["user that already has a password", { passwordHash: "hash" }],
    ["user with membership in another tenant", { hasMembershipInOtherTenant: true }],
  ])("rejects %s", async (_label, override) => {
    state.target = { ...pending, ...override };
    expect(await runAdminSetInviteePassword(input)).toEqual({ ok: false, code: "USER_NOT_ELIGIBLE" });
    expect(state.setPassword).not.toHaveBeenCalled();
  });

  it("rejects when user is not a member of the tenant", async () => {
    state.target = { ...pending, hasMembershipInTenant: false };
    expect(await runAdminSetInviteePassword(input)).toEqual({ ok: false, code: "MEMBERSHIP_MISSING" });
  });

  it("rejects self", async () => {
    expect(await runAdminSetInviteePassword({ ...input, userId: "admin" })).toEqual({
      ok: false,
      code: "SELF_NOT_ALLOWED",
    });
  });
});
