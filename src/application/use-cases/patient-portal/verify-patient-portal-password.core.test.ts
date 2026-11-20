import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakePortalLoginClientFinder, InMemoryLoginLockout } from "@/application/testing/in-memory-patient-portal";
import { verifyPatientPortalPassword } from "@/application/use-cases/patient-portal/verify-patient-portal-password.core";
import {
  PATIENT_PORTAL_PASSWORD_LOCKOUT_MS,
  PATIENT_PORTAL_PASSWORD_MAX_FAILED_ATTEMPTS,
} from "@/lib/constants/patient-portal";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

const TENANT = { id: "tenant-1", slug: "clinica" };
const IDENTIFIER = { kind: "cpf", cpf11: "12345678901" } as const;

describe("verifyPatientPortalPassword", () => {
  let clients: FakePortalLoginClientFinder;
  let lockout: InMemoryLoginLockout;
  const login = (password: string) =>
    verifyPatientPortalPassword({ tenant: TENANT, identifier: IDENTIFIER, password }, { clients, lockout });

  beforeEach(() => {
    clients = new FakePortalLoginClientFinder();
    clients.client = {
      id: "client-1",
      portalPasswordHash: bcrypt.hashSync("correct-pass", 4),
      portalPasswordChangedAt: null,
    } as PortalClientForLogin;
    lockout = new InMemoryLoginLockout();
  });

  it("should issue session claims for the correct password", async () => {
    const result = await login("correct-pass");
    expect(result).toMatchObject({ ok: true, sessionPayload: { clientId: "client-1", tenantId: "tenant-1", pwdv: 0 } });
  });

  it("should answer client_not_found when no client matches", async () => {
    clients.client = null;
    expect(await login("x")).toEqual({ ok: false, reason: "client_not_found" });
  });

  it("should lock after the max failed attempts and reject even the correct password", async () => {
    for (let i = 0; i < PATIENT_PORTAL_PASSWORD_MAX_FAILED_ATTEMPTS; i++) {
      expect(await login("wrong")).toMatchObject({ ok: false, reason: "invalid_password" });
    }
    expect(lockout.lockedUntil).not.toBeNull();
    expect(lockout.failed).toBe(0);
    expect(await login("correct-pass")).toMatchObject({ ok: false, reason: "locked" });
  });

  it("should set the lock for the configured duration", async () => {
    const before = Date.now();
    for (let i = 0; i < PATIENT_PORTAL_PASSWORD_MAX_FAILED_ATTEMPTS; i++) await login("wrong");
    const ms = lockout.lockedUntil!.getTime() - before;
    expect(ms).toBeGreaterThanOrEqual(PATIENT_PORTAL_PASSWORD_LOCKOUT_MS - 50);
    expect(ms).toBeLessThanOrEqual(PATIENT_PORTAL_PASSWORD_LOCKOUT_MS + 2000);
  });

  it("should accept the correct password again after the lock expires and clear the lock", async () => {
    lockout.lockedUntil = new Date(Date.now() - 1000);
    expect((await login("correct-pass")).ok).toBe(true);
    expect(lockout.lockedUntil).toBeNull();
  });

  it("should reset the failure counter on success", async () => {
    await login("wrong");
    await login("wrong");
    expect(lockout.failed).toBe(2);
    expect((await login("correct-pass")).ok).toBe(true);
    expect(lockout.failed).toBe(0);
  });

  it("should not count attempts when no password is set", async () => {
    clients.client = { ...clients.client!, portalPasswordHash: null };
    expect(await login("x")).toMatchObject({ ok: false, reason: "password_not_set" });
    expect(lockout.failed).toBe(0);
  });

  it("should include the client in failure results for auditing but never in not found", async () => {
    expect(await login("wrong")).toMatchObject({ client: { id: "client-1" } });
  });

  describe("timing parity (no CPF existence oracle)", () => {
    afterEach(() => vi.restoreAllMocks());

    it("should run a dummy bcrypt compare when the client does not exist", async () => {
      const compare = vi.spyOn(bcrypt, "compare");
      clients.client = null;

      expect(await login("whatever")).toEqual({ ok: false, reason: "client_not_found" });
      expect(compare).toHaveBeenCalledTimes(1);
      expect(compare.mock.calls[0]![0]).toBe("whatever");
    });

    it("should run a dummy bcrypt compare when the client has no password", async () => {
      const compare = vi.spyOn(bcrypt, "compare");
      clients.client = { ...clients.client!, portalPasswordHash: null };

      expect(await login("whatever")).toMatchObject({ reason: "password_not_set" });
      expect(compare).toHaveBeenCalledTimes(1);
    });

    it("should run a dummy bcrypt compare (never the real hash) while the client is locked", async () => {
      const compare = vi.spyOn(bcrypt, "compare");
      lockout.lockedUntil = new Date(Date.now() + 60_000);

      expect(await login("correct-pass")).toMatchObject({ reason: "locked" });
      expect(compare).toHaveBeenCalledTimes(1);
      expect(compare.mock.calls[0]![1]).not.toBe(clients.client!.portalPasswordHash);
    });

    it("should still compare against the real hash for an existing client with a password", async () => {
      const compare = vi.spyOn(bcrypt, "compare");

      await login("wrong");
      expect(compare).toHaveBeenCalledTimes(1);
      expect(compare.mock.calls[0]![1]).toBe(clients.client!.portalPasswordHash);
    });
  });
});
