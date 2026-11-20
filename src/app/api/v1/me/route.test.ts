import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSessionOr401: vi.fn(),
  getActiveTenantIdOr400: vi.fn(),
  runPatchMeProfile: vi.fn(),
  resolveUserProfileImageUrl: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireSessionOr401: mocks.requireSessionOr401,
  getActiveTenantIdOr400: mocks.getActiveTenantIdOr400,
  assertActiveTenantMembership: vi.fn(),
  assertTenantAdminOrSuper: vi.fn(),
  superAdminOr403: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/api/rate-limit", () => ({ rateLimit: async () => null }));
vi.mock("@/lib/api/i18n", () => ({ getApiT: async () => (key: string) => key }));
vi.mock("@/infrastructure/storage/resolve-user-profile-image-url", () => ({
  resolveUserProfileImageUrl: mocks.resolveUserProfileImageUrl,
}));
vi.mock("@/application/use-cases/me/patch-me-profile", () => ({ runPatchMeProfile: mocks.runPatchMeProfile }));
vi.mock("@/application/use-cases/me/get-me-profile", () => ({ getMeProfile: vi.fn() }));
vi.mock("@/application/use-cases/me/delete-me-account", () => ({ runDeleteMeAccount: vi.fn() }));

const { PATCH } = await import("./route");

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request("http://localhost/api/v1/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("PATCH /api/v1/me profile image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSessionOr401.mockResolvedValue({ session: { user: { id: "u1", globalRole: "user" } }, response: null });
    mocks.getActiveTenantIdOr400.mockResolvedValue({ tenantId: "t1", response: null });
    mocks.resolveUserProfileImageUrl.mockResolvedValue("https://signed.example/avatar");
    mocks.runPatchMeProfile.mockImplementation(async ({ patch: data }) => ({
      ok: true,
      user: { id: "u1", name: "Ana", image: data.image ?? null },
    }));
  });

  it.each([
    "gcs:tenants/t1/clients/c1/uploads/uuid-exame.pdf",
    "gcs:tenants/t1/library/uploads/uuid-modelo.pdf",
    "gcs:tenants/t1/exports/uuid-relatorio.csv",
    "gcs:tenants/t1/uploads/uuid-legado.pdf",
    "gcs:tenants/t2/avatars/uuid-photo.png",
  ])("should reject %s as profile image (422) and persist nothing", async (image) => {
    const res = await patch({ image });

    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toBe("errors.invalidObjectKey");
    expect(mocks.runPatchMeProfile).not.toHaveBeenCalled();
  });

  it("should accept an avatar key of the active tenant (existing upload flow keeps working)", async () => {
    const image = "gcs:tenants/t1/avatars/0b0e-photo.png";

    const res = await patch({ image });

    expect(res.status).toBe(200);
    expect(mocks.runPatchMeProfile).toHaveBeenCalledWith({ sessionUserId: "u1", patch: { image } });
  });

  it("should still allow clearing the image and plain https URLs", async () => {
    expect((await patch({ image: "" })).status).toBe(200);
    expect((await patch({ image: "https://cdn.example/a.png" })).status).toBe(200);
  });
});
