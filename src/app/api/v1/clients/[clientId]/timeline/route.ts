import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { formatZodIssues } from "@/lib/api/zod-error";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { findTenantClientVisibleToActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import { loadStaffClientTimelinePage } from "@/application/use-cases/client/load-staff-client-timeline-page";
import { clientTimelineQuerySchema } from "@/lib/validators/client-timeline-query";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const url = new URL(request.url);
  const parsedQ = clientTimelineQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    categories: url.searchParams.get("categories") ?? undefined,
  });
  if (!parsedQ.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsedQ.error), 422);
  }

  const { clientId } = params;
  const { page, limit, categories } = parsedQ.data;

  const client = await findTenantClientVisibleToActor(actorFromSession(session), tenantId, clientId, {
    id: true,
  });
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFoundInTenant"), 404);
  }

  const categoryFilter =
    categories != null && categories.length > 0 ? new Set(categories) : null;

  const data = await loadStaffClientTimelinePage({
    tenantId,
    clientId,
    page,
    limit,
    categoryFilter,
  });
  return jsonSuccess(data);
});
