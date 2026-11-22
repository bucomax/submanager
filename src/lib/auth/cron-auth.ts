import { timingSafeEqualStrings } from "@/lib/utils/timing-safe-compare";

/** Cron (Cloud Scheduler): `Authorization: Bearer <CRON_SECRET>`. Fail-closed sem o secret. */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return timingSafeEqualStrings(header, `Bearer ${secret}`);
}
