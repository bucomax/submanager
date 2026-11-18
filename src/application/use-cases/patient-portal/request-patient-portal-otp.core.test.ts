import { beforeEach, describe, expect, it } from "vitest";

import { FakePortalOtpDelivery, InMemoryPatientPortalOtpRepository } from "@/application/testing/in-memory-patient-portal";
import { requestPatientPortalOtp } from "@/application/use-cases/patient-portal/request-patient-portal-otp.core";
import { PATIENT_PORTAL_OTP_MAX_REQUESTS_PER_WINDOW } from "@/lib/constants/patient-portal";
import { hashPatientPortalOtpCode } from "@/lib/utils/patient-portal-otp";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

const TENANT = { id: "tenant-1", name: "Clínica" };
const CLIENT = {
  id: "client-1",
  name: "Ana",
  email: "ana@x.com",
  phone: "11999990000",
  isMinor: false,
  guardianEmail: null,
  guardianPhone: null,
} as PortalClientForLogin;

describe("requestPatientPortalOtp", () => {
  let otp: InMemoryPatientPortalOtpRepository;
  let delivery: FakePortalOtpDelivery;
  const request = (client: PortalClientForLogin | null = CLIENT) =>
    requestPatientPortalOtp({ tenant: TENANT, client }, { otp, delivery });

  beforeEach(() => {
    process.env.PATIENT_PORTAL_SECRET = "test-secret";
    otp = new InMemoryPatientPortalOtpRepository();
    delivery = new FakePortalOtpDelivery();
  });

  it("should answer opaque without creating a challenge when the client does not exist", async () => {
    expect(await request(null)).toEqual({ kind: "opaque" });
    expect(otp.challenges).toHaveLength(0);
  });

  it("should answer opaque when no channel is available", async () => {
    delivery.canEmail = false;
    expect(await request()).toEqual({ kind: "opaque" });
    expect(otp.challenges).toHaveLength(0);
  });

  it("should store only the hash of a code and e-mail the plain code to the patient", async () => {
    expect(await request()).toEqual({ kind: "sent" });

    const [email] = delivery.emails;
    expect(email).toMatchObject({ recipients: ["ana@x.com"], clinicName: "Clínica" });
    expect(otp.challenges).toHaveLength(1);
    expect(otp.challenges[0]!.codeHash).toBe(hashPatientPortalOtpCode(email!.code));
    expect(otp.challenges[0]!.codeHash).not.toContain(email!.code);
    expect(otp.challenges[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(delivery.whatsapps).toHaveLength(0);
  });

  it("should also send on WhatsApp when the webhook is configured", async () => {
    delivery.webhookConfigured = true;
    await request();
    expect(delivery.whatsapps).toMatchObject([{ phones: ["11999990000"] }]);
  });

  it("should rate limit after the max requests in the window and not send anything", async () => {
    for (let i = 0; i < PATIENT_PORTAL_OTP_MAX_REQUESTS_PER_WINDOW; i++) {
      expect((await request()).kind).toBe("sent");
    }
    delivery.emails.length = 0;

    expect(await request()).toEqual({ kind: "rate_limited" });
    expect(delivery.emails).toHaveLength(0);
    expect(otp.challenges).toHaveLength(PATIENT_PORTAL_OTP_MAX_REQUESTS_PER_WINDOW);
  });

  it("should report service_unavailable when the OTP secret is not configured", async () => {
    const previous = { a: process.env.PATIENT_PORTAL_SECRET, b: process.env.NEXTAUTH_SECRET };
    delete process.env.PATIENT_PORTAL_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    try {
      expect(await request()).toEqual({ kind: "service_unavailable" });
      expect(otp.challenges).toHaveLength(0);
    } finally {
      process.env.PATIENT_PORTAL_SECRET = previous.a;
      if (previous.b !== undefined) process.env.NEXTAUTH_SECRET = previous.b;
    }
  });
});
