import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryPatientPortalOtpRepository } from "@/application/testing/in-memory-patient-portal";
import { verifyPatientPortalOtp } from "@/application/use-cases/patient-portal/verify-patient-portal-otp.core";
import { PATIENT_PORTAL_OTP_MAX_ATTEMPTS } from "@/lib/constants/patient-portal";
import { hashPatientPortalOtpCode } from "@/lib/utils/patient-portal-otp";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

const TENANT = { id: "tenant-1", slug: "clinica" };
const CLIENT = { id: "client-1", portalPasswordChangedAt: null } as PortalClientForLogin;
const CORRECT_CODE = "123456";

describe("verifyPatientPortalOtp", () => {
  let otp: InMemoryPatientPortalOtpRepository;
  const verify = (code: string) => verifyPatientPortalOtp({ tenant: TENANT, client: CLIENT, code }, { otp });

  beforeEach(async () => {
    process.env.PATIENT_PORTAL_SECRET = "test-secret";
    otp = new InMemoryPatientPortalOtpRepository();
    await otp.createChallenge({
      clientId: CLIENT.id,
      tenantId: TENANT.id,
      codeHash: hashPatientPortalOtpCode(CORRECT_CODE),
      expiresAt: new Date(Date.now() + 60_000),
    });
  });

  it("should issue a session payload for the correct code", async () => {
    const result = await verify(CORRECT_CODE);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessionPayload).toMatchObject({ clientId: "client-1", tenantId: "tenant-1", tenantSlug: "clinica", pwdv: 0 });
      expect(result.sessionPayload.exp).toBeGreaterThan(Date.now() / 1000);
    }
  });

  it("should reject reuse of an already consumed challenge", async () => {
    await verify(CORRECT_CODE);
    expect(await verify(CORRECT_CODE)).toEqual({ ok: false, code: "invalid" });
  });

  it("should reject a wrong code without consuming the challenge", async () => {
    expect(await verify("000000")).toEqual({ ok: false, code: "invalid" });
    expect((await verify(CORRECT_CODE)).ok).toBe(true);
  });

  it("should reject the correct code after the max number of wrong attempts", async () => {
    for (let i = 0; i < PATIENT_PORTAL_OTP_MAX_ATTEMPTS; i++) {
      expect((await verify("000000")).ok).toBe(false);
    }
    expect(await verify(CORRECT_CODE)).toEqual({ ok: false, code: "invalid" });
  });

  it("should not let parallel guesses exceed the attempt limit", async () => {
    const guesses = Array.from({ length: 50 }, (_, i) => verify(String(i).padStart(6, "0")));
    await Promise.all(guesses);
    expect(otp.challenges[0]!.attempts).toBe(PATIENT_PORTAL_OTP_MAX_ATTEMPTS);
  });

  it("should let exactly one of two parallel correct submissions consume the challenge", async () => {
    const results = await Promise.all([verify(CORRECT_CODE), verify(CORRECT_CODE)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("should reject when there is no active challenge (expired or other tenant)", async () => {
    otp.challenges[0]!.expiresAt = new Date(Date.now() - 1);
    expect(await verify(CORRECT_CODE)).toEqual({ ok: false, code: "invalid" });

    expect(
      await verifyPatientPortalOtp({ tenant: { id: "other", slug: "x" }, client: CLIENT, code: CORRECT_CODE }, { otp }),
    ).toEqual({ ok: false, code: "invalid" });
  });
});
