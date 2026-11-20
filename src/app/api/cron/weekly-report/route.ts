import { jsonError, jsonSuccess } from "@/lib/api-response";
import { isAuthorizedCron } from "@/lib/auth/cron-auth";
import { runWeeklyReportSweep } from "@/infrastructure/notifications/weekly-report-sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SWEEP_BUDGET_MS = 240_000;

/** Cron semanal (GET, segunda de manhã): resumo da semana por e-mail aos administradores. Fail-closed sem `CRON_SECRET`. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return jsonError("UNAUTHORIZED", "Unauthorized", 401);
  }
  const summary = await runWeeklyReportSweep({ budgetMs: SWEEP_BUDGET_MS });
  return jsonSuccess(summary);
}
