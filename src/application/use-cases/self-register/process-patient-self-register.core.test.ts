import { beforeEach, describe, expect, it } from "vitest";

import {
  FakeSelfRegisterNotifier,
  InMemorySelfRegisterStore,
} from "@/application/testing/in-memory-self-register-store";
import {
  completePatientSelfRegister,
  loadPatientSelfRegisterInvitePreviewWith,
  type PatientSelfRegisterDeps,
  type ProcessPatientSelfRegisterBody,
} from "@/application/use-cases/self-register/process-patient-self-register.core";

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);

function setup() {
  const store = new InMemorySelfRegisterStore();
  const notifier = new FakeSelfRegisterNotifier();
  const slugCheck = { valid: true, calls: 0 };
  const deps: PatientSelfRegisterDeps = {
    store,
    notifier,
    validateInviteTenantSlug: async () => {
      slugCheck.calls += 1;
      return slugCheck.valid;
    },
    hashPassword: async (plain) => `hash:${plain}`,
  };
  const addInvite = (overrides: Partial<(typeof store.state.invites)[number]> = {}) => {
    const invite = {
      id: "inv-1",
      token: "tok-1",
      tenantId: "tenant-1",
      clientId: null,
      usedAt: null,
      expiresAt: FUTURE,
      tenant: { id: "tenant-1", name: "Clínica Teste", slug: "clinica", isActive: true },
      ...overrides,
    };
    store.state.invites.push(invite);
    return invite;
  };
  const body = (overrides: Record<string, unknown> = {}) =>
    ({ token: "tok-1", password: "s3nh4-forte", name: "Maria", phone: "11999999999", email: "maria@x.com", ...overrides }) as unknown as ProcessPatientSelfRegisterBody;
  const run = (data = body()) => completePatientSelfRegister(new Request("https://app.test/api"), data, deps);
  return { store, notifier, slugCheck, deps, addInvite, run, body };
}

describe("completePatientSelfRegister", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it("should create the client, consume the invite and record audit and both consent events in the same unit of work", async () => {
    ctx.addInvite();

    const result = await ctx.run();

    expect(result.ok).toBe(true);
    const { state } = ctx.store;
    expect(state.clients).toMatchObject([{ tenantId: "tenant-1", portalPasswordHash: "hash:s3nh4-forte" }]);
    expect(state.invites[0]!.usedAt).toBeInstanceOf(Date);
    expect(state.audits.map((a) => a.type)).toEqual([
      "SELF_REGISTER_COMPLETED",
      "PATIENT_PORTAL_PASSWORD_SET",
      "PATIENT_CONSENT_GIVEN",
      "PATIENT_CONSENT_GIVEN",
    ]);
    expect(state.audits[0]).toMatchObject({ payload: { inviteId: "inv-1", mode: "create" }, actorUserId: null });
    expect(state.audits.slice(2).map((a) => (a.payload as { consentType: string }).consentType)).toEqual(["terms", "lgpd"]);
    expect(JSON.stringify(state.audits)).not.toContain("s3nh4-forte");
  });

  it("should roll back client, invite and audit when recording a consent event fails", async () => {
    ctx.addInvite();
    ctx.store.failAuditOn = "PATIENT_CONSENT_GIVEN";

    await expect(ctx.run()).rejects.toThrow("audit write failed");

    expect(ctx.store.state.clients).toHaveLength(0);
    expect(ctx.store.state.invites[0]!.usedAt).toBeNull();
    expect(ctx.store.state.audits).toHaveLength(0);
  });

  it("should update the existing client of a targeted invite in update mode", async () => {
    ctx.addInvite({ clientId: "client-existing" });
    ctx.store.state.clients.push({ id: "client-existing", tenantId: "tenant-1", deletedAt: null, fields: { name: "Antigo" }, portalPasswordHash: null });

    const result = await ctx.run();

    expect(result.ok).toBe(true);
    expect(ctx.store.state.clients).toHaveLength(1);
    expect(ctx.store.state.clients[0]).toMatchObject({ fields: { name: "Maria" }, portalPasswordHash: "hash:s3nh4-forte" });
    expect(ctx.store.state.audits[0]).toMatchObject({ payload: { mode: "update" } });
  });

  it.each([
    ["unknown token", () => ctx.run(ctx.body({ token: "missing" }))],
    ["used invite", () => (ctx.addInvite({ usedAt: new Date() }), ctx.run())],
    ["expired invite", () => (ctx.addInvite({ expiresAt: PAST }), ctx.run())],
    ["inactive tenant", () => (ctx.addInvite({ tenant: { id: "tenant-1", name: "X", slug: "x", isActive: false } }), ctx.run())],
    ["removed target client", () => (ctx.addInvite({ clientId: "gone" }), ctx.run())],
  ])("should answer INVALID_TOKEN and write nothing for %s", async (_name, act) => {
    expect(await act()).toEqual({ ok: false, code: "INVALID_TOKEN" });
    expect(ctx.store.state.clients).toHaveLength(0);
    expect(ctx.store.state.audits).toHaveLength(0);
  });

  it("should not let the same invite be consumed twice", async () => {
    ctx.addInvite();

    expect((await ctx.run()).ok).toBe(true);
    expect(await ctx.run()).toEqual({ ok: false, code: "INVALID_TOKEN" });
    expect(ctx.store.state.clients).toHaveLength(1);
  });

  it("should answer INVALID_TOKEN when the URL tenant slug does not match the invite tenant", async () => {
    ctx.addInvite();
    ctx.slugCheck.valid = false;

    expect(await ctx.run()).toEqual({ ok: false, code: "INVALID_TOKEN" });
    expect(ctx.store.state.clients).toHaveLength(0);
  });

  it("should map a serialization conflict to SERIALIZABLE_CONFLICT and keep the invite usable", async () => {
    ctx.addInvite();
    ctx.store.conflictOnCommit = true;

    expect(await ctx.run()).toEqual({ ok: false, code: "SERIALIZABLE_CONFLICT" });
    expect(ctx.store.state.invites[0]!.usedAt).toBeNull();
  });

  it("should notify staff and send the welcome e-mail after commit, skipping the e-mail when none was given", async () => {
    ctx.addInvite();
    const result = await ctx.run();
    if (!result.ok) throw new Error("expected ok");
    await result.afterCommit();
    expect(ctx.notifier.staff).toMatchObject([{ tenantId: "tenant-1", patientName: "Maria", clinicName: "Clínica Teste" }]);
    expect(ctx.notifier.welcome).toMatchObject([{ patientEmail: "maria@x.com", tenantSlug: "clinica" }]);

    ctx.addInvite({ id: "inv-2", token: "tok-2" });
    const noEmail = await ctx.run(ctx.body({ token: "tok-2", email: null }));
    if (!noEmail.ok) throw new Error("expected ok");
    await noEmail.afterCommit();
    expect(ctx.notifier.staff).toHaveLength(2);
    expect(ctx.notifier.welcome).toHaveLength(1);
  });
});

describe("loadPatientSelfRegisterInvitePreviewWith", () => {
  const previewRow = (overrides = {}) => ({
    tenantId: "tenant-1",
    clientId: null,
    usedAt: null,
    expiresAt: FUTURE,
    tenant: { name: "Clínica", taxId: "123", isActive: true },
    client: null,
    ...overrides,
  });

  it("should return the tenant summary for a valid invite and invalid for used, expired or missing ones", async () => {
    const ctx = setup();
    ctx.store.previewRows = {
      ok: previewRow(),
      used: previewRow({ usedAt: new Date() }),
      expired: previewRow({ expiresAt: PAST }),
    };
    const preview = (token: string) => loadPatientSelfRegisterInvitePreviewWith(new Request("https://app.test"), token, ctx.deps);

    expect(await preview("ok")).toMatchObject({ valid: true, tenantName: "Clínica", tenantTaxId: "123" });
    expect(await preview("used")).toEqual({ valid: false });
    expect(await preview("expired")).toEqual({ valid: false });
    expect(await preview("missing")).toEqual({ valid: false });
    expect(await preview("")).toEqual({ valid: false });
  });

  it("should be invalid when the tenant slug header does not match", async () => {
    const ctx = setup();
    ctx.store.previewRows = { ok: previewRow() };
    ctx.slugCheck.valid = false;

    expect(await loadPatientSelfRegisterInvitePreviewWith(new Request("https://app.test"), "ok", ctx.deps)).toEqual({ valid: false });
  });
});
