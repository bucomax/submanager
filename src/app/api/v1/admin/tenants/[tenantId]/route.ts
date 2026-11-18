import { withSessionRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { patchAdminTenantBodySchema } from "@/lib/validators/tenant";
import { runPatchTenantActive } from "@/application/use-cases/admin/patch-tenant-active";

export const dynamic = "force-dynamic";

/** Ativa/desativa tenant globalmente. Apenas `super_admin`. Ao desativar, remove contexto ativo de usuários presos a este tenant. */
export const PATCH = withSessionRoute(async ({ request, apiT, params }) => {
  const { tenantId } = params;

  const parsed = await parseJsonBody(request, patchAdminTenantBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const tenant = await runPatchTenantActive({ tenantId, isActive: parsed.data.isActive });
  if (!tenant) {
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }

  return jsonSuccess({ tenant });
}, { role: "super_admin" });
