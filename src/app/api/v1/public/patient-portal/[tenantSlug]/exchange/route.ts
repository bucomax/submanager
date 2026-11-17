import { createApiMeta } from "@/lib/api/envelope";
import { rateLimit } from "@/lib/api/rate-limit";
import { getApiT } from "@/lib/api/i18n";
import { jsonError } from "@/lib/api-response";
import { appendPatientPortalSessionCookie } from "@/lib/auth/patient-portal-session";
import { AuditEventType } from "@prisma/client";
import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { findActiveTenantBySlug } from "@/application/use-cases/auth/resolve-public-tenant";
import { runExchangePatientPortalMagicLink } from "@/application/use-cases/patient-portal/exchange-patient-portal-magic-link";
import { postPatientPortalExchangeBodySchema } from "@/lib/validators/patient-portal";
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
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postPatientPortalExchangeBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const result = await runExchangePatientPortalMagicLink({
    tenant: { id: tenant.id, slug: tenant.slug },
    token: parsed.data.token,
  });

  if (!result.ok) {
    return jsonError("UNAUTHORIZED", apiT("errors.patientPortalInvalidToken"), 401);
  }

  try {
    const res = NextResponse.json({
      success: true,
      data: { ok: true },
      meta: createApiMeta(),
    });
    appendPatientPortalSessionCookie(res, result.sessionPayload);
    await auditEventPrismaRepository.recordCanonical({
      tenantId: result.sessionPayload.tenantId,
      clientId: result.sessionPayload.clientId,
      patientPathwayId: null,
      actorUserId: null,
      eventType: AuditEventType.PATIENT_PORTAL_SESSION_CREATED,
      payload: { clientId: result.sessionPayload.clientId, method: "magic_link" },
    });
    return res;
  } catch (e) {
    console.error("[patient-portal] session cookie signing failed:", e);
    return jsonError(
      "SERVICE_UNAVAILABLE",
      apiT("errors.patientPortalMisconfigured"),
      503,
    );
  }
}
