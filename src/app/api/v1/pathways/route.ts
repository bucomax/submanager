import { formatZodIssues } from "@/lib/api/zod-error";
import { getCachedPathwaysList } from "@/infrastructure/cache/cached-pathways-list";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { postPathwayBodySchema } from "@/lib/validators/pathway";
import { runCreateCarePathway } from "@/application/use-cases/pathway/create-care-pathway";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const ctx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (ctx.response) return ctx.response;
  const { tenantId } = ctx;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantId, request, apiT);
  if (forbidden) return forbidden;

  const data = await getCachedPathwaysList(tenantId);
  return jsonSuccess(data);
}

export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const ctx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (ctx.response) return ctx.response;
  const { tenantId } = ctx;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantId, request, apiT);
  if (forbidden) return forbidden;
  const adminErr = await assertTenantAdminOrSuper(
    auth.session!,
    tenantId,
    request,
    apiT,
    "errors.managePathwaysPermissionDenied",
  );
  if (adminErr) return adminErr;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postPathwayBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const pathway = await runCreateCarePathway({
    tenantId,
    name: parsed.data.name,
    description: parsed.data.description,
  });

  return jsonSuccess(
    {
      pathway,
    },
    { status: 201 },
  );
}
