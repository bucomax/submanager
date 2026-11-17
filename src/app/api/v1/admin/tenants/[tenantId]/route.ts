import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireSessionOr401, superAdminOr403 } from "@/lib/auth/guards";
import { patchAdminTenantBodySchema } from "@/lib/validators/tenant";
import { runPatchTenantActive } from "@/application/use-cases/admin/patch-tenant-active";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

/** Ativa/desativa tenant globalmente. Apenas `super_admin`. Ao desativar, remove contexto ativo de usuários presos a este tenant. */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const forbidden = await superAdminOr403(auth.session!, request, apiT);
  if (forbidden) return forbidden;

  const { tenantId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = patchAdminTenantBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const tenant = await runPatchTenantActive({ tenantId, isActive: parsed.data.isActive });
  if (!tenant) {
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }

  return jsonSuccess({ tenant });
}
