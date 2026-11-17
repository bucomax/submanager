import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { findTenantClientVisibleToSession } from "@/application/use-cases/shared/load-client-visibility-scope";
import { runCreateClientPortalLink } from "@/application/use-cases/client/create-client-portal-link";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { postClientPortalLinkBodySchema } from "@/lib/validators/patient-portal";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const { tenantId } = tenantCtx;

  const forbidden = await assertActiveTenantMembership(auth.session!, tenantId, request, apiT);
  if (forbidden) return forbidden;

  const { clientId } = await ctx.params;

  const client = await findTenantClientVisibleToSession(auth.session!, tenantId, clientId, {
    id: true,
    name: true,
    email: true,
  });
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as unknown;
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postClientPortalLinkBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const sendEmailFlag = parsed.data.sendEmail !== false;
  const email = client.email?.trim() ?? "";

  if (sendEmailFlag && !email) {
    return jsonError("VALIDATION_ERROR", apiT("errors.patientPortalEmailRequired"), 422);
  }

  const result = await runCreateClientPortalLink({
    tenantId,
    actorUserId: auth.session!.user.id,
    client,
    sendEmailFlag,
  });

  if (!result.ok) {
    if (result.code === "TENANT_SLUG_MISSING") {
      return jsonError("SERVICE_UNAVAILABLE", apiT("errors.tenantNotFound"), 503);
    }
    if (result.code === "EMAIL_NOT_CONFIGURED") {
      return jsonError("SERVICE_UNAVAILABLE", apiT("errors.invitesNotConfigured"), 503);
    }
    return jsonError("SERVICE_UNAVAILABLE", apiT("errors.emailSendFailedGeneric"), 503);
  }

  return jsonSuccess(result.data, { status: 201 });
}
