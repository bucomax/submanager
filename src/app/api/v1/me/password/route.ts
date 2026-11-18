import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { CHANGE_STAFF_PASSWORD_ERRORS } from "@/lib/api/error-tables/auth";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonSuccess } from "@/lib/api-response";
import { changePasswordBodySchema } from "@/lib/validators/profile";
import { runChangeStaffPassword } from "@/application/use-cases/auth/change-staff-password";

export const dynamic = "force-dynamic";

export const POST = withTenantRoute(async ({ request, session, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, changePasswordBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await runChangeStaffPassword({
    userId: session.user.id,
    tenantId,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, CHANGE_STAFF_PASSWORD_ERRORS, apiT);
  }

  return jsonSuccess({ message: apiT("success.passwordUpdated") });
});
