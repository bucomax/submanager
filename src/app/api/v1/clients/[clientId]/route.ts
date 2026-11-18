import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { CLIENT_DELETE_ERRORS, CLIENT_REFERENCE_ERRORS } from "@/lib/api/error-tables/client";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { formatZodIssues } from "@/lib/api/zod-error";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { findTenantClientVisibleToActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import { loadClientDetailResponseData } from "@/application/use-cases/client/load-client-detail";
import { validateClientOptionalRefs } from "@/application/use-cases/client/validate-client-references";
import { runDeleteClient } from "@/application/use-cases/client/delete-client";
import { patchClientBodySchema, runUpdateClient } from "@/application/use-cases/client/update-client";
import { clientDetailQuerySchema } from "@/lib/validators/client-detail-query";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const url = new URL(request.url);
  const parsedQ = clientDetailQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsedQ.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsedQ.error), 422);
  }
  const { page, limit } = parsedQ.data;

  const { clientId } = params;

  const row = await findTenantClientVisibleToActor(actorFromSession(session), tenantId, clientId, {
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

  const payload = await loadClientDetailResponseData(tenantId, row, page, limit);
  return jsonSuccess(payload);
});

export const PATCH = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const { clientId } = params;
  const existing = await findTenantClientVisibleToActor(actorFromSession(session), tenantId, clientId, {
    id: true,
    tenantId: true,
  });
  if (!existing) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  const parsed = await parseJsonBody(request, patchClientBodySchema, apiT);
  if (parsed.response) return parsed.response;

  const refErr = await validateClientOptionalRefs(
    tenantId,
    {
      assignedToUserId: parsed.data.assignedToUserId === undefined ? undefined : parsed.data.assignedToUserId,
      opmeSupplierId: parsed.data.opmeSupplierId === undefined ? undefined : parsed.data.opmeSupplierId,
    },
  );
  if (refErr) return mapUseCaseError(refErr, CLIENT_REFERENCE_ERRORS, apiT);

  const updated = await runUpdateClient({
    tenantId,
    actorUserId: session.user.id,
    clientDbId: existing.id,
    patch: parsed.data,
  });

  if (!updated.ok) {
    return jsonError("VALIDATION_ERROR", apiT("errors.noFieldsToUpdate"), 422);
  }

  return jsonSuccess({
    client: updated.client,
  });
});

export const DELETE = withTenantRoute(async ({ session, tenantId, apiT, params }) => {
  const { clientId } = params;
  const existing = await findTenantClientVisibleToActor(actorFromSession(session), tenantId, clientId, {
    id: true,
  });
  if (!existing) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  const deleted = await runDeleteClient({
    tenantId,
    actorUserId: session.user.id,
    clientDbId: existing.id,
    isSuperAdmin: session.user.globalRole === "super_admin",
  });

  if (!deleted.ok) {
    return mapUseCaseError(deleted.code, CLIENT_DELETE_ERRORS, apiT);
  }

  return jsonSuccess({ message: apiT("success.clientRemoved") });
});
