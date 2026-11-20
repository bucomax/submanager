import { jsonError, jsonSuccess } from "@/lib/api-response";
import { isAuthorizedCron } from "@/lib/auth/cron-auth";
import { runSurgeryReminderSweep } from "@/infrastructure/notifications/surgery-reminder-sweep";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SWEEP_BUDGET_MS = 240_000;

/** Cron diário (GET, fim da tarde): lembrete por e-mail das cirurgias de amanhã. Fail-closed sem `CRON_SECRET`. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return jsonError("UNAUTHORIZED", "Unauthorized", 401);
  }
  const summary = await runSurgeryReminderSweep({ budgetMs: SWEEP_BUDGET_MS });
  return jsonSuccess(summary);
}
