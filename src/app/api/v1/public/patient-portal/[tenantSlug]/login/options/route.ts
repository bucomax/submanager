import { parseJsonBody } from "@/lib/api/parse-json-body";
import { hashRateLimitKey, rateLimit } from "@/lib/api/rate-limit";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { findClientForPortalLogin } from "@/application/use-cases/client/find-client-for-portal-login";
import {
  parsePortalLoginInput,
  portalLoginRateKey,
} from "@/domain/auth/patient-portal-login-identifier";
import { findActiveTenantBySlug } from "@/application/use-cases/auth/resolve-public-tenant";
import { postPatientPortalLoginOptionsBodySchema } from "@/lib/validators/patient-portal";

export const dynamic = "force-dynamic";

import type { RouteCtx } from "@/types/api/route-context";

export async function POST(request: Request, ctx: RouteCtx) {
  const ipLimited = await rateLimit("patientPortalPublicIp");
  if (ipLimited) return ipLimited;

  const apiT = await getApiT(request);
  const { tenantSlug: rawSlug } = await ctx.params;
  const tenantSlug = rawSlug.trim().toLowerCase();
  const tenant = await findActiveTenantBySlug(tenantSlug);
  if (!tenant) {
    return jsonSuccess({ hasPassword: false });
  }

  const parsed = await parseJsonBody(request, postPatientPortalLoginOptionsBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const identifier = parsePortalLoginInput(parsed.data.login);
  if (!identifier) {
    return jsonError("VALIDATION_ERROR", apiT("errors.patientPortalLoginInvalid"), 422);
  }

  const identityLimited = await rateLimit(
    "patientPortalPublicIdentity",
    `pp-opts:${tenant.id}:${hashRateLimitKey(portalLoginRateKey(identifier))}`,
  );
  if (identityLimited) return identityLimited;

  const client = await findClientForPortalLogin(tenant.id, identifier);

  return jsonSuccess({ hasPassword: Boolean(client?.portalPasswordHash) });
}
