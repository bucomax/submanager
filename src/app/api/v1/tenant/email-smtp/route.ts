import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { SMTP_PATCH_ERRORS } from "@/lib/api/error-tables/tenant-settings";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { patchTenantSmtpBodySchema } from "@/lib/validators/tenant-smtp";
import {
  getTenantSmtpState,
  patchTenantSmtp,
} from "@/application/use-cases/tenant/tenant-smtp-settings";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ tenantId, apiT }) => {
  const dto = await getTenantSmtpState(tenantId);
  if (!dto) {
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }
  return jsonSuccess(dto);
}, { role: "admin" });

export const PATCH = withTenantRoute(async ({ request, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, patchTenantSmtpBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await patchTenantSmtp(tenantId, parsed.data);
  if (!result.ok) {
    return mapUseCaseError(result.code, SMTP_PATCH_ERRORS, apiT, {
      message: result.code === "INVALID_SMTP_WHEN_ENABLING" ? result.message : undefined,
    });
  }
  return jsonSuccess({ smtp: result.dto });
}, { role: "admin" });
