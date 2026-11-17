import { after } from "next/server";

import { getApiT } from "@/lib/api/i18n";
import { joinTranslatedZodIssues } from "@/lib/api/zod-i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { loadTenantMembershipClientScope } from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  postStageTransitionBodySchema,
  runTransitionPatientStage,
} from "@/application/use-cases/pathway/transition-patient-stage";

export const dynamic = "force-dynamic";

import type { RouteCtx } from "@/types/api/route-context";

export async function POST(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const { patientPathwayId } = await ctx.params;
  const actorUserId = auth.session!.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postStageTransitionBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      joinTranslatedZodIssues(parsed.error, apiT as (key: string) => string),
      422,
    );
  }

  const scope = await loadTenantMembershipClientScope(
    actorUserId,
    tenantCtx.tenantId,
    auth.session!.user.globalRole,
  );

  const outcome = await runTransitionPatientStage({
    tenantId: tenantCtx.tenantId,
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
    switch (outcome.code) {
      case "PATIENT_PATHWAY_NOT_FOUND":
        return jsonError("NOT_FOUND", apiT("errors.patientPathwayInstanceNotFound"), 404);
      case "PATHWAY_ALREADY_COMPLETED":
        return jsonError("CONFLICT", apiT("errors.pathwayAlreadyCompleted"), 409);
      case "TARGET_STAGE_NOT_FOUND":
        return jsonError("NOT_FOUND", apiT("errors.invalidStageForVersion"), 404);
      case "ALREADY_IN_TARGET_STAGE":
        return jsonError("VALIDATION_ERROR", apiT("errors.patientAlreadyInStage"), 422);
      case "LOCK_CONFLICT":
      case "STAGE_CONFLICT":
        return jsonError("CONFLICT", apiT("errors.stageTransitionConflict"), 409);
    }
  }

  // Notificação/e-mail/WhatsApp pós-commit: roda após a resposta e a plataforma mantém a função viva.
  after(outcome.afterCommit);

  return jsonSuccess(outcome.data);
}
