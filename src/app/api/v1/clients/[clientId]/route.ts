import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { joinTranslatedZodIssues } from "@/lib/api/zod-i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { findTenantClientVisibleToSession } from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { loadClientDetailResponseData } from "@/application/use-cases/client/load-client-detail";
import { validateClientOptionalRefs } from "@/application/use-cases/client/validate-client-references";
import { runDeleteClient } from "@/application/use-cases/client/delete-client";
import { patchClientBodySchema, runUpdateClient } from "@/application/use-cases/client/update-client";
import { clientDetailQuerySchema } from "@/lib/validators/client-detail-query";

export const dynamic = "force-dynamic";

import type { RouteCtx } from "@/types/api/route-context";

export async function GET(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const parsedQ = clientDetailQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsedQ.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsedQ.error), 422);
  }
  const { page, limit } = parsedQ.data;

  const { clientId } = await ctx.params;

  const row = await findTenantClientVisibleToSession(auth.session!, tenantCtx.tenantId, clientId, {
    id: true,
    name: true,
    phone: true,
    email: true,
    caseDescription: true,
    documentId: true,
    postalCode: true,
    addressLine: true,
    addressNumber: true,
    addressComp: true,
    neighborhood: true,
    city: true,
    state: true,
    isMinor: true,
    birthDate: true,
    guardianName: true,
    guardianDocumentId: true,
    guardianPhone: true,
    guardianEmail: true,
    guardianRelationship: true,
    emergencyContactName: true,
    emergencyContactPhone: true,
    preferredChannel: true,
    assignedToUserId: true,
    opmeSupplierId: true,
    createdAt: true,
    updatedAt: true,
    assignedTo: { select: { id: true, name: true, email: true } },
    opmeSupplier: { select: { id: true, name: true } },
  });

  if (!row) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  const payload = await loadClientDetailResponseData(tenantCtx.tenantId, row, page, limit);
  return jsonSuccess(payload);
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const { clientId } = await ctx.params;
  const existing = await findTenantClientVisibleToSession(auth.session!, tenantCtx.tenantId, clientId, {
    id: true,
    tenantId: true,
  });
  if (!existing) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = patchClientBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      joinTranslatedZodIssues(parsed.error, apiT as (key: string) => string),
      422,
    );
  }

  const refErr = await validateClientOptionalRefs(
    tenantCtx.tenantId,
    {
      assignedToUserId: parsed.data.assignedToUserId === undefined ? undefined : parsed.data.assignedToUserId,
      opmeSupplierId: parsed.data.opmeSupplierId === undefined ? undefined : parsed.data.opmeSupplierId,
    },
    apiT,
  );
  if (refErr) return refErr;

  const updated = await runUpdateClient({
    tenantId: tenantCtx.tenantId,
    actorUserId: auth.session!.user.id,
    clientDbId: existing.id,
    patch: parsed.data,
  });

  if (!updated.ok) {
    return jsonError("VALIDATION_ERROR", apiT("errors.noFieldsToUpdate"), 422);
  }

  return jsonSuccess({
    client: updated.client,
  });
}

export async function DELETE(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const { clientId } = await ctx.params;
  const existing = await findTenantClientVisibleToSession(auth.session!, tenantCtx.tenantId, clientId, {
    id: true,
  });
  if (!existing) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  const deleted = await runDeleteClient({
    tenantId: tenantCtx.tenantId,
    actorUserId: auth.session!.user.id,
    clientDbId: existing.id,
    isSuperAdmin: auth.session!.user.globalRole === "super_admin",
  });

  if (!deleted.ok) {
    if (deleted.code === "FORBIDDEN") {
      return jsonError("FORBIDDEN", apiT("errors.deletePatientForbidden"), 403);
    }
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  return jsonSuccess({ message: apiT("success.clientRemoved") });
}
