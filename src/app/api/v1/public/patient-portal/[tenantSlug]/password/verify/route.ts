import { formatZodIssues } from "@/lib/api/zod-error";
import { createApiMeta } from "@/lib/api/envelope";
import { getApiT } from "@/lib/api/i18n";
import { jsonError } from "@/lib/api-response";
import { hashRateLimitKey, rateLimit } from "@/lib/api/rate-limit";
import { appendPatientPortalSessionCookie } from "@/lib/auth/patient-portal-session";
import { AuditEventType } from "@prisma/client";
import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import {
  parsePortalLoginInput,
  portalLoginRateKey,
} from "@/domain/auth/patient-portal-login-identifier";
import { findActiveTenantBySlug } from "@/application/use-cases/auth/resolve-public-tenant";
import { runVerifyPatientPortalPassword } from "@/application/use-cases/patient-portal/verify-patient-portal-password";
import { postPatientPortalPasswordVerifyBodySchema } from "@/lib/validators/patient-portal";
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
    return jsonError("UNAUTHORIZED", apiT("errors.patientPortalPasswordInvalid"), 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postPatientPortalPasswordVerifyBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const identifier = parsePortalLoginInput(parsed.data.login);
  if (!identifier) {
    return jsonError("VALIDATION_ERROR", apiT("errors.patientPortalLoginInvalid"), 422);
  }

  const limited = await rateLimit(
    "patientPortalPassword",
    `pp-login-pw:${tenant.id}:${hashRateLimitKey(portalLoginRateKey(identifier))}`,
  );
  if (limited) return limited;

  const result = await runVerifyPatientPortalPassword({
    tenant: { id: tenant.id, slug: tenant.slug },
    identifier,
    password: parsed.data.password,
  });

  if (!result.ok) {
    if (result.reason === "client_not_found") {
      return jsonError("UNAUTHORIZED", apiT("errors.patientPortalPasswordInvalid"), 401);
    }
    const auditPayload =
      result.reason === "password_not_set"
        ? ({ reason: "password_not_set" } as const)
        : ({ reason: "invalid_password" } as const);
    if (result.client) {
      void auditEventPrismaRepository
        .recordCanonical({
          tenantId: tenant.id,
          clientId: result.client.id,
          patientPathwayId: null,
          actorUserId: null,
          eventType: AuditEventType.PATIENT_PORTAL_LOGIN_FAILED,
          payload: auditPayload,
        })
        .catch((err: unknown) => {
          // Sem PII: só ids internos e causa.
          console.error("[patient-portal] failed-login audit not recorded", {
            tenantId: tenant.id,
            clientId: result.client?.id,
            reason: auditPayload.reason,
            error: err instanceof Error ? err.message : "unknown",
          });
        });
    }
    return jsonError("UNAUTHORIZED", apiT("errors.patientPortalPasswordInvalid"), 401);
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
      clientId: result.sessionPayload.clientId,
      patientPathwayId: null,
      actorUserId: null,
      eventType: AuditEventType.PATIENT_PORTAL_SESSION_CREATED,
      payload: { clientId: result.sessionPayload.clientId, method: "password" },
    });
    return res;
  } catch (e) {
    console.error("[patient-portal] password session cookie signing failed:", e);
    return jsonError("SERVICE_UNAVAILABLE", apiT("errors.patientPortalMisconfigured"), 503);
  }
}
