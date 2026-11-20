import { prisma } from "@/infrastructure/database/prisma";
import { logger } from "@/lib/observability/logger";

/** Teto do ping: uma probe do Cloud Run/LB não pode ficar presa no pool esgotado ou no banco lento. */
const DATABASE_PING_TIMEOUT_MS = 2_000;

export async function runDatabasePing(timeoutMs = DATABASE_PING_TIMEOUT_MS): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  try {
    const outcome = await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    if (outcome === "timeout") {
      logger.warn("[health] database ping timed out", { timeoutMs });
      return false;
    }
    return true;
  } catch (err) {
    // `err` é serializado pelo logger (nome, código, mensagem redigida); nunca vai ao cliente.
    logger.warn("[health] database ping failed", { err });
    return false;
  } finally {
    clearTimeout(timer);
  }
}
