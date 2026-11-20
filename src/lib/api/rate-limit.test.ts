import { describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/queue/redis-connection", () => ({
  getRedisConnection: () => null,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
}));

const { hashRateLimitKey, rateLimit, resolveClientIp } = await import("./rate-limit");

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

  it("should key on the trusted-proxy IP when no identifier is given", async () => {
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

describe("rateLimit (Redis path)", () => {
  it("should use a single atomic eval and return the standard error envelope when blocked", async () => {
    vi.resetModules();
    const evalMock = vi.fn().mockResolvedValue([6, 42]);
    vi.doMock("@/infrastructure/queue/redis-connection", () => ({
      getRedisConnection: () => ({ eval: evalMock, incr: vi.fn(), expire: vi.fn() }),
    }));
    const { rateLimit: rl } = await import("./rate-limit");

    const res = await rl("auth", "redis-id");

    expect(evalMock).toHaveBeenCalledTimes(1);
    expect(evalMock.mock.calls[0][2]).toBe("rl:auth:redis-id");
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("42");
    const body = await res?.json();
    expect(body).toMatchObject({
      success: false,
      error: { code: "RATE_LIMITED" },
      meta: { timestamp: expect.any(String) },
    });
    vi.doUnmock("@/infrastructure/queue/redis-connection");
  });

  it("should allow when count is within the limit", async () => {
    vi.resetModules();
    vi.doMock("@/infrastructure/queue/redis-connection", () => ({
      getRedisConnection: () => ({ eval: vi.fn().mockResolvedValue([1, 60]) }),
    }));
    const { rateLimit: rl } = await import("./rate-limit");
    expect(await rl("auth", "ok-id")).toBeNull();
    vi.doUnmock("@/infrastructure/queue/redis-connection");
  });
});

const base = { forwardedFor: null, vercelForwardedFor: null, onVercel: false, trustedProxyHops: 1 };

describe("resolveClientIp", () => {
  it("should take the last XFF entry on Cloud Run so a forged first entry is ignored", () => {
    expect(resolveClientIp({ ...base, forwardedFor: "1.2.3.4, 203.0.113.7" })).toBe("203.0.113.7");
    expect(resolveClientIp({ ...base, forwardedFor: "203.0.113.7" })).toBe("203.0.113.7");
  });

  it("should respect TRUSTED_PROXY_HOPS when more than one proxy appends its address", () => {
    const forwardedFor = "9.9.9.9, 203.0.113.7, 10.0.0.1";
    expect(resolveClientIp({ ...base, forwardedFor, trustedProxyHops: 2 })).toBe("203.0.113.7");
    expect(resolveClientIp({ ...base, forwardedFor, trustedProxyHops: 1 })).toBe("10.0.0.1");
  });

  it("should fall back to unknown when the chain is shorter than the hop count", () => {
    expect(resolveClientIp({ ...base, forwardedFor: "203.0.113.7", trustedProxyHops: 2 })).toBe("unknown");
  });

  it("should fall back to unknown without XFF or with a malformed address", () => {
    expect(resolveClientIp(base)).toBe("unknown");
    expect(resolveClientIp({ ...base, forwardedFor: "not-an-ip" })).toBe("unknown");
    expect(resolveClientIp({ ...base, forwardedFor: "1.2.3.4, <script>" })).toBe("unknown");
  });

  it("should accept IPv6 addresses", () => {
    expect(resolveClientIp({ ...base, forwardedFor: "2001:db8::1" })).toBe("2001:db8::1");
  });

  it("should prefer x-vercel-forwarded-for on Vercel and fall back to the first XFF entry", () => {
    expect(resolveClientIp({ ...base, onVercel: true, vercelForwardedFor: "198.51.100.4", forwardedFor: "1.1.1.1, 2.2.2.2" })).toBe(
      "198.51.100.4",
    );
    expect(resolveClientIp({ ...base, onVercel: true, forwardedFor: "198.51.100.9, 76.76.21.21" })).toBe("198.51.100.9");
    expect(resolveClientIp({ ...base, onVercel: true })).toBe("unknown");
  });

  it("should treat an invalid hop count as 1", () => {
    expect(resolveClientIp({ ...base, forwardedFor: "1.2.3.4, 203.0.113.7", trustedProxyHops: 0 })).toBe("203.0.113.7");
  });
});
