import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  runForgotPassword: vi.fn(),
  after: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: mocks.after }));
vi.mock("@/lib/api/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  hashRateLimitKey: (raw: string) => createHash("sha256").update(raw).digest("hex").slice(0, 32),
}));
vi.mock("@/lib/api/i18n", () => ({ getApiT: async () => (key: string) => key }));
vi.mock("@/application/use-cases/auth/forgot-password", () => ({ runForgotPassword: mocks.runForgotPassword }));

const { POST } = await import("./route");

const afterResponse = vi.fn();
const okResult = { ok: true, messageKey: "success.forgotPasswordHint", afterResponse };

function post(email: string) {
  return POST(
    new Request("http://localhost/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),
  );
}

describe("POST /api/v1/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimit.mockResolvedValue(null);
    mocks.runForgotPassword.mockResolvedValue(okResult);
  });

  it("should rate limit by hashed normalized email, so casing cannot dodge it and the raw email is never a key", async () => {
    await post("Ana@Clinic.example");
    await post("ana@clinic.example");

    const emailCalls = mocks.rateLimit.mock.calls.filter(([preset]) => preset !== "auth");
    expect(emailCalls).toHaveLength(2);
    expect(emailCalls[0]![1]).toBe(emailCalls[1]![1]);
    expect(emailCalls[0]![1]).toMatch(/^forgot-pw:[0-9a-f]{32}$/);
    expect(emailCalls[0]![1]).not.toContain("ana@clinic.example");
  });

  it("should stop with the 429 and never run the use case when the email limit is hit", async () => {
    mocks.rateLimit.mockResolvedValueOnce(null).mockResolvedValueOnce(new Response(null, { status: 429 }));

    const res = await post("ana@clinic.example");

    expect(res.status).toBe(429);
    expect(mocks.runForgotPassword).not.toHaveBeenCalled();
  });

  it("should return the same body for any outcome and schedule the deferred work with after()", async () => {
    const first = await post("known@clinic.example");
    const second = await post("unknown@clinic.example");

    expect(first.status).toBe(200);
    expect((await first.json()).data).toEqual((await second.json()).data);
    expect(mocks.after).toHaveBeenCalledTimes(2);
    expect(mocks.after).toHaveBeenCalledWith(afterResponse);
  });

  it("should map EMAIL_NOT_CONFIGURED to 503 without scheduling anything", async () => {
    mocks.runForgotPassword.mockResolvedValue({ ok: false, code: "EMAIL_NOT_CONFIGURED" });

    const res = await post("ana@clinic.example");

    expect(res.status).toBe(503);
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
