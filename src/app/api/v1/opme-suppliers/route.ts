import { formatZodIssues } from "@/lib/api/zod-error";
import { getCachedOpmeSuppliersPage } from "@/infrastructure/cache/cached-opme-suppliers-list";
import { runCreateOpmeSupplier } from "@/application/use-cases/opme/create-opme-supplier";
import { buildPagination } from "@/lib/api/pagination";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import {
  opmeSuppliersListQuerySchema,
  postOpmeSupplierBodySchema,
} from "@/lib/validators/opme-supplier";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

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
    tenantId: tenantCtx.tenantId,
    limit,
    page,
    q,
    includeInactive,
  });

  return jsonSuccess({
    data,
    pagination: buildPagination(page, limit, totalItems),
  });
}

export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const adminBlock = await assertTenantAdminOrSuper(auth.session!, tenantCtx.tenantId, request, apiT);
  if (adminBlock) return adminBlock;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postOpmeSupplierBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const result = await runCreateOpmeSupplier({
    tenantId: tenantCtx.tenantId,
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
}
