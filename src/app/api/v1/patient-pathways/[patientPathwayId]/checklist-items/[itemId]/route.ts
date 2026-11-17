import { formatZodIssues } from "@/lib/api/zod-error";
import { isPatientPathwayVisibleToSession } from "@/application/use-cases/shared/is-patient-pathway-visible";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { patchPatientChecklistItemBodySchema } from "@/lib/validators/patient-pathway-checklist";
import { runPatchPatientChecklistItem } from "@/application/use-cases/patient-pathway/patch-checklist-item";

export const dynamic = "force-dynamic";

import type { RouteCtx } from "@/types/api/route-context";

export async function PATCH(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = patchPatientChecklistItemBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const { patientPathwayId, itemId } = await ctx.params;

  if (!(await isPatientPathwayVisibleToSession(auth.session!, tenantCtx.tenantId, patientPathwayId))) {
    return jsonError("NOT_FOUND", apiT("errors.patientPathwayNotFound"), 404);
  }

  const result = await runPatchPatientChecklistItem({
    tenantId: tenantCtx.tenantId,
    actorUserId: auth.session!.user.id,
    patientPathwayId,
    itemId,
    body: parsed.data,
  });

  if (!result.ok) {
    if (result.code === "PP_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.patientPathwayNotFound"), 404);
    }
    if (result.code === "ITEM_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.checklistItemNotFound"), 404);
    }
    if (result.code === "WRONG_STAGE") {
      return jsonError("VALIDATION_ERROR", apiT("errors.checklistOnlyCurrentStage"), 422);
    }
    return jsonError("INTERNAL_ERROR", apiT("errors.internalError"), 500);
  }

  return jsonSuccess({
    item: result.item,
  });
}
