import type { Prisma } from "@prisma/client";

/**
 * Lock consultivo (por transação) da jornada, na MESMA chave do publish
 * (`pathway-publish.repository`: `pg_advisory_xact_lock(hashtext(pathwayId))`, exclusivo).
 *
 * Quem lê a versão publicada para criar dados dependentes (ex.: iniciar `PatientPathway`) pega o lock
 * compartilhado: várias criações correm juntas, mas esperam um publish em andamento e vice-versa. Depois
 * de adquirido, a releitura da versão publicada na mesma transação já enxerga o commit do publish.
 */
export async function acquirePathwaySharedLock(tx: Prisma.TransactionClient, pathwayId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${pathwayId}))`;
}
