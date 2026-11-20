import type { App, AppScreenshot, FileAsset } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { mapAppToDto, mapAppToTenantDto, sanitizeAppMetadata } from "./map-app-dto";

const METADATA = {
  webhookSecret: "whsec_super_secret",
  healthCheckUrl: "https://app.example/health",
  nested: { apiKey: "k-123", label: "ok", list: [{ clientSecret: "s", name: "keep" }] },
  signingToken: "t",
};

function buildApp(metadata: unknown = METADATA) {
  return {
    id: "app-1",
    slug: "chat",
    name: "Chat",
    category: "communication",
    renderMode: "iframe",
    requiresConfig: false,
    configSchema: null,
    isPublished: true,
    isFeatured: false,
    sortOrder: 0,
    metadata,
    iconFile: null,
    screenshots: [] as (AppScreenshot & { file: FileAsset })[],
    pricingModel: "free",
    priceCurrency: "BRL",
    billingInterval: "monthly",
    trialDays: 0,
  } as unknown as App & { iconFile: FileAsset | null; screenshots: (AppScreenshot & { file: FileAsset })[] };
}

describe("mapAppToTenantDto", () => {
  it("should never expose metadata (nor the webhook secret) to tenant routes", () => {
    const dto = mapAppToTenantDto(buildApp());

    expect(dto).not.toHaveProperty("metadata");
    expect(JSON.stringify(dto)).not.toContain("whsec_super_secret");
    expect(dto).toMatchObject({ id: "app-1", slug: "chat", name: "Chat" });
  });
});

describe("mapAppToDto (admin)", () => {
  it("should drop sensitive metadata keys at any depth and keep harmless ones", () => {
    const dto = mapAppToDto(buildApp());

    expect(dto.metadata).toEqual({
      healthCheckUrl: "https://app.example/health",
      nested: { label: "ok", list: [{ name: "keep" }] },
    });
    expect(JSON.stringify(dto)).not.toContain("whsec_super_secret");
  });

  it("should return null metadata when the stored value is not an object", () => {
    expect(mapAppToDto(buildApp(null)).metadata).toBeNull();
    expect(mapAppToDto(buildApp(["webhookSecret"])).metadata).toBeNull();
  });
});

describe("sanitizeAppMetadata", () => {
  it("should not mutate the stored metadata (the webhook still reads the secret server-side)", () => {
    const stored = { webhookSecret: "x", keep: 1 };
    sanitizeAppMetadata(stored);
    expect(stored).toEqual({ webhookSecret: "x", keep: 1 });
  });
});
