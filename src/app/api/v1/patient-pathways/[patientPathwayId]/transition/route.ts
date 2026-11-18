import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { TRANSITION_STAGE_ERRORS } from "@/lib/api/error-tables/patient-pathway";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { after } from "next/server";

import { jsonError, jsonSuccess } from "@/lib/api-response";
import { loadTenantMembershipClientScope } from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  postStageTransitionBodySchema,
  runTransitionPatientStage,
} from "@/application/use-cases/pathway/transition-patient-stage";

export const dynamic = "force-dynamic";

export const POST = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const { patientPathwayId } = params;
  const actorUserId = session.user.id;

  const parsed = await parseJsonBody(request, postStageTransitionBodySchema, apiT);
  if (parsed.response) return parsed.response;

  const scope = await loadTenantMembershipClientScope(
    actorUserId,
    tenantId,
    session.user.globalRole,
  );

  const outcome = await runTransitionPatientStage({
    tenantId,
    actorUserId,
    patientPathwayId,
    input: parsed.data,
    clientVisibility: { scope, viewerUserId: actorUserId },
  });

  if (!outcome.ok) {
    if (outcome.code === "CHECKLIST_BLOCKED") {
      return jsonError(
        "CHECKLIST_REQUIRED_INCOMPLETE",
        apiT("errors.checklistRequiredIncomplete"),
        422,
        { pendingItems: outcome.pendingItems },
      );
    }
    return mapUseCaseError(outcome.code, TRANSITION_STAGE_ERRORS, apiT);
  }

  // Notificação/e-mail/WhatsApp pós-commit: roda após a resposta e a plataforma mantém a função viva.
  after(outcome.afterCommit);

  return jsonSuccess(outcome.data);
});
