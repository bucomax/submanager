import { describe, expect, it } from "vitest";

import {
  formatUserProfileImageGcsRef,
  isUserAvatarObjectKey,
  parseUserProfileImageGcsKey,
} from "./user-profile-image-ref";

describe("isUserAvatarObjectKey", () => {
  it("should accept avatar keys of the tenant", () => {
    expect(isUserAvatarObjectKey("tenants/t1/avatars/uuid-photo.png", "t1")).toBe(true);
    expect(isUserAvatarObjectKey("tenants/t1/avatars/uuid-photo.png")).toBe(true);
  });

  it("should reject another tenant avatar when the tenant is given", () => {
    expect(isUserAvatarObjectKey("tenants/t2/avatars/uuid-photo.png", "t1")).toBe(false);
  });

  it.each([
    "tenants/t1/clients/c1/uploads/uuid-exame.pdf",
    "tenants/t1/clients/c1/avatars/uuid-x.png",
    "tenants/t1/library/uploads/uuid-modelo.pdf",
    "tenants/t1/exports/uuid-relatorio.csv",
    "tenants/t1/uploads/uuid-legado.pdf",
    "tenants/t1/avatars/",
    "tenants/t1/avatars/sub/uuid.png",
    "tenants/t1/avatars/..",
    "tenants/t1/avatars-evil/uuid.png",
    "other/t1/avatars/uuid.png",
  ])("should reject non-avatar key %s", (key) => {
    expect(isUserAvatarObjectKey(key, "t1")).toBe(false);
  });
});

describe("gcs ref round trip", () => {
  it("should parse the key that formatUserProfileImageGcsRef wrote", () => {
    const key = "tenants/t1/avatars/uuid-photo.png";
    expect(parseUserProfileImageGcsKey(formatUserProfileImageGcsRef(key))).toBe(key);
  });
});
