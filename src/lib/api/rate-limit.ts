import { getRedisConnection } from "@/infrastructure/queue/redis-connection";
import { headers } from "next/headers";

type RateLimitConfig = {
  max: number;
  windowSec: number;
};

const PRESETS = {
  auth: { max: 5, windowSec: 60 } satisfies RateLimitConfig,
  /** Login por senha no portal do paciente (por tenant + CPF). */
  patientPortalPassword: { max: 5, windowSec: 15 * 60 } satisfies RateLimitConfig,
  api: { max: 120, windowSec: 60 } satisfies RateLimitConfig,
  sse: { max: 3, windowSec: 10 } satisfies RateLimitConfig,
} as const;

export type RateLimitPreset = keyof typeof PRESETS;

async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * Sliding-window rate limiter backed by Redis INCR + EXPIRE.
 * Returns null if allowed (or Redis unavailable), or a 429 Response if limit exceeded.
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

  const redis = getRedisConnection();
  if (!redis) return null;

  const config = PRESETS[preset];
  const id = identifier ?? await getClientIp();
  const key = `rl:${preset}:${id}`;

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, config.windowSec);
    }

    if (current > config.max) {
      const ttl = await redis.ttl(key);
      return Response.json(
        {
          success: false,
          error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(ttl > 0 ? ttl : config.windowSec),
            "X-RateLimit-Limit": String(config.max),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }

    return null;
  } catch {
    return null;
  }
}
