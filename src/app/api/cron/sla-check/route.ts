import { jsonError, jsonSuccess } from "@/lib/api-response";
import { runSlaCheckForActiveTenants } from "@/infrastructure/notifications/sla-notification-check";
import { timingSafeEqualStrings } from "@/lib/utils/timing-safe-compare";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SWEEP_BUDGET_MS = 240_000;

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return timingSafeEqualStrings(header, `Bearer ${secret}`);
}

/** Vercel Cron (GET): emite alertas SLA para todos os tenants ativos. Fail-closed sem `CRON_SECRET`. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return jsonError("UNAUTHORIZED", "Unauthorized", 401);
  }
  const summary = await runSlaCheckForActiveTenants({ budgetMs: SWEEP_BUDGET_MS });
  return jsonSuccess(summary);
}
