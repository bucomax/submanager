import { SignJWT } from "jose";
import { beforeEach, describe, expect, it } from "vitest";

import { deriveAppTokenKey, generateAppScopedToken, verifyAppScopedToken } from "./app-scoped-token";

const base = { userId: "u1", tenantId: "t1", appSlug: "app" };

describe("app-scoped-token", () => {
  beforeEach(() => {
    process.env.APP_TOKEN_SECRET = "base-secret-for-tests";
  });

  it("round-trips a token for its own app", async () => {
    const token = await generateAppScopedToken({ ...base, appId: "app-a" });
    expect(await verifyAppScopedToken(token)).toMatchObject({ sub: "u1", tid: "t1", aid: "app-a" });
  });

  it("derives different keys per app", () => {
    expect(Buffer.from(deriveAppTokenKey("a")).equals(Buffer.from(deriveAppTokenKey("b")))).toBe(false);
  });

  it("rejects a token signed with app A's key but claiming app B", async () => {
    const forged = await new SignJWT({ tid: "t1", aid: "app-b", slug: "b" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setIssuer("submanager")
      .setAudience("submanager-app")
      .setExpirationTime("5m")
      .sign(deriveAppTokenKey("app-a"));
    expect(await verifyAppScopedToken(forged)).toBeNull();
  });

  it("rejects a token signed with the raw base secret", async () => {
    const forged = await new SignJWT({ tid: "t1", aid: "app-a", slug: "a" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setIssuer("submanager")
      .setAudience("submanager-app")
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("base-secret-for-tests"));
    expect(await verifyAppScopedToken(forged)).toBeNull();
  });
});
