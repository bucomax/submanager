import { jsonError, jsonSuccess } from "@/lib/api-response";
import { isAuthorizedCron } from "@/lib/auth/cron-auth";
import { purgeExpiredDispatchKeys } from "@/infrastructure/database/dispatch-key";
import { runSlaCheckForActiveTenants } from "@/infrastructure/notifications/sla-notification-check";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SWEEP_BUDGET_MS = 240_000;

/**
 * Vercel Cron (GET): emite alertas SLA para todos os tenants ativos e expurga chaves de envio antigas
 * (`DispatchKey`). Fail-closed sem `CRON_SECRET`.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return jsonError("UNAUTHORIZED", "Unauthorized", 401);
  }
  const summary = await runSlaCheckForActiveTenants({ budgetMs: SWEEP_BUDGET_MS });
  const purgedDispatchKeys = await purgeDispatchKeysSafely();
  return jsonSuccess({ ...summary, purgedDispatchKeys });
}

/** Housekeeping isolado: falha no expurgo não pode invalidar o resultado do sweep. */
async function purgeDispatchKeysSafely(): Promise<number> {
  try {
    return await purgeExpiredDispatchKeys();
  } catch (err) {
    logger.error("[sla-check] dispatch key purge failed", { err });
    return 0;
  }
}
