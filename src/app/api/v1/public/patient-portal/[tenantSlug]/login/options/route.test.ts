import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findActiveTenantBySlug: vi.fn(),
  findClientForPortalLogin: vi.fn(),
}));

vi.mock("@/lib/api/rate-limit", () => ({ rateLimit: async () => null, hashRateLimitKey: (raw: string) => raw }));
vi.mock("@/lib/api/i18n", () => ({ getApiT: async () => (key: string) => key }));
vi.mock("@/application/use-cases/auth/resolve-public-tenant", () => ({
  findActiveTenantBySlug: mocks.findActiveTenantBySlug,
}));
vi.mock("@/application/use-cases/client/find-client-for-portal-login", () => ({
  findClientForPortalLogin: mocks.findClientForPortalLogin,
}));

const { POST } = await import("./route");

async function options(login: string) {
  const res = await POST(
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login }),
    }),
    { params: Promise.resolve({ tenantSlug: "clinica" }) },
  );
  return { status: res.status, data: (await res.json()).data };
}

describe("POST /api/v1/public/patient-portal/[tenantSlug]/login/options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findActiveTenantBySlug.mockResolvedValue({ id: "t1", slug: "clinica", name: "Clinica" });
  });

  it("should answer a non-existent CPF exactly like a CPF that has a password", async () => {
    mocks.findClientForPortalLogin.mockResolvedValueOnce(null);
    const missing = await options("12345678901");

    mocks.findClientForPortalLogin.mockResolvedValueOnce({ id: "c1", portalPasswordHash: "$2a$12$hash" });
    const withPassword = await options("12345678901");

    expect(missing).toEqual(withPassword);
    expect(missing).toEqual({ status: 200, data: { hasPassword: true } });
  });

  it("should keep sending existing patients without password to the OTP step", async () => {
    mocks.findClientForPortalLogin.mockResolvedValue({ id: "c1", portalPasswordHash: null });

    expect(await options("12345678901")).toEqual({ status: 200, data: { hasPassword: false } });
  });
});
