import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { getActiveTenantIdOr400, requireSessionOr401 } from "@/lib/auth/guards";
import { changePasswordBodySchema } from "@/lib/validators/profile";
import { runChangeStaffPassword } from "@/application/use-cases/auth/change-staff-password";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = changePasswordBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const result = await runChangeStaffPassword({
    userId: auth.session!.user.id,
    tenantId: tenantCtx.tenantId,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });

  if (!result.ok) {
    if (result.code === "NO_LOCAL_PASSWORD") {
      return jsonError("FORBIDDEN", apiT("errors.noLocalPassword"), 403);
    }
    return jsonError("INVALID_CREDENTIALS", apiT("errors.wrongCurrentPassword"), 401);
  }

  return jsonSuccess({ message: apiT("success.passwordUpdated") });
}
