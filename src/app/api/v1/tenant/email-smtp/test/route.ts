import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { postTestTenantSmtpBodySchema } from "@/lib/validators/tenant-smtp";
import { testTenantSmtp } from "@/application/use-cases/tenant/tenant-smtp-settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const adminBlock = await assertTenantAdminOrSuper(auth.session!, tenantCtx.tenantId, request, apiT);
  if (adminBlock) return adminBlock;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.length > 0) {
      body = JSON.parse(text) as unknown;
    }
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postTestTenantSmtpBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const to =
    parsed.data.to?.trim() || auth.session!.user?.email?.trim() || null;
  if (!to) {
    return jsonError("VALIDATION_ERROR", apiT("errors.invalidJson"), 422);
  }

  const r = await testTenantSmtp(tenantCtx.tenantId, to);
  if (!r.ok) {
    if (r.code === "TENANT_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
    }
    if (r.code === "INCOMPLETE") {
      return jsonError("PRECONDITION_FAILED", r.message, 412);
    }
    return jsonError("BAD_GATEWAY", r.message, 502);
  }
  return jsonSuccess({ message: r.message, ok: true as const });
}
