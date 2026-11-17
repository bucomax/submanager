import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PATIENT_PORTAL_PASSWORD_LOCKOUT_MS,
  PATIENT_PORTAL_PASSWORD_MAX_FAILED_ATTEMPTS,
} from "@/lib/constants/patient-portal";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

const db = vi.hoisted(() => ({
  client: null as PortalClientForLogin | null,
  failed: 0,
  lockedUntil: null as Date | null,
}));

vi.mock("@/application/use-cases/client/find-client-for-portal-login", () => ({
  findClientForPortalLogin: async () => db.client,
}));

/** Fake com a mesma semântica do repo Prisma (contador + bloqueio). */
vi.mock("@/infrastructure/repositories/patient-portal-login-lockout.repository", () => ({
  patientPortalLoginLockoutPrismaRepository: {
    async isLocked(_id: string, now: Date) {
      return db.lockedUntil !== null && db.lockedUntil > now;
    },
    async registerFailedAttempt(
      _id: string,
      p: { now: Date; maxFailures: number; lockMs: number },
    ) {
      if (db.lockedUntil === null || db.lockedUntil <= p.now) db.failed += 1;
      if (db.failed >= p.maxFailures) {
        db.lockedUntil = new Date(p.now.getTime() + p.lockMs);
        db.failed = 0;
        return true;
      }
      return false;
    },
    async resetFailedAttempts() {
      db.failed = 0;
      db.lockedUntil = null;
    },
  },
}));

vi.mock("@/lib/auth/patient-portal-session", () => ({
  portalPasswordVersionMs: (at: Date | null | undefined) => at?.getTime() ?? 0,
}));

const { runVerifyPatientPortalPassword } = await import("./verify-patient-portal-password");

const TENANT = { id: "tenant-1", slug: "clinica" };
const IDENTIFIER = { kind: "cpf", cpf11: "12345678901" } as const;

function login(password: string) {
  return runVerifyPatientPortalPassword({ tenant: TENANT, identifier: IDENTIFIER, password });
}

describe("runVerifyPatientPortalPassword lockout", () => {
  beforeEach(() => {
    db.client = {
      id: "client-1",
      portalPasswordHash: bcrypt.hashSync("correct-pass", 4),
      portalPasswordChangedAt: null,
    } as PortalClientForLogin;
    db.failed = 0;
    db.lockedUntil = null;
  });

  it("should lock after the max failed attempts and reject even the correct password", async () => {
    for (let i = 0; i < PATIENT_PORTAL_PASSWORD_MAX_FAILED_ATTEMPTS; i++) {
      expect(await login("wrong")).toMatchObject({ ok: false, reason: "invalid_password" });
    }
    expect(db.lockedUntil).not.toBeNull();
    expect(db.failed).toBe(0);
    expect(await login("correct-pass")).toMatchObject({ ok: false, reason: "locked" });
  });

  it("should accept the correct password again after the lock expires", async () => {
    db.lockedUntil = new Date(Date.now() - 1000);
    expect((await login("correct-pass")).ok).toBe(true);
    expect(db.lockedUntil).toBeNull();
  });

  it("should reset the failure counter on success", async () => {
    await login("wrong");
    await login("wrong");
    expect(db.failed).toBe(2);
    expect((await login("correct-pass")).ok).toBe(true);
    expect(db.failed).toBe(0);
  });

  it("should set the lock for the configured duration", async () => {
    const before = Date.now();
    for (let i = 0; i < PATIENT_PORTAL_PASSWORD_MAX_FAILED_ATTEMPTS; i++) await login("wrong");
    const ms = db.lockedUntil!.getTime() - before;
    expect(ms).toBeGreaterThanOrEqual(PATIENT_PORTAL_PASSWORD_LOCKOUT_MS - 50);
    expect(ms).toBeLessThanOrEqual(PATIENT_PORTAL_PASSWORD_LOCKOUT_MS + 2000);
  });

  it("should not count attempts when no password is set", async () => {
    db.client = { ...db.client!, portalPasswordHash: null };
    expect(await login("x")).toMatchObject({ ok: false, reason: "password_not_set" });
    expect(db.failed).toBe(0);
  });
});
