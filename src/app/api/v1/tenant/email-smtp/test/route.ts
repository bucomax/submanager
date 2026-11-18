import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { SMTP_TEST_ERRORS } from "@/lib/api/error-tables/tenant-settings";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { postTestTenantSmtpBodySchema } from "@/lib/validators/tenant-smtp";
import { testTenantSmtp } from "@/application/use-cases/tenant/tenant-smtp-settings";

export const dynamic = "force-dynamic";

export const POST = withTenantRoute(async ({ request, session, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, postTestTenantSmtpBodySchema, apiT, { issues: "fields", allowEmptyBody: true });
  if (parsed.response) return parsed.response;

  const to =
    parsed.data.to?.trim() || session.user?.email?.trim() || null;
  if (!to) {
    return jsonError("VALIDATION_ERROR", apiT("errors.invalidJson"), 422);
  }

  const r = await testTenantSmtp(tenantId, to);
  if (!r.ok) {
    return mapUseCaseError(r.code, SMTP_TEST_ERRORS, apiT, {
      message: r.code === "TENANT_NOT_FOUND" ? undefined : r.message,
    });
  }
  return jsonSuccess({ message: r.message, ok: true as const });
}, { role: "admin" });
