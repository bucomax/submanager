import { getApiT } from "@/lib/api/i18n";
import { jsonIfPrismaSchemaMismatch } from "@/lib/api/prisma-schema-error";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { joinTranslatedZodIssues } from "@/lib/api/zod-i18n";
import { validateClientOptionalRefs } from "@/application/use-cases/client/validate-client-references";
import { postClientBodySchema, runCreateClient } from "@/application/use-cases/client/create-client";
import { runListClientsPage } from "@/application/use-cases/client/list-clients-page";
import { clientsListQuerySchema } from "@/lib/validators/clients-list-query";

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
      return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
    }

    const payload = await runListClientsPage({
      tenantId,
      session: auth.session!,
      query: parsed.data,
    });

    return jsonSuccess(payload);
  } catch (err) {
    console.error("[GET /api/v1/clients]", err);
    const schemaErr = jsonIfPrismaSchemaMismatch(err, apiT, "[GET /api/v1/clients]");
    if (schemaErr) return schemaErr;
    if (err instanceof Error) console.error("[GET /api/v1/clients]", err.message);
    return jsonError("INTERNAL_ERROR", apiT("errors.internalError"), 500);
  }
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postClientBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      joinTranslatedZodIssues(parsed.error, apiT as (key: string) => string),
      422,
    );
  }

  const refErr = await validateClientOptionalRefs(
    tenantId,
    {
      assignedToUserId: parsed.data.assignedToUserId,
      opmeSupplierId: parsed.data.opmeSupplierId,
    },
    apiT,
  );
  if (refErr) return refErr;

  const { client } = await runCreateClient({
    tenantId,
    actorUserId: auth.session!.user.id,
    data: parsed.data,
  });

  return jsonSuccess({ client }, { status: 201 });
}
