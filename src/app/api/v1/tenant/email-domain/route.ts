import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import {
  EMAIL_DOMAIN_PATCH_ERRORS,
  EMAIL_DOMAIN_REMOVE_ERRORS,
  EMAIL_DOMAIN_SETUP_ERRORS,
} from "@/lib/api/error-tables/tenant-settings";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
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

export const GET = withTenantRoute(async ({ tenantId, apiT }) => {
  const dto = await getTenantEmailDomainState(tenantId);
  if (!dto) {
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }
  return jsonSuccess({ emailDomain: dto });
}, { role: "admin" });

export const POST = withTenantRoute(async ({ request, session, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, postSetupTenantEmailDomainBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await setupTenantEmailDomain({
    tenantId,
    body: parsed.data,
    actorUserId: session.user.id,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, EMAIL_DOMAIN_SETUP_ERRORS, apiT, { message: result.errorMessage });
  }

  return jsonSuccess({ emailDomain: result.dto });
}, { role: "admin" });

export const PATCH = withTenantRoute(async ({ request, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, patchTenantEmailDomainBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await patchTenantEmailDomainInput({
    tenantId,
    body: parsed.data,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, EMAIL_DOMAIN_PATCH_ERRORS, apiT);
  }
  return jsonSuccess({ emailDomain: result.dto });
}, { role: "admin" });

export const DELETE = withTenantRoute(async ({ session, tenantId, apiT }) => {
  const result = await removeTenantEmailDomain({
    tenantId,
    actorUserId: session.user.id,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, EMAIL_DOMAIN_REMOVE_ERRORS, apiT);
  }
  return jsonSuccess({ emailDomain: result.dto });
}, { role: "admin" });
