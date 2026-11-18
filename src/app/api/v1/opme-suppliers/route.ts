import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { formatZodIssues } from "@/lib/api/zod-error";
import { getCachedOpmeSuppliersPage } from "@/infrastructure/cache/cached-opme-suppliers-list";
import { runCreateOpmeSupplier } from "@/application/use-cases/opme/create-opme-supplier";
import { buildPagination } from "@/lib/api/pagination";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  opmeSuppliersListQuerySchema,
  postOpmeSupplierBodySchema,
} from "@/lib/validators/opme-supplier";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ request, tenantId }) => {
  const url = new URL(request.url);
  const parsed = opmeSuppliersListQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    includeInactive: url.searchParams.get("includeInactive") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const { limit, page, q, includeInactive } = parsed.data;

  const { data, totalItems } = await getCachedOpmeSuppliersPage({
    tenantId,
    limit,
    page,
    q,
    includeInactive,
  });

  return jsonSuccess({
    data,
    pagination: buildPagination(page, limit, totalItems),
  });
});

export const POST = withTenantRoute(async ({ request, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, postOpmeSupplierBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await runCreateOpmeSupplier({
    tenantId,
    name: parsed.data.name,
  });

  if (!result.ok) {
    return jsonError("CONFLICT", apiT("errors.opmeSupplierNameConflict"), 409);
  }

  return jsonSuccess(
    {
      supplier: result.supplier,
    },
    { status: 201 },
  );
}, { role: "admin" });
