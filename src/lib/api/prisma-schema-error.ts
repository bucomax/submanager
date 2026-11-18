import { logger } from "@/lib/observability/logger";
import { Prisma } from "@prisma/client";

import type { ApiT } from "@/lib/api/i18n";
import { jsonError } from "@/lib/api-response";

/**
 * Banco sem migration aplicada (coluna/tabela inexistente) → 503 em vez de 500 opaco.
 */
export function jsonIfPrismaSchemaMismatch(
  err: unknown,
  apiT: ApiT,
  logPrefix: string,
): Response | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return null;
  if (err.code !== "P2021" && err.code !== "P2022") return null;
  logger.error(`${logPrefix} DB schema out of sync with Prisma — run migrate deploy on production`, {
    code: err.code,
    meta: err.meta,
  });
  return jsonError("DATABASE_SCHEMA_PENDING", apiT("errors.databaseSchemaOutdated"), 503);
}
