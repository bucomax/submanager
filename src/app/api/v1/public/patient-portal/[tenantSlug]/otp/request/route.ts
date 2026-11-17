import { formatZodIssues } from "@/lib/api/zod-error";
import { hashRateLimitKey, rateLimit } from "@/lib/api/rate-limit";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { findClientForPortalLogin } from "@/application/use-cases/client/find-client-for-portal-login";
import { findActiveTenantBySlug } from "@/application/use-cases/auth/resolve-public-tenant";
import { runRequestPatientPortalOtp } from "@/application/use-cases/patient-portal/request-patient-portal-otp";
import {
  parsePortalLoginInput,
  portalLoginRateKey,
} from "@/domain/auth/patient-portal-login-identifier";
import { postPatientPortalOtpRequestBodySchema } from "@/lib/validators/patient-portal";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

function jsonSuccessOpaque() {
  return jsonSuccess({ ok: true });
}

export async function POST(request: Request, ctx: RouteCtx) {
  const ipLimited = await rateLimit("patientPortalPublicIp");
  if (ipLimited) return ipLimited;

  const apiT = await getApiT(request);
  const { tenantSlug: rawSlug } = await ctx.params;
  const tenantSlug = rawSlug.trim().toLowerCase();
  const tenant = await findActiveTenantBySlug(tenantSlug);
  if (!tenant) {
    return jsonSuccessOpaque();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postPatientPortalOtpRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const identifier = parsePortalLoginInput(parsed.data.login);
  if (!identifier) {
    return jsonError("VALIDATION_ERROR", apiT("errors.patientPortalLoginInvalid"), 422);
  }

  const identityLimited = await rateLimit(
    "patientPortalPublicIdentity",
    `pp-otpreq:${tenant.id}:${hashRateLimitKey(portalLoginRateKey(identifier))}`,
  );
  if (identityLimited) return identityLimited;

  const client = await findClientForPortalLogin(tenant.id, identifier);

  const result = await runRequestPatientPortalOtp({
    tenant: { id: tenant.id, name: tenant.name },
    client,
  });

  // `rate_limited` só ocorre quando o paciente existe: responder 429 vazaria a existência do CPF.
  // Mantém a resposta opaca (o código simplesmente não é enviado).
  if (result.kind === "service_unavailable") {
    return jsonError("SERVICE_UNAVAILABLE", apiT("errors.patientPortalMisconfigured"), 503);
  }

  return jsonSuccessOpaque();
}
