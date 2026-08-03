import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const ISSUER = "submanager";
const AUDIENCE = "submanager-app";

/** Token lifetime: 15 minutes */
const TOKEN_TTL_SECONDS = 15 * 60;

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not set");
  return new TextEncoder().encode(secret);
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
    .sign(getSecret());
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

export async function verifyAppScopedToken(
  token: string,
): Promise<AppScopedTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALG],
    });

    const sub = payload.sub;
    const tid = payload.tid as string | undefined;
    const aid = payload.aid as string | undefined;
    const slug = payload.slug as string | undefined;

    if (!sub || !tid || !aid || !slug) return null;

    return { sub, tid, aid, slug };
  } catch {
    return null;
  }
}
