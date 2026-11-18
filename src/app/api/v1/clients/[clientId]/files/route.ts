import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { formatZodIssues } from "@/lib/api/zod-error";
import { buildPagination } from "@/lib/api/pagination";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { listStaffClientFilesPage } from "@/application/use-cases/client/list-staff-client-files-page";
import { findTenantClientVisibleToActor } from "@/application/use-cases/shared/load-client-visibility-scope";
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

  const client = await findTenantClientVisibleToActor(actorFromSession(session), tenantId, clientId, {
    id: true,
  });
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  const { totalItems, data } = await listStaffClientFilesPage({
    tenantId,
    clientId,
    page,
    limit,
  });

  return jsonSuccess({
    data,
    pagination: buildPagination(page, limit, totalItems),
  });
});
