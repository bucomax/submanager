import { beforeEach, describe, expect, it, vi } from "vitest";

const gcs = vi.hoisted(() => ({
  getGcsObjectSize: vi.fn(),
  deleteObjectFromBucket: vi.fn().mockResolvedValue(undefined),
  readFirstBytesFromGcsObject: vi.fn().mockResolvedValue(null),
  computeSha256HexForGcsObjectKey: vi.fn().mockResolvedValue(null),
}));
const assets = vi.hoisted(() => ({ createStaffUploadedAsset: vi.fn() }));

vi.mock("@/infrastructure/storage/gcs-storage", () => ({
  ...gcs,
  keyMatchesFileRegisterIntent: () => true,
  publicUrlForKey: () => null,
}));
vi.mock("@/infrastructure/repositories/file-asset.repository", () => ({
  fileAssetPrismaRepository: assets,
}));
vi.mock("@/infrastructure/repositories/audit-event.repository", () => ({
  auditEventPrismaRepository: { recordCanonical: vi.fn() },
}));

const { runRegisterStaffFileAfterUpload } = await import("./register-staff-file-after-upload");
const { MAX_UPLOAD_SIZE_BYTES } = await import("@/lib/constants/file-upload");

const DATA = {
  key: "tenants/t1/library/uploads/x-a.pdf",
  fileName: "a.pdf",
  mimeType: "application/pdf",
  sizeBytes: 10,
} as Parameters<typeof runRegisterStaffFileAfterUpload>[0]["data"];

describe("runRegisterStaffFileAfterUpload size check", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should fail closed and not register when object size cannot be read", async () => {
    gcs.getGcsObjectSize.mockResolvedValue(null);
    const res = await runRegisterStaffFileAfterUpload({ tenantId: "t1", userId: "u1", data: DATA });
    expect(res).toEqual({ ok: false, code: "STORAGE_UNAVAILABLE" });
    expect(assets.createStaffUploadedAsset).not.toHaveBeenCalled();
  });

  it("should reject and delete oversize objects", async () => {
    gcs.getGcsObjectSize.mockResolvedValue(MAX_UPLOAD_SIZE_BYTES + 1);
    const res = await runRegisterStaffFileAfterUpload({ tenantId: "t1", userId: "u1", data: DATA });
    expect(res).toMatchObject({ ok: false, code: "FILE_TOO_LARGE" });
    expect(gcs.deleteObjectFromBucket).toHaveBeenCalledWith(DATA.key);
  });
});
