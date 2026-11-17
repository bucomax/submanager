import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATIENT_PORTAL_OTP_MAX_ATTEMPTS } from "@/lib/constants/patient-portal";
import { hashPatientPortalOtpCode } from "@/lib/utils/patient-portal-otp";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

type FakeChallenge = { id: string; codeHash: string; attempts: number; consumedAt: Date | null };

const store = vi.hoisted(() => ({ challenge: null as FakeChallenge | null }));

/** Fake in-memory com a mesma semântica atômica do repo Prisma (updateMany condicional). */
vi.mock("@/infrastructure/repositories/patient-portal-otp.repository", () => ({
  patientPortalOtpPrismaRepository: {
    async findLatestActiveChallenge() {
      const c = store.challenge;
      return c && !c.consumedAt ? { id: c.id, codeHash: c.codeHash, attempts: c.attempts } : null;
    },
    async reserveChallengeAttempt(id: string, max: number) {
      const c = store.challenge;
      if (!c || c.id !== id || c.consumedAt || c.attempts >= max) return false;
      c.attempts += 1;
      return true;
    },
    async consumeChallengeIfPending(id: string) {
      const c = store.challenge;
      if (!c || c.id !== id || c.consumedAt) return false;
      c.consumedAt = new Date();
      return true;
    },
  },
}));

vi.mock("@/lib/auth/patient-portal-session", () => ({
  portalPasswordVersionMs: (at: Date | null | undefined) => at?.getTime() ?? 0,
}));

const { runVerifyPatientPortalOtp } = await import("./verify-patient-portal-otp");

const TENANT = { id: "tenant-1", slug: "clinica" };
const CLIENT = { id: "client-1", portalPasswordChangedAt: null } as PortalClientForLogin;
const CORRECT_CODE = "123456";

function verify(code: string) {
  return runVerifyPatientPortalOtp({ tenant: TENANT, client: CLIENT, code });
}

describe("runVerifyPatientPortalOtp", () => {
  beforeEach(() => {
    process.env.PATIENT_PORTAL_SECRET = "test-secret";
    store.challenge = {
      id: "challenge-1",
      codeHash: hashPatientPortalOtpCode(CORRECT_CODE),
      attempts: 0,
      consumedAt: null,
    };
  });

  it("should issue a session for the correct code", async () => {
    const result = await verify(CORRECT_CODE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessionPayload).toMatchObject({ clientId: "client-1", tenantId: "tenant-1" });
    }
  });

  it("should reject reuse of an already consumed challenge", async () => {
    await verify(CORRECT_CODE);
    expect(await verify(CORRECT_CODE)).toEqual({ ok: false, code: "invalid" });
  });

  it("should reject the correct code after max wrong attempts", async () => {
    for (let i = 0; i < PATIENT_PORTAL_OTP_MAX_ATTEMPTS; i++) {
      expect((await verify("000000")).ok).toBe(false);
    }
    expect(await verify(CORRECT_CODE)).toEqual({ ok: false, code: "invalid" });
  });

  it("should not let parallel guesses exceed the attempt limit", async () => {
    const guesses = Array.from({ length: 50 }, (_, i) => verify(String(i).padStart(6, "0")));
    await Promise.all(guesses);
    expect(store.challenge?.attempts).toBe(PATIENT_PORTAL_OTP_MAX_ATTEMPTS);
  });
});
