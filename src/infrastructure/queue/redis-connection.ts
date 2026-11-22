import { logger } from "@/lib/observability/logger";
import IORedis from "ioredis";

type ConnectionSlot = "default" | "worker" | "subscriber";

const CIRCUIT_MS_DEFAULT = 45_000;

const globalConnections = globalThis as unknown as {
  __redisPool?: Map<ConnectionSlot, IORedis>;
  __redisCircuitUntil?: number;
  __notifQueue?: { close: () => Promise<void> };
};

/** Conexões `subscribe` fora do pool (SSE); desligadas no circuit breaker. */
const standaloneSubscribers = new Set<IORedis>();

/** Após falhas de conexão, deixa de criar clientes Redis por um tempo (evita spam de ECONNREFUSED). */
export function tripRedisCircuit(durationMs = CIRCUIT_MS_DEFAULT): void {
  globalConnections.__redisCircuitUntil = Date.now() + durationMs;

  const pool = globalConnections.__redisPool;
  if (pool) {
    for (const c of pool.values()) {
      try {
        c.disconnect(false);
      } catch {
        /* ignore */
      }
    }
    pool.clear();
  }

  for (const c of [...standaloneSubscribers]) {
    try {
      c.disconnect(false);
    } catch {
      /* ignore */
    }
  }
  standaloneSubscribers.clear();

  const q = globalConnections.__notifQueue;
  if (q) {
    void q.close().catch(() => {});
    delete globalConnections.__notifQueue;
  }
}

/**
 * Shutdown gracioso: encerra as conexões do pool e dos subscribers com `QUIT` (aguarda comandos
 * pendentes) e força `disconnect` após o timeout. Mantém o circuito aberto para que requisições
 * em voo caiam no modo inline em vez de recriar conexões durante o desligamento.
 */
export async function closeRedisConnections(timeoutMs = 5_000): Promise<void> {
  globalConnections.__redisCircuitUntil = Number.MAX_SAFE_INTEGER;

  const connections = [...(globalConnections.__redisPool?.values() ?? []), ...standaloneSubscribers];
  globalConnections.__redisPool?.clear();
  standaloneSubscribers.clear();

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([Promise.allSettled(connections.map((c) => c.quit())), timeout]);
  clearTimeout(timer);

  for (const c of connections) c.disconnect(false);
}

function isRedisCircuitOpen(): boolean {
  return Date.now() < (globalConnections.__redisCircuitUntil ?? 0);
}

/** Returns true when `REDIS_URL` is non-empty (BullMQ, SSE pub/sub, rate limit, locks). */
export function isRedisEnabled(): boolean {
  return !!process.env.REDIS_URL?.trim();
}

/**
 * Decide se algum worker consumirá as filas BullMQ, espelhando `src/instrumentation.ts`:
 * o worker local só sobe sem `DISABLE_NOTIFICATION_WORKER=true`.
 * `QUEUE_EXTERNAL_WORKER=1` declara um worker em outro host (vale em qualquer ambiente).
 */
export function resolveQueueConsumerAvailable(env: Record<string, string | undefined>): boolean {
  if (!env.REDIS_URL?.trim()) return false;
  if (env.QUEUE_EXTERNAL_WORKER === "1") return true;
  const localWorkerRuns = env.DISABLE_NOTIFICATION_WORKER !== "true";
  return localWorkerRuns;
}

/**
 * Há consumidor para as filas BullMQ neste deploy?
 * Emitters devem usar isto (e não `isRedisEnabled`) para decidir entre fila e execução inline.
 */
export function isQueueConsumerAvailable(): boolean {
  return resolveQueueConsumerAvailable(process.env);
}

function createConnection(): IORedis {
  const url = process.env.REDIS_URL!.trim();
  const conn = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
    enableOfflineQueue: true,
    connectTimeout: 5_000,
    retryStrategy(times) {
      const cap = 8;
      if (times > cap) {
        logger.warn(
          "[redis] Desistindo da reconexão. Suba o Redis (`docker compose up -d redis`), defina `REDIS_URL`, ou remova/limpe `REDIS_URL` no `.env` para modo inline.",
          { attempts: cap },
        );
        tripRedisCircuit();
        return null;
      }
      return Math.min(times * 400, 4_000);
    },
  });
  conn.on("error", () => {
    /* Evita "Unhandled error event" do ioredis; reconexão via retryStrategy. */
  });
  return conn;
}

function getPool(): Map<ConnectionSlot, IORedis> {
  if (!globalConnections.__redisPool) {
    globalConnections.__redisPool = new Map();
  }
  return globalConnections.__redisPool;
}

function getOrCreate(slot: ConnectionSlot): IORedis {
  const pool = getPool();
  let conn = pool.get(slot);
  if (!conn) {
    conn = createConnection();
    // lazyConnect: true — initiate connection on first use, not on import
    conn.connect().catch(() => {});
    pool.set(slot, conn);
  }
  return conn;
}

/** Queue producers (API side): non-blocking commands only. Returns null when Redis is disabled or circuit is open. */
export function getRedisConnection(): IORedis | null {
  if (!isRedisEnabled() || isRedisCircuitOpen()) return null;
  return getOrCreate("default");
}

/** Worker consumers: uses blocking commands. Returns null when Redis is disabled or circuit is open. */
export function getWorkerRedisConnection(): IORedis | null {
  if (!isRedisEnabled() || isRedisCircuitOpen()) return null;
  return getOrCreate("worker");
}

/** SSE subscriber connections are per-client. Returns null when Redis is disabled or circuit is open. */
export function createSubscriberConnection(): IORedis | null {
  if (!isRedisEnabled() || isRedisCircuitOpen()) return null;
  const conn = createConnection();
  conn.connect().catch(() => {});
  standaloneSubscribers.add(conn);
  conn.once("end", () => standaloneSubscribers.delete(conn));
  return conn;
}
