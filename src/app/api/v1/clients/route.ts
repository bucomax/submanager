import { logger } from "@/lib/observability/logger";
import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { CLIENT_REFERENCE_ERRORS } from "@/lib/api/error-tables/client";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { formatZodIssues } from "@/lib/api/zod-error";
import { jsonIfPrismaSchemaMismatch } from "@/lib/api/prisma-schema-error";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { validateClientOptionalRefs } from "@/application/use-cases/client/validate-client-references";
import { postClientBodySchema, runCreateClient } from "@/application/use-cases/client/create-client";
import { runListClientsPage } from "@/application/use-cases/client/list-clients-page";
import { clientsListQuerySchema } from "@/lib/validators/clients-list-query";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ request, session, tenantId, apiT }) => {
  try {
    const url = new URL(request.url);
    const parsed = clientsListQuerySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      pathwayId: url.searchParams.get("pathwayId") ?? undefined,
      stageId: url.searchParams.get("stageId") ?? undefined,
      status: url.searchParams.get("status") || undefined,
      fresh: url.searchParams.get("fresh") ?? undefined,
    });
    if (!parsed.success) {
      return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
    }

    const payload = await runListClientsPage({
      tenantId,
      actor: actorFromSession(session),
      query: parsed.data,
    });

    return jsonSuccess(payload);
  } catch (err) {
    logger.error("[GET /api/v1/clients]", { err });
    const schemaErr = jsonIfPrismaSchemaMismatch(err, apiT, "[GET /api/v1/clients]");
    if (schemaErr) return schemaErr;
    return jsonError("INTERNAL_ERROR", apiT("errors.internalError"), 500);
  }
});

export const POST = withTenantRoute(async ({ request, session, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, postClientBodySchema, apiT);
  if (parsed.response) return parsed.response;

  const refErr = await validateClientOptionalRefs(
    tenantId,
    {
      assignedToUserId: parsed.data.assignedToUserId,
      opmeSupplierId: parsed.data.opmeSupplierId,
    },
  );
  if (refErr) return mapUseCaseError(refErr, CLIENT_REFERENCE_ERRORS, apiT);

  const { client } = await runCreateClient({
    tenantId,
    actorUserId: session.user.id,
    data: parsed.data,
  });

  return jsonSuccess({ client }, { status: 201 });
});
