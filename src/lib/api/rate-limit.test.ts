import { describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/queue/redis-connection", () => ({
  getRedisConnection: () => null,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
}));

const { hashRateLimitKey, rateLimit } = await import("./rate-limit");

describe("rateLimit (in-memory fallback without Redis)", () => {
  it("should block requests above the preset max", async () => {
    const id = `ip-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(await rateLimit("auth", id)).toBeNull();
    }
    const blocked = await rateLimit("auth", id);
    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("should count identifiers independently", async () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 5; i++) await rateLimit("auth", a);
    expect((await rateLimit("auth", a))?.status).toBe(429);
    expect(await rateLimit("auth", b)).toBeNull();
  });

  it("should fall back to the first forwarded IP when no identifier is given", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await rateLimit("sse")).toBeNull();
    }
    expect((await rateLimit("sse"))?.status).toBe(429);
  });
});

describe("hashRateLimitKey", () => {
  it("should not expose the raw identifier", () => {
    const hashed = hashRateLimitKey("tenant-1:12345678900");
    expect(hashed).not.toContain("12345678900");
    expect(hashed).toHaveLength(32);
    expect(hashRateLimitKey("tenant-1:12345678900")).toBe(hashed);
  });
});
