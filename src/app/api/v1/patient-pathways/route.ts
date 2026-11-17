import { after } from "next/server";

import { formatZodIssues } from "@/lib/api/zod-error";
import { getCachedPatientPathwaysList } from "@/infrastructure/cache/cached-patient-pathways-list";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { loadTenantMembershipClientScope } from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import {
  runCreatePatientPathway,
  postPatientPathwayBodySchema,
} from "@/application/use-cases/patient-pathway/create-patient-pathway";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const ctx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (ctx.response) return ctx.response;
  const { tenantId } = ctx;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantId, request, apiT);
  if (forbidden) return forbidden;

  const scope = await loadTenantMembershipClientScope(
    auth.session!.user.id,
    tenantId,
    auth.session!.user.globalRole,
  );

  const data = await getCachedPatientPathwaysList({
    tenantId,
    viewerUserId: auth.session!.user.id,
    globalRole: auth.session!.user.globalRole,
    scope,
  });

  return jsonSuccess(data);
}

export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const ctx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (ctx.response) return ctx.response;
  const { tenantId } = ctx;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantId, request, apiT);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postPatientPathwayBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const { clientId, pathwayId } = parsed.data;

  const outcome = await runCreatePatientPathway({
    tenantId,
    actorUserId: auth.session!.user.id,
    session: auth.session!,
    clientId,
    pathwayId,
  });

  if (!outcome.ok) {
    switch (outcome.code) {
      case "CLIENT_NOT_FOUND":
        return jsonError("NOT_FOUND", apiT("errors.patientNotFoundInTenant"), 404);
      case "ACTIVE_PATHWAY_EXISTS":
        return jsonError("CONFLICT", apiT("errors.patientAlreadyInJourney"), 409);
      case "PATHWAY_NOT_FOUND":
        return jsonError("NOT_FOUND", apiT("errors.pathwayNotFound"), 404);
      case "NO_PUBLISHED_VERSION":
        return jsonError("CONFLICT", apiT("errors.noPublishedVersionWithStages"), 409);
    }
  }

  after(outcome.afterCommit);

  return jsonSuccess(outcome.data, { status: 201 });
}
