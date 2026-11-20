import { logger } from "@/lib/observability/logger";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { createApiMeta } from "@/lib/api/envelope";
import { hashRateLimitKey, rateLimit } from "@/lib/api/rate-limit";
import { getApiT } from "@/lib/api/i18n";
import { jsonError } from "@/lib/api-response";
import {
  appendPatientPortalSessionCookie,
} from "@/lib/auth/patient-portal-session";
import { AuditEventType } from "@prisma/client";
import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { findClientForPortalLogin } from "@/application/use-cases/client/find-client-for-portal-login";
import { findActiveTenantBySlug } from "@/application/use-cases/auth/resolve-public-tenant";
import { runVerifyPatientPortalOtp } from "@/application/use-cases/patient-portal/verify-patient-portal-otp";
import {
  parsePortalLoginInput,
  portalLoginRateKey,
} from "@/domain/auth/patient-portal-login-identifier";
import { postPatientPortalOtpVerifyBodySchema } from "@/lib/validators/patient-portal";
import { NextResponse } from "next/server";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: RouteCtx) {
  const ipLimited = await rateLimit("patientPortalPublicIp");
  if (ipLimited) return ipLimited;

  const apiT = await getApiT(request);
  const { tenantSlug: rawSlug } = await ctx.params;
  const tenantSlug = rawSlug.trim().toLowerCase();
  const tenant = await findActiveTenantBySlug(tenantSlug);
  if (!tenant) {
    return jsonError("UNAUTHORIZED", apiT("errors.patientPortalOtpInvalid"), 401);
  }

  const parsed = await parseJsonBody(request, postPatientPortalOtpVerifyBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const identifier = parsePortalLoginInput(parsed.data.login);
  if (!identifier) {
    return jsonError("VALIDATION_ERROR", apiT("errors.patientPortalLoginInvalid"), 422);
  }

  const identityLimited = await rateLimit(
    "patientPortalOtpVerify",
    `pp-otpver:${tenant.id}:${hashRateLimitKey(portalLoginRateKey(identifier))}`,
  );
  if (identityLimited) return identityLimited;

  // `client` nulo segue pelo use case (mesmo custo/resposta de código inválido): sem oráculo de CPF por tempo.
  const client = await findClientForPortalLogin(tenant.id, identifier);

  const result = await runVerifyPatientPortalOtp({
    tenant: { id: tenant.id, slug: tenant.slug },
    client,
    code: parsed.data.code,
  });

  if (!result.ok || !client) {
    return jsonError("UNAUTHORIZED", apiT("errors.patientPortalOtpInvalid"), 401);
  }

  try {
    const res = NextResponse.json({
      success: true,
      data: { ok: true },
      meta: createApiMeta(),
    });
    appendPatientPortalSessionCookie(res, result.sessionPayload);
    await auditEventPrismaRepository.recordCanonical({
      tenantId: tenant.id,
      clientId: client.id,
      patientPathwayId: null,
      actorUserId: null,
      eventType: AuditEventType.PATIENT_PORTAL_SESSION_CREATED,
      payload: { clientId: client.id, method: "otp" },
    });
    return res;
  } catch (e) {
    logger.error("[patient-portal] OTP session cookie signing failed", { err: e });
    return jsonError(
      "SERVICE_UNAVAILABLE",
      apiT("errors.patientPortalMisconfigured"),
      503,
    );
  }
}
