import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { patchTenantSmtpBodySchema } from "@/lib/validators/tenant-smtp";
import {
  getTenantSmtpState,
  patchTenantSmtp,
} from "@/application/use-cases/tenant/tenant-smtp-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const adminBlock = await assertTenantAdminOrSuper(auth.session!, tenantCtx.tenantId, request, apiT);
  if (adminBlock) return adminBlock;

  const dto = await getTenantSmtpState(tenantCtx.tenantId);
  if (!dto) {
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }
  return jsonSuccess(dto);
}

export async function PATCH(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const adminBlock = await assertTenantAdminOrSuper(auth.session!, tenantCtx.tenantId, request, apiT);
  if (adminBlock) return adminBlock;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = patchTenantSmtpBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const result = await patchTenantSmtp(tenantCtx.tenantId, parsed.data);
  if (!result.ok) {
    if (result.code === "TENANT_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
    }
    if (result.code === "ENCRYPTION_KEY") {
      return jsonError("INTERNAL_ERROR", "Chave de criptografia (WHATSAPP_ENCRYPTION_KEY) inválida.", 500);
    }
    if (result.code === "INVALID_SMTP_WHEN_ENABLING") {
      return jsonError("UNPROCESSABLE_ENTITY", result.message, 422);
    }
    return jsonError("VALIDATION_ERROR", apiT("errors.invalidJson"), 422);
  }
  return jsonSuccess({ smtp: result.dto });
}
