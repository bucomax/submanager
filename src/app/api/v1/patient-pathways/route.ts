import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { CREATE_PATIENT_PATHWAY_ERRORS } from "@/lib/api/error-tables/patient-pathway";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { after } from "next/server";

import { getCachedPatientPathwaysList } from "@/infrastructure/cache/cached-patient-pathways-list";
import { jsonSuccess } from "@/lib/api-response";
import { loadTenantMembershipClientScope } from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  runCreatePatientPathway,
  postPatientPathwayBodySchema,
} from "@/application/use-cases/patient-pathway/create-patient-pathway";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ session, tenantId }) => {
  const scope = await loadTenantMembershipClientScope(
    session.user.id,
    tenantId,
    session.user.globalRole,
  );

  const data = await getCachedPatientPathwaysList({
    tenantId,
    viewerUserId: session.user.id,
    globalRole: session.user.globalRole,
    scope,
  });

  return jsonSuccess(data);
});

export const POST = withTenantRoute(async ({ request, session, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, postPatientPathwayBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const { clientId, pathwayId } = parsed.data;

  const outcome = await runCreatePatientPathway({
    tenantId,
    actorUserId: session.user.id,
    actor: actorFromSession(session),
    clientId,
    pathwayId,
  });

  if (!outcome.ok) {
    return mapUseCaseError(outcome.code, CREATE_PATIENT_PATHWAY_ERRORS, apiT);
  }

  after(outcome.afterCommit);

  return jsonSuccess(outcome.data, { status: 201 });
});
