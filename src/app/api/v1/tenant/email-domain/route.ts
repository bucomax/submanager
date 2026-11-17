import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import {
  patchTenantEmailDomainBodySchema,
  postSetupTenantEmailDomainBodySchema,
} from "@/lib/validators/email-domain";
import {
  getTenantEmailDomainState,
  patchTenantEmailDomainInput,
  removeTenantEmailDomain,
  setupTenantEmailDomain,
} from "@/application/use-cases/tenant/tenant-email-domain";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const adminBlock = await assertTenantAdminOrSuper(auth.session!, tenantCtx.tenantId, request, apiT);
  if (adminBlock) return adminBlock;

  const dto = await getTenantEmailDomainState(tenantCtx.tenantId);
  if (!dto) {
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }
  return jsonSuccess({ emailDomain: dto });
}

export async function POST(request: Request) {
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

  const parsed = postSetupTenantEmailDomainBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const result = await setupTenantEmailDomain({
    tenantId: tenantCtx.tenantId,
    body: parsed.data,
    actorUserId: auth.session!.user.id,
  });

  if (!result.ok) {
    if (result.code === "RESEND_NOT_CONFIGURED") {
      return jsonError("SERVICE_UNAVAILABLE", apiT("errors.emailResendNotConfigured"), 503);
    }
    if (result.code === "ALREADY_HAS_DOMAIN") {
      return jsonError("CONFLICT", apiT("errors.emailDomainAlreadyConfigured"), 409);
    }
    if (result.code === "RESEND_DUPLICATE") {
      return jsonError("CONFLICT", result.errorMessage ?? "Domínio já existe no Resend.", 409);
    }
    if (result.code === "RESEND_ERROR") {
      return jsonError("BAD_GATEWAY", result.errorMessage ?? "Falha ao criar domínio no Resend.", 502);
    }
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }

  return jsonSuccess({ emailDomain: result.dto });
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

  const parsed = patchTenantEmailDomainBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const result = await patchTenantEmailDomainInput({
    tenantId: tenantCtx.tenantId,
    body: parsed.data,
  });

  if (!result.ok) {
    if (result.code === "DOMAIN_NOT_VERIFIED") {
      return jsonError("PRECONDITION_FAILED", apiT("errors.emailDomainNotVerified"), 412);
    }
    if (result.code === "VALIDATION") {
      return jsonError("VALIDATION_ERROR", apiT("errors.emailFromAddressMustMatchDomain"), 422);
    }
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }
  return jsonSuccess({ emailDomain: result.dto });
}

export async function DELETE(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const adminBlock = await assertTenantAdminOrSuper(auth.session!, tenantCtx.tenantId, request, apiT);
  if (adminBlock) return adminBlock;

  const result = await removeTenantEmailDomain({
    tenantId: tenantCtx.tenantId,
    actorUserId: auth.session!.user.id,
  });

  if (!result.ok) {
    if (result.code === "RESEND_ERROR") {
      return jsonError("BAD_GATEWAY", "Falha ao remover domínio no Resend.", 502);
    }
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }
  return jsonSuccess({ emailDomain: result.dto });
}
