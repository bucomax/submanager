import { prisma } from "@/infrastructure/database/prisma";

/** Chaves de envio idempotente são expurgadas pelo cron SLA depois deste prazo. */
export const DISPATCH_KEY_RETENTION_DAYS = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Reserva atômica de uma chave de envio (`DispatchKey`, PK = `key`).
 * `true` = reserva nova (pode enviar); `false` = já reservada por outra execução.
 */
export async function reserveDispatchKey(key: string): Promise<boolean> {
  const { count } = await prisma.dispatchKey.createMany({ data: [{ key }], skipDuplicates: true });
  return count > 0;
}

/** Libera a reserva para permitir novo envio (ex.: falha transitória sem retry automático). */
export async function releaseDispatchKey(key: string): Promise<void> {
  await prisma.dispatchKey.deleteMany({ where: { key } });
}

export async function hasDispatchKey(key: string): Promise<boolean> {
  const row = await prisma.dispatchKey.findUnique({ where: { key }, select: { key: true } });
  return row !== null;
}

/** Remove chaves mais antigas que a retenção. Devolve quantas foram removidas. */
export async function purgeExpiredDispatchKeys(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - DISPATCH_KEY_RETENTION_DAYS * MS_PER_DAY);
  const { count } = await prisma.dispatchKey.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}
