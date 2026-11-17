import { afterEach, describe, expect, it, vi } from "vitest";

const getSignedUrl = vi.hoisted(() => vi.fn().mockResolvedValue(["https://signed.example/put"]));

vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    bucket() {
      return { file: () => ({ getSignedUrl }) };
    }
  },
}));

const { presignUploadUrl } = await import("./gcs-storage");
const { MAX_UPLOAD_SIZE_BYTES } = await import("@/lib/constants/file-upload");

describe("presignUploadUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function stubGcsEnv() {
    vi.stubEnv("GCS_BUCKET_NAME", "bucket");
    vi.stubEnv("GCS_PROJECT_ID", "proj");
    vi.stubEnv("GCS_EXPECTED_PROJECT_ID", "proj");
  }

  it("should not sign nor return the range header by default", async () => {
    stubGcsEnv();
    const res = await presignUploadUrl("k", "application/pdf");
    expect(res.uploadHeaders).toEqual({});
    expect(getSignedUrl.mock.calls[0][0].extensionHeaders).toBeUndefined();
  });

  it("should sign and return the range header when UPLOAD_ENFORCE_CONTENT_LENGTH_RANGE=1", async () => {
    stubGcsEnv();
    vi.stubEnv("UPLOAD_ENFORCE_CONTENT_LENGTH_RANGE", "1");
    const res = await presignUploadUrl("k", "application/pdf");
    const expected = `0,${MAX_UPLOAD_SIZE_BYTES}`;
    expect(res.uploadHeaders).toEqual({ "x-goog-content-length-range": expected });
    expect(getSignedUrl.mock.calls[0][0].extensionHeaders).toEqual({
      "x-goog-content-length-range": expected,
    });
  });
});
