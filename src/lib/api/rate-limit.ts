import { getRedisConnection } from "@/infrastructure/queue/redis-connection";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

type RateLimitConfig = {
  max: number;
  windowSec: number;
};

const PRESETS = {
  auth: { max: 5, windowSec: 60 } satisfies RateLimitConfig,
  /** Login por senha no portal do paciente (por tenant + CPF). */
  patientPortalPassword: { max: 5, windowSec: 15 * 60 } satisfies RateLimitConfig,
  /** Rotas públicas do portal do paciente: por IP. */
  patientPortalPublicIp: { max: 30, windowSec: 60 } satisfies RateLimitConfig,
  /** Rotas públicas do portal: por tenant + documento (hash). */
  patientPortalPublicIdentity: { max: 10, windowSec: 15 * 60 } satisfies RateLimitConfig,
  /** Verificação de OTP por tenant + documento (hash). */
  patientPortalOtpVerify: { max: 10, windowSec: 15 * 60 } satisfies RateLimitConfig,
  api: { max: 120, windowSec: 60 } satisfies RateLimitConfig,
  sse: { max: 3, windowSec: 10 } satisfies RateLimitConfig,
} as const;

export type RateLimitPreset = keyof typeof PRESETS;

/** Hash curto para compor chaves de rate limit sem expor CPF/e-mail no Redis/memória. */
export function hashRateLimitKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

const MEMORY_MAX_KEYS = 10_000;
const memoryWindows = new Map<string, { count: number; resetAt: number }>();

/** Fixed-window em memória (por processo) — fallback quando Redis ausente/falhando. */
function memoryIncrement(key: string, windowSec: number): { count: number; ttlSec: number } {
  const now = Date.now();
  if (memoryWindows.size >= MEMORY_MAX_KEYS) {
    for (const [k, v] of memoryWindows) {
      if (v.resetAt <= now) memoryWindows.delete(k);
    }
    // Ainda cheio: descarta as entradas mais antigas (ordem de inserção).
    for (const k of memoryWindows.keys()) {
      if (memoryWindows.size < MEMORY_MAX_KEYS) break;
      memoryWindows.delete(k);
    }
  }
  const entry = memoryWindows.get(key);
  if (!entry || entry.resetAt <= now) {
    memoryWindows.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { count: 1, ttlSec: windowSec };
  }
  entry.count += 1;
  return { count: entry.count, ttlSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
}

function tooManyRequests(max: number, retryAfterSec: number): Response {
  return Response.json(
    {
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(max),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Sliding-window rate limiter backed by Redis INCR + EXPIRE.
 * Fallback em memória (por processo) quando Redis ausente/com erro.
 * Returns null if allowed, or a 429 Response if limit exceeded.
 */
export async function rateLimit(
  preset: RateLimitPreset,
  identifier?: string,
): Promise<Response | null> {
  /**
   * Carga local: `PRESETS.api` é 120/min por usuário — scripts com alta concorrência viram só 429.
   * Somente fora de produção e com env explícita (nunca habilitar em deploy).
   */
  if (
    preset === "api" &&
    process.env.NODE_ENV !== "production" &&
    process.env.LOAD_TEST_DISABLE_API_RL === "1"
  ) {
    return null;
  }

  const config = PRESETS[preset];
  const id = identifier ?? await getClientIp();
  const key = `rl:${preset}:${id}`;

  const redis = getRedisConnection();
  if (redis) {
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, config.windowSec);
      }
      if (current > config.max) {
        const ttl = await redis.ttl(key);
        return tooManyRequests(config.max, ttl > 0 ? ttl : config.windowSec);
      }
      return null;
    } catch (err) {
      console.error("[rate-limit] redis error, using in-memory fallback:", err instanceof Error ? err.message : "unknown");
    }
  }

  const { count, ttlSec } = memoryIncrement(key, config.windowSec);
  return count > config.max ? tooManyRequests(config.max, ttlSec) : null;
}
