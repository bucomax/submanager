import { logger } from "@/lib/observability/logger";
import { randomUUID } from "node:crypto";

import { getRedisConnection } from "@/infrastructure/queue/redis-connection";

/** Libera a chave somente se o valor ainda for o token do dono (evita apagar lock de outro após TTL). */
const RELEASE_IF_OWNER_LUA =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

export type LockHandle = {
  /** Compare-and-delete: só remove a chave se este handle ainda for o dono. */
  release: () => Promise<void>;
};

/**
 * Adquire lock com dono (SET NX EX com token aleatório).
 * Retorna `null` se outro processo detém o lock.
 *
 * Fail-open: sem Redis (ou com Redis indisponível) concede o lock sem exclusão mútua.
 * Chamadores que precisam de consistência devem ter guarda própria (ex.: update condicional no banco).
 */
export async function acquireLock(key: string, ttlSec: number): Promise<LockHandle | null> {
  const noop: LockHandle = { release: async () => {} };
  const redis = getRedisConnection();
  if (!redis) return noop;

  const token = randomUUID();
  try {
    const result = await redis.set(key, token, "EX", ttlSec, "NX");
    if (result !== "OK") return null;
  } catch (err) {
    logger.warn("[distributed-lock] acquire failed; fail-open.", { err });
    return noop;
  }

  return {
    release: async () => {
      try {
        await redis.eval(RELEASE_IF_OWNER_LUA, 1, key, token);
      } catch (err) {
        logger.warn("[distributed-lock] release failed; lock expires by TTL.", { err });
      }
    },
  };
}

/**
 * Throttle de janela curta (SET NX EX) sem release explícito: expira por TTL.
 * Retorna true se o chamador "ganhou" o slot. Sem Redis, sempre true.
 */
export async function tryAcquire(key: string, ttlSec: number): Promise<boolean> {
  return (await acquireLock(key, ttlSec)) !== null;
}
