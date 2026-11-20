import { beforeEach, describe, expect, it, vi } from "vitest";

const gcs = vi.hoisted(() => ({
  isGcsConfigured: vi.fn(),
  presignGetObject: vi.fn(),
  publicUrlForKey: vi.fn(),
}));
vi.mock("@/infrastructure/storage/gcs-storage", () => gcs);

const { resolveUserProfileImageUrl } = await import("./resolve-user-profile-image-url");

describe("resolveUserProfileImageUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gcs.publicUrlForKey.mockReturnValue(null);
    gcs.isGcsConfigured.mockReturnValue(true);
    gcs.presignGetObject.mockResolvedValue("https://signed.example/get");
  });

  it("should presign avatar keys", async () => {
    const url = await resolveUserProfileImageUrl("gcs:tenants/t1/avatars/uuid-photo.png");

    expect(url).toBe("https://signed.example/get");
    expect(gcs.presignGetObject).toHaveBeenCalledWith("tenants/t1/avatars/uuid-photo.png", 3600);
  });

  it.each([
    "gcs:tenants/t1/clients/c1/uploads/uuid-exame.pdf",
    "gcs:tenants/t1/library/uploads/uuid-modelo.pdf",
    "gcs:tenants/t1/exports/uuid-relatorio.csv",
  ])("should never sign or expose a non-avatar key (%s)", async (image) => {
    expect(await resolveUserProfileImageUrl(image)).toBeNull();
    expect(gcs.presignGetObject).not.toHaveBeenCalled();
    expect(gcs.publicUrlForKey).not.toHaveBeenCalled();
  });

  it("should keep passing through plain http(s) images and empty values", async () => {
    expect(await resolveUserProfileImageUrl("https://cdn.example/a.png")).toBe("https://cdn.example/a.png");
    expect(await resolveUserProfileImageUrl(null)).toBeNull();
    expect(await resolveUserProfileImageUrl("")).toBeNull();
  });
});
