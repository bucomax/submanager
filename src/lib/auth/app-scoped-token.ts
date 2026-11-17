import { hkdfSync } from "crypto";

import { SignJWT, decodeJwt, jwtVerify } from "jose";

const ALG = "HS256";
const ISSUER = "submanager";
const AUDIENCE = "submanager-app";

/** Token lifetime: 15 minutes */
const TOKEN_TTL_SECONDS = 15 * 60;

function getBaseSecret(): string {
  const secret = process.env.APP_TOKEN_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("APP_TOKEN_SECRET not set");
  return secret;
}

/**
 * Chave por app: HKDF-SHA256(base secret, info = `submanager-app-token:${appId}`).
 * O segredo base nunca sai do servidor; um vendor que conhece a chave do seu app
 * não consegue forjar tokens de outros apps nem sessões NextAuth.
 */
export function deriveAppTokenKey(appId: string): Uint8Array {
  const key = hkdfSync(
    "sha256",
    Buffer.from(getBaseSecret(), "utf8"),
    Buffer.alloc(0),
    Buffer.from(`submanager-app-token:${appId}`, "utf8"),
    32,
  );
  return new Uint8Array(key);
}

// ---------------------------------------------------------------------------
// Token payload
// ---------------------------------------------------------------------------

export type AppScopedTokenPayload = {
  /** User ID */
  sub: string;
  /** Tenant ID */
  tid: string;
  /** App ID */
  aid: string;
  /** App slug */
  slug: string;
};

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

export async function generateAppScopedToken(params: {
  userId: string;
  tenantId: string;
  appId: string;
  appSlug: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    tid: params.tenantId,
    aid: params.appId,
    slug: params.appSlug,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(params.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(deriveAppTokenKey(params.appId));
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

export async function verifyAppScopedToken(
  token: string,
): Promise<AppScopedTokenPayload | null> {
  try {
    const unverifiedAid = decodeJwt(token).aid;
    if (typeof unverifiedAid !== "string" || !unverifiedAid) return null;

    const { payload } = await jwtVerify(token, deriveAppTokenKey(unverifiedAid), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALG],
    });

    const sub = payload.sub;
    const tid = payload.tid as string | undefined;
    const aid = payload.aid as string | undefined;
    const slug = payload.slug as string | undefined;

    if (!sub || !tid || !aid || !slug || aid !== unverifiedAid) return null;

    return { sub, tid, aid, slug };
  } catch {
    return null;
  }
}
